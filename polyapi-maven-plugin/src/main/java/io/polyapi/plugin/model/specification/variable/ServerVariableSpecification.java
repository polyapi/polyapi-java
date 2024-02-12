package io.polyapi.plugin.model.specification.variable;

import io.polyapi.plugin.model.specification.Specification;
import io.polyapi.plugin.service.visitor.PolyVisitor;
import lombok.Getter;
import lombok.Setter;

import java.util.Set;
import java.util.stream.Stream;

import static java.lang.String.format;
import static java.util.stream.Collectors.toSet;
import static java.util.stream.Stream.concat;

@Getter
@Setter
public class ServerVariableSpecification extends Specification {
    private VariableSpecification variable;

    @Override
    protected String getTypePackage() {
        return "variable.server";
    }

    public String getValueType() {
        return variable.getValueType().getType(getClassName());
    }

    @Override
    public void accept(PolyVisitor visitor) {
        visitor.visit(this);
    }

    @Override
    public Set<String> getImports() {
        return concat(Stream.of(format("%s.%sHandler", getPackageName(), getClassName())), variable.getValueType().getImports(getPackageName(), getClassName()).stream()).collect(toSet());
    }
}
