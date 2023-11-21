package io.polyapi.client.api;

import org.json.JSONObject;

import com.fasterxml.jackson.core.JsonProcessingException;

public class ObjectMapper extends com.fasterxml.jackson.databind.ObjectMapper {
  private static ObjectMapper instance;

  private ObjectMapper() {
    super();
    configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
  }

  public static ObjectMapper getInstance() {
    if (instance == null) {
      instance = new ObjectMapper();
    }
    return instance;
  }

  @Override
  public <T> T readValue(String src, Class<T> valueType) throws JsonProcessingException {
    if (valueType == String.class) {
      return (T) src;
    }
    return super.readValue(src, valueType);
  }

  public <T> Object toJSONValue(Object value) {
    if (
      value == null
        || value instanceof String
        || value instanceof Number
        || value instanceof Boolean
    ) {
      return value;
    } else {
      return new JSONObject(value);
    }
  }
}
