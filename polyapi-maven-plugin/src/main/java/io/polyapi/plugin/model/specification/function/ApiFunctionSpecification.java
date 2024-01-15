package io.polyapi.plugin.model.specification.function;

import io.polyapi.plugin.model.specification.ApiType;
import lombok.Getter;
import lombok.Setter;

import static java.lang.String.format;

@Getter
@Setter
public class ApiFunctionSpecification extends FunctionSpecification {
    private ApiType apiType;

    @Override
    public String getResultType() {
        return format("ApiFunctionResponse<%s>", super.getResultType());
    }

    @Override
    protected String getSubtypePackage() {
        return "api";
    }
}
