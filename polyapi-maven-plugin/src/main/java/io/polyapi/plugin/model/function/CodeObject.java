package io.polyapi.plugin.model.function;


import io.polyapi.commons.api.model.Visibility;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static java.lang.String.format;
import static java.util.stream.Collectors.joining;

@Getter
@Setter
public class CodeObject {
    private String packageName;
    private String className;
    private String methodName;
    private String params;
    private String code;
}
