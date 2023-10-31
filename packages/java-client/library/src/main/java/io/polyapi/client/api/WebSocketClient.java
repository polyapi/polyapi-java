package io.polyapi.client.api;

import org.json.JSONException;
import org.json.JSONObject;

import io.socket.client.Ack;
import io.socket.client.IO;
import io.socket.client.Socket;
import io.socket.emitter.Emitter;

public class WebSocketClient {
  private static final String URL = ClientInfo.API_BASE_URL + "/events";
  private Socket socket;

  private static WebSocketClient instance;

  private WebSocketClient() {
  }

  public static WebSocketClient getInstance() {
    if (instance == null) {
      instance = new WebSocketClient();
    }

    return instance;
  }

  private Socket getSocket() {
    if (socket == null || !socket.connected()) {
      try {
        socket = IO.socket(URL);
        socket.on(Socket.EVENT_CONNECT, args -> {
        });
        socket.connect();
      } catch (Exception e) {
        e.printStackTrace();
      }
    }
    return socket;
  }

  public void registerWebhookEventHandler(String webhookHandleID, Emitter.Listener callback) throws JSONException {
    var socket = getSocket();

    var obj = new JSONObject();
    obj.put("clientID", ClientInfo.CLIENT_ID);
    obj.put("apiKey", ClientInfo.API_KEY);
    obj.put("webhookHandleID", webhookHandleID);

    socket.emit("registerWebhookEventHandler", obj, (Ack) args -> {
      if (args[0].equals(true)) {
        socket.on("handleWebhookEvent:" + webhookHandleID, callback);
      } else {
        System.out.println("Could not register webhook event handler for " + webhookHandleID);
      }
    });
  }

  public OnUpdateListener registerOnUpdateVariableEventHandler(String variableID, Emitter.Listener callback) throws JSONException {
    var socket = getSocket();

    var obj = new JSONObject();
    obj.put("clientID", ClientInfo.CLIENT_ID);
    obj.put("apiKey", ClientInfo.API_KEY);
    obj.put("variableId", variableID);

    socket.emit("registerVariableChangeEventHandler", obj, (Ack) args -> {
      if (args[0].equals(true)) {
        socket.on("handleVariableChangeEvent:" + variableID, callback);
      } else {
        System.out.println("Could not register variable change event handler for " + variableID);
      }
    });

    return () -> {
      socket.off("handleVariableChangeEvent:" + variableID);
      socket.emit("unregisterVariableChangeEventHandler", obj);
    };
  }

  public OnUpdateListener registerOnUpdateVariablesEventHandler(String path, OnUpdateOptions options, Emitter.Listener callback) throws JSONException {
    var socket = getSocket();

    var obj = new JSONObject();
    obj.put("clientID", ClientInfo.CLIENT_ID);
    obj.put("apiKey", ClientInfo.API_KEY);
    obj.put("path", path);
    obj.put("options", new JSONObject(options));

    socket.emit("registerVariablesChangeEventHandler", obj, (Ack) args -> {
      if (args[0].equals(true)) {
        socket.on("handleVariablesChangeEvent:" + path, callback);
      } else {
        System.out.println("Could not register variable change event handler for " + path);
      }
    });

    return () -> {
      socket.off("handleVariablesChangeEvent:" + path);
      socket.emit("unregisterVariablesChangeEventHandler", obj);
    };
  }

  public void registerAuthFunctionEventHandler(String id, Emitter.Listener callback) throws JSONException {
    var socket = getSocket();

    var obj = new JSONObject();
    obj.put("clientID", ClientInfo.CLIENT_ID);
    obj.put("apiKey", ClientInfo.API_KEY);
    obj.put("functionId", id);

    socket.emit("registerAuthFunctionEventHandler", obj, (Ack) args -> {
      if (args[0].equals(true)) {
        socket.on("handleAuthFunctionEvent:" + id, callback);
      } else {
        System.out.println("Could not register auth function event handler for " + id);
      }
    });
  }

  public void unregisterAuthFunctionEventHandler(String id) throws JSONException {
    var socket = getSocket();

    var obj = new JSONObject();
    obj.put("clientID", ClientInfo.CLIENT_ID);
    obj.put("apiKey", ClientInfo.API_KEY);
    obj.put("functionId", id);

    socket.off("handleAuthFunctionEvent:" + id);
    socket.emit("unregisterAuthFunctionEventHandler", obj);
  }

  public void disconnect() {
    if (socket != null) {
      socket.disconnect();
    }
  }
}
