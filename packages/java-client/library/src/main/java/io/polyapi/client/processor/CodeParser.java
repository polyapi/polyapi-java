package io.polyapi.client.processor;

import java.io.File;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.apache.maven.artifact.DependencyResolutionRequiredException;
import org.apache.maven.project.MavenProject;
import org.jetbrains.annotations.NotNull;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.javaparser.JavaParser;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.Modifier;
import com.github.javaparser.ast.NodeList;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.Parameter;
import com.github.javaparser.ast.expr.ArrayCreationExpr;
import com.github.javaparser.ast.expr.MarkerAnnotationExpr;
import com.github.javaparser.ast.expr.NormalAnnotationExpr;
import com.github.javaparser.ast.expr.ObjectCreationExpr;
import com.github.javaparser.ast.expr.SingleMemberAnnotationExpr;
import com.github.javaparser.ast.expr.VariableDeclarationExpr;
import com.github.javaparser.ast.stmt.BlockStmt;
import com.github.javaparser.ast.type.Type;
import com.github.javaparser.ast.visitor.VoidVisitorAdapter;
import com.github.javaparser.symbolsolver.JavaSymbolSolver;
import com.github.javaparser.symbolsolver.javaparsermodel.declarations.JavaParserClassDeclaration;
import com.github.javaparser.symbolsolver.resolution.typesolvers.ClassLoaderTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.CombinedTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.JarTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.JavaParserTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.ReflectionTypeSolver;
import com.kjetland.jackson.jsonSchema.JsonSchemaGenerator;

public class CodeParser {

  public List<FunctionData> parseFunctionData(MavenProject project, String name, File file) throws CodeParserException {
    try {
      var functions = new ArrayList<FunctionData>();
      var classLoader = getClassLoader(project);

      var combinedTypeSolver = new CombinedTypeSolver();
      project.getCompileSourceRoots()
        .forEach(path -> combinedTypeSolver.add(new JavaParserTypeSolver(new File(path))));
      combinedTypeSolver.add(new JavaParserTypeSolver(project.getBasedir() + "/target/generated-sources"));
      project.getCompileClasspathElements().stream()
        .filter(path -> path.endsWith(".jar"))
        .forEach(path -> {
          try {
            combinedTypeSolver.add(new JarTypeSolver(path));
          } catch (Exception e) {
            throw new RuntimeException(e);
          }
        });
      combinedTypeSolver.add(new ReflectionTypeSolver());
      combinedTypeSolver.add(new ClassLoaderTypeSolver(classLoader));

      var symbolSolver = new JavaSymbolSolver(combinedTypeSolver);
      var parser = new JavaParser(new ParserConfiguration().setSymbolResolver(symbolSolver));
      var compilationUnit = parser.parse(file).getResult().get();

      for (MethodDeclaration md : compilationUnit.findAll(MethodDeclaration.class)) {
        if (md.getNameAsString().equals(name)) {
          functions.add(parseMethodDeclaration(md, classLoader, compilationUnit, parser));
        }
      }
      return functions;
    } catch (Exception e) {
      throw new CodeParserException(e.getMessage(), e);
    }
  }

  @NotNull
  private ClassLoader getClassLoader(MavenProject project) throws DependencyResolutionRequiredException, MalformedURLException {
    var classpathElements = new ArrayList<>(project.getCompileClasspathElements());
    classpathElements.addAll(project.getRuntimeClasspathElements());
    classpathElements.add(project.getBuild().getOutputDirectory());

    var urls = new URL[classpathElements.size()];
    for (int i = 0; i < classpathElements.size(); i++) {
      urls[i] = new File(classpathElements.get(i)).toURI().toURL();
    }
    return new URLClassLoader(urls, getClass().getClassLoader());
  }

