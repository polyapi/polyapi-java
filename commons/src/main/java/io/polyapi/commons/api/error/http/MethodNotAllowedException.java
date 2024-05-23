package io.polyapi.commons.api.error.http;

import io.polyapi.commons.api.http.Response;

/**
 * Exception thrown when there's a Method Not Allowed (status code 405) response from the server.
 */
public class MethodNotAllowedException extends HttpResponseException {

    /**
     * Constructor that takes a message and the response returned.
     *
     * @param response The response.
     */
    public MethodNotAllowedException(Response response) {
        super("Trying to access service with the wrong HTTP method.", response);
    }
}
