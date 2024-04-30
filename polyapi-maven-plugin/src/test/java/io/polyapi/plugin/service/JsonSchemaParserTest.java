package io.polyapi.plugin.service;

import io.polyapi.plugin.model.generation.CustomType;
import io.polyapi.plugin.model.specification.function.ApiFunctionSpecification;
import io.polyapi.plugin.service.schema.JsonSchemaParser;
import org.apache.commons.io.IOUtils;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

import static java.lang.String.format;
import static java.nio.charset.Charset.defaultCharset;
import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class JsonSchemaParserTest {
    private static final String DEFAULT_RESPONSE_NAME = "ResponseType";
    private final JsonSchemaParser jsonSchemaParser = new JsonSchemaParser();

    public static Stream<Arguments> generateSource() {
        return Stream.of(createArguments(1, "Simple recursive schema with no base type.", "Data", DEFAULT_RESPONSE_NAME),
                createArguments(2, "Recursive schema with base type.", "Coupon", "Discount", "Address", "CouponMetadata", "ResponseTypeMetadata", DEFAULT_RESPONSE_NAME, "InvoiceSettings", "Shipping"),
                createArguments(3, "Schema that has a text value evaluated to null.", "Message", DEFAULT_RESPONSE_NAME, "Edited", "Metadata", "Block", "Attachment", "Text", "EventPayload"),
                createArguments(4, "Schema with base type and no definitions.", DEFAULT_RESPONSE_NAME),
                createArguments(5, "Schema for array of numbers."),
                createArguments(6, "Schema for array of integers."),
                createArguments(7, "Simple schema with attribute.", DEFAULT_RESPONSE_NAME),
                createArguments(8, "Schema with duplicate fields.", "ResponseTypeElement"),
                createArguments(9, "Schema with enum.", DEFAULT_RESPONSE_NAME, "DashStyle"),
                createArguments(10, "Schema that is a String."),
                createArguments(11, "Schema that uses allof."),
                createArguments(12, "Schema with enum with '-' in one of the options.", "Identifier", "TestResponse"),
                createArguments(13, "Schema with different types that have the same enum.", "Identifier", DEFAULT_RESPONSE_NAME, "Data"),
                createArguments(14, "Schema that is an Integer."),
                createArguments(15, "Schema with multiple enums with the same name and properties.", DEFAULT_RESPONSE_NAME, "DashMinusstyle", "DashMinusstyle_", "Other"));
    }

    public static Stream<Arguments> getTypeSource() {
        return Stream.of(Arguments.of(1, "Simple recursive schema with no base type.", createClassName(DEFAULT_RESPONSE_NAME)),
                Arguments.of(2, "Recursive schema with base type.", createClassName(DEFAULT_RESPONSE_NAME)),
                Arguments.of(3, "Schema that has a text value evaluated to null.", createClassName(DEFAULT_RESPONSE_NAME)),
                Arguments.of(4, "Schema with base type and no definitions.", createClassName(DEFAULT_RESPONSE_NAME)),
                Arguments.of(5, "Schema for array of numbers.", createListClassName(Double.class.getName())),
                Arguments.of(6, "Schema for array of integers.", createListClassName(Long.class.getName())),
                Arguments.of(7, "Simple schema with attribute.", createClassName(DEFAULT_RESPONSE_NAME)),
                Arguments.of(8, "Schema with duplicate fields.", createListClassName(createClassName("ResponseTypeElement"))),
                Arguments.of(9, "Schema with enum.", createClassName(DEFAULT_RESPONSE_NAME)),
                Arguments.of(10, "Schema that is a String.", String.class.getName()),
                Arguments.of(11, "Schema that uses allof.", Object.class.getName()),
                Arguments.of(12, "Schema with enum with '-' in one of the options.", createClassName(DEFAULT_RESPONSE_NAME)),
                Arguments.of(13, "Schema with different types that have the same enum.", createClassName(DEFAULT_RESPONSE_NAME)),
                Arguments.of(14, "Schema that is an integer.", Long.class.getName()));
    }

    private static String createClassName(String className) {
        return format("%s.%s", JsonSchemaParserTest.class.getPackageName(), className);
    }

    private static String createListClassName(String typeClassName) {
        return format("%s<%s>", List.class.getName(), typeClassName);
    }

    private static Arguments createArguments(Integer caseNumber, String caseDescription, String... expectedNames) {
        return Arguments.of(caseNumber, caseDescription, Arrays.stream(expectedNames).toList());
    }

    @ParameterizedTest(name = "Case {0}: {1}")
    @MethodSource("generateSource")
    public void generateTest(Integer caseNumber, String description, List<String> expectedNames) {
        var specification = new ApiFunctionSpecification();
        specification.setName("test");
        specification.setContext("polyapi.testing");
        var customTypes = jsonSchemaParser.parse("TestResponse", specification.getPackageName(), getSchema(caseNumber));
        assertThat(customTypes, notNullValue());
        assertThat(customTypes.size(), equalTo(expectedNames.size()));
        var customTypeNames = customTypes.stream().map(CustomType::getName).toList();
        expectedNames.forEach(expectedName -> assertTrue(customTypeNames.contains(expectedName), format("Result should contain object with name %s. Result contains %s.", expectedName, customTypeNames)));
        customTypes.forEach(customType -> assertTrue(customType.getCode().contains(format("public class %s {", customType.getName())) || customType.getCode().contains(format("public enum %s {", customType.getName()))));
    }

    @ParameterizedTest(name = "Case {0}: {1}")
    @MethodSource("getTypeSource")
    public void getTypeTest(Integer caseNumber, String description, String expectedType) {
        assertThat(jsonSchemaParser.getType(DEFAULT_RESPONSE_NAME, JsonSchemaParserTest.class.getPackageName(), getSchema(caseNumber)).getFullName(), equalTo(expectedType));
    }

    private String getSchema(Integer caseNumber) {
        try {
            return IOUtils.toString(JsonSchemaParser.class.getResourceAsStream(format("/%s/cases/Case %s.schema.json", JsonSchemaParser.class.getPackageName().replace(".", "/"), caseNumber)), defaultCharset());
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }
}
