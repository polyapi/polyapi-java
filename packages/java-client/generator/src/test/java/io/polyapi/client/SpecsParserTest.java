package io.polyapi.client;

import io.polyapi.client.model.specification.Specification;
import io.polyapi.client.parser.SpecsParser;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class SpecsParserTest {

  private SpecsParser parser;

  @BeforeEach
  public void setUp() {
    parser = new SpecsParser();
  }

  @Test
  public void testParseSpecs() {
    String jsonSpec;
    try (InputStream is = getClass().getClassLoader().getResourceAsStream("specs.json")) {
      if (is == null) {
        throw new RuntimeException("Failed to read specs.json");
      }
      jsonSpec = new String(is.readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw new RuntimeException("Failed to read specs.json", e);
    }

    // Parse the spec and perform assertions
    try {
      List<Specification> specifications = parser.parseSpecs(jsonSpec);

      // Perform your assertions here based on expected values
      // Example:
      assertFalse(specifications.isEmpty(), "Specifications should not be empty");
      // More assertions...

    } catch (IOException e) {
      fail("Failed to parse spec", e);
    }
  }
}
