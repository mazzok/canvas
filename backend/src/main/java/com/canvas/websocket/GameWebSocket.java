package com.canvas.websocket;

import com.canvas.model.GamePhase;
import com.canvas.model.Player;
import com.canvas.model.StrokeEvent;
import com.canvas.model.StrokeType;
import com.canvas.session.GameEngine;
import com.canvas.session.SessionManager;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.websocket.OnClose;
import jakarta.websocket.OnError;
import jakarta.websocket.OnMessage;
import jakarta.websocket.OnOpen;
import jakarta.websocket.Session;
import jakarta.websocket.server.PathParam;
import jakarta.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;
import java.util.logging.Logger;
import java.util.stream.Collectors;

@ServerEndpoint("/ws/{sessionId}")
@ApplicationScoped
public class GameWebSocket {

    private static final Logger LOG = Logger.getLogger(GameWebSocket.class.getName());

    @Inject SessionManager sessionManager;
    @Inject GameEngine gameEngine;

    @org.eclipse.microprofile.config.inject.ConfigProperty(name = "app.base-url", defaultValue = "http://localhost:8080")
    String baseUrl;

    private final ObjectMapper mapper;
    private final Map<Session, String> wsToPlayerId = new ConcurrentHashMap<>();
    private final Map<String, ScheduledFuture<?>> activeTimers = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);

    public GameWebSocket() {
        mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
    }

    @OnOpen
    public void onOpen(Session ws, @PathParam("sessionId") String sessionId) {
        // Player must send JOIN as first message to register
    }

    @OnMessage
    public void onMessage(String raw, Session ws, @PathParam("sessionId") String sessionId) {
        LOG.info("onMessage sessionId=" + sessionId + " raw=" + raw);
        try {
            WsMessage msg = mapper.readValue(raw, WsMessage.class);
            LOG.info("parsed type=" + msg.type);
            com.canvas.model.Session gameSession = sessionManager.getSession(sessionId);
            LOG.info("session=" + (gameSession == null ? "NULL" : gameSession.id));

            switch (msg.type) {
                case JOIN -> handleJoin(ws, gameSession, msg.payload);
                case START_GAME -> handleStartGame(ws, gameSession);
                case VOTE_CATEGORY -> handleVoteCategory(ws, gameSession, msg.payload);
                case SELECT_CATEGORY -> handleSelectCategory(ws, gameSession, msg.payload);
                case STROKE -> handleStroke(ws, gameSession, msg.payload);
                case DRAWING_DONE -> handleDrawingDone(ws, gameSession);
                case GUESS -> handleGuess(ws, gameSession, msg.payload);
                default -> sendTo(ws, WsMessage.error("Unknown message type: " + msg.type));
            }
        } catch (Exception e) {
            LOG.severe("onMessage exception: " + e);
            sendTo(ws, WsMessage.error("Invalid message format: " + e.getMessage()));
        }
    }

    @OnClose
    public void onClose(Session ws, @PathParam("sessionId") String sessionId) {
        String playerId = wsToPlayerId.remove(ws);
        if (playerId == null) return;
        com.canvas.model.Session gameSession = sessionManager.getSession(sessionId);
        if (gameSession == null) return;
        Player player = gameSession.players.get(playerId);
        if (player != null) {
            player.connected = false;
            broadcast(gameSession, WsMessage.of(MessageType.PLAYER_DISCONNECTED,
                Map.of("playerId", playerId, "nickname", player.nickname)));
        }
    }

    @OnError
    public void onError(Session ws, Throwable t) {
        wsToPlayerId.remove(ws);
    }

    // ── Handlers ─────────────────────────────────────────────────────────────

    private void handleJoin(Session ws, com.canvas.model.Session gameSession, Map<String, Object> payload) {
        LOG.info("handleJoin payload=" + payload);
        if (gameSession == null) { LOG.warning("Session not found"); sendTo(ws, WsMessage.error("Session not found")); return; }

        String nickname = (String) payload.get("nickname");
        String existingPlayerId = (String) payload.get("playerId");

        Player player = sessionManager.addPlayer(gameSession.id, nickname, existingPlayerId);
        if (player == null) { sendTo(ws, WsMessage.error("Could not join session")); return; }

        wsToPlayerId.put(ws, player.id);

        // If reconnecting, send full game state + stroke replay
        List<Map<String, Object>> strokeReplay = List.of();
        if (existingPlayerId != null && gameSession.currentRound != null) {
            strokeReplay = gameSession.currentRound.strokeHistory.stream()
                .map(this::strokeToMap).collect(Collectors.toList());
        }

        List<Map<String, Object>> playerList = buildPlayerList(gameSession);

        String joinUrl = baseUrl + "/join/" + gameSession.id;
        sendTo(ws, WsMessage.of(MessageType.GAME_STATE, Map.of(
            "playerId", player.id,
            "isHost", player.isHost,
            "phase", gameSession.phase.name(),
            "displayMode", gameSession.displayMode.name(),
            "language", gameSession.language.name(),
            "players", playerList,
            "strokeHistory", strokeReplay,
            "joinUrl", joinUrl
        )));

        broadcast(gameSession, WsMessage.of(MessageType.PLAYER_JOINED, Map.of(
            "playerId", player.id,
            "nickname", player.nickname,
            "isHost", player.isHost,
            "players", playerList
        )));
    }

    private void handleStartGame(Session ws, com.canvas.model.Session gameSession) {
        String playerId = wsToPlayerId.get(ws);
        if (!isHost(gameSession, playerId)) { sendTo(ws, WsMessage.error("Only host can start")); return; }
        if (gameSession.phase != GamePhase.LOBBY) { sendTo(ws, WsMessage.error("Game already started")); return; }

        gameSession.phase = GamePhase.CATEGORY;
        gameSession.categoryVotes.clear();
        broadcast(gameSession, WsMessage.of(MessageType.CATEGORY_OPTIONS,
            Map.of("categories", CATEGORIES)));
        broadcast(gameSession, WsMessage.of(MessageType.CATEGORY_VOTES,
            Map.of("votes", Map.of(), "countdownStarted", false, "secondsLeft", 10)));
    }

    private void handleVoteCategory(Session ws, com.canvas.model.Session gameSession, Map<String, Object> payload) {
        if (gameSession == null || gameSession.phase != GamePhase.CATEGORY) return;
        String playerId = wsToPlayerId.get(ws);
        if (playerId == null) return;

        String category = (String) payload.get("category");
        if (category == null || !CATEGORIES.contains(category)) return;

        synchronized (gameSession) {
            // Remove this player from any previous vote
            gameSession.categoryVotes.values().forEach(voters -> voters.remove(playerId));
            // Add to new category
            gameSession.categoryVotes
                .computeIfAbsent(category, k -> new java.util.concurrent.CopyOnWriteArrayList<>())
                .add(playerId);

            boolean isFirstVote = activeTimers.get(gameSession.id + "-category") == null;
            broadcastCategoryVotes(gameSession, isFirstVote, 10);

            if (isFirstVote) {
                startCategoryCountdown(gameSession);
            }
        }
    }

    private void broadcastCategoryVotes(com.canvas.model.Session gameSession, boolean countdownStarted, long secondsLeft) {
        broadcast(gameSession, WsMessage.of(MessageType.CATEGORY_VOTES, Map.of(
            "votes", new HashMap<>(gameSession.categoryVotes),
            "countdownStarted", countdownStarted || activeTimers.containsKey(gameSession.id + "-category"),
            "secondsLeft", secondsLeft
        )));
    }

    private static final List<String> CATEGORIES = List.of("tiere", "pflanzen", "natur", "maerchen", "garten");

    private void startCategoryCountdown(com.canvas.model.Session gameSession) {
        String key = gameSession.id + "-category";
        long[] secondsLeft = {10};

        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(() -> {
            secondsLeft[0]--;
            broadcastCategoryVotes(gameSession, true, secondsLeft[0]);

            if (secondsLeft[0] <= 0) {
                synchronized (gameSession) {
                    cancelTimer(key);
                    String winner = gameEngine.resolveCategory(gameSession.categoryVotes, CATEGORIES);
                    gameSession.categoryVotes.clear();
                    String drawerId = gameEngine.startRound(gameSession, winner);
                    Player drawer = gameSession.players.get(drawerId);
                    broadcast(gameSession, WsMessage.of(MessageType.ROUND_STARTED, Map.of(
                        "drawerId", drawerId,
                        "drawerNickname", drawer.nickname,
                        "category", winner,
                        "wordLength", gameSession.currentRound.word.length(),
                        "firstLetter", String.valueOf(gameSession.currentRound.word.charAt(0))
                    )));
                    getWsForPlayer(gameSession, drawerId).ifPresent(drawerWs ->
                        sendTo(drawerWs, WsMessage.of(MessageType.WORD_SECRET,
                            Map.of("word", gameSession.currentRound.word))));
                    startDrawingTimer(gameSession);
                }
            }
        }, 1, 1, TimeUnit.SECONDS);
        activeTimers.put(key, future);
    }

    private void handleSelectCategory(Session ws, com.canvas.model.Session gameSession, Map<String, Object> payload) {
        if (gameSession == null || gameSession.phase != GamePhase.CATEGORY) {
            sendTo(ws, WsMessage.error("Not in CATEGORY phase")); return;
        }
        String playerId = wsToPlayerId.get(ws);
        if (!isHost(gameSession, playerId)) { sendTo(ws, WsMessage.error("Only host can select category")); return; }

        String category = (String) payload.get("category");
        String drawerId = gameEngine.startRound(gameSession, category);
        Player drawer = gameSession.players.get(drawerId);

        // Notify all: round started
        broadcast(gameSession, WsMessage.of(MessageType.ROUND_STARTED, Map.of(
            "drawerId", drawerId,
            "drawerNickname", drawer.nickname,
            "category", category,
            "wordLength", gameSession.currentRound.word.length(),
            "firstLetter", String.valueOf(gameSession.currentRound.word.charAt(0))
        )));

        // Unicast secret word to drawer
        getWsForPlayer(gameSession, drawerId).ifPresent(drawerWs ->
            sendTo(drawerWs, WsMessage.of(MessageType.WORD_SECRET,
                Map.of("word", gameSession.currentRound.word))));

        // Start drawing timer (60s)
        startDrawingTimer(gameSession);
    }

    private void handleStroke(Session ws, com.canvas.model.Session gameSession, Map<String, Object> payload) {
        if (gameSession.phase != GamePhase.DRAWING) return;
        String playerId = wsToPlayerId.get(ws);
        if (!playerId.equals(gameSession.currentRound.drawerId)) return;

        StrokeEvent stroke = new StrokeEvent(
            toDouble(payload.get("x")),
            toDouble(payload.get("y")),
            (String) payload.get("color"),
            toInt(payload.get("size")),
            StrokeType.valueOf((String) payload.get("type"))
        );
        gameSession.currentRound.strokeHistory.add(stroke);

        // Broadcast to all except drawer
        broadcastExcept(gameSession, ws, WsMessage.of(MessageType.STROKE, strokeToMap(stroke)));
    }

    private void handleDrawingDone(Session ws, com.canvas.model.Session gameSession) {
        String playerId = wsToPlayerId.get(ws);
        if (gameSession.phase != GamePhase.DRAWING) return;
        if (!playerId.equals(gameSession.currentRound.drawerId)) return;

        cancelTimer(gameSession.id + "-drawing");
        transitionToCountdown(gameSession);
    }

    private void handleGuess(Session ws, com.canvas.model.Session gameSession, Map<String, Object> payload) {
        if (gameSession.phase != GamePhase.GUESSING) return;
        String playerId = wsToPlayerId.get(ws);
        String guess = (String) payload.get("text");

        boolean correct = gameEngine.processGuess(gameSession, playerId, guess);
        if (correct) {
            cancelTimer(gameSession.id + "-guessing");
            Player winner = gameSession.players.get(playerId);
            broadcast(gameSession, WsMessage.of(MessageType.CORRECT_GUESS, Map.of(
                "winnerId", playerId,
                "winnerNickname", winner.nickname,
                "word", gameSession.currentRound.word,
                "scores", buildPlayerList(gameSession)
            )));
            broadcast(gameSession, WsMessage.of(MessageType.ROUND_ENDED, Map.of(
                "word", gameSession.currentRound.word,
                "reason", "guessed",
                "scores", buildPlayerList(gameSession)
            )));
        }
    }

    // ── Timer management ─────────────────────────────────────────────────────

    private void startDrawingTimer(com.canvas.model.Session gameSession) {
        String key = gameSession.id + "-drawing";
        cancelTimer(key);

        long[] elapsed = {0};
        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(() -> {
            elapsed[0]++;
            broadcast(gameSession, WsMessage.of(MessageType.TIMER_TICK,
                Map.of("phase", "DRAWING", "secondsLeft", 60 - elapsed[0])));
            if (elapsed[0] >= 60) {
                cancelTimer(key);
                transitionToCountdown(gameSession);
            }
        }, 1, 1, TimeUnit.SECONDS);
        activeTimers.put(key, future);
    }

    private void transitionToCountdown(com.canvas.model.Session gameSession) {
        gameEngine.endDrawingPhase(gameSession);
        // 3-2-1 countdown
        long[] count = {3};
        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(() -> {
            broadcast(gameSession, WsMessage.of(MessageType.COUNTDOWN,
                Map.of("seconds", count[0])));
            count[0]--;
            if (count[0] < 0) {
                cancelTimer(gameSession.id + "-countdown");
                startGuessingTimer(gameSession);
            }
        }, 0, 1, TimeUnit.SECONDS);
        activeTimers.put(gameSession.id + "-countdown", future);
    }

    private void startGuessingTimer(com.canvas.model.Session gameSession) {
        gameEngine.startGuessingPhase(gameSession);
        String key = gameSession.id + "-guessing";

        // Send initial hint
        String word = gameSession.currentRound.word;
        broadcast(gameSession, WsMessage.of(MessageType.HINT,
            Map.of("revealedLetters", Arrays.asList(gameEngine.buildHint(word, 0)))));

        long[] elapsed = {0};
        int[] lastReveal = {0};

        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(() -> {
            elapsed[0]++;
            broadcast(gameSession, WsMessage.of(MessageType.TIMER_TICK,
                Map.of("phase", "GUESSING", "secondsLeft", 60 - elapsed[0])));

            int reveal = gameEngine.hintRevealCount(elapsed[0]);
            if (reveal > lastReveal[0]) {
                lastReveal[0] = reveal;
                broadcast(gameSession, WsMessage.of(MessageType.HINT,
                    Map.of("revealedLetters", Arrays.asList(gameEngine.buildHint(word, reveal)))));
            }

            if (elapsed[0] >= 60) {
                cancelTimer(key);
                if (gameSession.phase == GamePhase.GUESSING) {
                    gameEngine.endGuessingPhase(gameSession);
                    broadcast(gameSession, WsMessage.of(MessageType.ROUND_ENDED, Map.of(
                        "word", word,
                        "reason", "timeout",
                        "scores", buildPlayerList(gameSession)
                    )));
                }
            }
        }, 1, 1, TimeUnit.SECONDS);
        activeTimers.put(key, future);
    }

    private void cancelTimer(String key) {
        ScheduledFuture<?> f = activeTimers.remove(key);
        if (f != null) f.cancel(false);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void broadcast(com.canvas.model.Session gameSession, WsMessage msg) {
        String json = toJson(msg);
        wsToPlayerId.entrySet().stream()
            .filter(e -> gameSession.players.containsKey(e.getValue()))
            .map(Map.Entry::getKey)
            .forEach(ws -> sendRaw(ws, json));
    }

    private void broadcastExcept(com.canvas.model.Session gameSession, Session excludeWs, WsMessage msg) {
        String json = toJson(msg);
        wsToPlayerId.entrySet().stream()
            .filter(e -> gameSession.players.containsKey(e.getValue()) && !e.getKey().equals(excludeWs))
            .map(Map.Entry::getKey)
            .forEach(ws -> sendRaw(ws, json));
    }

    private void sendTo(Session ws, WsMessage msg) {
        sendRaw(ws, toJson(msg));
    }

    private void sendRaw(Session ws, String json) {
        try {
            if (ws.isOpen()) ws.getAsyncRemote().sendText(json);
        } catch (Exception ignored) {}
    }

    private Optional<Session> getWsForPlayer(com.canvas.model.Session gameSession, String playerId) {
        return wsToPlayerId.entrySet().stream()
            .filter(e -> e.getValue().equals(playerId))
            .map(Map.Entry::getKey)
            .findFirst();
    }

    private boolean isHost(com.canvas.model.Session gameSession, String playerId) {
        if (gameSession == null || playerId == null) return false;
        Player p = gameSession.players.get(playerId);
        return p != null && p.isHost;
    }

    private List<Map<String, Object>> buildPlayerList(com.canvas.model.Session gameSession) {
        return gameSession.players.values().stream()
            .map(p -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", p.id);
                m.put("nickname", p.nickname);
                m.put("score", p.score);
                m.put("connected", p.connected);
                m.put("isHost", p.isHost);
                return m;
            })
            .collect(Collectors.toList());
    }

    private Map<String, Object> strokeToMap(StrokeEvent s) {
        return Map.of("x", s.x, "y", s.y, "color", s.color, "size", s.size, "type", s.type.name());
    }

    private String toJson(WsMessage msg) {
        try { return mapper.writeValueAsString(msg); }
        catch (Exception e) { return "{\"type\":\"ERROR\"}"; }
    }

    private double toDouble(Object o) {
        return o instanceof Number n ? n.doubleValue() : 0.0;
    }

    private int toInt(Object o) {
        return o instanceof Number n ? n.intValue() : 1;
    }
}
