package io.polyapi.client.generator;

import java.io.IOException;

import org.jsonschema2pojo.DefaultGenerationConfig;
import org.jsonschema2pojo.Jackson2Annotator;
import org.jsonschema2pojo.SchemaGenerator;
import org.jsonschema2pojo.SchemaMapper;
import org.jsonschema2pojo.SchemaStore;
import org.jsonschema2pojo.rules.RuleFactory;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.codemodel.JCodeModel;

public class JsonSchemaToTypeGenerator {
  public JCodeModel generateObjectCodeModel(JsonNode schema, String typeName, String packageName) {
    var config = new DefaultGenerationConfig() {
      @Override
      public boolean isGenerateBuilders() {
        return false;
      }

      @Override
      public boolean isIncludeToString() {
        return false;
      }

      @Override
      public boolean isIncludeHashcodeAndEquals() {
        return false;
      }

      @Override
      public boolean isUseLongIntegers() {
        return true;
      }

      @Override
      public boolean isIncludeAdditionalProperties() {
        return false;
      }

      @Override
      public String getClassNamePrefix() {
        return typeName;
      }
    };

    var schemaMapper = new SchemaMapper(
      new RuleFactory(config, new Jackson2Annotator(config), new SchemaStore()),
      new SchemaGenerator()
    );

    try {
      var codeModel = new JCodeModel();
      schemaMapper.generate(codeModel, "", packageName, schema.toString());
      return codeModel;
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
  }
}
