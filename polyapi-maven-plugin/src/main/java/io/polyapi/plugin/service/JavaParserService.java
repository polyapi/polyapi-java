package io.polyapi.plugin.service;

import io.polyapi.plugin.model.function.PolyFunction;
import io.polyapi.plugin.model.function.PolyFunctionMetadata;

import java.io.File;
import java.lang.reflect.Method;
import java.util.List;

public interface JavaParserService {

    @Deprecated
    PolyFunction parseFunction(List<File> sourceRoots, List<String> jarPaths, File file, Method method, String description, String context);
}