  private FunctionData parseMethodDeclaration(MethodDeclaration md, ClassLoader classLoader, CompilationUnit compilationUnit, JavaParser parser) throws JsonProcessingException, CodeParserException {
    var functionData = new FunctionData();
    var typeData = resolveTypeData(md.getType(), classLoader);

    functionData.setName(md.getNameAsString());
    functionData.setReturnType(typeData.name());
    functionData.setReturnTypeSchema(typeData.jsonSchema());

    for (Parameter param : md.getParameters()) {
      var argumentData = new ArgumentData();
      var argumentTypeData = resolveTypeData(param.getType(), classLoader);

      argumentData.setName(param.getNameAsString());
      argumentData.setType(argumentTypeData.name());
      argumentData.setTypeSchema(argumentTypeData.jsonSchema());

      functionData.getArguments().add(argumentData);
    }

    var generatedCode = generateClientFunctionClass(md, parser);

    md.accept(new TypeResolver(compilationUnit, parser), generatedCode);

    addAdditionalImports(compilationUnit, generatedCode);
    addExecuteInternalMethod(md, generatedCode);
    functionData.setCode(generatedCode.toString());

    return functionData;
  }

  private static void addAdditionalImports(CompilationUnit cu, CompilationUnit generatedCode) {
    cu.getImports().stream()
      .filter(importDeclaration ->
        generatedCode.getTypes().stream()
          .noneMatch(typeDeclaration -> {
            var type = typeDeclaration.asClassOrInterfaceDeclaration();
            return importDeclaration.getNameAsString().endsWith(type.getNameAsString());
          })
      )
      .forEach(generatedCode::addImport);
  }

  private static void addExecuteInternalMethod(MethodDeclaration md, CompilationUnit generatedCode) {
    var executeInternal = generatedCode.getType(0).asClassOrInterfaceDeclaration().addMethod("executeInternal", Modifier.Keyword.PRIVATE)
      .setType(md.getType())
      .setBody(md.getBody().orElse(new BlockStmt(NodeList.nodeList())));
    md.getParameters()
      .forEach(param -> {
        executeInternal.addParameter(param.getType(), param.getNameAsString());
      });
  }

  @NotNull
  private static CompilationUnit generateClientFunctionClass(MethodDeclaration md, JavaParser parser) {
    var compilationUnit = new CompilationUnit();
    var customFunctionClass = new ClassOrInterfaceDeclaration();

    compilationUnit.addImport("io.polyapi.client.api.*");

    customFunctionClass.setName("PolyCustomFunction");
    var executeMethod = customFunctionClass.addMethod("execute");
    executeMethod.setType(Object.class);
    md.getParameters()
      .forEach(param -> {
        executeMethod.addParameter("Object", param.getNameAsString());
      });
    executeMethod.setBody(parser.parseBlock(getExecuteMethodBody(md)).getResult().get());

    compilationUnit.addType(customFunctionClass);
    return compilationUnit;
  }

  private static String getExecuteMethodBody(MethodDeclaration md) {
    var body = new StringBuilder();

    body.append("{\n");
    body.append("  try {\n");
    body.append("    return executeInternal(\n");

    var parameters = md.getParameters();
    for (int index = 0, parametersSize = parameters.size(); index < parametersSize; index++) {
      var param = parameters.get(index);
      body.append("      ObjectMapper.getInstance().convertValue(").append(param.getNameAsString()).append(", ").append(param.getTypeAsString()).append(".class)");
      if (index < parametersSize - 1) {
        body.append(",\n");
      } else {
        body.append("\n");
      }
    }
    body.append("    );\n");
    body.append("  } catch (Exception e) {\n");
    body.append("    throw new PolyRuntimeException(e);\n");
    body.append("  }\n");
    body.append("}");

    return body.toString();
  }

