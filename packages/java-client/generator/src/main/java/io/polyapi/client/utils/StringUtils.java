package io.polyapi.client.utils;

import org.apache.commons.text.CaseUtils;
import org.apache.commons.text.WordUtils;

public class StringUtils {
  private static final char[] delimiters = new char[]{' ', '_', '-', '.'};

  public static String toCamelCase(String input) {
    return CaseUtils.toCamelCase(input, false, delimiters);
  }

  public static String toPascalCase(String input) {
    return WordUtils.capitalize(input, delimiters).replaceAll("_|-|\\.|\\s", "");
  }
}
