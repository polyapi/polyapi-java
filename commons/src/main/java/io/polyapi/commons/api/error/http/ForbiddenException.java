package io.polyapi.commons.api.error.http;

import io.polyapi.commons.api.http.Response;

/**
 * Exception thrown when there's a Forbidden (status code 403) response from the server.
 */
public class ForbiddenException extends HttpResponseException {

    /**
     * Constructor that takes a message and the response returned.
     *
     * @param response The response.
     */
    public ForbiddenException(Response response) {
        super("A Forbidden status code was received. Please verify the permissions of your user.", response);
    }
}
