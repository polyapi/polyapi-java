package io.polyapi.commons.api.error.http;

import io.polyapi.commons.api.http.Response;

/**
 * Exception thrown when there's a Service Unavailable (status code 503) response from the server.
 */
public class ServiceUnavailableException extends HttpResponseException {

    /**
     * Constructor that takes a message and the response returned.
     *
     * @param response The response.
     */
    public ServiceUnavailableException(Response response) {
        super("Service is currently unavailable. Please retry later.", response);
    }
}
