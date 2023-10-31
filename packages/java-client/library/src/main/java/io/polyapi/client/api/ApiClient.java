package io.polyapi.client.api;

import java.io.IOException;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import lombok.Getter;
import okhttp3.Headers;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class ApiClient {
  private final OkHttpClient client = new OkHttpClient();

  private static ApiClient instance;

  private ApiClient() {
  }

  public static ApiClient getInstance() {
    if (instance == null) {
      instance = new ApiClient();
    }

    return instance;
  }

  public ApiResponse get(String path) {
    var request = new Request.Builder()
      .url(ClientInfo.API_BASE_URL + path)
      .header("Authorization", "Bearer " + ClientInfo.API_KEY)
      .build();

    return executeRequest(request);
  }

  public ApiResponse post(String path, String jsonPayload) {
    var body = RequestBody.create(jsonPayload, MediaType.parse("application/json; charset=utf-8"));
    var request = new Request.Builder()
      .url(ClientInfo.API_BASE_URL + path)
      .header("Authorization", "Bearer " + ClientInfo.API_KEY)
      .post(body)
      .build();

    return executeRequest(request);
  }

  public ApiResponse patch(String path, String jsonPayload) {
    var body = RequestBody.create(jsonPayload, MediaType.parse("application/json; charset=utf-8"));
    var request = new Request.Builder()
      .url(ClientInfo.API_BASE_URL + path)
      .header("Authorization", "Bearer " + ClientInfo.API_KEY)
      .patch(body)
      .build();

    return executeRequest(request);
  }

  private ApiResponse executeRequest(Request request) {
    try (Response response = client.newCall(request).execute()) {
      if (!response.isSuccessful()) {
        throw new PolyRuntimeException("Error while executing request: " + response.code() + " " + response.message());
      }

      var body = response.body() != null  ? response.body().string() : null;

      return new ApiResponse(body, response.code(), toMap(response.headers()));
    } catch (IOException e) {
      throw new PolyRuntimeException(e);
    }
  }

  private Map<String, String> toMap(Headers headers) {
    return Stream.of(headers)
      .flatMap(header -> header.names().stream().map(name -> Map.entry(name, header.get(name))))
      .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
  }

  @Getter
  public static class ApiResponse {
    private String body;
    private int statusCode;
    private Map<String, String> headers;

    public ApiResponse(String body, int statusCode, Map<String, String> headers) {
      this.body = body;
      this.statusCode = statusCode;
      this.headers = headers;
    }
  }
}
