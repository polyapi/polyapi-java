package io.polyapi.plugin.model.function;

import io.polyapi.commons.api.model.FunctionType;

import java.io.InputStream;
import java.util.List;

public record PolyFunctionMetadata(String name, String signature, FunctionType type, InputStream sourceCode, String context, List<String> dependencies, Boolean isDeployable) {

    @Override
    public String toString() {
        return "PolyFunctionMetadata{" +
                "name='" + name + '\'' +
                ", type=" + type +
                ", context='" + context + '\'' +
                ", dependencies=" + dependencies +
                '}';
    }

    public String getTypedType() {
        return type.name().toLowerCase();
    }
}
