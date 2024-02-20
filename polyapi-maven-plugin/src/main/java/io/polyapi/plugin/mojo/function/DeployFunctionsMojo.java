package io.polyapi.plugin.mojo.function;

import io.polyapi.commons.api.error.http.HttpResponseException;
import io.polyapi.plugin.error.deploy.DeploymentWrapperException;
import io.polyapi.plugin.model.function.PolyFunctionMetadata;
import io.polyapi.plugin.mojo.PolyApiMojo;
import io.polyapi.plugin.service.PolyFunctionService;
import io.polyapi.plugin.service.PolyFunctionServiceImpl;
import org.apache.commons.io.IOUtils;
import org.apache.maven.plugins.annotations.Mojo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.apache.maven.plugins.annotations.ResolutionScope.COMPILE_PLUS_RUNTIME;

@Mojo(name = "deploy-functions", requiresDependencyResolution = COMPILE_PLUS_RUNTIME)
public class DeployFunctionsMojo extends PolyApiMojo {
    private static final Logger logger = LoggerFactory.getLogger(DeployFunctionsMojo.class);

    @Override
    protected void execute(String host, Integer port) {
        PolyFunctionService polyFunctionService = new PolyFunctionServiceImpl(host, port, getHttpClient(), getJsonParser(), getMavenService().getProjectClassLoader());
        logger.info("Initiating the deployment of functions.");
        Set<PolyFunctionMetadata> polyFunctions = getMavenService().scanPolyFunctions();
        Map<PolyFunctionMetadata, HttpResponseException> exceptions = new HashMap<>();
        polyFunctions.forEach(polyFunctionMetadata -> {
            logger.debug("Discovered {} function '{}' on context '{}'.", polyFunctionMetadata.getTypedType(), polyFunctionMetadata.name(), polyFunctionMetadata.context());
            if (polyFunctionMetadata.isDeployable()) {
                try {
                    String id = polyFunctionService.deploy(polyFunctionMetadata);
                    logger.info("Deployed {} function '{}' on context '{}' with id '{}'", polyFunctionMetadata.getTypedType(), polyFunctionMetadata.name(), polyFunctionMetadata.context(), id);
                    logger.debug("Function can be accessed at {}:{}/functions/{}/{}", host, port, polyFunctionMetadata.getTypedType(), id);
                } catch (HttpResponseException e) {
                    logger.error("{} function '{}' deployment failed.", polyFunctionMetadata.getTypedType(), polyFunctionMetadata.name());
                    exceptions.put(polyFunctionMetadata, e);
                }
            } else {
                logger.warn("Deployment of {} function '{}' on context '{}' skipped.", polyFunctionMetadata.getTypedType(), polyFunctionMetadata.name(), polyFunctionMetadata.context());
            }
        });
        if (exceptions.isEmpty()) {
            logger.info("Deployment of {} functions complete.", polyFunctions.size());
        } else {
            logger.error("{} Errors occurred while deploying a total of {} functions.", exceptions.size(), polyFunctions.stream().filter(PolyFunctionMetadata::isDeployable).count());
            exceptions.forEach((polyFunctionMetadata, exception) -> {
                logger.debug("{} occurred while deploying {} function '{}' on context '{}'. Exception message is '{}'.", exception.getClass(), polyFunctionMetadata.getTypedType(), polyFunctionMetadata.name(), polyFunctionMetadata.context(), Optional.ofNullable(exception.getMessage()).orElse("No message"));
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
}
