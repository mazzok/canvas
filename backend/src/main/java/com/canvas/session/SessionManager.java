package com.canvas.session;

import com.canvas.model.*;
import jakarta.enterprise.context.ApplicationScoped;
import java.security.SecureRandom;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class SessionManager {

    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private final SecureRandom rng = new SecureRandom();
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();

    public Session createSession(DisplayMode displayMode, Language language, String hostNickname) {
        String id = generateId();
        Session session = new Session(id, null, displayMode, language);
        sessions.put(id, session);
        Player host = addPlayer(id, hostNickname, null);
        host.isHost = true;
        session.hostId = host.id;
        return session;
    }

    public Session getSession(String sessionId) {
        return sessions.get(sessionId);
    }

    public void removeSession(String sessionId) {
        sessions.remove(sessionId);
    }

    /**
     * Add or reconnect a player.
     * @param playerId existing UUID to reconnect, or null for new player
     */
    public Player addPlayer(String sessionId, String nickname, String playerId) {
        Session session = sessions.get(sessionId);
        if (session == null) return null;

        if (playerId != null && session.players.containsKey(playerId)) {
            Player existing = session.players.get(playerId);
            existing.connected = true;
            return existing;
        }
        String newId = UUID.randomUUID().toString();
        Player player = new Player(newId, nickname, false);
        session.players.put(newId, player);
        return player;
    }

    /** Only used in tests to reset state between runs. */
    public void clearAll() {
        sessions.clear();
    }

    private String generateId() {
        String id;
        do {
            StringBuilder sb = new StringBuilder(6);
            for (int i = 0; i < 6; i++) sb.append(CHARS.charAt(rng.nextInt(CHARS.length())));
            id = sb.toString();
        } while (sessions.containsKey(id));
        return id;
    }
}
