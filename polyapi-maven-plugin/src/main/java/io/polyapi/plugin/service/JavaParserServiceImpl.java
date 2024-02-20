package io.polyapi.plugin.service;

import com.fasterxml.jackson.databind.JavaType;
import com.github.javaparser.JavaParser;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.ast.NodeList;
import com.github.javaparser.ast.PackageDeclaration;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.Parameter;
import com.github.javaparser.ast.body.TypeDeclaration;
import com.github.javaparser.ast.comments.JavadocComment;
import com.github.javaparser.ast.expr.*;
import com.github.javaparser.ast.stmt.BlockStmt;
import com.github.javaparser.ast.stmt.ExpressionStmt;
import com.github.javaparser.ast.stmt.ReturnStmt;
import com.github.javaparser.ast.type.ClassOrInterfaceType;
import com.github.javaparser.ast.type.Type;
import com.github.javaparser.metamodel.TypeMetaModel;
import com.github.javaparser.resolution.declarations.ResolvedParameterDeclaration;
import com.github.javaparser.resolution.types.ResolvedType;
import com.github.javaparser.symbolsolver.JavaSymbolSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.*;
import io.polyapi.commons.api.json.JsonParser;
import io.polyapi.commons.api.model.PolyGeneratedClass;
import io.polyapi.plugin.error.PolyApiMavenPluginException;
import io.polyapi.plugin.error.classloader.QualifiedNameNotFoundException;
import io.polyapi.plugin.model.TypeData;
import io.polyapi.plugin.model.function.CodeObject;
import io.polyapi.plugin.model.function.PolyFunction;
import io.polyapi.plugin.model.function.PolyFunctionArgument;
import io.polyapi.plugin.model.function.PolyFunctionMetadata;
import lombok.SneakyThrows;
import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.charset.Charset;
import java.util.*;

import static com.fasterxml.jackson.databind.type.TypeFactory.defaultInstance;
import static com.github.javaparser.ast.Modifier.Keyword.PUBLIC;
import static java.lang.Character.isUpperCase;
import static java.lang.String.format;
import static java.util.stream.Collectors.joining;
import static java.util.stream.IntStream.range;

public class JavaParserServiceImpl implements JavaParserService {
    private static final Logger logger = LoggerFactory.getLogger(JavaParserServiceImpl.class);
    private final JsonParser jsonParser;
    private final ClassLoader classLoader;
    private final JavaParser javaParser;

    public JavaParserServiceImpl(ClassLoader classLoader, JsonParser jsonParser) {
        this.classLoader = classLoader;
        this.javaParser = new JavaParser(new ParserConfiguration().setSymbolResolver(new JavaSymbolSolver(new ClassLoaderTypeSolver(classLoader))));
        this.jsonParser = jsonParser;
    }

    private TypeData parse(ResolvedType type) {
        logger.debug("Resolving type of method declaration.");
        TypeData result = new TypeData("void", null);
        if (!type.isVoid()) {
            logger.trace("Parsing loaded class to TypeData class.");
            result = new TypeData("object", jsonParser.toJsonSchema(toMap(type)));
        }
        logger.debug("Type resolved to {}.", result.name());
        return result;
    }

    private java.lang.reflect.Type toMap(ResolvedType type) {
        String qualifiedName = type.asReferenceType().getQualifiedName();
        String publicClassName = Arrays.stream(qualifiedName.split("\\."))
                .filter(keyword -> isUpperCase(keyword.toCharArray()[0]))
                .findFirst()
                .orElseThrow();// FIXME: Throw the appropriate exception.

        // Adding this way of defining the qualified name of a class because the library handles inner classes incorrectly, assigning them 'package.MainClass.InnerClass' when it should be 'package.MainClass$InnerClass'.
        String fixedQualifiedName = qualifiedName.substring(0, qualifiedName.indexOf(publicClassName)).concat(publicClassName).concat(qualifiedName.substring(qualifiedName.indexOf(publicClassName) + publicClassName.length()).replace(".", "$"));
        try {
            var typeFactory = defaultInstance();
            return typeFactory.constructParametricType(Class.forName(fixedQualifiedName, true, classLoader), type.asReferenceType().getTypeParametersMap().stream()
                    .map(pair -> pair.b)
                    .map(this::toMap)
                    .map(typeFactory::constructType)
                    .toArray(JavaType[]::new));
        } catch (ClassNotFoundException e) {
            throw new QualifiedNameNotFoundException(fixedQualifiedName, e);
        }
    }

