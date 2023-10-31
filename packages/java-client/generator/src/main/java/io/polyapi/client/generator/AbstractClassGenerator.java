package io.polyapi.client.generator;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.PrintWriter;

import com.github.jknack.handlebars.Handlebars;

public class AbstractClassGenerator {
  protected final static String PACKAGE_NAME_BASE = "io.polyapi";
  protected final Handlebars handlebars = new TemplateGenerator();

  protected void saveClassToFile(String content, String packagePath, String className) {
    var directory = getClassDirectory(packagePath);

    var file = new File(directory, className + ".java");
    try (PrintWriter out = new PrintWriter(file)) {
      out.println(content);
    } catch (FileNotFoundException e) {
      throw new RuntimeException(e);
    }
  }

  protected File getClassDirectory(String packagePath) {
    var directoryPath = "target/generated-sources/" + packagePath.replace('.', '/');
    var directory = new File(directoryPath);
    directory.mkdirs();
    return directory;
  }
}
