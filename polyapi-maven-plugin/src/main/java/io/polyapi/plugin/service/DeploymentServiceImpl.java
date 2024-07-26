package io.polyapi.plugin.service;

import io.polyapi.commons.api.error.http.HttpResponseException;
import io.polyapi.commons.api.http.HttpClient;
import io.polyapi.commons.api.json.JsonParser;
import io.polyapi.commons.api.model.PolyFunctionAnnotationRecord;
import io.polyapi.commons.api.model.PolyServerFunction;
import io.polyapi.commons.api.model.RequiredDependencies;
import io.polyapi.commons.api.model.RequiredDependency;
import io.polyapi.plugin.error.PolyApiMavenPluginException;
import io.polyapi.plugin.error.deploy.DeploymentWrapperException;
import io.polyapi.plugin.model.function.CodeObject;
import io.polyapi.plugin.model.function.PolyFunction;
import io.polyapi.plugin.model.function.PolyFunctionArgument;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.IOUtils;

import java.io.FileInputStream;
import java.io.IOException;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.MatchResult;
import java.util.regex.Pattern;
import java.util.stream.IntStream;

import static com.fasterxml.jackson.databind.type.TypeFactory.defaultInstance;
import static java.lang.String.format;
import static java.nio.charset.Charset.defaultCharset;
import static java.util.function.Predicate.not;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toSet;
import static java.util.stream.Stream.concat;

@Slf4j
@AllArgsConstructor
public class DeploymentServiceImpl implements DeploymentService {
    private final HttpClient httpClient;
    private final JsonParser jsonParser;
    private final MavenService mavenService;
    private final String host;
    private final Integer port;

