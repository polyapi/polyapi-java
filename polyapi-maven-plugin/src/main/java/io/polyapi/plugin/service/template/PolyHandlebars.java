package io.polyapi.plugin.service.template;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Options;
import com.github.jknack.handlebars.io.ClassPathTemplateLoader;
import io.polyapi.plugin.model.specification.function.FunctionSpecification;

import java.util.Collection;
import java.util.stream.IntStream;

import static io.polyapi.plugin.utils.StringUtils.toPascalCase;
import static java.lang.String.format;
import static java.util.stream.Collectors.joining;

public class PolyHandlebars extends Handlebars {

    public PolyHandlebars() {
        super(new ClassPathTemplateLoader("/templates", ".hbs"));
        registerHelper("ifIsType", new ConditionHelper<>((object, options) -> object.getClass().getSimpleName().equals(options.param(0))));
        registerHelper("ifIsNotEmpty", new ConditionHelper<>((Collection<?> collection, Options options) -> !collection.isEmpty()));
        registerHelper("renderArguments", (FunctionSpecification specification, Options options) ->
                IntStream.range(0, specification.getFunction().getArguments().size())
                        .boxed()
                        .map(i -> format("%s %s", specification.getFunction().getArguments().get(i).getType().getType(format("%s$%s", specification.getClassName(), toPascalCase(specification.getFunction().getArguments().get(i).getName()))), specification.getFunction().getArguments().get(i).getInCodeName()))
                        .collect(joining(", ")));
        registerHelper("ifEquals", new ConditionHelper<>((value, options) -> value.equals(options.param(0))));
        registerHelper("isNull", new ConditionHelper<>((value, options) -> value == null));
    }
}
