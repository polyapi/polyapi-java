package io.polyapi.plugin.service;

import io.polyapi.commons.api.model.PolyFunction;
import io.polyapi.commons.api.model.PolyGeneratedClass;
import io.polyapi.commons.api.model.RequiredDependencies;
import io.polyapi.commons.api.model.RequiredDependency;
import io.polyapi.plugin.error.PolyApiMavenPluginException;
import io.polyapi.plugin.error.validation.PropertyNotFoundException;
import org.apache.maven.artifact.DependencyResolutionRequiredException;
import org.apache.maven.model.Plugin;
import org.apache.maven.model.PluginExecution;
import org.apache.maven.project.MavenProject;
import org.codehaus.plexus.util.xml.Xpp3Dom;
import org.reflections.Reflections;
import org.reflections.util.ConfigurationBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.lang.model.SourceVersion;
import java.io.File;
import java.lang.reflect.Method;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.*;
import java.util.function.Consumer;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static java.lang.String.format;
import static java.util.function.Predicate.not;
import static java.util.regex.Pattern.compile;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toSet;
import static java.util.stream.Stream.concat;
import static javax.lang.model.SourceVersion.isKeyword;
import static org.reflections.scanners.Scanners.MethodsAnnotated;

public class MavenService {
    private static final Logger logger = LoggerFactory.getLogger(MavenService.class);
    private static final String FUNCTION_NAME_PATTERN = "^[a-z][\\w$_]+$";
    private static final String CONTEXT_PATTERN = "^[a-z][\\w$_.]*[\\w$_]$";
    private final MavenProject project;

    public MavenService(MavenProject project) {
        this.project = project;
    }

    public void getPropertyFromPlugin(String propertyName, String currentValue, Consumer<String> callback) {
        logger.debug("Checking value of '{}' as an input parameter.", propertyName);
        if (currentValue == null) {
            logger.debug("Parameter '{}' is empty. Attempting to retrieve it from plugin configuration.", propertyName);
            callback.andThen(value -> logger.debug("Parameter '{}' value is '{}'.", propertyName, value))
                    .accept(getPropertyFromPlugin("io.polyapi.client", "library", propertyName));
        } else {
            logger.debug("Parameter '{}' value is '{}'", propertyName, currentValue);
        }
    }

    public String getPropertyFromPlugin(String pluginGroupId, String pluginArtifactId, String propertyName) {
        logger.debug("Scanning plugins.");
        List<Plugin> plugins = project.getBuild().getPlugins();
        logger.debug("Found {} plugins. Filtering by group ID matching '{}' and artifact ID matching '{}'.", plugins.size(), pluginGroupId, pluginArtifactId);
        return plugins.stream()
                .filter(plugin -> pluginGroupId.equals(plugin.getGroupId()))
                .filter(plugin -> pluginArtifactId.equals(plugin.getArtifactId()))
                .peek(plugin -> logger.debug("Found match: {}.{}:{}.\nRetrieving executions.", plugin.getGroupId(), plugin.getArtifactId(), plugin.getVersion()))
                .map(Plugin::getExecutions)
                .peek(pluginExecutions -> logger.debug("Found {} executions.", pluginExecutions.size()))
                .flatMap(List::stream)
                .map(PluginExecution::getConfiguration)
                .filter(Objects::nonNull)
                .map(Xpp3Dom.class::cast)
                .peek(configuration -> logger.debug("Found configuration within the execution. Retrieving children."))
                .map(Xpp3Dom::getChildren)
                .peek(children -> logger.debug("Found {} children properties.", children.length))
                .flatMap(Stream::of)
                .filter(Objects::nonNull)
                .peek(property -> logger.debug("Property '{}' found.", propertyName))
                .map(Xpp3Dom::getValue)
                .findFirst()
                .orElseThrow(() -> new PropertyNotFoundException(propertyName));
    }

    public URLClassLoader getProjectClassLoader() {
        try {
            return new URLClassLoader(concat(concat(project.getCompileClasspathElements().stream(),
                            project.getRuntimeClasspathElements().stream()),
                    Stream.of(project.getBuild().getOutputDirectory()))
                    .peek(classLoadingPath -> logger.debug("    Adding classloading path '{}'.", classLoadingPath))
                    .map(File::new)
                    .map(File::toURI)
                    .map(uri -> {
                        try {
                            return uri.toURL();
                        } catch (MalformedURLException e) {
                            // FIXME: Throw appropriate exception.
                            throw new RuntimeException(e);
                        }
                    })
                    .toArray(URL[]::new),
                    MavenService.class.getClassLoader());
        } catch (DependencyResolutionRequiredException e) {
            throw new RuntimeException(e);
        }
    }

    public List<File> getSourceFolders() {
        return concat(project.getCompileSourceRoots().stream(), Stream.of(project.getBasedir() + "/target/generated-sources"))
                .peek(sourceRoot -> logger.debug("    Retrieving source root '{}'", sourceRoot))
                .map(File::new)
                .filter(File::exists)
                .toList();
    }

