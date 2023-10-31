package io.polyapi.client.api;

@FunctionalInterface
public interface AuthTokenEventConsumer {
  void accept(String token, String url, String error);
}
