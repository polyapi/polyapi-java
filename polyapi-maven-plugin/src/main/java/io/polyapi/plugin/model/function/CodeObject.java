package io.polyapi.plugin.model.function;


import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class CodeObject {
    private String packageName;
    private String className;
    private String methodName;
    private String params;
    private String availableContexts;
    private String code;
}
