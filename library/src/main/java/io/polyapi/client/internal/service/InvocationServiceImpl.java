package io.polyapi.client.internal.service;

import io.polyapi.client.api.ApiFunctionResponse;
import io.polyapi.client.api.AuthTokenEventConsumer;
import io.polyapi.client.api.AuthTokenOptions;
import io.polyapi.client.api.GetAuthTokenResponse;
import io.polyapi.client.api.model.PolyMetadata;
import io.polyapi.client.api.model.function.PolyAuthSubresource;
import io.polyapi.client.error.generation.GeneratedClassInstantiationException;
import io.polyapi.client.error.generation.GeneratedClassNotFoundException;
import io.polyapi.client.error.generation.MissingDefaultConstructorException;
import io.polyapi.client.error.invocation.delegate.DelegateExecutionException;
import io.polyapi.client.error.invocation.delegate.InvalidMethodDeclarationException;
import io.polyapi.client.internal.websocket.WebSocketClient;
import io.polyapi.commons.api.error.PolyApiException;
import io.polyapi.commons.api.error.http.UnexpectedHttpResponseException;
import io.polyapi.commons.api.http.HttpClient;
import io.polyapi.commons.api.http.ResponseRecord;
import io.polyapi.commons.api.json.JsonParser;
import io.polyapi.commons.api.model.FunctionType;
import io.polyapi.commons.api.model.PolyFunction;
import io.polyapi.commons.api.service.PolyApiService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Type;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static com.fasterxml.jackson.databind.type.TypeFactory.defaultInstance;
import static io.polyapi.commons.api.model.FunctionType.CLIENT;
import static java.lang.String.format;
import static java.util.function.Predicate.not;

public class InvocationServiceImpl extends PolyApiService implements InvocationService {
    private static final Logger logger = LoggerFactory.getLogger(InvocationServiceImpl.class);
    private final WebSocketClient webSocketClient;
    private final String clientId;
    private final JsonParser jsonParser;
    private final VariableInjectionService variableInjectionService;

    public InvocationServiceImpl(String host, Integer port, String clientId, HttpClient client, JsonParser jsonParser, WebSocketClient webSocketClient, VariableInjectionService variableInjectionService) {
        super(host, port, client, jsonParser);
        this.clientId = clientId;
        this.jsonParser = jsonParser;
        this.webSocketClient = webSocketClient;
        this.variableInjectionService = variableInjectionService;
    }

    @Override
    public <T> T invokeServerFunction(Class<?> invokingClass, String id, Map<String, Object> body, Type expectedResponseType) {
        return invokeFunction("server", id, body, expectedResponseType);
    }

