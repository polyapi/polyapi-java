# Java Client Library (beta)
### v0.3.4

## Introduction
Welcome my friends! This is the Poly API Java client GitHub page. If you are here, then it means you're familiar with what we do at Poly. If you aren't, you can always check [here](https://github.com/polyapi/poly-alpha).
In here you'll find instructions for both developers and customers to work with Poly through our Java clients and maven plugin.
We hope that you find this documentation useful and easy to understand. If you don't please let us know.

### Index
1. [Requirements:](#requirements)
Here you'll find the minimum requirements of software that you'll need to work with this Java client.
2. [Project setup:](#project-setup)
This section will get you the steps you need to do to setup this Poly client.
3. [Project description:](#project-description)
This is the boring section that describes the structure of this project and its components.
4. [Usage:](#usage)
In here you will find common usages of this client.
5. [Changelog:](#changelog)
This last (but not least) section shows the list of changes per version of this client. 

<a name="requirements"></a>
## Requirements
This is the list of requirements for the usage of this client:
- Java 17+
- Maven 3.6.3+ (or Gradle 7.2+)
- Poly API key

<a name="project-setup"></a>
## Setting up project
### I'm looking to dive into the source code!
Welcome fellow Poly dev! As you will be modifying the code here (and maybe even this documentation), you'll need to download and make sure that this project compiles for you.
So, the steps to follow are these:
1. **Setup an SSH key in your computer.**
To do so, follow [this GitHub tutorial](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account).
2. **Clone this beautiful project.** To do so, run wherever you want to set the project.:
```
git clone git@github.com:polyapi/polyapi-java.git
```

3. **Install the project.** For this you'll run:
```
mvn clean install
```
From the folder of the project.

**There! You got the project running my dear, go make things better!**

If you want to run the project functionalities, follow the steps for customer. Just bear in mind to update the version to your local ones below. 

### I'm looking to use Poly to simplify my life!
Nice to have some customers looking around here! So, you'll need to run the following steps: 
1. **Create a new Java Maven project.** There are many ways to achieve this. Most likely you already have a project where you want to run this. If you don't, you can follow [this tutorial](https://maven.apache.org/guides/getting-started/maven-in-five-minutes.html). Just have in mind to update the Java version to 17.
2. **Update the project.** Add the following to your project's `pom.xml`:
```xml
<properties>
  <poly.version>0.3.3</poly.version>
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
      <executions>
        <configuration>
          <host>https://develop-k8s.polyapi.io</host>
          <port>443</port>
          <apiKey>{API_KEY}</apiKey>
        </configuration>
        <execution>
          <phase>generate-sources</phase>
          <goals>
            <goal>generate-sources</goal>
          </goals>
        </execution>
      </executions>
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
Make sure you replace `{API_KEY}` with valid API key to access the Poly API.
If you work on Windows, remember to replace the '/' bar in the resources for '\'. 

3. **Compile the project.** To generate the Poly functions and compile the project (this needs to be done everytime you update your Poly functions) run this beautiful command:
```
mvn clean compile
```

**And Poly is ready to use in your Java project!**

<a name="project-description"></a>
## Project description
This is the boring section that describes this project. If you are not into the technical details, you'll are likely to find this boring and not very useful.

You have been warned.

This project has the following components:
1. **Multimodule project**
This is the core multimodule project that will wrap every project here and compile them together.
2. **Parent pom**
This provides the common maven configuration for to the rest of the Java projects.
3. **Commons library**
This library is one containing all objects that are common to all Java libraries used, such as the HttpClient or common model classes.
4. **The Library** 
This library is the one that is injected into the customer's project and contains the basic functionality used by all the generated code.
5. **Maven plugin**
This plugin contains the goals to add functions to the Poly server as well as downloading and generating the Poly code to run the Poly functions.

### Multimodule project
This project works both as a multimodule project and as a parent pom. The purpose of this project is to unify the development of all common Java client components in one.

### Parent pom
This project, a single POM file, works as a parent pom and provides the basic Maven configuration for all projects that inherit it.

At this time it provides the common test libraries, as well as the logging ones. It also provids the versioning for all children projects.

### Commons library
This library is used by both the Maven plugin as well as the client library as it serves common functionality to both.
It provides 3 main functionalities:

#### The HTTP client
The HTTP client provides a generic interface to execute HTTP requests. It is used by the internal services. It uses [OkHttp](https://square.github.io/okhttp/) as a client by default, but by implementing the interface and using a different client in the back (such as [Jersey](https://eclipse-ee4j.github.io/jersey/)) requires to just implement the interface and use instead.
The interface for the client is defined [here](https://github.com/polyapi/polyapi-java/blob/develop/commons/src/main/java/io/polyapi/commons/api/http/HttpClient.java).

Have in mind that there are other interfaces that can be implemented, such as [Request](https://github.com/polyapi/polyapi-java/blob/develop/commons/src/main/java/io/polyapi/commons/api/http/Request.java) and [Response](https://github.com/polyapi/polyapi-java/blob/develop/commons/src/main/java/io/polyapi/commons/api/http/Response.java), although they already have default implementations.

#### File service

This basic functionality is used to write files into the FileSystem. There isn't any library involved, just plain Java File usage.

#### JSon parser

This parser uses [Jackson](https://github.com/FasterXML/jackson) as default client, but provides an interface [JsonParser](https://github.com/polyapi/polyapi-java/blob/develop/commons/src/main/java/io/polyapi/commons/api/json/JsonParser.java). To use different clients, you just need to replace the implementation but implement the interface.

### The Library
This library is the PolyAPI client itself. It provides the common functionality for the usage of Poly functions in Java.

It relies in the existence of generated code using the Maven plugin to provide the interface. Normally you wouldn't have to access it's contents, as they work through the generated classes.

#### Proxy factory
One of the key classes in this library is the proxy factory. As most of the generated code is interfaces, the implementation by default is proxied to channel all of them through the API calls. This hides the implementation from the developers so this works in a black box kind of way.

### Maven plugin
This maven plugin provides the following MOJOs:

#### add-server-function
This MOJO adds a server function to the Poly Server. Poly Server functions are functions that are run in the Poly server.

##### Parameters
Here's the list of parameters:
 - **host (required):** The host where the Poly API instance is hosted.
 - **port:** The port that the Poly API instance is listening to. Default value is 443.
 - **apiKey (required):** The API key required to authenticate to Poly.
 - **file (required):** The relative path to the file that contains the function to be uploaded.
 - **functionName (required):** The name of the method to be converted into the function to be uploaded.
 - **context:** The context where the function will be hosted. When generating the function interface, this will influence the package name.
 - **description:** The description of the function.

#### add-client-function
This MOJO adds a client function to the Poly Server. Poly Client functions are functions that, although are stored in the Server, are ultimately executed in the client.

##### Parameters
Here's the list of parameters:
- **host (required):** The host where the Poly API instance is hosted.
- **port:** The port that the Poly API instance is listening to. Default value is 443.
- **apiKey (required):** The API key required to authenticate to Poly.
- **file (required):** The relative path to the file that contains the function to be uploaded.
- **functionName (required):** The name of the method to be converted into the function to be uploaded.
- **context:** The context where the function will be hosted. When generating the function interface, this will influence the package name.
- **description:** The description of the function.

#### generate-sources
This MOJO generates all the sources for a determined API key into the `target/generated-sources` folder.

##### Parameters
Here's the list of parameters:
- **host (required):** The host where the Poly API instance is hosted.
- **port:** The port that the Poly API instance is listening to. Default value is 443.
- **apiKey (required):** The API key required to authenticate to Poly.
- **context:** Comma separated values that work as filter for the retrieved specifications. These filters will return any specification that starts with any of the the indicated values. (i.e. if you set `polyapi,google` as a value, it will only generate those that have either of those as a context). This parameter is case-insensitive. 
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
It scans the project for classes annotated with `@PolyFunction` and it will upload them. See the documentation of the class for documentation. If the class is also annotated with `@RequiredDependency` it will add the dependencies indicated in the annotation to the server function so they will provide their classes when the function executes.'

##### Parameters
Here's the list of parameters:
- **host (required):** The host where the Poly API instance is hosted.
- **port:** The port that the Poly API instance is listening to. Default value is 443.
- **apiKey (required):** The API key required to authenticate to Poly.

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

### Custom functions
It is possible to create custom functions that can be used in Poly. To do so, you need to create a class with desired function. For example:
```java
public class CustomFunction {
    public String sayHello(String name) {
        return "Hello " + name;
    }
}
```

Then there are 2 approaches:

#### Manual approach
In this approach, you will use the `add-client-function` goals of the PolyAPI maven plugin.

Just run:
```bash
mvn polyapi:add-client-function -Dname=sayHello -Dfile="src/main/java/custom/CustomFunction.java" -Dcontext="test.client" -Dclient -Ddescription="This says hello to you"
```
This will add the function with specified name and context to Poly, so it can be used in code:

```java
var result = Poly.test.client.sayHello("John");
System.out.println(result);
```

#### Annotation approach
This approach requires that you have a setup project. In this project, you need to have the PolyAPI commons library installed as a dependency.
```xml
<dependency>
    <groupId>io.polyapi</groupId>
    <artifactId>commons</artifactId>
    <version>${poly.version}</version>
</dependency>
```
Then annotate the function you want to upload with `@PolyFunction`. Have in mind that to mark this as a custom function (or client function) you need to set the property `type` in the annotation to `CLIENT`, leaving the annotation something like: 
```java
@PolyFunction(type = FunctionType.CLIENT) 
```
Then, just run:
```bash
mvn polyapi:deploy-functions
```
### Server Functions
Similar to Custom Functions, you can create Server Functions. To do so, you need to create a class with desired function same as with Custom Functions.
Then to add it to Poly, there are the same 2 approaches:

#### Manual approach
In here instead of using the `add-client-function` goal, you use the `add-server-function` one:
```bash
mvn polyapi:add-server-function -Dname=sayHello -Dfile="src/main/java/custom/CustomFunction.java" -Dcontext="test.server" -Ddescription="This says hello to you from server"
```
Otherwise it's the same as in the client functions.

#### Annotation approach
This is the same as the client functions, but you don't need to set the `type` property in the annotation. By default it will assume its a server function.

## Limitations
Comparing to its Typescript counterpart, the Java library is still missing the following features:
- Error handlers
- Fetching multiple Poly Variables from context

These features will be added in the future releases.

## Changelog
### v0.3.4
- Added validation to avoid duplicate specifications based on context and name.
### v0.3.3
- Fixed 'type' property for Server variables
- Added missing 'type' property to specs.json
### v0.3.2
- Fixed bug in deploy-functions where inner classes weren't taken into consideration.
- Refactored deploy-functions to be reflection based instead of reading source code.
### v0.3.1
- Fixed bug in deploy-functions where generics weren't taken into consideration.
### v0.3.0
- Added deploy-functions MOJO.
- Added functionality to add maven dependencies to executions.
### v0.2.5
- Fixed bug where enums were generated as inner classes.
- Fixed bug in generation of custom functions.
- Fixed bug where schema with +1 and -1 as names were parsed as the same string. Now the properties will named plus1 and minus1.
- Fixed bug where Auth functions were not created appropriately.
### v0.2.4
- Fixed bug in server functions that didn't allow Poly invocations in server functions.
### v0.2.3
- Fixed bug in server functions that didn't allow complex object in server functions.
### v0.2.2
- Fixed variable injection in server functions.
### v0.2.1
- Fixed bug in add-server-function that uploaded arguments without keys.
### v0.2.0
- Improved type generation.
- Unified the client usage.
- Replaced approach to use proxies.
- Split project into multiple modules.
### v0.1.8
- Fixed type generation for Java server functions
### v0.1.7
- Added support for Java server functions
### v0.1.6
- Added support for Java client functions
### v0.1.5
- Fixed issue with void return types
### v0.1.4
- Deployment setup update
### v0.1.3
- Storing Poly specs file into `target/.poly/specs.json`
### v0.1.2
- Using String as default class on `inject` secret variable function
- Fixed Vari packaging causing variable classes overwriting each other 
### v0.1.1
- Added initial support for injecting Poly Variables to Poly Functions
