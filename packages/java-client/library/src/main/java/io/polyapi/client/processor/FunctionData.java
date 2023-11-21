package io.polyapi.client.processor;

import java.util.ArrayList;
import java.util.List;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FunctionData {
  private String name;
  private String code;
  private String returnType;
  private String returnTypeSchema;
  private List<ArgumentData> arguments = new ArrayList<>();
}