    @Override
    @SneakyThrows(IOException.class)
    public PolyFunction parseFunction(PolyFunctionMetadata polyFunctionMetadata) {
        logger.debug("Parsing poly function metadata {}", polyFunctionMetadata);
        if (logger.isTraceEnabled()) {
            logger.trace("Function code: {}", IOUtils.toString(polyFunctionMetadata.sourceCode(), Charset.defaultCharset()));
            polyFunctionMetadata.sourceCode().reset();
        }
        var compilationUnit = javaParser.parse(polyFunctionMetadata.sourceCode()).getResult().orElseThrow();
        return compilationUnit.getTypes().stream()
                .map(TypeDeclaration::getMethods)
                .flatMap(List::stream)
                .filter(methodDeclaration -> {
                    String parsedMethodDeclaration = methodDeclaration.resolve().getSignature();
                    // Replacing '$' for '.' in polyfunctionMetadata.signature() because ResolvedMethodLikeDeclaration#signature() doesn't distinguish between inner classes and classes and therefore doesn't include the $ in the signature.
                    String fixedSignature = polyFunctionMetadata.signature().replace("$", ".");
                    boolean result = parsedMethodDeclaration.equals(fixedSignature);
                    logger.debug("'{}' compares to '{}'? {}", parsedMethodDeclaration, fixedSignature, result);
                    return result;
                })
                .peek(methodDeclaration -> logger.debug("Found matching method declaration: {}", methodDeclaration.getSignature()))
                .map(methodDeclaration -> {
                    CodeObject codeObject = new CodeObject();
                    codeObject.setPackageName(compilationUnit.getPackageDeclaration().map(PackageDeclaration::getName).map(Name::asString).orElse(""));
                    codeObject.setClassName(compilationUnit.getType(0).getNameAsString());
                    codeObject.setMethodName(methodDeclaration.getNameAsString());

                    var resolvedMethodDeclaration = methodDeclaration.resolve();
                    ClassOrInterfaceDeclaration classOrInterfaceDeclaration = compilationUnit.getType(0).asClassOrInterfaceDeclaration()
                            .addAnnotation(PolyGeneratedClass.class);
                    logger.debug("Creating PolyFunction from method declaration: {}", resolvedMethodDeclaration.getName());
                    var function = new PolyFunction();
                    function.setContext(polyFunctionMetadata.context());
                    methodDeclaration.getJavadocComment().map(JavadocComment::asString).ifPresent(function::setDescription);
                    function.setArguments(new ArrayList<>());
                    logger.trace("Parsing return type for {}.", resolvedMethodDeclaration.getName());
                    var typeData = parse(resolvedMethodDeclaration.getReturnType());
                    function.setName(resolvedMethodDeclaration.getName());
                    function.setReturnType(typeData.name());
                    logger.trace("Adding JSon schema to return type.");
                    if (!resolvedMethodDeclaration.getReturnType().isVoid()) {
                        function.setReturnTypeSchema(jsonParser.parseString(typeData.jsonSchema(), defaultInstance().constructMapType(HashMap.class, String.class, Object.class)));
                    }
                    logger.trace("Parsing parameters.");
                    range(0, resolvedMethodDeclaration.getNumberOfParams()).boxed().map(resolvedMethodDeclaration::getParam)
                            .peek(param -> logger.trace("    Parsing parameter {}.", param.getName()))
                            .map(param -> {
                                logger.debug("Adding parameter '{}' to execute method.", param.getName());
                                logger.trace("Converting to PolyFunctionArgument.");
                                var argument = new PolyFunctionArgument();
                                argument.setKey(param.getName());
                                argument.setName(param.getName());
                                var argumentTypeData = parse(param.getType());
                                switch (param.getType().asReferenceType().getQualifiedName()) {
                                    case "java.lang.Integer", "java.lang.Long", "java.lang.Number", "java.lang.Double", "java.lang.Float", "java.lang.Short", "java.lang.Byte" ->
                                            argument.setType("number");
                                    case "java.lang.Boolean" -> argument.setType("boolean");
                                    case "java.lang.String", "java.lang.Character" -> argument.setType("string");
                                    default -> {
                                        argument.setType("object");
                                        argument.setTypeSchema(argumentTypeData.jsonSchema());
                                    }
                                }
                                return argument;
                            })
                            .forEach(function.getArguments()::add);
                    codeObject.setParams(range(0, resolvedMethodDeclaration.getNumberOfParams()).boxed()
                            .map(resolvedMethodDeclaration::getParam)
                                    .map(ResolvedParameterDeclaration::describeType)
                                            .collect(joining(",")));
                    logger.trace("Parsed {} parameters.", function.getArguments().size());
                    codeObject.setCode(compilationUnit.toString());
                    function.setCode(jsonParser.toJsonString(codeObject));
                    function.setRequirements(polyFunctionMetadata.dependencies());
                    return function;
                })
                .findFirst()
                .orElse(null);
    }

