package io.polyapi.commons.api.error.http;

import io.polyapi.commons.api.http.Response;

/**
 * Exception thrown when there's an Unauthorized (status code 401) response from the server.
 */
public class UnauthorizedException extends HttpResponseException {

    /**
     * Constructor that takes a message and the response returned.
     *
     * @param response The response.
     */
    public UnauthorizedException(Response response) {
        super("An Unauthorized status code was received. Please verify the permissions of your user.", response);
    }
}
