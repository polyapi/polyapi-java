package io.polyapi.client.model.property;

import io.polyapi.client.model.specification.FunctionSpecification;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FunctionPropertyType extends PropertyType {
  private String name;
  private FunctionSpecification spec;
}
