package io.polyapi.commons.api.error.http;

import io.polyapi.commons.api.http.Response;

import static java.lang.String.format;

/**
 * Exception thrown when the status code from a response belongs to the 1XX.
 */
public class UnexpectedInformationalResponseException extends HttpResponseException {

    public UnexpectedInformationalResponseException(Response response) {
        super(format("An unexpected informational response was received. Status code: %s.", response.statusCode()), response);
    }
}
