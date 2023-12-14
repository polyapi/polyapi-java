package io.polyapi.commons.api.service;

import io.polyapi.commons.api.error.http.UnexpectedHttpResponseException;
import io.polyapi.commons.api.error.http.UnexpectedInformationalResponseException;
import io.polyapi.commons.api.http.HttpClient;
import io.polyapi.commons.api.http.HttpMethod;
import io.polyapi.commons.api.http.Request;
import io.polyapi.commons.api.http.Response;
import io.polyapi.commons.api.json.JsonParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.lang.reflect.Type;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Predicate;

import static io.polyapi.commons.api.http.HttpMethod.GET;
import static io.polyapi.commons.api.http.HttpMethod.POST;
import static java.util.function.Predicate.not;

/**
 * Parent implementation class for all services that connecto the Poly API service.
 */
public class PolyApiService {
  private static final Logger logger = LoggerFactory.getLogger(PolyApiService.class);

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

  public <O> O get(String relativePath, Map<String, List<String>> headers, Map<String, List<String>> queryParams, Type expectedResponseType) {
    return parsedCall(GET, relativePath, headers, queryParams, null, expectedResponseType);
  }

  public <I, O> O post(String relativePath, Map<String, List<String>> headers, Map<String, List<String>> queryParams, I body, Type expectedResponseType) {
    return parsedCall(POST, relativePath, headers, queryParams, body, expectedResponseType);
  }

  private <I, O> O parsedCall(HttpMethod method, String relativePath, Map<String, List<String>> headers, Map<String, List<String>> queryParams, I body, Type expectedResponseType) {
    Map<String, List<String>> allHeaders = new HashMap<>();
    allHeaders.put("Accept", List.of("application/json"));
    allHeaders.put("Content-type", List.of("application/json"));
    headers.forEach((key, value) -> allHeaders.put(key, value.stream().toList()));

    Response response = callApi(method, relativePath, allHeaders, queryParams, jsonParser.toJsonInputStream(body));
    if (response.statusCode() < 200) {
      throw new UnexpectedInformationalResponseException(response);
    }
    if (response.statusCode() >= 400) {
      // TODO: Change this to more specific exceptions per code. As some may require actions rather than displaying an error (i.e. token refresh).
      switch (response.statusCode()) {
        default:
          throw new UnexpectedHttpResponseException(response);
      }
    }
    logger.debug("Response is successful. Status code is {}.", response.statusCode());
    logger.debug("Parsing response.");
    O result = Optional.of(expectedResponseType)
      .filter(not(Void.TYPE::equals))
      .map(type -> jsonParser.<O>parseInputStream(response.body(), type))
      .orElse(null);
    logger.debug("Response parsed successfully.");
    return result;
  }

  private Response callApi(HttpMethod method, String relativePath, Map<String, List<String>> headers, Map<String, List<String>> queryParams, InputStream body) {
    Request request = client.prepareAuthenticatedRequest(host, port, method, relativePath)
      .withHeaders(headers)
      .withQueryParams(queryParams)
      .withBody(body)
      .build();
    logger.debug("Executing authenticated GET request with target {}", request.getUrl());
    return client.send(request);
  }
}