  private TypeData resolveTypeData(Type type, ClassLoader classLoader) throws JsonProcessingException, CodeParserException {
    if (type.isVoidType()) {
      return new TypeData("void", null);
    }

    var isArray = type.isArrayType();

    var resolvedType = isArray ? type.getElementType().resolve() : type.resolve();
    var qualifiedName = resolvedType.asReferenceType().getQualifiedName();
    Class<?> clazz;
    try {
      clazz = classLoader.loadClass(qualifiedName);
    } catch (ClassNotFoundException e) {
      throw new CodeParserException("Class not found: " + qualifiedName + ". Make sure you have compiled your project.", e);
    }

    if (String.class.isAssignableFrom(clazz)) {
      return new TypeData("object", wrapInArrayConditionally("{\"type\": \"string\"}", isArray));
    }
    if (Integer.class.isAssignableFrom(clazz)) {
      return new TypeData("object", wrapInArrayConditionally("{\"type\": \"integer\"}", isArray));
    }
    if (Number.class.isAssignableFrom(clazz)) {
      return new TypeData("object", wrapInArrayConditionally("{\"type\": \"number\"}", isArray));
    }
    if (Boolean.class.isAssignableFrom(clazz)) {
      return new TypeData("object", wrapInArrayConditionally("{\"type\": \"boolean\"}", isArray));
    }

    return new TypeData("object", wrapInArrayConditionally(resolveClassSchema(clazz), isArray));
  }

  private String resolveClassSchema(Class<?> clazz) throws JsonProcessingException {
    var objectMapper = new ObjectMapper();
    var jsonSchemaGenerator = new JsonSchemaGenerator(objectMapper);
    var jsonSchema = jsonSchemaGenerator.generateJsonSchema(clazz);
    return objectMapper.writeValueAsString(jsonSchema);
  }

  private String wrapInArrayConditionally(String schema, boolean wrap) {
    return wrap ? "{\"type\": \"array\", \"items\": " + schema + "}" : schema;
  }

  private record TypeData(String name, String jsonSchema) {
  }

  private static class TypeResolver extends VoidVisitorAdapter<CompilationUnit> {

    private final CompilationUnit cu;
    private final JavaParser parser;

    public TypeResolver(CompilationUnit cu, JavaParser parser) {
      this.cu = cu;
      this.parser = parser;
    }

    @Override
    public void visit(VariableDeclarationExpr expr, CompilationUnit generatedCode) {
      super.visit(expr, generatedCode);
      expr.getVariables().forEach(vd -> {
        resolveType(vd.getType(), generatedCode);
      });
    }

    @Override
    public void visit(ObjectCreationExpr expr, CompilationUnit generatedCode) {
      super.visit(expr, generatedCode);
      resolveType(expr.getType(), generatedCode);
    }

    @Override
    public void visit(ArrayCreationExpr expr, CompilationUnit generatedCode) {
      super.visit(expr, generatedCode);
      resolveType(expr.getElementType(), generatedCode);
    }

    @Override
    public void visit(Parameter param, CompilationUnit generatedCode) {
      super.visit(param, generatedCode);
      resolveType(param.getType(), generatedCode);
    }

    private void resolveType(Type type, CompilationUnit generatedCode) {
      if (type.isArrayType()) {
        type = type.getElementType();
      }
      if (isIgnoredType(type)) {
        return;
      }

      try {
        var resolvedType = type.resolve();
        if (resolvedType.isReferenceType()) {
          var typeDeclaration = resolvedType.asReferenceType().getTypeDeclaration().get();
          if (isInIgnoredPackage(typeDeclaration.getQualifiedName())) {
            return;
          }

          if (typeDeclaration instanceof JavaParserClassDeclaration) {
            var classCode = ((JavaParserClassDeclaration) typeDeclaration).getWrappedNode().getParentNode().get().toString();
            var classCompilationUnit = parser.parse(classCode).getResult().get();
            classCompilationUnit.accept(new TypeResolver(cu, parser), generatedCode);

            classCompilationUnit.getImports()
              .forEach(generatedCode::addImport);
            classCompilationUnit.getTypes()
              .forEach(classType -> {
                generatedCode.getType(0).asClassOrInterfaceDeclaration().addMember(classType);
              });
          }
        }
      } catch (IllegalStateException e) {
        // not resolvable type, skipping
      }
    }

    private boolean isInIgnoredPackage(String qualifiedName) {
      var ignoredPackages = new String[]{
        "java.lang.",
        "io.polyapi."
      };

      return Arrays.stream(ignoredPackages)
        .anyMatch(qualifiedName::startsWith);
    }

    private boolean isIgnoredType(Type type) {
      if (type.isVarType()) {
        return true;
      }
      if (type.isPrimitiveType()) {
        return true;
      }

      return false;
    }
  }
}
