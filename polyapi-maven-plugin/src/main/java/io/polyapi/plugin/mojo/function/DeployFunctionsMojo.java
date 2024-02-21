package io.polyapi.plugin.mojo.function;

import io.polyapi.commons.api.error.http.HttpResponseException;
import io.polyapi.commons.api.model.PolyFunction;
import io.polyapi.commons.api.model.RequiredDependencies;
import io.polyapi.commons.api.model.RequiredDependency;
import io.polyapi.plugin.error.PolyApiMavenPluginException;
import io.polyapi.plugin.error.deploy.DeploymentWrapperException;
import io.polyapi.plugin.model.function.CodeObject;
import io.polyapi.plugin.model.function.PolyFunctionArgument;
import io.polyapi.plugin.mojo.PolyApiMojo;
import io.polyapi.plugin.service.PolyFunctionService;
import io.polyapi.plugin.service.PolyFunctionServiceImpl;
import org.apache.commons.io.IOUtils;
import org.apache.maven.plugins.annotations.Mojo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.FileInputStream;
import java.io.IOException;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.lang.reflect.Type;
import java.util.*;
import java.util.stream.Collectors;

import static com.fasterxml.jackson.databind.type.TypeFactory.defaultInstance;
import static java.lang.String.format;
import static java.nio.charset.Charset.defaultCharset;
import static java.util.function.Predicate.isEqual;
import static java.util.function.Predicate.not;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Stream.concat;
import static org.apache.maven.plugins.annotations.ResolutionScope.COMPILE_PLUS_RUNTIME;

@Mojo(name = "deploy-functions", requiresDependencyResolution = COMPILE_PLUS_RUNTIME)
public class DeployFunctionsMojo extends PolyApiMojo {
    private static final Logger logger = LoggerFactory.getLogger(DeployFunctionsMojo.class);

    @Override
    protected void execute(String host, Integer port) {
        PolyFunctionService polyFunctionService = new PolyFunctionServiceImpl(host, port, getHttpClient(), getJsonParser(), getMavenService().getProjectClassLoader());
        logger.info("Initiating the deployment of functions.");
        Map<io.polyapi.plugin.model.function.PolyFunction, HttpResponseException> exceptions = new HashMap<>();
        Set<Method> methods = getMavenService().scanPolyFunctions();
        methods.forEach(method -> {
            logger.info("Processing method '{}'.", method);
            PolyFunction annotation = method.getAnnotation(PolyFunction.class);
            Class<?> declaringClass = method.getDeclaringClass();
            io.polyapi.plugin.model.function.PolyFunction polyFunction = new io.polyapi.plugin.model.function.PolyFunction();
            polyFunction.setName(Optional.ofNullable(annotation.name()).filter(not(String::isBlank)).orElseGet(method::getName));
            logger.debug("Poly function name is '{}'.", polyFunction.getName());
            polyFunction.setLanguage("java");
            CodeObject codeObject = new CodeObject();
            codeObject.setClassName(declaringClass.getSimpleName());
            codeObject.setPackageName(declaringClass.getPackageName());
            codeObject.setMethodName(method.getName());
            codeObject.setParams(Arrays.stream(method.getParameters()).map(Parameter::getType).map(Class::getName).collect(joining(",")));
            String sourceCodePath = format("src/main/java/%s/%s.java",
                    declaringClass.getPackageName().replace(".", "/"),
                    declaringClass.getSimpleName());
            logger.debug("Obtaining source code from '{}'", sourceCodePath);
            try (FileInputStream fileInputStream = new FileInputStream(sourceCodePath)) {
                codeObject.setCode(IOUtils.toString(fileInputStream, defaultCharset()));
            } catch (IOException e) {
                throw new PolyApiMavenPluginException(e); // FIXME: Throw the appropriate exception.
            }
            polyFunction.setCode(getJsonParser().toJsonString(codeObject));
            polyFunction.setContext(Optional.ofNullable(annotation.context()).filter(not(String::isBlank)).orElseGet(declaringClass::getPackageName));
            logger.debug("Poly function context is '{}'", polyFunction.getContext());
            logger.debug("Processing parameters.");
            polyFunction.setArguments(new ArrayList<>());
            Arrays.stream(method.getParameters()).map(parameter -> {
                logger.debug("Processing parameter {}", parameter);
                PolyFunctionArgument argument = new PolyFunctionArgument();
                argument.setType(parameter.getParameterizedType().getTypeName());
                argument.setTypeSchema(getJsonParser().toJsonSchema(parameter.getParameterizedType()));
                argument.setRequired(true);
                argument.setKey(parameter.getName());
                argument.setName(parameter.getName());
                logger.debug("Parameter '{}' of type '{}' processed.", parameter.getName(), parameter.getParameterizedType());
                return argument;
            }).forEach(polyFunction.getArguments()::add);
            logger.debug("Retrieving required dependencies.");
            polyFunction.setRequirements(getMavenService().getMatchingDependencies(concat(Optional.ofNullable(method.getAnnotation(RequiredDependencies.class)).map(RequiredDependencies::value).stream().flatMap(Arrays::stream),
                    Optional.ofNullable(method.getAnnotation(RequiredDependency.class)).stream())
                    .map(requiredDependency -> format("%s:%s:%s", requiredDependency.groupId(), requiredDependency.artifactId(), requiredDependency.version()))
                    .toList()));
            polyFunction.setReturnType(getPolyType(method.getReturnType()));
            Optional.of(method.getGenericReturnType()).filter(not(isEqual(Void.TYPE))).map(getJsonParser()::toJsonSchema).map(schema -> getJsonParser().<Map<String, Object>>parseString(schema, defaultInstance().constructMapType(HashMap.class, String.class, Object.class))).ifPresent(polyFunction::setReturnTypeSchema);
            String type = annotation.type().name().toLowerCase();
            try {
                String id = polyFunctionService.deploy(type, polyFunction);
                logger.info("Deployed {} function '{}' on context '{}' with id '{}'", type, polyFunction.getName(), polyFunction.getContext(), id);
                logger.debug("Function can be accessed at {}:{}/functions/{}/{}", host, port, type, id);
            } catch (HttpResponseException e) {
                logger.error("{} function '{}' deployment failed.", type, polyFunction.getName());
                exceptions.put(polyFunction, e);
            }
        });
        if (exceptions.isEmpty()) {
            logger.info("Deployment of {} functions complete.", methods.size());
        } else {
            logger.error("{} Errors occurred while deploying a total of {} functions.", exceptions.size(), methods.size());
            exceptions.forEach((polyFunctionMetadata, exception) -> {
                if (exception instanceof HttpResponseException) {
                    try {
                        logger.error(IOUtils.toString(HttpResponseException.class.cast(exception).getResponse().body()));
                    } catch (IOException e) {
                        throw new RuntimeException(e);
                    }
                }
            });
            throw new DeploymentWrapperException(exceptions.values());
        }
    }

    private String getPolyType(Type type) {
        return switch (type.getTypeName()) {
            case "java.lang.Integer", "java.lang.Long", "java.lang.Number", "java.lang.Double", "java.lang.Float", "java.lang.Short", "java.lang.Byte" ->
                    "number";
            case "java.lang.Boolean" -> "boolean";
            case "java.lang.String", "java.lang.Character" -> "string";
            case "void" -> "void";
            default -> "object";
        };
    }
}
