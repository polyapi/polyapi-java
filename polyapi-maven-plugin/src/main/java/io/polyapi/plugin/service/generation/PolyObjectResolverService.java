package io.polyapi.plugin.service.generation;

import static java.lang.String.format;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects; 
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.IntStream;

import io.polyapi.plugin.model.generation.Context;
import io.polyapi.plugin.model.generation.KeyValuePair;
import io.polyapi.plugin.model.generation.ResolvedContext;
import io.polyapi.plugin.model.specification.function.ApiFunctionSpecification;
import io.polyapi.plugin.model.specification.function.AuthFunctionSpecification;
import io.polyapi.plugin.model.specification.function.ClientFunctionSpecification;
import io.polyapi.plugin.model.specification.function.FunctionSpecification;
import io.polyapi.plugin.model.specification.function.ServerFunctionSpecification;
import io.polyapi.plugin.model.specification.resolved.ResolvedApiFunctionSpecification;
import io.polyapi.plugin.model.specification.resolved.ResolvedAuthFunctionSpecification;
import io.polyapi.plugin.model.specification.resolved.ResolvedCustomFunctionSpecification;
import io.polyapi.plugin.model.specification.resolved.ResolvedFunctionSpecification;
import io.polyapi.plugin.model.specification.resolved.ResolvedServerFunctionSpecification;
import io.polyapi.plugin.model.specification.resolved.ResolvedServerVariableSpecification;
import io.polyapi.plugin.model.specification.resolved.ResolvedStandardAuthFunctionSpecification;
import io.polyapi.plugin.model.specification.resolved.ResolvedSubresourceAuthFunctionSpecification;
import io.polyapi.plugin.model.specification.resolved.ResolvedWebhookHandleSpecification;
import io.polyapi.plugin.model.specification.variable.ServerVariableSpecification;
import io.polyapi.plugin.model.specification.webhook.WebhookHandleSpecification;
import io.polyapi.plugin.model.type.PropertyPolyType;
import io.polyapi.plugin.model.type.complex.ObjectPolyType;
import io.polyapi.plugin.model.type.function.FunctionPolyType;
import io.polyapi.plugin.service.schema.JsonSchemaParser;
import io.polyapi.plugin.service.visitor.ImportsCollectorVisitor;
import io.polyapi.plugin.service.visitor.PolyObjectResolverVisitor;
import io.polyapi.plugin.service.visitor.TypeExtractionVisitor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class PolyObjectResolverService {
    private final JsonSchemaParser jsonSchemaParser;
    private static final Pattern VALID_IMPORT =
        Pattern.compile("^[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)+$");

    public PolyObjectResolverService(JsonSchemaParser jsonSchemaParser) {
        this.jsonSchemaParser = jsonSchemaParser;
    }

    public ResolvedServerFunctionSpecification resolve(ServerFunctionSpecification specification) {
        return resolve(specification, ResolvedServerFunctionSpecification::new);
    }

    public ResolvedCustomFunctionSpecification resolve(ClientFunctionSpecification specification) {
        Matcher matcher = Pattern.compile("public class [a-zA-Z0-9]*").matcher(specification.getCode());
        return resolve(specification, base -> new ResolvedCustomFunctionSpecification(base, matcher.find() ? matcher.group().substring(13) : base.getClassName()));
    }

    public ResolvedApiFunctionSpecification resolve(ApiFunctionSpecification specification) {
        return resolve(specification, ResolvedApiFunctionSpecification::new);
    }

    public ResolvedAuthFunctionSpecification resolve(AuthFunctionSpecification specification) {
        return resolve(specification, specification.getSubResource() == null ? base -> new ResolvedStandardAuthFunctionSpecification(base, specification.getFunction().getArguments().stream()
                .filter(argument -> argument.getName().equalsIgnoreCase("options"))
                .map(PropertyPolyType::getType)
                .map(ObjectPolyType.class::cast)
                .anyMatch(type -> type.getProperties().stream()
                        .anyMatch(property -> property.getName().equalsIgnoreCase("audience")))) : ResolvedSubresourceAuthFunctionSpecification::new);
    }

    public ResolvedWebhookHandleSpecification resolve(WebhookHandleSpecification specification) {
        String basePackage = specification.getPackageName();
        String className = specification.getClassName();
        ImportsCollectorVisitor importsCollectorVisitor = new ImportsCollectorVisitor(basePackage, className, jsonSchemaParser);
        importsCollectorVisitor.doVisit(specification);
        TypeExtractionVisitor typeExtractionVisitor = new TypeExtractionVisitor(className + "Event", basePackage, jsonSchemaParser);
        typeExtractionVisitor.doVisit(FunctionPolyType.class.cast(specification.getFunction().getArguments().get(0).getType()).getSpec().getArguments().get(0).getType());
        return new ResolvedWebhookHandleSpecification(specification.getId(), specification.getName(), basePackage, importsCollectorVisitor.getImports(), className, typeExtractionVisitor.getResult().getFullName());
    }

    public ResolvedServerVariableSpecification resolve(ServerVariableSpecification specification) {
        String basePackage = specification.getPackageName();
        String className = specification.getClassName();
        TypeExtractionVisitor typeExtractionVisitor = new TypeExtractionVisitor(specification.getTypeName(), basePackage, jsonSchemaParser);
        typeExtractionVisitor.doVisit(specification.getVariable());
        ImportsCollectorVisitor importsCollectorVisitor = new ImportsCollectorVisitor(basePackage, className, jsonSchemaParser);
        importsCollectorVisitor.doVisit(specification.getVariable());
        return new ResolvedServerVariableSpecification(specification.getId(), specification.getName(), basePackage, importsCollectorVisitor.getImports(), className, typeExtractionVisitor.getResult().getFullName(), specification.getVariable().isSecret());
    }

    public ResolvedContext resolve(Context context) {
        Set<String> imports = new HashSet<>();
        context.getSubcontexts().stream()
            .map(subcontext -> format("%s.%s", subcontext.getPackageName(), subcontext.getClassName()))
            .filter(s -> !s.isBlank())
            .forEach(imports::add);
        context.getSpecifications().forEach(specification -> {
            ImportsCollectorVisitor importsCollectorVisitor = new ImportsCollectorVisitor(specification.getPackageName(), specification.getClassName(), jsonSchemaParser);
            importsCollectorVisitor.doVisit(specification);
            importsCollectorVisitor.getImports().stream()
                .filter(Objects::nonNull)
                .filter(s -> !s.isBlank())
                .filter(s -> VALID_IMPORT.matcher(s).matches())
                .filter(s -> !s.substring(s.lastIndexOf('.') + 1).equals(context.getClassName()))
                .forEach(imports::add);
        });

        return new ResolvedContext(context.getName(), context.getPackageName(), imports, context.getClassName(), context.getSubcontexts().stream().map(this::resolve).toList(), context.getSpecifications().stream().map(specification -> {
            PolyObjectResolverVisitor visitor = new PolyObjectResolverVisitor(this);
            visitor.doVisit(specification);
            return visitor.getResult();
        }).toList());
    }

    private <T extends ResolvedFunctionSpecification> T resolve(FunctionSpecification specification, Function<ResolvedFunctionSpecification, T> constructor) {
        log.debug("Generating classes for {} function '{}'.", specification.getType(), specification.getName());
        String basePackage = specification.getPackageName();
        String className = specification.getClassName();
        ImportsCollectorVisitor importsCollectorVisitor = new ImportsCollectorVisitor(basePackage, className, jsonSchemaParser);
        specification.getFunction().accept(importsCollectorVisitor);
        List<KeyValuePair<String, String>> arguments = new ArrayList<>();
        List<PropertyPolyType> specificationArguments = specification.getFunction().getArguments();
        IntStream.range(0, specificationArguments.size()).forEach(i -> {
            PropertyPolyType argument = specificationArguments.get(i);
            TypeExtractionVisitor argumentTypeExtractionVisitor = new TypeExtractionVisitor(format("%sArg%s", className, i), basePackage, jsonSchemaParser);
            argument.accept(argumentTypeExtractionVisitor);
            arguments.add(new KeyValuePair<>(argument.getName(), argumentTypeExtractionVisitor.getResult().getFullName()));
        });
        TypeExtractionVisitor returnTypeExtractionVisitor = new TypeExtractionVisitor(format("%sResult", className), basePackage, jsonSchemaParser);
        Optional.ofNullable(specification.getFunction().getReturnType()).ifPresent(returnTypeExtractionVisitor::doVisit);
        return constructor.apply(new ResolvedFunctionSpecification(specification.getId(),
                specification.getName(),
                basePackage,
                importsCollectorVisitor.getImports(),
                className,
                specification.getName(),
                arguments,
                returnTypeExtractionVisitor.getResult().getFullName()));
    }
}
