package io.polyapi.client.model.property;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import io.polyapi.client.model.specification.PropertySpecification;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ObjectPropertyType extends PropertyType {
  private JsonNode schema;
  private List<PropertySpecification> properties;
  private String typeName;

  @Override
  public String getInCodeType() {
    if (typeName != null && !typeName.isEmpty()) {
      return typeName;
    }
    return "Object";
  }
}
