package com.canvas.websocket;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class WsMessage {
    public MessageType type;
    public Map<String, Object> payload;

    public WsMessage() {}

    public WsMessage(MessageType type, Map<String, Object> payload) {
        this.type = type;
        this.payload = payload;
    }

    public static WsMessage of(MessageType type, Map<String, Object> payload) {
        return new WsMessage(type, payload);
    }

    public static WsMessage error(String message) {
        return new WsMessage(MessageType.ERROR, Map.of("message", message));
    }
}
