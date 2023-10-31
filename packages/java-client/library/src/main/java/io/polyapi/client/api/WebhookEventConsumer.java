package io.polyapi.client.api;

import java.util.Map;

@FunctionalInterface
public interface WebhookEventConsumer<E> {
  void accept(E event, Map<String, String> headers, Map<String, String> params);
}
