package io.polyapi.plugin.utils;

import com.google.common.base.CaseFormat;

import static java.util.function.Predicate.not;
import static org.apache.commons.text.WordUtils.capitalize;
import static org.apache.commons.text.WordUtils.uncapitalize;

import java.util.Optional;

public class StringUtils {
    private static final char[] DELIMITERS = new char[]{' ', '_', '-', '.'};
    private StringUtils() {
        // Do nothing.
    }

    public static String toPascalCase(String input) {

        return Optional.ofNullable(input)
                .filter(not(String::isBlank))
                .map(value -> capitalize(input, DELIMITERS).replaceAll("[\\-\\.\s]", ""))
                .orElse(input);
    }

    public static String toCamelCase(String input) {
        return uncapitalize(toPascalCase(input));
    }
}
