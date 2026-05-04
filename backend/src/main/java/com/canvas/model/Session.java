package com.canvas.model;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class Session {
    public String id;
    // hostId is the single source of truth for host status; Player.isHost is derived for convenience
    public String hostId;
    public GamePhase phase;
    public DisplayMode displayMode;
    public Language language;
    // ConcurrentHashMap for thread-safe individual ops; compound read-modify-write must use synchronized(session)
    public Map<String, Player> players = new ConcurrentHashMap<>();
    public Round currentRound; // null between rounds
    // category name → list of player IDs who voted for it
    public Map<String, List<String>> categoryVotes = new ConcurrentHashMap<>();

    public Session() {}

    public Session(String id, String hostId, DisplayMode displayMode, Language language) {
        this.id = id;
        this.hostId = hostId;
        this.displayMode = displayMode;
        this.language = language;
        this.phase = GamePhase.LOBBY;
    }
}
