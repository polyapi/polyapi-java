package io.polyapi.plugin.mojo;

import io.polyapi.commons.api.error.http.HttpResponseException;
import io.polyapi.commons.api.model.PolyFunction;
import io.polyapi.commons.api.model.RequiredDependencies;
import io.polyapi.commons.api.model.RequiredDependency;
import io.polyapi.plugin.error.PolyApiMavenPluginException;
import io.polyapi.plugin.error.deploy.DeploymentWrapperException;
import io.polyapi.plugin.model.function.CodeObject;
import io.polyapi.plugin.model.function.PolyFunctionArgument;
import io.polyapi.plugin.service.PolyFunctionService;
import io.polyapi.plugin.service.PolyFunctionServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.IOUtils;
import org.apache.maven.plugins.annotations.Mojo;

import java.io.FileInputStream;
import java.io.IOException;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.MatchResult;
import java.util.regex.Pattern;
import java.util.stream.IntStream;

import static com.fasterxml.jackson.databind.type.TypeFactory.defaultInstance;
import static io.polyapi.commons.api.model.PolyFunction.AUTO_DETECT_CONTEXT;
import static java.lang.String.format;
import static java.nio.charset.Charset.defaultCharset;
import static java.util.function.Predicate.isEqual;
import static java.util.function.Predicate.not;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toSet;
import static java.util.stream.Stream.concat;
import static org.apache.commons.lang.StringUtils.isBlank;
import static org.apache.maven.plugins.annotations.ResolutionScope.COMPILE_PLUS_RUNTIME;

@Mojo(name = "deploy-functions", requiresDependencyResolution = COMPILE_PLUS_RUNTIME)
@Slf4j
public class DeployFunctionsMojo extends PolyApiMojo {

    @org.apache.maven.plugins.annotations.Parameter(property = "functions")
    private String functions;

    @org.apache.maven.plugins.annotations.Parameter(property = "dry-run", defaultValue = "false")
    private boolean dryRun;

