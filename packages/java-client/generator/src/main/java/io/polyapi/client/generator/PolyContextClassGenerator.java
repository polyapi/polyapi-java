package io.polyapi.client.generator;

import java.io.IOException;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import io.polyapi.client.model.property.FunctionPropertyType;
import io.polyapi.client.model.property.ObjectPropertyType;
import io.polyapi.client.model.specification.ApiFunctionSpecification;
import io.polyapi.client.model.specification.CustomFunctionSpecification;
import io.polyapi.client.model.specification.FunctionSpecification;
import io.polyapi.client.model.specification.PropertySpecification;
import io.polyapi.client.model.specification.Specification;
import io.polyapi.client.model.specification.WebhookHandleSpecification;
import io.polyapi.client.utils.StringUtils;

public class PolyContextClassGenerator extends SpecificationClassGenerator<Specification> {

  private final LibraryTreeNode<Specification> root = new LibraryTreeNode<>("Poly", true);

  public void generate(Collection<Specification> specifications) throws IOException {
    for (Specification spec : specifications) {
      insertIntoTree(root, spec);
    }

    generateClassesFromTree(root, PACKAGE_NAME_BASE + ".poly");
  }

  private void generateClassesFromTree(LibraryTreeNode<Specification> node, String currentPackage) throws IOException {
    var context = new HashMap<String, Object>();
    var template = handlebars.compile("polyContextClass");
    var className = StringUtils.toPascalCase(node.getContext());

    context.put("packageName", node.isRoot() ? PACKAGE_NAME_BASE : currentPackage);
    context.put("className", className);
    context.put("subContexts", getSubContexts(node, currentPackage));
    context.put("specifications", node.getSpecifications());
    context.put("useStatic", node.isRoot());

    generateTypeClasses(node, currentPackage);
    saveClassToFile(template.apply(context), node.isRoot() ? PACKAGE_NAME_BASE : currentPackage, className);

    for (Map.Entry<String, LibraryTreeNode<Specification>> entry : node.getSubContexts().entrySet()) {
      var subContextPackage = node.isRoot() ? currentPackage : currentPackage + "." + entry.getKey().toLowerCase();
      generateClassesFromTree(entry.getValue(), subContextPackage);
    }
  }

  private void generateTypeClasses(LibraryTreeNode<Specification> node, String currentPackage) {
    var specifications = node.getSpecifications();
    for (var specification : specifications) {
      if (specification instanceof ApiFunctionSpecification apiFunctionSpecification) {
        generateFunctionTypeClasses(specification, apiFunctionSpecification.getFunction(), currentPackage);
      }
      if (specification instanceof CustomFunctionSpecification customFunctionSpecification && customFunctionSpecification.isJava()) {
        var className = customFunctionSpecification.getClassName();
        var classContent = "package " + currentPackage + ";\n\n" +
          customFunctionSpecification.getCode();

        saveClassToFile(
          classContent
            .replace("class PolyCustomFunction", "class " + className),
          currentPackage,
          className
        );
        generateFunctionTypeClasses(specification, customFunctionSpecification.getFunction(), currentPackage);
      }
      if (specification instanceof WebhookHandleSpecification webhookHandleSpecification) {
        var type = ((FunctionPropertyType) webhookHandleSpecification.getFunction().getArguments().get(0).getType()).getSpec().getArguments().get(0).getType();
        if (type instanceof ObjectPropertyType) {
          generateObjectPropertyType(currentPackage, (ObjectPropertyType) type, StringUtils.toPascalCase(specification.getName()) + "$EventType");
        }
      }
    }
  }

  private void generateFunctionTypeClasses(Specification specification, FunctionSpecification functionSpecification, String packageName) {
    if (functionSpecification.getReturnType() instanceof ObjectPropertyType returnType) {
      generateObjectPropertyType(packageName, returnType, StringUtils.toPascalCase(specification.getName()) + "$ReturnType");
    }

    for (PropertySpecification argument : functionSpecification.getArguments()) {
      if (argument.getType() instanceof ObjectPropertyType argumentType) {
        generateObjectPropertyType(packageName, argumentType, StringUtils.toPascalCase(specification.getName()) + "$" + StringUtils.toPascalCase(argument.getName()));
      }
    }
  }

  private List<Map<String, Object>> getSubContexts(LibraryTreeNode<Specification> node, String currentPackage) {
    return node.getSubContexts().values().stream()
      .map(subContext -> {
        Map<String, Object> result = new HashMap<>();
        var className = StringUtils.toPascalCase(subContext.getContext());
        result.put("name", subContext.getContext());
        result.put("className", node.isRoot() ? currentPackage + "." + className : currentPackage + "." + className.toLowerCase() + "." + className);
        result.put("useStatic", node.isRoot());
        return result;
      })
      .toList();
  }
}