    @Override
    public <T> T invokeApiFunction(Class<?> invokingClass, String id, Map<String, Object> body, Type expectedResponseType) {
        ApiFunctionResponse<T> response = invokeFunction("API", id, body, defaultInstance().constructParametricType(ApiFunctionResponse.class, defaultInstance().constructType(expectedResponseType)));
        if (response.getStatus() < 200 || response.getStatus() >= 400) {
            throw new UnexpectedHttpResponseException(new ResponseRecord(response.getHeaders().entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, entry -> List.of(entry.getValue()))), Optional.ofNullable(response.getData()).map(jsonParser::toJsonInputStream).orElse(null), response.getStatus()));
        }

        return response.getData();
    }

    @Override
    public <T> T invokeCustomFunction(Class<?> invokingClass, String id, Map<String, Object> body, Type expectedResponseType) {
        try {
            var delegateClass = Class.forName(format("%s.delegate.%s", invokingClass.getPackageName(), Optional.ofNullable(invokingClass.getDeclaredAnnotation(PolyMetadata.class)).map(PolyMetadata::delegate).filter(not(String::isBlank)).orElseGet(invokingClass::getSimpleName)));
            Object delegate;
            try {
                delegate = delegateClass.getConstructor().newInstance();
            } catch (NoSuchMethodException e) {
                throw new MissingDefaultConstructorException(invokingClass.getName(), e);
            } catch (InvocationTargetException | IllegalAccessException | InstantiationException e) {
                throw new GeneratedClassInstantiationException(invokingClass.getName(), e);
            }
            var method = Stream.of(invokingClass.getDeclaredMethods()).findFirst()
                    .orElseThrow(() -> new PolyApiException());
            try {
                return (T) Arrays.stream(delegateClass.getDeclaredMethods())
                        .filter(declaredMethod ->
                                Optional.ofNullable(declaredMethod.getDeclaredAnnotation(PolyFunction.class))
                                        .filter(annotation -> annotation.type().equals(CLIENT))
                                        .filter(not(annotation -> annotation.name().isBlank()))
                                        .filter(annotation -> annotation.name().equalsIgnoreCase(method.getName()))
                                        .isPresent())
                        .filter(declaredMethod -> declaredMethod.getParameterTypes().equals(method.getParameterTypes()))
                        .findFirst()
                        .orElseGet(() -> {
                            try {
                                return delegateClass.getDeclaredMethod(method.getName(), method.getParameterTypes());
                            } catch (NoSuchMethodException e) {
                                throw new InvalidMethodDeclarationException(invokingClass, e);
                            }
                        })
                        .invoke(delegate, body.values().toArray());
            } catch (IllegalAccessException e) {
                throw new InvalidMethodDeclarationException(invokingClass, e);
            } catch (InvocationTargetException e) {
                throw new DelegateExecutionException(invokingClass, e);
            }
        } catch (
                ClassNotFoundException e) {
            throw new GeneratedClassNotFoundException(invokingClass.getName(), e);
        }
    }

    @Override
    public Void invokeAuthFunction(Class<?> invokingClass, String id, Map<String, Object> body, Type expectedResponseType) {
        try {
            AuthTokenEventConsumer callback = AuthTokenEventConsumer.class.cast(body.remove("callback"));
            AuthTokenOptions options = AuthTokenOptions.class.cast(body.remove("options"));
            body.put("eventsClientId", clientId);
            Optional.ofNullable(options).ifPresent(presentOptions -> {
                body.put("userId", options.getUserId());
                body.put("callbackUrl", options.getCallbackUrl());
            });
            Optional<AuthTokenOptions> optionalOptions = Optional.ofNullable(options);
            GetAuthTokenResponse data = post(format("auth-providers/%s/execute", id), replace(body), GetAuthTokenResponse.class);
            if (data.getToken() == null) {
                if (data.getUrl() == null || !optionalOptions.map(AuthTokenOptions::getAutoCloseOnUrl).orElse(false)) {
                    webSocketClient.registerAuthFunctionEventHandler(id, objects -> {
                        try {
                            GetAuthTokenResponse event = jsonParser.parseString(objects[0].toString(), GetAuthTokenResponse.class);
                            if (event.getToken() != null) {
                                callback.accept(event.getToken(), event.getUrl(), event.getError());
                                if (optionalOptions.map(AuthTokenOptions::getAutoCloseOnToken).orElse(true)) {
                                    webSocketClient.unregisterAuthFunctionEventHandler(id);
                                }
                            }
                        } catch (RuntimeException e) {
                            throw new PolyApiException(e);
                        }
                    });
                    callback.accept(data.getToken(), data.getUrl(), data.getError());

                    // FIXME: This will always unregister the event handler and indicate that the timeout has been reached.
                    var timeout = optionalOptions.map(AuthTokenOptions::getTimeout).orElse(120_000);
                    if (timeout > 0) {
                        new Timer().schedule(new TimerTask() {
                            @Override
                            public void run() {
                                webSocketClient.unregisterAuthFunctionEventHandler(id);
                                callback.accept(null, null, format("Timeout reached for auth function %s.", id));
                            }
                        }, timeout);
                    }
                } else {
                    callback.accept(null, data.getUrl(), null);
                }
            } else {
                callback.accept(data.getToken(), data.getUrl(), null);
            }
            return null;
        } catch (RuntimeException e) {
            // FIXME: Throw the appropriate exception.
            throw new PolyApiException(e);
        }
    }

    private <T> T invokeFunction(String type, String id, Map<String, Object> body, Type expectedResponseType) {
        logger.debug("Invoking Poly {} function with ID {}.", type, id);
        var result = super.<Map<String, Object>, T>post(format("functions/%s/%s/execute", type.toLowerCase(), id), replace(body), expectedResponseType);
        logger.debug("Function successfully executed. Returning result as {}.", expectedResponseType.getTypeName());
        return result;
    }

    @Override
    public <T> T injectVariable(String id, String packageName, String type) {
        return variableInjectionService.inject(id, packageName, type);
    }

    @Override
    public <T> T getVariable(String id, Type expectedResponseType) {
        logger.debug("Retrieving variable of type {} with ID {}.", expectedResponseType.getTypeName(), id);
        return get(format("variables/%s/value", id), expectedResponseType);
    }

    @Override
    public <T> void updateVariable(String id, T entity) {
        logger.debug("Updating variable with ID {}.", id);
        patch(format("variables/%s", id), entity);
        logger.debug("Update successful.");
    }

    @Override
    public Void invokeSubresourceAuthFunction(Class<?> invokingClass, String id, Map<String, Object> body, Type expectedResponseType) {
        body.put("clientID", clientId);
        post(format("auth-providers/%s/%s", id, invokingClass.getDeclaredAnnotation(PolyAuthSubresource.class).value()), replace(body), expectedResponseType);
        return null;
    }

    private Map<String, Object> replace(Map<String, Object> body) {
        return body.entrySet().stream().collect(Collectors.<Map.Entry<String, Object>, String, Object>toMap(Map.Entry::getKey, entry -> variableInjectionService.replace(entry.getKey(), entry.getValue())));
    }

}
