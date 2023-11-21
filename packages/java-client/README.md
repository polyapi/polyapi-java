# Java Client Library (beta)
### v0.1.6

## Introduction
This is a Java client library for Poly API. It is generated from the [Poly specification](https://develop-k8s.polyapi.io/specs). It is based on its Typescript counterpart [polyapi](https://www.npmjs.com/package/polyapi)

## Requirements
- Java 17+
- Maven 3.6.3+ (or Gradle 7.2+) (optional)
- Poly API key

## Setting up project
1. Create a new Java Maven project
4. Add the following to your project's `pom.xml` to add the dependencies:
```xml
<properties>
  <poly.version>0.1.6</poly.version>
</properties>
<dependencies>
  <dependency>
    <groupId>io.polyapi.client</groupId>
    <artifactId>library</artifactId>
    <version>${poly.version}</version>
  </dependency>
</dependencies>
<build>
  <plugins>
    <plugin>
      <groupId>io.polyapi.client</groupId>
      <artifactId>library</artifactId>
      <version>${poly.version}</version>
      <executions>
        <execution>
          <phase>generate-sources</phase>
          <goals>
            <goal>generate-sources</goal>
          </goals>
          <configuration>
            <apiBaseUrl>https://develop-k8s.polyapi.io</apiBaseUrl>
            <apiKey>{API_KEY}</apiKey>
          </configuration>
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

5. Run `mvn clean compile` to generate the Poly functions and compile the project (this needs to be done everytime you update your Poly functions)

## Using the library
### Poly Functions
To use the Poly functions you can import `import io.polyapi.Poly;` and traverse through it to find the function you want to use. For example:
```java
var body = new Create$HotelDataBody();
var payload = new Create$Payload();
var result = Poly.hotelApi.hotelData.createRoomEntry("https://eofn4s3nvu8okku.m.pipedream.net", "meat", body, payload);
var data = result.getData();

System.out.println(data.getPrice());
``` 

### Webhook handlers
```java
Poly.events.itemPurchased((event, headers, params) -> {
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

### Custom Functions
It is possible to create custom functions that can be used in Poly. To do so, you need to create a class with desired function. For example:
```java
public class CustomFunction {
    public String sayHello(String name) {
        return "Hello " + name;
    }
}
```
Then to add it to Poly, you need to add run the following Maven goal:
```bash
mvn library:addFunction -Dname=sayHello -Dfile=src/main/java/custom/CustomFunction.java -Dcontext=test.client -Dclient -Ddescription="This says hello to you"
```
Note the use of `-Dclient` flag. This is used to specify that the function is a client function.
This will add the function with specified name and context to Poly, so it can be used in code:

```java
var result = Poly.test.client.sayHello("John");
System.out.println(result);
```

## Limitations
Comparing to its Typescript counterpart, the Java library is still missing the following features:
- Error handlers
- Fetching multiple Poly Variables from context
- Java Server functions

These features will be added in the future releases.

## Changelog
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