    @Deprecated
    @Override
    public PolyFunction parseFunction(List<File> sourceRoots, List<String> jarPaths, File file, Method method, String description, String context) {
        try {
            logger.debug("Setting up a combined type solvers.");
            var combinedTypeSolver = new CombinedTypeSolver();
            sourceRoots.stream()
                    .peek(sourceRoot -> logger.debug("    Adding JavaParserTypeSolver."))
                    .map(JavaParserTypeSolver::new)
                    .forEach(combinedTypeSolver::add);
            jarPaths.stream()
                    .peek(path -> logger.debug("    Adding JarTypeSolver."))
                    .map(path -> {
                        try {
                            return new JarTypeSolver(path);
                        } catch (IOException e) {
                            // FIXME Throw an appropriate exception.
                            throw new PolyApiMavenPluginException(e);
                        }
                    })
                    .forEach(combinedTypeSolver::add);
            logger.debug("    Adding ReflectionTypeSolver.");
            combinedTypeSolver.add(new ReflectionTypeSolver());
            logger.debug("    Adding ClassLoaderTypeSolver for classloader defined above.");
            combinedTypeSolver.add(new ClassLoaderTypeSolver(classLoader));
            logger.debug("CombinedTypeSolver complete.");
            logger.debug("Setting up Java Parser.");
            var parser = new JavaParser(new ParserConfiguration().setSymbolResolver(new JavaSymbolSolver(combinedTypeSolver)));
            logger.debug("Parser complete.");
            logger.info("Proceeding with parsing of file in path '{}'.", file.getAbsolutePath());
            var compilationUnit = parser.parse(file).getResult().orElseThrow();
            var functions = new ArrayList<PolyFunction>();
            compilationUnit.getTypes().stream()
                    .map(TypeDeclaration::resolve)
                    .forEach(resolvedCompilationUnit -> {
                        resolvedCompilationUnit.getDeclaredMethods().stream()
                                .filter(methodDeclaration -> methodDeclaration.getName().equals(method.getName()))
                                .peek(methodDeclaration -> logger.debug("Found matching method declaration: {}", methodDeclaration.getSignature()))
                                .forEach(methodDeclaration -> {
                                    logger.debug("Creating PolyFunction from method declaration: {}", methodDeclaration.getName());
                                    var function = new PolyFunction();
                                    function.setDescription(description);
                                    function.setContext(context);
                                    function.setArguments(new ArrayList<>());
                                    logger.trace("Parsing return type for {}.", methodDeclaration.getName());
                                    var typeData = parse(methodDeclaration.getReturnType());
                                    function.setName(methodDeclaration.getName());
                                    function.setReturnType(typeData.name());
                                    logger.trace("Adding JSon schema to return type.");
                                    if (!methodDeclaration.getReturnType().isVoid()) {
                                        function.setReturnTypeSchema(jsonParser.parseString(typeData.jsonSchema(), defaultInstance().constructMapType(HashMap.class, String.class, Object.class)));
                                    }
                                    if (!methodDeclaration.getName().equals("execute")) {
                                        logger.debug("Adding execute() method for server to invoke.");
                                        MethodDeclaration executeMethod = compilationUnit.getType(0).asClassOrInterfaceDeclaration().addMethod("execute", PUBLIC)
                                                .setType(methodDeclaration.getReturnType().isVoid() ? "void" : methodDeclaration.getReturnType().asReferenceType().getQualifiedName().substring(methodDeclaration.getReturnType().asReferenceType().getQualifiedName().lastIndexOf('.') + 1))
                                                .setBody(new BlockStmt(NodeList.nodeList(Optional.of(new MethodCallExpr(methodDeclaration.getName(), range(0, methodDeclaration.getNumberOfParams()).boxed()
                                                                .map(methodDeclaration::getParam)
                                                                .map(ResolvedParameterDeclaration::getName)
                                                                .map(NameExpr::new)
                                                                .toArray(Expression[]::new)))
                                                        .map(expression -> methodDeclaration.getReturnType().isVoid() ? new ExpressionStmt(expression) : new ReturnStmt(expression)).get())));
                                        range(0, methodDeclaration.getNumberOfParams()).boxed().map(methodDeclaration::getParam)
                                                .forEach(param -> executeMethod.addParameter(param.asParameter().getType().asReferenceType().getQualifiedName().substring(param.asParameter().getType().asReferenceType().getQualifiedName().lastIndexOf('.') + 1), param.getName()));
                                    }
                                    logger.trace("Parsing parameters.");
                                    range(0, methodDeclaration.getNumberOfParams()).boxed().map(methodDeclaration::getParam)
                                            .peek(param -> logger.trace("    Parsing parameter {}.", param.getName()))
                                            .map(param -> {
                                                logger.debug("Adding parameter '{}' to execute method.", param.getName());
                                                logger.trace("Converting to PolyFunctionArgument.");
                                                var argument = new PolyFunctionArgument();
                                                argument.setKey(param.getName());
                                                argument.setName(param.getName());
                                                var argumentTypeData = parse(param.getType());
                                                switch (param.getType().asReferenceType().getQualifiedName()) {
                                                    case "java.lang.Integer", "java.lang.Long", "java.lang.Number", "java.lang.Double", "java.lang.Float", "java.lang.Short", "java.lang.Byte" ->
                                                            argument.setType("number");
                                                    case "java.lang.Boolean" -> argument.setType("boolean");
                                                    case "java.lang.String", "java.lang.Character" ->
                                                            argument.setType("string");
                                                    default -> {
                                                        argument.setType("object");
                                                        argument.setTypeSchema(argumentTypeData.jsonSchema());
                                                    }
                                                }
                                                return argument;
                                            })
                                            .forEach(function.getArguments()::add);
                                    logger.trace("Parsed {} parameters.", function.getArguments().size());
                                    compilationUnit.setPackageDeclaration("io.polyapi.knative.function");
                                    compilationUnit.getType(0).setName("PolyCustomFunction");
                                    function.setCode(compilationUnit.toString());
                                    functions.add(function);
                                });
                    });

            if (functions.isEmpty()) {
                throw new PolyApiMavenPluginException("No function with name " + method.getName() + " found in file: " + file.getAbsolutePath());
            } else if (functions.size() > 1) {
                throw new PolyApiMavenPluginException("More than one function with name " + method.getName() + " found in file: " + file.getAbsolutePath());
            }
            return functions.get(0);
        } catch (FileNotFoundException e) {
            throw new PolyApiMavenPluginException("Error parsing file", e);
        }

    }
}
