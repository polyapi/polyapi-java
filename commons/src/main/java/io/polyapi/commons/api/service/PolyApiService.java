package io.polyapi.commons.api.service;

import io.polyapi.commons.api.error.http.UnexpectedHttpResponseException;
import io.polyapi.commons.api.error.http.UnexpectedInformationalResponseException;
import io.polyapi.commons.api.http.HttpClient;
import io.polyapi.commons.api.http.HttpMethod;
import io.polyapi.commons.api.http.Request;
import io.polyapi.commons.api.http.Response;
import io.polyapi.commons.api.json.JsonParser;
import lombok.extern.slf4j.Slf4j;

import java.io.InputStream;
import java.lang.reflect.Type;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static io.polyapi.commons.api.http.HttpMethod.*;
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

  public PolyApiService(String host, Integer port, HttpClient client, JsonParser jsonParser) {
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

  private <I, O> O parsedCall(HttpMethod method, String relativePath, Map<String, List<String>> headers, Map<String, List<String>> queryParams, I body, Type expectedResponseType) {
    Map<String, List<String>> allHeaders = new HashMap<>();
    allHeaders.put("Accept", List.of("application/json"));
    allHeaders.put("Content-type", List.of("application/json"));
    headers.forEach((key, value) -> allHeaders.put(key, value.stream().toList()));

    Response response = callApi(method, relativePath, allHeaders, queryParams, jsonParser.toJsonInputStream(body));
    log.debug("Response is successful. Status code is {}.", response.statusCode());
    log.debug("Parsing response.");
    O result = Optional.of(expectedResponseType)
      .filter(not(Void.TYPE::equals))
      .map(type -> jsonParser.<O>parseInputStream(response.body(), type))
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
