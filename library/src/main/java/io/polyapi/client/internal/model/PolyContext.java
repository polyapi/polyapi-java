package io.polyapi.client.internal.model;

import io.polyapi.client.api.model.function.AudienceTokenAuthFunction;
import io.polyapi.client.api.model.function.PolyApiFunction;
import io.polyapi.client.api.model.function.PolyCustomFunction;
import io.polyapi.client.api.model.function.PolyServerFunction;
import io.polyapi.client.api.model.function.SubresourceAuthFunction;
import io.polyapi.client.api.model.function.TokenAuthFunction;
import io.polyapi.client.api.model.variable.ServerVariableHandler;
import io.polyapi.client.internal.proxy.PolyProxyFactory;
import io.polyapi.client.internal.proxy.WebhookHandle;
import io.polyapi.client.internal.proxy.WebhookHandlerFactory;
import io.polyapi.client.internal.service.InvocationServiceImpl;
import io.polyapi.client.internal.service.VariableInjectionServiceImpl;
import io.polyapi.client.internal.websocket.WebSocketClient;
import io.polyapi.commons.api.error.PolyApiException;
import io.polyapi.commons.api.http.HttpClient;
import io.polyapi.commons.api.json.JsonParser;
import io.polyapi.commons.internal.http.DefaultHttpClient;
import io.polyapi.commons.internal.http.HardcodedTokenProvider;
import io.polyapi.commons.internal.json.JacksonJsonParser;

import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.util.Optional;
import java.util.Properties;

public class PolyContext {
    private final PolyProxyFactory proxyFactory;
    private final WebhookHandlerFactory webhookHandlerFactory;

    public PolyContext() {
        this(Optional.of(new Properties())
                .map(properties -> {
                    try {
                        properties.load(PolyContext.class.getResourceAsStream("/poly.properties"));
                        return new PolyContextConfiguration(properties);
                    } catch (IOException e) {
                        throw new PolyApiException(e);
                    }
                }).orElseThrow(PolyApiException::new), new JacksonJsonParser());
    }

    private PolyContext(PolyContextConfiguration config, JsonParser jsonParser) {
        this(config.getHost(), config.getPort(), config.getClientId(), new DefaultHttpClient(new HardcodedTokenProvider(config.getApiKey()), config.getConnectionTimeoutMillis(), config.getReadTimeoutMillis(), config.getWriteTimeoutMillis()), new WebSocketClient(config.getHost(), config.getPort(), config.getClientId(), new HardcodedTokenProvider(config.getApiKey())), jsonParser);
    }

    private PolyContext(String host, Integer port, String clientId, HttpClient httpClient, WebSocketClient webSocketClient, JsonParser jsonParser) {
        this(new PolyProxyFactory(new InvocationServiceImpl(host, port, clientId, httpClient, jsonParser, webSocketClient, new VariableInjectionServiceImpl())), new WebhookHandlerFactory(webSocketClient, jsonParser));
    }

    public PolyContext(PolyProxyFactory proxyFactory, WebhookHandlerFactory webhookHandlerFactory) {
        this.proxyFactory = proxyFactory;
        this.webhookHandlerFactory = webhookHandlerFactory;
    }

    protected <T extends PolyServerFunction> T createServerFunctionProxy(Class<T> polyInterface) {
        return proxyFactory.createServerFunctionProxy(polyInterface);
    }

    protected <T extends PolyApiFunction> T createApiFunctionProxy(Class<T> polyInterface) {
        return proxyFactory.createApiFunctionProxy(polyInterface);
    }

    protected <T extends PolyCustomFunction> T createCustomFunctionProxy(Class<T> polyInterface) {
        return proxyFactory.createCustomVariableProxy(polyInterface);
    }

    protected <T, H extends ServerVariableHandler<T>> H createServerVariableHandler(Class<H> polyInterface) {
        return proxyFactory.createServerVariableHandler(polyInterface);
    }

    protected <T> T createServerVariableProxy(String type, String packageName) {
        return proxyFactory.createServerVariableProxy(type, packageName);
    }

    protected <T extends WebhookHandle> T createWebhookHandle(Class<T> polyInterface) {
        return webhookHandlerFactory.create(polyInterface);
    }

    protected <T extends TokenAuthFunction> T createTokenAuthFunction(Class<T> polyInterface) {
        return proxyFactory.createTokenAuthProxy(polyInterface);
    }

    protected <T extends AudienceTokenAuthFunction> T createAudienceTokenAuthFunction(Class<T> polyInterface) {
        return proxyFactory.createAudienceTokenAuthProxy(polyInterface);
    }

    protected <T extends SubresourceAuthFunction> T createSubresourceAuthFunction(Class<T> polyInterface) {
        return proxyFactory.createSubresourceAuthProxy(polyInterface);
    }

    protected <T extends PolyContext> T createSubContext(Class<T> polyContextType) {
        try {
            return polyContextType.getDeclaredConstructor(PolyProxyFactory.class, WebhookHandlerFactory.class).newInstance(proxyFactory, webhookHandlerFactory);
        } catch (InstantiationException | IllegalAccessException | InvocationTargetException |
                 NoSuchMethodException e) {
            // FIXME: Throw appropriate exception.
            throw new PolyApiException(e);
        }
    }
}
