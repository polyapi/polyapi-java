package io.polyapi.client.generator;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.PrintWriter;

import io.polyapi.client.model.specification.ServerVariableSpecification;
import io.polyapi.client.parser.SpecsParser;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class CodeGenerator {
  public void generate(String apiBaseUrl, String apiKey) throws IOException {
    var specsParser = new SpecsParser();
    var clientInfoClassGenerator = new ClientInfoClassGenerator();
    var polyContextClassGenerator = new PolyContextClassGenerator();
    var variContextClassGenerator = new VariContextClassGenerator();
    var specsJSON = getSpecs(apiBaseUrl, apiKey);
    var specifications = specsParser.parseSpecs(specsJSON);

    clientInfoClassGenerator.generate(apiBaseUrl, apiKey);
    polyContextClassGenerator.generate(specifications);
    variContextClassGenerator.generate(
      specifications.stream()
        .filter(specification -> specification instanceof ServerVariableSpecification)
        .map(specification -> (ServerVariableSpecification) specification)
        .toList()
    );
    saveSpecsToFile(specsJSON);
  }

  private static String getSpecs(String apiBaseUrl, String apiKey) throws IOException {
    var client = new OkHttpClient();
    var request = new Request.Builder()
      .url(apiBaseUrl + "/specs")
      .header("Authorization", "Bearer " + apiKey)
      .build();

    try (Response response = client.newCall(request).execute()) {
      if (!response.isSuccessful()) {
        throw new RuntimeException("Error while setting Poly specifications: " + response.code() + " " + response.message());
      }

      return response.body().string();
    }
  }

  private void saveSpecsToFile(String specsJSON) throws IOException {
    var targetDir = new File("target/.poly");
    if (!targetDir.exists()) {
      boolean wasSuccessful = targetDir.mkdirs();
      if (!wasSuccessful) {
        throw new IOException("Could not create directory: " + targetDir.getAbsolutePath());
      }
    }
    var file = new File(targetDir, "specs.json");
    try (PrintWriter out = new PrintWriter(file)) {
      out.println(specsJSON);
    } catch (FileNotFoundException e) {
      throw new RuntimeException(e);
    }
  }
}
