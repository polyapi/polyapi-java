package io.polyapi.plugin.model.specification.function;

import io.polyapi.plugin.model.CustomType;
import io.polyapi.plugin.model.Generable;
import io.polyapi.plugin.service.visitor.CodeGenerationVisitor;
import io.polyapi.plugin.service.visitor.PolyVisitor;
import lombok.Getter;
import lombok.Setter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static java.lang.String.format;
import static java.util.regex.Pattern.CASE_INSENSITIVE;
import static java.util.regex.Pattern.MULTILINE;

@Getter
@Setter
public class CustomFunctionSpecification extends FunctionSpecification {
    private static final Logger logger = LoggerFactory.getLogger(CustomFunctionSpecification.class);
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
        logger.info(code);
        Matcher matcher = Pattern.compile("public class [a-zA-Z0-9]*").matcher(code);
        return matcher.find()? matcher.group().substring(13) : getClassName();
    }
}

