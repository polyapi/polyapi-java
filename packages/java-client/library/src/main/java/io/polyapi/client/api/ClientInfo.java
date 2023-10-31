package io.polyapi.client.api;

public class ClientInfo {
  public static final String CLIENT_ID;
  public static final String API_BASE_URL;
  public static final String API_KEY;

  static {
    try {
      Class<?> clientInfoClass = Class.forName("io.polyapi.ClientInfo");
      CLIENT_ID = (String) clientInfoClass.getField("CLIENT_ID").get(null);
      API_BASE_URL = (String) clientInfoClass.getField("API_BASE_URL").get(null);
      API_KEY = (String) clientInfoClass.getField("API_KEY").get(null);
    } catch (ClassNotFoundException e) {
      throw new RuntimeException("Could not find oi.polyapi.ClientInfo class");
    } catch (NoSuchFieldException | IllegalAccessException e) {
        throw new RuntimeException(e);
    }
  }
}
