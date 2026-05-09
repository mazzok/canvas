package com.canvas.model;

import java.time.Instant;
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
    // Tracks when any player was last connected; used for idle-session cleanup
    public volatile Instant lastActivityAt = Instant.now();

    public Session() {}

    public Session(String id, String hostId, DisplayMode displayMode, Language language) {
        this.id = id;
        this.hostId = hostId;
        this.displayMode = displayMode;
        this.language = language;
        this.phase = GamePhase.LOBBY;
        this.lastActivityAt = Instant.now();
    }

    public void touch() {
        this.lastActivityAt = Instant.now();
    }

    public boolean hasConnectedPlayers() {
        return players.values().stream().anyMatch(p -> p.connected);
    }
}
