package io.polyapi.commons.api.error;

/**
 * Parent exception for all exceptions that want to be handled during the execution of a Poly function.
 * Requires a status code that will be returned to the user in case an exception happens.
 */
public abstract class PolyApiExecutionException extends PolyApiException {

    /**
     * See {@link PolyApiException#PolyApiException()}
     */
    public PolyApiExecutionException() {
        super();
    }

    /**
     * See {@link PolyApiException#PolyApiException(String)}
     */
    public PolyApiExecutionException(String message) {
        super(message);
    }

    /**
     * See {@link PolyApiException#PolyApiException(String, Throwable)}
     */
    public PolyApiExecutionException(String message, Throwable cause) {
        super(message, cause);
    }

    /**
     * See {@link PolyApiException#PolyApiException(Throwable)}
     */
    public PolyApiExecutionException(Throwable cause) {
        super(cause);
    }

    public abstract int getStatusCode();
}
