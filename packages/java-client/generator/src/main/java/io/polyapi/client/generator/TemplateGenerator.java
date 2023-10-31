package io.polyapi.client.generator;

import java.util.List;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Helper;
import com.github.jknack.handlebars.io.ClassPathTemplateLoader;
import com.github.jknack.handlebars.io.TemplateLoader;
import io.polyapi.client.model.specification.PropertySpecification;

public class TemplateGenerator extends Handlebars {
  private final JsonSchemaToTypeGenerator jsonSchemaToTypeGenerator = new JsonSchemaToTypeGenerator();

  public TemplateGenerator() {
    super(getTemplateLoader());
    registerHelpers();
  }

  private static TemplateLoader getTemplateLoader() {
    TemplateLoader loader = new ClassPathTemplateLoader();
    loader.setPrefix("/templates");
    loader.setSuffix(".hbs");
    return loader;
  }

  private void registerHelpers() {
    registerHelper("ifIsType", ifIsType());
    registerHelper("renderArguments", renderArguments());
    registerHelper("ifEquals", ifEquals());
  }

  private Helper<Object> ifEquals() {
    return (value, options) -> {
      if (value.equals(options.param(0))) {
        return options.fn();
      }
      return options.inverse();
    };
  }

  private static Helper<Object> renderArguments() {
    return (argsList, options) -> {
      var result = new StringBuilder();
      for (int i = 0; i < ((List<?>) argsList).size(); i++) {
        var property = (PropertySpecification) ((List<?>) argsList).get(i);
        result.append(property.getType().getInCodeType()).append(" ").append(property.getInCodeName());
        if (i < ((List<?>) argsList).size() - 1) {
          result.append(", ");
        }
      }
      return result.toString();
    };
  }

  private static Helper<Object> ifIsType() {
    return (object, options) -> {
      if (object.getClass().getSimpleName().equals(options.param(0))) {
        return options.fn();
      }
      return options.inverse();
    };
  }
}
