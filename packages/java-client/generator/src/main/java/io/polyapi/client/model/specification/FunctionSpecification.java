package io.polyapi.client.model.specification;

import java.util.List;

import io.polyapi.client.model.property.PropertyType;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FunctionSpecification {
  private List<PropertySpecification> arguments;
  private PropertyType returnType;
  private Boolean synchronous;
}
