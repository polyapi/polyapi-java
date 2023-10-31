package io.polyapi.client.api;

import java.util.IdentityHashMap;
import java.util.Map;

import com.google.gson.JsonObject;

public class VariableInjectManager {
  private static VariableInjectManager instance;

  private final Map<Object, InjectedVariable> injectedVariables = new IdentityHashMap<>();

  private VariableInjectManager() {
  }

  public static VariableInjectManager getInstance() {
    if (instance == null) {
      instance = new VariableInjectManager();
    }
    return instance;
  }

  public void saveInjectedVariable(Object variableValue, InjectedVariable variable) {
    injectedVariables.put(variableValue, variable);
  }

  public Object getInjectedValueOrOriginal(Object value) {
    var injectedVariable = injectedVariables.remove(value);
    if (injectedVariable == null) {
      return value;
    }

//    var injectedVariablePayload = new JsonObject();
//    injectedVariablePayload.addProperty("type", "PolyVariable");
//    injectedVariablePayload.addProperty("id", injectedVariable.id());
//    if (injectedVariable.path() != null) {
//      injectedVariablePayload.addProperty("path", injectedVariable.path());
//    }
//    return injectedVariablePayload;

    return injectedVariable;
  }
}
