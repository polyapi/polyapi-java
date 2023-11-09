package io.polyapi.client.generator;

import java.io.IOException;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import io.polyapi.client.model.property.ObjectPropertyType;
import io.polyapi.client.model.specification.ServerVariableSpecification;
import io.polyapi.client.utils.StringUtils;

public class VariContextClassGenerator extends SpecificationClassGenerator<ServerVariableSpecification> {

  private final LibraryTreeNode<ServerVariableSpecification> root = new LibraryTreeNode<>("Vari", true);
  public void generate(Collection<ServerVariableSpecification> specifications) throws IOException {
    for (ServerVariableSpecification spec : specifications) {
      insertIntoTree(root, spec);
    }

    generateClassesFromTree(root, PACKAGE_NAME_BASE + ".vari");
  }

  private void generateClassesFromTree(LibraryTreeNode<ServerVariableSpecification> node, String currentPackage) throws IOException {
    var context = new HashMap<String, Object>();
    var template = handlebars.compile("variContextClass");
    var className = StringUtils.toPascalCase(node.getContext());

    context.put("packageName", node.isRoot() ? PACKAGE_NAME_BASE : currentPackage);
    context.put("className", className);
    context.put("subContexts", getSubContexts(node, currentPackage));
    context.put("variables", node.getSpecifications());
    context.put("root", node.isRoot());

    generateTypeClasses(node, currentPackage);
    saveClassToFile(template.apply(context), node.isRoot() ? PACKAGE_NAME_BASE : currentPackage, className);

    for (Map.Entry<String, LibraryTreeNode<ServerVariableSpecification>> entry : node.getSubContexts().entrySet()) {
      var subContextPackage = currentPackage + "." + entry.getKey().toLowerCase();
      generateClassesFromTree(entry.getValue(), subContextPackage);
    }
  }

  private void generateTypeClasses(LibraryTreeNode<ServerVariableSpecification> node, String currentPackage) throws IOException {
    var specifications = node.getSpecifications();
    for (var specification : specifications) {
      var type = specification.getVariable().getValueType();
      if (type instanceof ObjectPropertyType) {
        generateObjectPropertyType(currentPackage, (ObjectPropertyType) type, StringUtils.toPascalCase(specification.getName()) + "$VariableValue");
      }

      generateVariableClass(specification, currentPackage);
    }
  }

  private void generateVariableClass(ServerVariableSpecification specification, String currentPackage) throws IOException {
    var context = new HashMap<String, Object>();
    var template = handlebars.compile("variableClass");
    var className = specification.getClassName();

    context.put("className", className);
    context.put("packageName", currentPackage);
    context.put("specification", specification);
    context.put("typeName", specification.getVariable().getValueType().getInCodeType());

    saveClassToFile(template.apply(context), currentPackage, className);
  }

  private List<Map<String, Object>> getSubContexts(LibraryTreeNode<ServerVariableSpecification> node, String currentPackage) {
    return node.getSubContexts().values().stream()
      .map(subContext -> {
        Map<String, Object> result = new HashMap<>();
        var className = StringUtils.toPascalCase(subContext.getContext());
        result.put("name", subContext.getContext());
        result.put("className", currentPackage + "." + className.toLowerCase() + "." + className);
        result.put("useStatic", node.isRoot());
        return result;
      })
      .toList();
  }
}
