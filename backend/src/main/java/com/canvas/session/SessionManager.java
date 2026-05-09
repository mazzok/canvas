package com.canvas.session;

import com.canvas.model.*;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.logging.Logger;

@ApplicationScoped
public class SessionManager {

    private static final Logger LOG = Logger.getLogger(SessionManager.class.getName());
    private static final Duration IDLE_TIMEOUT = Duration.ofMinutes(5);
    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private final SecureRandom rng = new SecureRandom();
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cleaner = Executors.newSingleThreadScheduledExecutor();

    @PostConstruct
    void startCleanup() {
        cleaner.scheduleAtFixedRate(this::removeIdleSessions, 1, 1, TimeUnit.MINUTES);
    }

    @PreDestroy
    void stopCleanup() {
        cleaner.shutdownNow();
    }

    void removeIdleSessions() {
        Instant cutoff = Instant.now().minus(IDLE_TIMEOUT);
        sessions.values().removeIf(s -> {
            if (!s.hasConnectedPlayers() && s.lastActivityAt.isBefore(cutoff)) {
                LOG.info("Removing idle session " + s.id + " (no players since " + s.lastActivityAt + ")");
                return true;
            }
            return false;
        });
    }

    public Session createSession(DisplayMode displayMode, Language language, String hostNickname) {
        // Build the host player and session fully before publishing to the map
        String hostPlayerId = UUID.randomUUID().toString();
        Player host = new Player(hostPlayerId, hostNickname, true);

        Session session;
        do {
            String id = randomId();
            session = new Session(id, hostPlayerId, displayMode, language);
            session.players.put(hostPlayerId, host);
        } while (sessions.putIfAbsent(session.id, session) != null); // atomic: retry on ID collision

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

    public List<Session> listSessions() {
        return new ArrayList<>(sessions.values());
    }

    /** Only used in tests to reset state between runs. */
    public void clearAll() {
        sessions.clear();
    }

    private String randomId() {
        StringBuilder sb = new StringBuilder(6);
        for (int i = 0; i < 6; i++) sb.append(CHARS.charAt(rng.nextInt(CHARS.length())));
        return sb.toString();
    }
}
