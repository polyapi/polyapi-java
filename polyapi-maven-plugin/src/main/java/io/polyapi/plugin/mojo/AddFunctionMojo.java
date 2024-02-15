package io.polyapi.plugin.mojo;

import io.polyapi.plugin.error.classloader.QualifiedNameNotFoundException;
import io.polyapi.plugin.model.function.PolyFunction;
import io.polyapi.plugin.model.function.PolyFunctionArgument;
import io.polyapi.plugin.service.JavaParserService;
import io.polyapi.plugin.service.JavaParserServiceImpl;
import io.polyapi.plugin.service.PolyFunctionService;
import io.polyapi.plugin.service.PolyFunctionServiceImpl;
import lombok.Setter;
import org.apache.maven.plugins.annotations.Parameter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.function.BiConsumer;

import static java.lang.String.format;
import static java.util.stream.Collectors.joining;

@Setter
public abstract class AddFunctionMojo extends PolyApiMojo {
    private static final Logger logger = LoggerFactory.getLogger(AddFunctionMojo.class);

    @Parameter(property = "functionName")
    private String functionName;

    @Parameter(property = "file")
    private File file;

    @Parameter(property = "context")
    private String context;

    @Parameter(property = "description")
    private String description;

    @Override
    public void execute(String host, Integer port) {
        var classLoader = getMavenService().getProjectClassLoader();
        BiConsumer<Method, File> addFunction = (Method method, File file) -> {
            logger.debug("Setting up the Java parser service.");
            logger.debug("Setting up class loader for all relevant places in the project.");
            JavaParserService javaParserService = new JavaParserServiceImpl(classLoader, getJsonParser());
            logger.debug("Setting up HTTP service to access the Function API in Poly.");
            logger.info("Parsing function {} in file {}.", method.getName(), file.getAbsolutePath());
            var polyFunction = javaParserService.parseFunction(getMavenService().getSourceFolders(), getMavenService().getJarSources(), file, method, description, context);
            logger.info("Poly function {}({}) parsed.", polyFunction.getName(), polyFunction.getArguments().stream().map(PolyFunctionArgument::getType).collect(joining(", ")));
            logger.info("Deploying function.");
            logger.debug("Target URL is {}.", host);
            deployFunction(polyFunction, new PolyFunctionServiceImpl(host, port, getHttpClient(), getJsonParser()));
            logger.info("Function deployed successfully.");
        };
        if (functionName == null && file == null) {
            getMavenService().getPolyFunctionMethods().forEach(method -> {
                Class<?> declaringClass = method.getDeclaringClass();
                addFunction.accept(method, new File(format("src/main/java/%s/%s.java", declaringClass.getPackageName().replace(".", "/"), declaringClass.getSimpleName())));
            });
        } else {
            if (functionName == null || file == null) {
                throw new RuntimeException();// FIXME: Throw the appropriate exception
            }
            String path = file.getAbsolutePath();
            String className = path.substring(path.lastIndexOf("src/main/java/") + 14, path.length() - 5).replace("/", ".");
            try {
                Class<?> clazz = classLoader.loadClass(className);
                List<Method> methods = Arrays.stream(clazz.getDeclaredMethods()).filter(method -> method.getName().equalsIgnoreCase(functionName)).toList();
                if (methods.size() > 1) {
                    throw new RuntimeException(); // FIXME: Throw the appropriate exception
                }
                if (methods.isEmpty()) {
                    throw new RuntimeException(); // FIXME: Throw the appropriate exception.
                }
                methods.forEach(method -> addFunction.accept(method, file));
            } catch (ClassNotFoundException e) {
                throw new QualifiedNameNotFoundException(className, e);
            }
        }
    }

    protected abstract void deployFunction(PolyFunction function, PolyFunctionService polyFunctionService);
}
