package io.polyapi.client.generator;

import java.io.IOException;
import java.util.HashMap;
import java.util.UUID;

public class ClientInfoClassGenerator extends AbstractClassGenerator {
  public void generate(String apiBaseUrl, String apiKey) throws IOException {
    var context = new HashMap<String, Object>();
    var template = handlebars.compile("clientInfo");

    context.put("clientID", UUID.randomUUID().toString());
    context.put("apiBaseUrl", apiBaseUrl);
    context.put("apiKey", apiKey);
    context.put("packageName", PACKAGE_NAME_BASE);

    saveClassToFile(template.apply(context), PACKAGE_NAME_BASE, "ClientInfo");
  }
}