    @Override
    protected void execute(String host, Integer port) {
        PolyFunctionService polyFunctionService = new PolyFunctionServiceImpl(host, port, getHttpClient(), getJsonParser());
        log.info("Initiating the deployment of functions.");
        if (dryRun) {
            log.warn("Dry run mode is set. This won't deploy to server.");
        }
        Map<io.polyapi.plugin.model.function.PolyFunction, HttpResponseException> exceptions = new HashMap<>();
        Predicate<Method> filter;
        if (isBlank(functions)) {
            log.debug("No specific functions to deploy were declared.");
            filter = method -> true;
        } else {
            filter = method -> Arrays.stream(functions.split(",")).map(String::trim).anyMatch(name -> {
                PolyFunction annotation = method.getAnnotation(PolyFunction.class);
                String functionName = Optional.ofNullable(annotation.name()).filter(not(String::isBlank)).orElseGet(method::getName);
                return functionName.equals(name) || format("%s.%s", Optional.ofNullable(annotation.context()).filter(not(String::isBlank)).orElseGet(method.getDeclaringClass()::getPackageName), functionName).equals(name);
            });
        }
        Set<Method> methods = getMavenService().scanPolyFunctions(filter);
        methods.forEach(method -> {
            log.info("Processing method '{}'.", method);
            PolyFunction annotation = method.getAnnotation(PolyFunction.class);
            Class<?> declaringClass = method.getDeclaringClass();
            io.polyapi.plugin.model.function.PolyFunction polyFunction = new io.polyapi.plugin.model.function.PolyFunction();
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
                if (annotation.contextAwareness().equals(AUTO_DETECT_CONTEXT)) {
                    Set<String> matches = Pattern.compile("(Vari|Poly)\\.[.a-zA-Z0-9_\\s]+[^.a-zA-Z0-9_\\s]")
                            .matcher(code)
                            .results()
                            .map(MatchResult::group)
                            .flatMap(result -> {
                                log.debug("Processing match {}", result);
                                List<String> parts = Arrays.stream(result.substring(5).replace("\n", "").split("\\.")).toList();
                                List<String> usedParts = parts.size() > 1? parts.subList(0, parts.size() - 1) : List.of("");
                                log.trace("Context parts: {}", usedParts);
                                return IntStream.range(0, usedParts.size()).boxed()
                                        .map(i -> String.join(".", usedParts.subList(0, i + 1)));
                            })
                            .collect(toSet());
                    codeObject.setAvailableContexts(matches.isEmpty()? "-" : String.join(",", matches));
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
            polyFunction.setCode(getJsonParser().toJsonString(codeObject));
            polyFunction.setContext(Optional.ofNullable(annotation.context()).filter(not(String::isBlank)).orElseGet(declaringClass::getPackageName));
            log.debug("Poly function context is '{}'", polyFunction.getContext());
            log.debug("Processing parameters.");
            polyFunction.setArguments(new ArrayList<>());
            Arrays.stream(method.getParameters()).map(parameter -> {
                log.debug("Processing parameter {}", parameter);
                PolyFunctionArgument argument = new PolyFunctionArgument();
                argument.setType(parameter.getParameterizedType().getTypeName());
                argument.setTypeSchema(getJsonParser().toJsonSchema(parameter.getParameterizedType()));
                argument.setRequired(true);
                argument.setKey(parameter.getName());
                argument.setName(parameter.getName());
                log.debug("Parameter '{}' of type '{}' processed.", parameter.getName(), parameter.getParameterizedType());
                return argument;
            }).forEach(polyFunction.getArguments()::add);
            log.debug("Retrieving required dependencies.");
            polyFunction.setRequirements(getMavenService().getMatchingDependencies(concat(Optional.ofNullable(method.getAnnotation(RequiredDependencies.class)).map(RequiredDependencies::value).stream().flatMap(Arrays::stream), Optional.ofNullable(method.getAnnotation(RequiredDependency.class)).stream()).map(requiredDependency -> format("%s:%s:%s", requiredDependency.groupId(), requiredDependency.artifactId(), requiredDependency.version())).toList()));
            polyFunction.setReturnType(getPolyType(method.getReturnType()));
            Optional.of(method.getGenericReturnType()).filter(not(isEqual(Void.TYPE))).map(getJsonParser()::toJsonSchema).map(schema -> getJsonParser().<Map<String, Object>>parseString(schema, defaultInstance().constructMapType(HashMap.class, String.class, Object.class))).ifPresent(polyFunction::setReturnTypeSchema);
            String type = annotation.type().name().toLowerCase();
            if (dryRun) {
                log.info("{} function with content '{}' should be deployed.", type, polyFunction);
                log.info("Skipping deployment because dry run mode is activated.");
                log.info("Dry run complete for {} functions.", methods.size());
            } else {
                try {
                    String id = polyFunctionService.deploy(type, polyFunction);
                    log.info("Deployed {} function '{}' on context '{}' with id '{}'", type, polyFunction.getName(), polyFunction.getContext(), id);
                    log.debug("Function can be accessed at {}:{}/functions/{}/{}", host, port, type, id);
                } catch (HttpResponseException e) {
                    log.error("{} function '{}' deployment failed.", type, polyFunction.getName());
                    exceptions.put(polyFunction, e);
                }
                if (exceptions.isEmpty()) {
                    log.info("Deployment of {} functions complete.", methods.size());
                } else {
                    log.error("{} Errors occurred while deploying a total of {} functions.", exceptions.size(), methods.size());
                    exceptions.forEach((polyFunctionMetadata, exception) -> {
                        try {
                            log.error(IOUtils.toString(HttpResponseException.class.cast(exception).getResponse().body(), defaultCharset()));
                        } catch (IOException e) {
                            throw new RuntimeException(e);
                        }
                    });
                    throw new DeploymentWrapperException(exceptions.values());
                }
            }
        });
    }

    private String getPolyType(Type type) {
        return switch (type.getTypeName()) {
            case "java.lang.Integer", "java.lang.Long", "java.lang.Number", "java.lang.Double", "java.lang.Float",
                 "java.lang.Short", "java.lang.Byte" -> "number";
            case "java.lang.Boolean" -> "boolean";
            case "java.lang.String", "java.lang.Character" -> "string";
            case "void" -> "void";
            default -> "object";
        };
    }
}
