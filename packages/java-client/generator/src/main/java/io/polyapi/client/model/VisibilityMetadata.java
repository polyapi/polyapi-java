package io.polyapi.client.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VisibilityMetadata {
  private Visibility visibility;
  private String foreignTenantName;
}

