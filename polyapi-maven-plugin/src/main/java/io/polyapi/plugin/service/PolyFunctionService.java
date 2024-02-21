package io.polyapi.plugin.service;

import io.polyapi.plugin.model.function.PolyFunction;
import io.polyapi.plugin.model.function.PolyFunctionMetadata;

public interface PolyFunctionService {

    PolyFunction postServerFunction(PolyFunction polyFunction);

    PolyFunction postClientFunction(PolyFunction polyFunction);

    String deploy(String type, PolyFunction polyFunction);
}
