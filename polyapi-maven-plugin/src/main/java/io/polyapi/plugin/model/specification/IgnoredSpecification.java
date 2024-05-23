package io.polyapi.plugin.model.specification;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class IgnoredSpecification extends Specification {
    @Override
    public String getSpecificationType() {
        return "ignored";
    }
}
