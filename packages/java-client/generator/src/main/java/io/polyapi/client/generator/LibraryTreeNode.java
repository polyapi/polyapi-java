package io.polyapi.client.generator;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import io.polyapi.client.model.specification.Specification;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LibraryTreeNode<T extends Specification> {
  private final String context;
  private final boolean root;
  private final Map<String, LibraryTreeNode<T>> subContexts = new HashMap<>();
  private final Set<T> specifications = new HashSet<>();

  public LibraryTreeNode(String context, boolean root) {
    this.context = context;
    this.root = root;
  }

  public LibraryTreeNode(String context) {
    this.context = context;
    this.root = false;
  }

  public void addSubContext(String context, LibraryTreeNode<T> subContext) {
    subContexts.put(context, subContext);
  }

  public LibraryTreeNode<T> getSubContext(String context) {
    return subContexts.get(context);
  }

  public void addSpecification(T spec) {
    specifications.add(spec);
  }
}
