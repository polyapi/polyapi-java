package io.polyapi.client.utils;

import org.apache.commons.text.CaseUtils;
import org.apache.commons.text.WordUtils;

public class StringUtils {
  private static final char[] delimiters = new char[]{' ', '_', '-', '.'};

  public static String toCamelCase(String input) {
    if (input == null || input.isEmpty()) {
      return input;
    }

    var camelCaseString = new StringBuilder();
    var firstChar = true;
    var nextCharUpperCase = false;
    var lowercaseCharsBefore = false;

    for (char ch : input.toCharArray()) {
      if (ch == ' ' || ch == '-' || ch == '_' || ch == '.') {
        nextCharUpperCase = true;
      } else if (firstChar) {
        camelCaseString.append(Character.toLowerCase(ch));
        firstChar = false;
      } else if (nextCharUpperCase) {
        camelCaseString.append(Character.toUpperCase(ch));
        nextCharUpperCase = false;
      } else if (lowercaseCharsBefore && Character.isUpperCase(ch)) {
        camelCaseString.append(ch);
        lowercaseCharsBefore = false;
      } else if (!lowercaseCharsBefore && Character.isLowerCase(ch)) {
        camelCaseString.append(ch);
        lowercaseCharsBefore = true;
      } else {
        camelCaseString.append(Character.toLowerCase(ch));
      }
    }

    return camelCaseString.toString();
  }

  public static String toPascalCase(String input) {
    return WordUtils.capitalize(input, delimiters).replaceAll("_|-|\\.|\\s", "");
  }
}
