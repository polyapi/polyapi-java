package io.polyapi.commons.api.service;

import io.polyapi.commons.api.error.parse.ParsingException;
import io.polyapi.commons.api.error.parse.UnsupportedContentTypeException;
import io.polyapi.commons.api.http.HttpClient;
import io.polyapi.commons.api.http.HttpMethod;
import io.polyapi.commons.api.http.Request;
import io.polyapi.commons.api.http.Response;
import io.polyapi.commons.api.json.JsonParser;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.IOUtils;

import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Type;
import java.lang.reflect.TypeVariable;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static io.polyapi.commons.api.http.HttpMethod.*;
import static java.nio.charset.Charset.defaultCharset;
import static java.util.function.Predicate.not;

/**
 * Parent implementation class for all services that connecto the Poly API service.
 */
@Slf4j
public class PolyApiService {
    private final String host;
    private final Integer port;
    private final HttpClient client;
    private final JsonParser jsonParser;

    public PolyApiService(HttpClient client, JsonParser jsonParser, String host, Integer port) {
        this.client = client;
        this.jsonParser = jsonParser;
        this.host = host;
        this.port = port;
    }

    public <O> O get(String relativePath, Type expectedResponseType) {
        return get(relativePath, new HashMap<>(), new HashMap<>(), expectedResponseType);
    }

    public <O> O get(String relativePath, Map<String, List<String>> headers, Map<String, List<String>> queryParams, Type expectedResponseType) {
        return parsedCall(GET, relativePath, headers, queryParams, null, expectedResponseType);
    }

    public <I, O> O post(String relativePath, I body, Type expectedResponseType) {
        return post(relativePath, new HashMap<>(), new HashMap<>(), body, expectedResponseType);
    }

    public <I, O> O post(String relativePath, Map<String, List<String>> headers, Map<String, List<String>> queryParams, I body, Type expectedResponseType) {
        return parsedCall(POST, relativePath, headers, queryParams, body, expectedResponseType);
    }

    public <I> void patch(String relativePath, I body) {
        parsedCall(PATCH, relativePath, new HashMap<>(), new HashMap<>(), body, Void.TYPE);
    }

    public <I> void patch(String relativePath, Map<String, List<String>> headers, Map<String, List<String>> queryParams, I body) {
        parsedCall(PATCH, relativePath, headers, queryParams, body, Void.TYPE);
    }

    public void delete(String relativePath) {
        delete(relativePath, new HashMap<>(), new HashMap<>(), null);
    }


    public <I> void delete(String relativePath, Map<String, List<String>> headers, Map<String, List<String>> queryParams, I body) {
        parsedCall(DELETE, relativePath, headers, queryParams, body, Void.TYPE);
    }

    private <I, O> O parsedCall(HttpMethod method, String relativePath, Map<String, List<String>> headers, Map<String, List<String>> queryParams, I body, Type expectedResponseType) {
        Map<String, List<String>> allHeaders = new HashMap<>();
        //allHeaders.put("Accept", List.of("application/json"));
        allHeaders.put("Content-type", List.of("application/json"));
        headers.forEach((key, value) -> allHeaders.put(key, value.stream().toList()));

        Response response = callApi(method, relativePath, allHeaders, queryParams, jsonParser.toJsonInputStream(body));
        log.debug("Response is successful. Status code is {}.", response.statusCode());
        log.debug("Parsing response.");
        O result = Optional.of(expectedResponseType)
                .filter(not(Void.TYPE::equals))
                .map(type ->{
                    String contentType = response.headers().get("Content-type").stream().findFirst().orElseThrow();
                    O parsedResult;
                    log.debug("Content type is {}.", contentType);
                    log.debug("Type class is {}.", type.getClass());
                    log.debug("Type is {}.", type);
                    if (contentType.startsWith("application/json")) {
                        parsedResult = jsonParser.parseInputStream(response.body(), TypeVariable.class.isAssignableFrom(type.getClass()) ? Object.class : type);
                    } else {
                        if ((type.getClass().isAssignableFrom(String.class) || TypeVariable.class.isAssignableFrom(type.getClass())) && contentType.startsWith("text/")) {
                            try {
                                parsedResult = (O)IOUtils.toString(response.body(), defaultCharset());
                            } catch (IOException e) {
                                throw new ParsingException("An error occurred while parsing the response.", e);
                            }
                        } else {
                            if ((InputStream.class.isAssignableFrom(type.getClass()) || type.getClass().isAssignableFrom(TypeVariable.class))) {
                                parsedResult = (O)response.body();
                            } else {
                                throw new UnsupportedContentTypeException(contentType, type);
                            }
                        }
                    }
                    return parsedResult;
                })
                .orElse(null);
        log.debug("Response parsed successfully.");
        return result;
    }

    private Response callApi(HttpMethod method, String relativePath, Map<String, List<String>> headers, Map<String, List<String>> queryParams, InputStream body) {
        Request request = client.prepareAuthenticatedRequest(host, port, method, relativePath)
                .withHeaders(headers)
                .withQueryParams(queryParams)
                .withBody(body)
                .build();
        log.debug("Executing authenticated {} request with target {}", method, request.getUrl());
        return client.send(request);
    }
}
