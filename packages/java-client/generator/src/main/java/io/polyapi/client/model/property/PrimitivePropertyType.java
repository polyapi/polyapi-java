package io.polyapi.client.model.property;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PrimitivePropertyType extends PropertyType {
  private String type;  // 'string' | 'number' | 'boolean'

  @Override
  public String getInCodeType() {
    return switch (type) {
      case "string" -> "String";
      case "number" -> "Number";
      case "boolean" -> "Boolean";
      default -> "Object";
    };
  }
}

