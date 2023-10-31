package io.polyapi.client.model.specification;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class WebhookHandleSpecification extends Specification {
  private FunctionSpecification function;
}
