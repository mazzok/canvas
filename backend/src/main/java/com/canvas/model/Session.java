package com.canvas.model;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class Session {
    public String id;
    public String hostId;
    public GamePhase phase;
    public DisplayMode displayMode;
    public Language language;
    public Map<String, Player> players = new ConcurrentHashMap<>();
    public Round currentRound;

    public Session() {}

    public Session(String id, String hostId, DisplayMode displayMode, Language language) {
        this.id = id;
        this.hostId = hostId;
        this.displayMode = displayMode;
        this.language = language;
        this.phase = GamePhase.LOBBY;
    }
}
