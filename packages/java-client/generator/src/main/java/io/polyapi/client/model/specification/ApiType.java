package io.polyapi.client.model.specification;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum ApiType {
  GRAPHQL("graphql"),
  REST("rest");

  private final String jsonValue;

  ApiType(String jsonValue) {
    this.jsonValue = jsonValue;
  }

  @JsonValue
  public String jsonValue() {
    return this.jsonValue;
  }

  @JsonCreator
  public static ApiType fromJsonValue(String jsonValue) {
    for (ApiType type : ApiType.values()) {
      if (type.jsonValue.equalsIgnoreCase(jsonValue)) {
        return type;
      }
    }
    throw new IllegalArgumentException("Unexpected value '" + jsonValue + "'");
  }
}