    public List<PolyFunction> deployFunctions(List<String> functionFilters, boolean dryRun) {
        PolyFunctionService polyFunctionService = new PolyFunctionServiceImpl(httpClient, jsonParser, host, port);
        Map<PolyFunction, HttpResponseException> exceptions = new HashMap<>();
        Predicate<Method> filter;
        if (functionFilters.isEmpty()) {
            log.debug("No specific functions to deploy were declared.");
            filter = method -> true;
        } else {
            filter = method -> functionFilters.stream().anyMatch(
                    name -> {
                        PolyFunctionAnnotationRecord annotation = PolyFunctionAnnotationRecord.createFrom(method);
                        String functionName = Optional.ofNullable(annotation)
                                .map(PolyFunctionAnnotationRecord::name)
                                .filter(not(String::isBlank))
                                .orElseGet(method::getName);
                        return functionName.equals(name) || format("%s.%s", Optional.ofNullable(annotation).map(PolyFunctionAnnotationRecord::context).filter(not(String::isBlank)).orElseGet(method.getDeclaringClass()::getPackageName), functionName).equals(name);
                    });
        }
        Set<Method> methods = mavenService.scanPolyFunctions(filter);
        List<PolyFunction> deployedFunctions = methods.stream().map(method -> {
                    log.info("Processing method '{}'.", method);
                    PolyFunctionAnnotationRecord annotation = PolyFunctionAnnotationRecord.createFrom(method);
                    Class<?> declaringClass = method.getDeclaringClass();
                    PolyFunction polyFunction = new PolyFunction();
                    polyFunction.setName(Optional.ofNullable(annotation.name()).filter(not(String::isBlank)).orElseGet(method::getName));
                    log.debug("Poly function name is '{}'.", polyFunction.getName());
                    polyFunction.setLanguage("java");
                    CodeObject codeObject = new CodeObject();
                    codeObject.setClassName(declaringClass.getSimpleName());
                    codeObject.setPackageName(declaringClass.getPackageName());
                    codeObject.setMethodName(method.getName());
                    codeObject.setParams(Arrays.stream(method.getParameters()).map(Parameter::getType).map(Class::getName).collect(joining(",")));
                    String sourceCodePath = format("src/main/java/%s/%s.java", declaringClass.getPackageName().replace(".", "/"), declaringClass.getSimpleName());
                    log.debug("Obtaining source code from '{}'", sourceCodePath);
                    try (FileInputStream fileInputStream = new FileInputStream(sourceCodePath)) {
                        String code = IOUtils.toString(fileInputStream, defaultCharset());
                        codeObject.setCode(code);
                        if (annotation.contextAwareness().equals(PolyServerFunction.AUTO_DETECT_CONTEXT)) {
                            Set<String> matches = Pattern.compile("(Vari|Poly)\\.[.a-zA-Z0-9_\\s]+[^.a-zA-Z0-9_\\s]")
                                    .matcher(code)
                                    .results()
                                    .map(MatchResult::group)
                                    .flatMap(result -> {
                                        log.debug("Processing match {}", result);
                                        List<String> parts = Arrays.stream(result.substring(5).replace("\n", "").split("\\.")).toList();
                                        List<String> usedParts = parts.size() > 1 ? parts.subList(0, parts.size() - 1) : List.of("");
                                        log.trace("Context parts: {}", usedParts);
                                        return IntStream.range(0, usedParts.size()).boxed()
                                                .map(i -> String.join(".", usedParts.subList(0, i + 1)));
                                    })
                                    .collect(toSet());
                            codeObject.setAvailableContexts(matches.isEmpty() ? "-" : String.join(",", matches));
                            if (dryRun) {
                                log.info("Auto-detected contexts: {}", codeObject.getAvailableContexts());
                            } else {
                                log.debug("Auto-detected contexts: {}", codeObject.getAvailableContexts());
                            }
                        } else {
                            codeObject.setAvailableContexts(annotation.contextAwareness());
                        }
                    } catch (IOException e) {
                        throw new PolyApiMavenPluginException(e); // FIXME: Throw the appropriate exception.
                    }
                    polyFunction.setCode(jsonParser.toJsonString(codeObject));
                    polyFunction.setContext(Optional.ofNullable(annotation.context()).filter(not(String::isBlank)).orElseGet(declaringClass::getPackageName));
                    log.debug("Poly function context is '{}'", polyFunction.getContext());
                    log.debug("Processing parameters.");
                    polyFunction.setArguments(new ArrayList<>());
                    Arrays.stream(method.getParameters()).map(parameter -> {
                        log.debug("Processing parameter {}", parameter);
                        PolyFunctionArgument argument = new PolyFunctionArgument();
                        if (parameter.getType().equals(Object.class)) {
                            argument.setType("any");
                        } else {
                            argument.setType(parameter.getParameterizedType().getTypeName());
                            argument.setTypeSchema(jsonParser.toJsonSchema(parameter.getParameterizedType()));
                        }
                        argument.setRequired(true);
                        argument.setKey(parameter.getName());
                        argument.setName(parameter.getName());
                        log.debug("Parameter '{}' of type '{}' processed.", parameter.getName(), parameter.getParameterizedType());
                        return argument;
                    }).forEach(polyFunction.getArguments()::add);
                    log.debug("Retrieving required dependencies.");
                    polyFunction.setRequirements(mavenService.getMatchingDependencies(concat(Optional.ofNullable(method.getAnnotation(RequiredDependencies.class)).map(RequiredDependencies::value).stream().flatMap(Arrays::stream), Optional.ofNullable(method.getAnnotation(RequiredDependency.class)).stream()).map(requiredDependency -> format("%s:%s:%s", requiredDependency.groupId(), requiredDependency.artifactId(), requiredDependency.version())).toList()));
                    polyFunction.setReturnType(switch (method.getReturnType().getTypeName()) {
                        case "java.lang.Integer", "java.lang.Long", "java.lang.Number", "java.lang.Double", "java.lang.Float",
                             "java.lang.Short", "java.lang.Byte" -> "number";
                        case "java.lang.Boolean" -> "boolean";
                        case "java.lang.String", "java.lang.Character" -> "string";
                        case "java.lang.Object" -> "any";
                        case "void" -> "void";
                        default -> "object";
                    });
                    if (!(polyFunction.getReturnType().equals("any") || polyFunction.getReturnType().equals("void"))) {
                        Optional.of(method.getGenericReturnType()).map(jsonParser::toJsonSchema).map(schema -> jsonParser.<Map<String, Object>>parseString(schema, defaultInstance().constructMapType(HashMap.class, String.class, Object.class))).ifPresent(polyFunction::setReturnTypeSchema);
                    }
                    String type = annotation.type();
                    PolyFunction result = null;
                    if (dryRun) {
                        log.debug("{} function with content '{}' should be deployed.", type, polyFunction);
                        log.info("Skipping deployment of {} function '{}' because dry run mode is activated.", type, polyFunction.getName());
                    } else {
                        try {
                            result = polyFunctionService.deploy(type, polyFunction);
                        } catch (HttpResponseException e) {
                            log.error("{} function '{}' deployment failed.", type, polyFunction.getName());
                            exceptions.put(polyFunction, e);
                        }
                    }
                    return result;
                })
                .filter(Objects::nonNull)
                .toList();
        if (exceptions.isEmpty()) {
            log.info("Deployment of {} functions complete.", methods.size());
        } else {
            throw new DeploymentWrapperException(exceptions.values());
        }
        return deployedFunctions;
    }
}

