package io.polyapi.commons.api.error.http;

import io.polyapi.commons.api.http.Response;

/**
 * Exception thrown when there's an I'm a Teapot (status code 418) response from the server.
 */
public class ImATeapotException extends HttpResponseException {

    /**
     * Constructor that takes a message and the response returned.
     *
     * @param response The response.
     */
    public ImATeapotException(Response response) {
        super("I'm a teapot. I cannot process data.", response);
    }
}
