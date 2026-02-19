# Java Client Library

* Latest released version 0.15.6
* Latest snapshot version 0.15.7-SNAPSHOT

## Introduction
This is the PolyAPI Java client GitHub page. If you are here, then it means you're familiar with what we do at Poly. If you aren't, you can always check [here](https://github.com/polyapi/poly-alpha).
In here you'll find instructions for both developers and customers to work with Poly through our Java clients and maven plugin.
We hope that you find this documentation useful and easy to understand. If you don't please let us know.

## Index
1. [Requirements:](#requirements)
Here you'll find the minimum requirements of software that you'll need to work with this Java client.
2. [Project setup:](#project-setup)
This section will get you the steps you need to do to setup this Poly client.
3. [Usage:](#usage)
In here you will find common usages of this client.
4. [Project description:](#project-description)
This section describes the structure of this project and its components.
5. [Changelog:](#changelog)
This last (but not least) section shows the list of changes per version of this client. 

<a name="requirements"></a>
## Requirements
This is the list of requirements for the usage of this client:
- Java 17+
- Maven 3.6.3+ (or Gradle 7.2+)
- PolyAPI API Key
- PolyAPI Host URL (ex. `https://na1.polyapi.io`)

<a name="project-setup"></a>
## Setting up project

1. **Create a new Java Maven project.**

   There are many ways to achieve this. Most likely you already have a project where you want to run this. If you don't, you can follow [this tutorial](https://maven.apache.org/guides/getting-started/maven-in-five-minutes.html). Just have in mind to update the Java version to 17.

2. **Add extension for project-specific settings.**

   **NOTE: If you're using Maven v4.0.0 or higher then you do not need to use an extension in order to have a project-specific settings and can skip this step.**

   Maven versions below v4.0.0 only support global and user-account specific `settings.xml` file, but this extension will allow you to have a `settings.xml` file just for this PolyAPI project which will give you a good place to keep your PolyAPI credentials securely out of your project's `pom.xml` file.

   Create or update your `PROJECT/.mvn/extensions.xml` file to enable setting up project-specific settings for maven:
   ```xml
   <extensions xmlns="http://maven.apache.org/EXTENSIONS/1.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/EXTENSIONS/1.0.0 http://maven.apache.org/xsd/core-extensions-1.0.0.xsd">
     <extension>
       <groupId>com.github.gzm55.maven</groupId>
       <artifactId>project-settings-extension</artifactId>
       <version>0.3.5</version>
     </extension>
   </extensions>
   ```

3. **Create or update your project settings.xml file.**

   Update your `PROJECT/.mvn/settings.xml` file if you already have one, or create one and paste in the following (be sure to replace the `POLYAPI_HOST_URL` and `POLYAPI_API_KEY` with the actual values):
   ```xml
   <settings>
     <profiles>
       <profile>
         <id>my-profile</id>
         <properties>
           <poly.hostUrl>POLYAPI_HOST_URL</poly.hostUrl>
           <poly.apiKey>POLYAPI_API_KEY</poly.apiKey>
         </properties>
       </profile>
     </profiles>
     <activeProfiles>
       <activeProfile>my-profile</activeProfile>
     </activeProfiles>
   </settings>
   ```

   **WARNING: If you're using a git repository for development, be sure to add `.mvn/settings.xml` file to your `.gitignore` file. Otherwise you could leak your PolyAPI credentials by commiting this file!**

4. **Update the project pom.xml file.**

   Add the following to your project's `pom.xml` (be sure to replace `POLYAPI_VERSION` with the actual version you wish to use):
   ```xml
   <properties>
     <poly.version>POLYAPI_VERSION</poly.version>
   </properties>
   <dependencies>
     <dependency>
       <groupId>io.polyapi</groupId>
       <artifactId>library</artifactId>
       <version>${poly.version}</version>
     </dependency>
   </dependencies>
   <build>
     <resources>
       <resource>
         <directory>target/generated-resources</directory>
       </resource>
     </resources>
     <plugins>
       <plugin>
         <groupId>io.polyapi</groupId>
         <artifactId>polyapi-maven-plugin</artifactId>
         <version>${poly.version}</version>
         <configuration>
             <host>${poly.hostUrl}</host>
             <port>443</port>
             <apiKey>${poly.apiKey}</apiKey>
         </configuration>
         <executions>
           <execution>
             <phase>generate-sources</phase>
             <goals>
               <goal>generate-sources</goal>
             </goals>
             <configuration>
                 <host>${poly.hostUrl}</host>
                 <port>443</port>
                 <apiKey>${poly.apiKey}</apiKey>
             </configuration>
           </execution>
         </executions>
       </plugin>
         <plugin>
             <groupId>org.apache.maven.plugins</groupId>
             <artifactId>maven-compiler-plugin</artifactId>
             <version>3.13.0</version>
             <configuration>
                 <parameters>true</parameters>
             </configuration>
         </plugin>
         <plugin>
         <groupId>org.codehaus.mojo</groupId>
         <artifactId>build-helper-maven-plugin</artifactId>
         <version>3.2.0</version>
         <executions>
           <execution>
             <id>add-source</id>
             <phase>generate-sources</phase>
             <goals>
               <goal>add-source</goal>
             </goals>
             <configuration>
               <sources>
                 <source>target/generated-sources</source>
               </sources>
             </configuration>
           </execution>
         </executions>
       </plugin>
     </plugins>
   </build>
   ```
   Make sure you replace `{API_KEY}` with valid API key to access PolyAPI.
   If you work on Windows, remember to replace the '/' bar in the resources for '\'. 

5. **Compile the project.**

   To generate the Poly functions and compile the project (this needs to be done everytime you update your Poly functions) run this command:
   ```
   mvn clean compile
   ```

6. **And Poly is ready to use in your Java project!**

<a name="project-usage"></a>
## Usage

### Poly Functions
To use the Poly functions you can import `import io.polyapi.Poly;` and traverse through it to find the function you want to use. For example:
```java
var result = Poly.yourApi.context.reallyCoolPolyFunction("https://really.cool.polyfunction.net", "param");

System.out.println(result);
``` 

### Webhook handlers
```java
Poly.myWebhooks.onCoolEvent((event, headers, params) -> {
  System.out.println(event.getPrice());
});
```

### Error handlers
```java
Poly.onError("poly.context", errorEvent -> {
    System.out.println(errorEvent.getMessage());
});
```

### Auth functions
```java
var clientId = "...";
var clientSecret = "...";
var scopes = new String[]{"offline_access"};

Poly.auth0.getToken(clientId, clientSecret, scopes, (token, url, error) -> {
    System.out.println(token);
    System.out.println(url);
    System.out.println(error);

    if (token != null) {
        ...
        // revoke token (optional, if you want to revoke the token after you are done with it)
        Poly.auth0.revokeToken(token);
    }
});
```

### Poly Variables
To use Poly variables you can import `import io.polyapi.Vari;` and traverse through it to find the variable you want to use. For example:
```java
var clientId = Vari.auth.clientId.get();
System.out.println(clientId);
```
You can update variable using the following code:
```java
Vari.auth.clientId.update("newClientId");
```
You can listen for update events:
```java
Vari.auth.clientId.onUpdate((event) -> {
  System.out.println("Previous value: " + event.getPreviousValue()+", currentValue: " + event.getCurrentValue());
});
```

### Poly server functions
It is possible to deploy server functions that can be used in Poly. To do so, you need to create a class with desired function. For example:
```java
public class CustomFunction {
    public String sayHello(String name) {
        return "Hello " + name;
    }
}
```
Then, it is required that you have a setup project. In this project, you need to have the PolyAPI commons library installed as a dependency.
```xml
<dependency>
    <groupId>io.polyapi</groupId>
    <artifactId>commons</artifactId>
    <version>${poly.version}</version>
</dependency>
```
Then, annotate the function you want to upload with `@PolyServerFunction`. 
And finally, just run:
```bash
mvn polyapi:deploy-functions
```
### Poly client functions
To create a Poly client Function you need to follow the same steps as with a server function, but instead using the `@PolyClientFunction` annotation.
### Vari server variables
To create a Poly server variable you need to just run the following command:
``` bash
mvn polyapi:create-server-variable -Dname=myVariable -Dvalue=myValue -Dcontext=myContext
```

## Limitations
Comparing to its Typescript counterpart, the Java library is still missing the following features:
- Error handlers
- Fetching multiple Poly Variables from context

These features will be added in the future releases.

<a name="project-description"></a>
## Project description

This a multimodule project containing several packages to make development easier:

- parent-pom
- commons
- library
- polyapi-maven-plugin

### Parent pom (/parent-pom)
This project, a single POM file, works as a parent pom and provides the basic Maven configuration for all projects that inherit it.

At this time it provides the common test libraries, as well as the logging ones. It also provids the versioning for all children projects.

### Commons library (/commons)
This library is used by both the Maven plugin as well as the client library as it serves common functionality to both.

It provides several functionalities:

#### The HTTP client
The HTTP client provides a generic interface to execute HTTP requests. It is used by the internal services. It uses [OkHttp](https://square.github.io/okhttp/) as a client by default, but by implementing the interface and using a different client in the back (such as [Jersey](https://eclipse-ee4j.github.io/jersey/)) requires to just implement the interface and use instead.
The interface for the client is defined [here](https://github.com/polyapi/polyapi-java/blob/develop/commons/src/main/java/io/polyapi/commons/api/http/HttpClient.java).

Have in mind that there are other interfaces that can be implemented, such as [Request](https://github.com/polyapi/polyapi-java/blob/develop/commons/src/main/java/io/polyapi/commons/api/http/Request.java) and [Response](https://github.com/polyapi/polyapi-java/blob/develop/commons/src/main/java/io/polyapi/commons/api/http/Response.java), although they already have default implementations.

#### File service

This basic functionality is used to write files into the FileSystem. There isn't any library involved, just plain Java File usage.

#### JSON parser

This parser uses [Jackson](https://github.com/FasterXML/jackson) as default client, but provides an interface [JsonParser](https://github.com/polyapi/polyapi-java/blob/develop/commons/src/main/java/io/polyapi/commons/api/json/JsonParser.java). To use different clients, you just need to replace the implementation but implement the interface.

### The Library (/library)
This library is the PolyAPI client itself. It provides the common functionality for the usage of Poly functions in Java.

It relies in the existence of generated code using the Maven plugin to provide the interface. Normally you wouldn't have to access it's contents, as they work through the generated classes.

#### Proxy factory
One of the key classes in this library is the proxy factory. As most of the generated code is interfaces, the implementation by default is proxied to channel all of them through the API calls. This hides the implementation from the developers so this works in a black box kind of way.

### Maven plugin (/polyapi-maven-plugin)
This maven plugin provides the following MOJOs:

#### generate-sources
This MOJO generates all the sources for a determined API key into the `target/generated-sources` folder.

##### Parameters
Here's the list of parameters:
- **host (required):** The host where the PolyAPI instance is hosted.
- **port:** The port that the PolyAPI instance is listening to. Default value is 443.
- **apiKey (required):** The API key required to authenticate to Poly.
- **context:** Comma separated values that work as filter for the retrieved specifications. These filters will return any specification that starts with any of the indicated values. (i.e. if you set `polyapi,google` as a value, it will only generate those that have either of those as a context). This parameter is case-insensitive. 
- **overwrite:** Flag indicating that the generated files will overwrite any existing files. Default value is false.

#### deploy-functions
This MOJO requires a project to run and the commons library to be set as a dependency:
```xml
<dependency>
    <groupId>io.polyapi</groupId>
    <artifactId>commons</artifactId>
    <version>${poly.version}</version>
</dependency>
```
It scans the project for classes annotated with `@PolyServerFunction` or `@PolyClientFunction` and it will upload them. See the documentation of the class for documentation. If the class is also annotated with `@RequiredDependency` it will add the dependencies indicated in the annotation to the server function so they will provide their classes when the function executes.'

This MOJO uses reflection to retrieve the information from the functions to deploy. In order to properly obtain the property names for the arguments, the following plugin needs to be added:
```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-compiler-plugin</artifactId>
    <version>3.12.1</version>
    <configuration>
        <parameters>true</parameters>
    </configuration>
</plugin>
```
Otherwise argument names will be shown as "arg0", "arg1", etc.

##### Parameters
Here's the list of parameters:
- **host (required):** The host where the PolyAPI instance is hosted.
- **port:** The port that the PolyAPI instance is listening to. Default value is 443.
- **apiKey (required):** The API key required to authenticate to Poly.
- **functions:** Comma separated value containing the names of the functions to deploy. The functions must be annotated with either the `@PolyServerFunction` or `@PolyClientFunction` annotations as it is described. This parameter triggers a filter by function name and/or context + function name in the `[context].[functionName]` format. Each comma separated value will be taken independently and deployed.
- **dry-run:** Flag that when added makes the MOJO prepare everything for a deployment but not do it. This is for debugging purposes.

#### delete-function
This MOJO doesn't require a project to run.

It deletes a server/client/api/auth function, webhook or variable from the Poly server. It can take 2 types of inputs:
 - **id**: Deletes the entity with the matching ID.
 - **contxt/function name**: Deletes the entity that matches the context and function name. It's case insensitive, but will fall back to be case sensitive in case that there are 2 or more matches with different cases. If none of those cases match exactly, it will throw an error. 

##### Parameters
Here's the list of parameters:
- **host (required):** The host where the PolyAPI instance is hosted.
- **port:** The port that the PolyAPI instance is listening to. Default value is 443.
- **apiKey (required):** The API key required to authenticate to Poly.
- **id:** ID of the entity to delete. Cannot coexist with either `functionName` nor `context` arguments.
- **functionName:** Name of the function to delete. Cannot coexist with `id` argument. Mandatory unless `id` is set.
- **context:** Context of the function to delete. Cannot coexist with `id` argument. Mandatory unless `id` is set.

#### create-server-variable
This MOJO doesn't require a project to run.

Creates a Poly server variable. Available types are String or primitive types. See parameter description for more information.


##### Parameters
Here's the list of parameters:
- **host (required):** The host where the PolyAPI instance is hosted.
- **port:** The port that the PolyAPI instance is listening to. Default value is 443.
- **apiKey (required):** The API key required to authenticate to Poly.
- **context (required):** Context of the variable to add.
- **name (required):** The name of the variable to add.
- **value (required):** The content of the variable to add.
- **description:** The description of the variable being added. If not set, it will be automatically generated.
- **secret:** Whether or not the variable contents will be revealed.
- **type:** The type of the variable being set. This field is case insensitive. Valid inputs are `string`, `java.lang.String`, `integer`, `int`, `java.lang.Integer`, `double`, `java.lang.Double`, `long`, `java.lang.Long`, `float`, `java.lang.Float`, `byte`, `java.lang.Byte`, `short`, `java.lang.Short`, `boolean`, `java.lang.Boolean`. The content of the `value` field will be cast to this type before upload. If not set, the type will be auto-detected from the `value` content.

<a name="changelog"></a>
## Changelog
See the Changelog **[here](https://github.com/polyapi/polyapi-java/releases)**.