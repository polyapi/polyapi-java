package io.polyapi.plugin.model.specification.function;

import io.polyapi.plugin.service.visitor.PolyVisitor;
import lombok.Getter;
import lombok.Setter;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Getter
@Setter
public class CustomFunctionSpecification extends FunctionSpecification {
    private String[] requirements;
    private String code;
    private String language;

    @Override
    protected String getSubtypePackage() {
        return "custom";
    }

    @Override
    public void accept(PolyVisitor visitor) {
        visitor.visit(this);
    }

    public boolean isJava() {
        return "java".equals(language);
    }

    public String getDelegate() {
        Matcher matcher = Pattern.compile("public class [a-zA-Z0-9]*").matcher(code);
        return matcher.find()? matcher.group().substring(13) : getClassName();
    }
}

