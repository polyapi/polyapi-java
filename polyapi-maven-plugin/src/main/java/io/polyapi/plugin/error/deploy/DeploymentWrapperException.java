package io.polyapi.plugin.error.deploy;

import io.polyapi.commons.api.error.PolyApiException;
import io.polyapi.plugin.error.PolyApiMavenPluginException;

import java.util.Collection;

/**
 * Exception that wraps all the other exceptions thrown when deploying functions.
 */
public class DeploymentWrapperException extends PolyApiMavenPluginException {

    public DeploymentWrapperException(Collection<? extends Throwable> suppressedExceptions) {
        super("Exceptions occurred while deploying functions.");
        suppressedExceptions.forEach(this::addSuppressed);
    }
}
