package io.polyapi.commons.api.model;


import java.lang.annotation.Repeatable;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.METHOD;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

@Target(METHOD)
@Retention(RUNTIME)
@Repeatable(RequiredDependencies.class)
public @interface RequiredDependency {

    String groupId() default "";

    String artifactId() default ".*";

    String version() default ".*";
}
