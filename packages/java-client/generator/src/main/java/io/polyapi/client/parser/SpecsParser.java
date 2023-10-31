package io.polyapi.client.parser;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import io.polyapi.client.model.specification.Specification;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class SpecsParser {

  private final ObjectMapper objectMapper;

  public SpecsParser() {
    this.objectMapper = new ObjectMapper();
  }

  public List<Specification> parseSpecs(String jsonSpec) throws IOException {
    var root = objectMapper.readTree(jsonSpec);
    var reader = objectMapper.readerFor(Specification.class);

    var specifications = new ArrayList<Specification>();
    for (JsonNode node : root) {
      specifications.add(reader.readValue(node));
    }

    return specifications;
  }
}
