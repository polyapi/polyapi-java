package io.polyapi.client.model.specification;

import io.polyapi.client.model.property.PropertyType;
import io.polyapi.client.utils.StringUtils;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PropertySpecification {
  private String name;
  private String description;
  private PropertyType type;
  private boolean required;
  private Boolean nullable;

  public String getInCodeName() {
    return StringUtils.toCamelCase(name);
  }
}
