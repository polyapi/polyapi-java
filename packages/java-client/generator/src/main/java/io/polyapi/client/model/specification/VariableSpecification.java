package io.polyapi.client.model.specification;

import io.polyapi.client.model.property.PropertyType;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VariableSpecification {
  private String environmentId;
  private boolean secret;
  private PropertyType valueType;
  private Object value;

  public VariableSpecification() {
    var obj = new Object();

  }
}