    public List<String> getJarSources() {
        try {
            return project.getCompileClasspathElements().stream()
                    .filter(path -> path.endsWith(".jar"))
                    .peek(path -> logger.debug("    Retrieving jar sources from '{}'.", path))
                    .toList();
        } catch (DependencyResolutionRequiredException e) {
            // FIXME: Throw appropriate exception.
            throw new PolyApiMavenPluginException(e);
        }
    }

    public Set<Method> scanPolyFunctions() {
        logger.info("Scanning the project for functions annotated with {}}.", PolyFunction.class.getName());
        URLClassLoader projectClassLoader = getProjectClassLoader();
        Reflections reflections = new Reflections(new ConfigurationBuilder()
                .addClassLoaders(projectClassLoader)
                .addScanners(MethodsAnnotated)
                .addUrls(projectClassLoader.getURLs()));
        logger.debug("Reflections URLS: {}", reflections.getConfiguration().getUrls().size());
        Set<Method> methods = reflections.getMethodsAnnotatedWith(PolyFunction.class);
        logger.info("Found {} methods to convert.", methods.size());

        List.of(RequiredDependency.class, RequiredDependencies.class).forEach(annotation ->
                reflections.getMethodsAnnotatedWith(annotation).stream()
                        .filter(not(methods::contains))
                        .forEach(misusedMethod -> logger.warn("Method {} is annotated with {} but is ignored as it needs to be annotated with {} to be scanned.", misusedMethod, misusedMethod.getAnnotation(annotation).getClass().getSimpleName(), PolyFunction.class.getSimpleName())));
        Set<Method> validatedMethods = methods.stream()
                .filter(not(method -> method.getDeclaringClass().isAnnotationPresent(PolyGeneratedClass.class)))
                .filter(method -> {
                    boolean result = true;
                    PolyFunction polyFunction = method.getAnnotation(PolyFunction.class);
                    logger.debug("Validating function name.");
                    String functionName = Optional.ofNullable(polyFunction.name()).filter(not(String::isBlank)).orElseGet(method::getName);
                    if (!functionName.matches(FUNCTION_NAME_PATTERN)) {
                        logger.error("Method '{}' skipped. Property 'functionName' with value '{}' doesn't match pattern '{}'.", method, functionName, FUNCTION_NAME_PATTERN);
                        result = false;
                    }
                    if (isKeyword(functionName.trim())) {
                        logger.error("Method '{}' skipped. Property 'functionName' with value '{}' is a Java keyword.", method, functionName);
                        result = false;
                    }
                    return result;
                })
                .filter(method -> {
                    boolean result = true;
                    PolyFunction polyFunction = method.getAnnotation(PolyFunction.class);
                    logger.debug("Validating context.");
                    String context = Optional.ofNullable(polyFunction.context()).filter(not(String::isEmpty)).orElseGet(method.getDeclaringClass()::getPackageName);
                    if (!context.matches(CONTEXT_PATTERN)) {
                        logger.error("Method '{}' skipped. Property 'context' with value '{}' doesn't match pattern '{}'.", method, context, CONTEXT_PATTERN);
                        result = false;
                    }
                    String keywords = Arrays.stream(context.split("\\.")).filter(SourceVersion::isKeyword).collect(joining(","));
                    if (!keywords.isEmpty()) {
                        logger.error("Method '{}' skipped. Property 'context' with value '{}' uses Java keywords '{}}'. Please rename the context accordingly.", method, context, keywords);
                        result = false;
                    }
                    return result;
                })
                .filter(method -> {
                    PolyFunction polyFunction = method.getAnnotation(PolyFunction.class);
                    boolean isDeployable = polyFunction.isDeployable();
                    if (!isDeployable) {
                        logger.warn("Method '{}' skipped. Marked as not deployable.", method);
                    }
                    return isDeployable;
                })
                .collect(toSet());
        if (validatedMethods.size() < methods.size()) {
            logger.warn("Only {} of {} methods are valid.", validatedMethods.size(), methods.size());
        }
        return validatedMethods;
    }

    public List<String> getMatchingDependencies(List<String> patterns) {
        logger.debug("Retrieving required dependencies.");
        Pattern pattern = compile(Optional.of(String.join("|", patterns))
                .filter(not(String::isEmpty))
                .orElse("(?=a)b"));
        logger.debug("Pattern used to match required dependencies is: {}", pattern.pattern());
        List<String> requiredDependencies = project.getDependencies().stream()
                .map(dependency -> format("%s:%s:%s", dependency.getGroupId(), dependency.getArtifactId(), dependency.getVersion()))
                .filter(pattern.asPredicate())
                .toList();
        logger.debug("Required dependencies found: {}", requiredDependencies);
        return requiredDependencies;
    }

    public Set<Method> getPolyFunctionMethods() {
        logger.info("Scanning projects for methods annotated with @PolyFunction.");
        URLClassLoader projectClassLoader = getProjectClassLoader();
        Reflections reflections = new Reflections(new ConfigurationBuilder()
                .addClassLoaders(projectClassLoader)
                .addScanners(MethodsAnnotated)
                .addUrls(projectClassLoader.getURLs()));
        logger.info("Reflections URLS: {}", reflections.getConfiguration().getUrls().size());
        Set<Method> methods = reflections.getMethodsAnnotatedWith(PolyFunction.class);
        logger.info("Methods: {}", methods.size());
        return methods;
    }
}
