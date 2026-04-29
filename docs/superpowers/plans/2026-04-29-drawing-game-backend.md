# Drawing & Guessing Game — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Quarkus backend: session management, game engine (phases, timers, scoring, hints), Jakarta WebSocket real-time API, REST session-creation endpoint, and MongoDB word lists.

**Architecture:** All game state lives in-memory (ConcurrentHashMap). The GameEngine runs server-side timers via ScheduledExecutorService and broadcasts events over Jakarta WebSocket. MongoDB stores only word lists (one document per category+language). The React build is served as Quarkus static resources — one Docker image, no separate frontend server.

**Tech Stack:** Quarkus 3.x, Jakarta WebSocket (`quarkus-websockets`), Quarkus REST (`quarkus-resteasy-reactive-jackson`), Quarkus MongoDB Panache (`quarkus-mongodb-panache`), JUnit 5, Mockito, Docker Compose.

---

## File Structure

```
backend/
├── pom.xml
├── src/
│   ├── main/
│   │   ├── java/com/canvas/
│   │   │   ├── model/
│   │   │   │   ├── GamePhase.java          enum: LOBBY|CATEGORY|DRAWING|COUNTDOWN|GUESSING|RESULT
│   │   │   │   ├── DisplayMode.java        enum: OWN_DEVICE|SHARED_SCREEN
│   │   │   │   ├── Language.java           enum: DE|EN
│   │   │   │   ├── StrokeType.java         enum: START|MOVE|END
│   │   │   │   ├── StrokeEvent.java        x,y (normalized 0-1), color, size(1-3), type
│   │   │   │   ├── Player.java             id, nickname, score, connected, isHost
│   │   │   │   ├── Round.java              drawerId, word, category, strokeHistory, timestamps
│   │   │   │   └── Session.java            id, hostId, phase, displayMode, language, players, currentRound
│   │   │   ├── words/
│   │   │   │   ├── WordDocument.java       MongoDB @MongoEntity: category, language, words[]
│   │   │   │   ├── WordRepository.java     PanacheMongoRepository<WordDocument>
│   │   │   │   └── WordService.java        getRandomWord(category,language), seedIfEmpty()
│   │   │   ├── session/
│   │   │   │   ├── SessionManager.java     createSession, getSession, removeSession
│   │   │   │   └── GameEngine.java         phase transitions, timer, scoring, hints — @ApplicationScoped
│   │   │   ├── websocket/
│   │   │   │   ├── MessageType.java        enum of all WS event names
│   │   │   │   ├── WsMessage.java          {type:MessageType, payload:Map<String,Object>}
│   │   │   │   └── GameWebSocket.java      @ServerEndpoint("/ws/{sessionId}")
│   │   │   └── rest/
│   │   │       └── SessionResource.java    POST /api/sessions → {sessionId, joinUrl}
│   │   └── resources/
│   │       ├── application.properties
│   │       └── words/
│   │           ├── de.json                 German word lists by category
│   │           └── en.json                 English word lists by category
│   └── test/
│       └── java/com/canvas/
│           ├── session/
│           │   ├── SessionManagerTest.java
│           │   └── GameEngineTest.java
│           ├── words/
│           │   └── WordServiceTest.java
│           └── rest/
│               └── SessionResourceTest.java
```

**Key design choices:**
- Stroke coordinates are **normalized to [0.0, 1.0]** relative to canvas dimensions. Clients send normalized coords; server relays as-is. This ensures strokes render correctly on different screen sizes.
- `ScheduledExecutorService` (1 thread per active timer) handles drawing + guessing countdowns.
- `GameWebSocket` holds `Map<jakarta.websocket.Session, String> wsToPlayerId` for routing.

---

## Task 1: Maven Project Scaffold

**Files:**
- Create: `backend/pom.xml`
- Create: `backend/src/main/resources/application.properties`

- [ ] **Step 1: Generate Quarkus project**

```bash
cd /d/GIT/canvas
mvn io.quarkus.platform:quarkus-maven-plugin:3.15.1:create \
  -DprojectGroupId=com.canvas \
  -DprojectArtifactId=backend \
  -DprojectVersion=1.0.0-SNAPSHOT \
  -Dextensions="websockets,resteasy-reactive-jackson,mongodb-panache"
```

Expected: `backend/` directory created with `pom.xml`, `src/`, and Maven wrapper.

- [ ] **Step 2: Configure application.properties**

Replace `backend/src/main/resources/application.properties` with:

```properties
# MongoDB
quarkus.mongodb.connection-string=mongodb://localhost:27017
quarkus.mongodb.database=canvas

# HTTP
quarkus.http.port=8080

# Serve React build from Quarkus (populated in frontend plan)
quarkus.http.root-path=/

# CORS for local development
quarkus.http.cors=true
quarkus.http.cors.origins=http://localhost:5173

# Test profile: use embedded MongoDB
%test.quarkus.mongodb.connection-string=mongodb://localhost:27017
%test.quarkus.mongodb.database=canvas_test
```

- [ ] **Step 3: Verify the project builds**

```bash
cd backend
./mvnw compile
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**

```bash
cd /d/GIT/canvas
git add backend/
git commit -m "feat: scaffold Quarkus backend project"
```

---

## Task 2: Domain Models

**Files:**
- Create: `backend/src/main/java/com/canvas/model/GamePhase.java`
- Create: `backend/src/main/java/com/canvas/model/DisplayMode.java`
- Create: `backend/src/main/java/com/canvas/model/Language.java`
- Create: `backend/src/main/java/com/canvas/model/StrokeType.java`
- Create: `backend/src/main/java/com/canvas/model/StrokeEvent.java`
- Create: `backend/src/main/java/com/canvas/model/Player.java`
- Create: `backend/src/main/java/com/canvas/model/Round.java`
- Create: `backend/src/main/java/com/canvas/model/Session.java`

- [ ] **Step 1: Create enums**

`backend/src/main/java/com/canvas/model/GamePhase.java`:
```java
package com.canvas.model;
public enum GamePhase { LOBBY, CATEGORY, DRAWING, COUNTDOWN, GUESSING, RESULT }
```

`backend/src/main/java/com/canvas/model/DisplayMode.java`:
```java
package com.canvas.model;
public enum DisplayMode { OWN_DEVICE, SHARED_SCREEN }
```

`backend/src/main/java/com/canvas/model/Language.java`:
```java
package com.canvas.model;
public enum Language { DE, EN }
```

`backend/src/main/java/com/canvas/model/StrokeType.java`:
```java
package com.canvas.model;
public enum StrokeType { START, MOVE, END }
```

- [ ] **Step 2: Create StrokeEvent**

`backend/src/main/java/com/canvas/model/StrokeEvent.java`:
```java
package com.canvas.model;

public class StrokeEvent {
    public double x;       // normalized 0.0–1.0
    public double y;       // normalized 0.0–1.0
    public String color;   // hex, e.g. "#e74c3c"
    public int size;       // 1, 2, or 3
    public StrokeType type;

    public StrokeEvent() {}

    public StrokeEvent(double x, double y, String color, int size, StrokeType type) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.type = type;
    }
}
```

- [ ] **Step 3: Create Player**

`backend/src/main/java/com/canvas/model/Player.java`:
```java
package com.canvas.model;

public class Player {
    public String id;        // UUID, stable across reconnects
    public String nickname;
    public int score;
    public boolean connected;
    public boolean isHost;

    public Player() {}

    public Player(String id, String nickname, boolean isHost) {
        this.id = id;
        this.nickname = nickname;
        this.isHost = isHost;
        this.score = 0;
        this.connected = true;
    }
}
```

- [ ] **Step 4: Create Round**

`backend/src/main/java/com/canvas/model/Round.java`:
```java
package com.canvas.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class Round {
    public String drawerId;
    public String word;
    public String category;
    public List<StrokeEvent> strokeHistory = new ArrayList<>();
    public Instant drawingStartedAt;
    public Instant guessingStartedAt;

    public Round() {}

    public Round(String drawerId, String word, String category) {
        this.drawerId = drawerId;
        this.word = word;
        this.category = category;
        this.drawingStartedAt = Instant.now();
    }
}
```

- [ ] **Step 5: Create Session**

`backend/src/main/java/com/canvas/model/Session.java`:
```java
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
```

- [ ] **Step 6: Compile to verify no errors**

```bash
cd backend
./mvnw compile
```

Expected: `BUILD SUCCESS`

- [ ] **Step 7: Commit**

```bash
cd /d/GIT/canvas
git add backend/src/main/java/com/canvas/model/
git commit -m "feat: add domain models (Session, Player, Round, StrokeEvent)"
```

---

## Task 3: Word Lists (MongoDB + Seed Data)

**Files:**
- Create: `backend/src/main/resources/words/de.json`
- Create: `backend/src/main/resources/words/en.json`
- Create: `backend/src/main/java/com/canvas/words/WordDocument.java`
- Create: `backend/src/main/java/com/canvas/words/WordRepository.java`
- Create: `backend/src/main/java/com/canvas/words/WordService.java`
- Create: `backend/src/test/java/com/canvas/words/WordServiceTest.java`

- [ ] **Step 1: Write the failing test**

`backend/src/test/java/com/canvas/words/WordServiceTest.java`:
```java
package com.canvas.words;

import com.canvas.model.Language;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
class WordServiceTest {

    @Inject
    WordService wordService;

    @Test
    void getRandomWord_returnsWordFromCategory() {
        String word = wordService.getRandomWord("tiere", Language.DE);
        assertNotNull(word);
        assertFalse(word.isBlank());
    }

    @Test
    void getRandomWord_unknownCategory_returnsNull() {
        String word = wordService.getRandomWord("unknown", Language.DE);
        assertNull(word);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
./mvnw test -Dtest=WordServiceTest -pl .
```

Expected: FAIL — `WordService` class not found.

- [ ] **Step 3: Create German word list**

`backend/src/main/resources/words/de.json`:
```json
[
  {
    "category": "tiere",
    "language": "de",
    "words": ["Schmetterling", "Elefant", "Igel", "Frosch", "Eichhörnchen",
              "Marienkäfer", "Pinguin", "Giraffe", "Hase", "Ente",
              "Schildkröte", "Papagei", "Löwe", "Zebra", "Biene",
              "Katze", "Hund", "Fisch", "Vogel", "Schnecke"]
  },
  {
    "category": "pflanzen",
    "language": "de",
    "words": ["Sonnenblume", "Tulpe", "Kaktus", "Baum", "Pilz",
              "Rose", "Gras", "Blatt", "Wurzel", "Beere",
              "Apfelbaum", "Tanne", "Bambus", "Efeu", "Moos"]
  },
  {
    "category": "natur",
    "language": "de",
    "words": ["Regenbogen", "Wolke", "Blitz", "Schnee", "Regen",
              "Berg", "Fluss", "See", "Mond", "Sonne",
              "Stern", "Vulkan", "Wasserfall", "Welle", "Eis"]
  },
  {
    "category": "maerchen",
    "language": "de",
    "words": ["Drache", "Prinzessin", "Zauberstab", "Schloss", "Fee",
              "Riese", "Zwerg", "Hexe", "Einhorn", "Meerjungfrau",
              "Zauberhut", "Fliegendes Pferd", "Zaubertrank", "Schatztruhe", "Kristallkugel"]
  },
  {
    "category": "garten",
    "language": "de",
    "words": ["Schaukel", "Gießkanne", "Schaufel", "Vogelhaus", "Regenwurm",
              "Kompost", "Zaun", "Gartenhaus", "Blumenbeet", "Rasen",
              "Schubkarre", "Rechen", "Gewächshaus", "Teich", "Hecke"]
  }
]
```

- [ ] **Step 4: Create English word list**

`backend/src/main/resources/words/en.json`:
```json
[
  {
    "category": "tiere",
    "language": "en",
    "words": ["butterfly", "elephant", "hedgehog", "frog", "squirrel",
              "ladybug", "penguin", "giraffe", "rabbit", "duck",
              "turtle", "parrot", "lion", "zebra", "bee",
              "cat", "dog", "fish", "bird", "snail"]
  },
  {
    "category": "pflanzen",
    "language": "en",
    "words": ["sunflower", "tulip", "cactus", "tree", "mushroom",
              "rose", "grass", "leaf", "root", "berry",
              "apple tree", "fir tree", "bamboo", "ivy", "moss"]
  },
  {
    "category": "natur",
    "language": "en",
    "words": ["rainbow", "cloud", "lightning", "snow", "rain",
              "mountain", "river", "lake", "moon", "sun",
              "star", "volcano", "waterfall", "wave", "ice"]
  },
  {
    "category": "maerchen",
    "language": "en",
    "words": ["dragon", "princess", "magic wand", "castle", "fairy",
              "giant", "dwarf", "witch", "unicorn", "mermaid",
              "wizard hat", "flying horse", "magic potion", "treasure chest", "crystal ball"]
  },
  {
    "category": "garten",
    "language": "en",
    "words": ["swing", "watering can", "shovel", "birdhouse", "earthworm",
              "compost", "fence", "garden shed", "flower bed", "lawn",
              "wheelbarrow", "rake", "greenhouse", "pond", "hedge"]
  }
]
```

- [ ] **Step 5: Create WordDocument**

`backend/src/main/java/com/canvas/words/WordDocument.java`:
```java
package com.canvas.words;

import io.quarkus.mongodb.panache.PanacheMongoEntity;
import io.quarkus.mongodb.panache.common.MongoEntity;
import java.util.List;

@MongoEntity(collection = "word_lists")
public class WordDocument extends PanacheMongoEntity {
    public String category;
    public String language;
    public List<String> words;
}
```

- [ ] **Step 6: Create WordRepository**

`backend/src/main/java/com/canvas/words/WordRepository.java`:
```java
package com.canvas.words;

import io.quarkus.mongodb.panache.PanacheMongoRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;

@ApplicationScoped
public class WordRepository implements PanacheMongoRepository<WordDocument> {

    public Optional<WordDocument> findByCategoryAndLanguage(String category, String language) {
        return find("category = ?1 and language = ?2", category, language).firstResultOptional();
    }
}
```

- [ ] **Step 7: Create WordService**

`backend/src/main/java/com/canvas/words/WordService.java`:
```java
package com.canvas.words;

import com.canvas.model.Language;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.io.InputStream;
import java.util.List;
import java.util.Random;

@ApplicationScoped
public class WordService {

    @Inject WordRepository wordRepository;

    private final Random random = new Random();
    private final ObjectMapper mapper = new ObjectMapper();

    void onStart(@Observes StartupEvent ev) {
        seedIfEmpty();
    }

    public void seedIfEmpty() {
        if (wordRepository.count() > 0) return;
        for (String lang : List.of("de", "en")) {
            try (InputStream is = getClass().getResourceAsStream("/words/" + lang + ".json")) {
                List<WordDocument> docs = mapper.readValue(is, new TypeReference<>() {});
                docs.forEach(wordRepository::persist);
            } catch (Exception e) {
                throw new RuntimeException("Failed to seed word lists for language: " + lang, e);
            }
        }
    }

    public String getRandomWord(String category, Language language) {
        return wordRepository
            .findByCategoryAndLanguage(category, language.name().toLowerCase())
            .map(doc -> {
                if (doc.words == null || doc.words.isEmpty()) return null;
                return doc.words.get(random.nextInt(doc.words.size()));
            })
            .orElse(null);
    }
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
cd backend
./mvnw test -Dtest=WordServiceTest
```

Expected: `Tests run: 2, Failures: 0, Errors: 0`

- [ ] **Step 9: Commit**

```bash
cd /d/GIT/canvas
git add backend/src/main/java/com/canvas/words/ backend/src/main/resources/words/ backend/src/test/java/com/canvas/words/
git commit -m "feat: add word service with MongoDB persistence and seed data"
```

---

## Task 4: SessionManager

**Files:**
- Create: `backend/src/main/java/com/canvas/session/SessionManager.java`
- Create: `backend/src/test/java/com/canvas/session/SessionManagerTest.java`

- [ ] **Step 1: Write the failing tests**

`backend/src/test/java/com/canvas/session/SessionManagerTest.java`:
```java
package com.canvas.session;

import com.canvas.model.*;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
class SessionManagerTest {

    @Inject SessionManager sessionManager;

    @BeforeEach
    void clearSessions() {
        sessionManager.clearAll();
    }

    @Test
    void createSession_generatesUniqueIds() {
        Session s1 = sessionManager.createSession(DisplayMode.OWN_DEVICE, Language.DE, "nick1");
        Session s2 = sessionManager.createSession(DisplayMode.OWN_DEVICE, Language.DE, "nick2");
        assertNotEquals(s1.id, s2.id);
        assertEquals(6, s1.id.length());
    }

    @Test
    void createSession_hostPlayerAdded() {
        Session session = sessionManager.createSession(DisplayMode.OWN_DEVICE, Language.DE, "Anna");
        assertEquals(1, session.players.size());
        Player host = session.players.values().iterator().next();
        assertTrue(host.isHost);
        assertEquals("Anna", host.nickname);
    }

    @Test
    void getSession_returnsSession() {
        Session created = sessionManager.createSession(DisplayMode.OWN_DEVICE, Language.DE, "Anna");
        Session found = sessionManager.getSession(created.id);
        assertNotNull(found);
        assertEquals(created.id, found.id);
    }

    @Test
    void getSession_unknownId_returnsNull() {
        assertNull(sessionManager.getSession("XXXXXX"));
    }

    @Test
    void addPlayer_joinsSession() {
        Session session = sessionManager.createSession(DisplayMode.OWN_DEVICE, Language.DE, "Anna");
        Player p = sessionManager.addPlayer(session.id, "Ben", null);
        assertNotNull(p);
        assertEquals("Ben", p.nickname);
        assertFalse(p.isHost);
        assertEquals(2, session.players.size());
    }

    @Test
    void addPlayer_reconnect_restoresPlayer() {
        Session session = sessionManager.createSession(DisplayMode.OWN_DEVICE, Language.DE, "Anna");
        Player original = sessionManager.addPlayer(session.id, "Ben", null);
        original.connected = false;
        Player reconnected = sessionManager.addPlayer(session.id, "Ben", original.id);
        assertEquals(original.id, reconnected.id);
        assertTrue(reconnected.connected);
        assertEquals(2, session.players.size()); // no duplicate
    }
}
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend
./mvnw test -Dtest=SessionManagerTest
```

Expected: FAIL — `SessionManager` class not found.

- [ ] **Step 3: Implement SessionManager**

`backend/src/main/java/com/canvas/session/SessionManager.java`:
```java
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
./mvnw test -Dtest=SessionManagerTest
```

Expected: `Tests run: 6, Failures: 0, Errors: 0`

- [ ] **Step 5: Commit**

```bash
cd /d/GIT/canvas
git add backend/src/main/java/com/canvas/session/SessionManager.java backend/src/test/java/com/canvas/session/SessionManagerTest.java
git commit -m "feat: add SessionManager with in-memory session CRUD"
```

---

## Task 5: WebSocket Message Types

**Files:**
- Create: `backend/src/main/java/com/canvas/websocket/MessageType.java`
- Create: `backend/src/main/java/com/canvas/websocket/WsMessage.java`

- [ ] **Step 1: Create MessageType enum**

`backend/src/main/java/com/canvas/websocket/MessageType.java`:
```java
package com.canvas.websocket;

public enum MessageType {
    // Client → Server
    JOIN, START_GAME, SELECT_CATEGORY, STROKE, DRAWING_DONE, GUESS,

    // Server → Client
    GAME_STATE, PLAYER_JOINED, PLAYER_DISCONNECTED,
    CATEGORY_OPTIONS, ROUND_STARTED, WORD_SECRET,
    COUNTDOWN, HINT, CORRECT_GUESS, ROUND_ENDED, TIMER_TICK, ERROR
}
```

- [ ] **Step 2: Create WsMessage**

`backend/src/main/java/com/canvas/websocket/WsMessage.java`:
```java
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
```

- [ ] **Step 3: Compile**

```bash
cd backend
./mvnw compile
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**

```bash
cd /d/GIT/canvas
git add backend/src/main/java/com/canvas/websocket/MessageType.java backend/src/main/java/com/canvas/websocket/WsMessage.java
git commit -m "feat: add WebSocket message types and WsMessage wrapper"
```

---

## Task 6: GameEngine — Phase Transitions & Scoring

**Files:**
- Create: `backend/src/main/java/com/canvas/session/GameEngine.java`
- Create: `backend/src/test/java/com/canvas/session/GameEngineTest.java`

- [ ] **Step 1: Write the failing tests**

`backend/src/test/java/com/canvas/session/GameEngineTest.java`:
```java
package com.canvas.session;

import com.canvas.model.*;
import com.canvas.words.WordService;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
class GameEngineTest {

    @Inject GameEngine gameEngine;
    @Inject SessionManager sessionManager;
    @InjectMock WordService wordService;

    private Session session;
    private String drawerId;

    @BeforeEach
    void setup() {
        sessionManager.clearAll();
        Mockito.when(wordService.getRandomWord(Mockito.anyString(), Mockito.any()))
               .thenReturn("Schmetterling");
        session = sessionManager.createSession(DisplayMode.OWN_DEVICE, Language.DE, "Anna");
        sessionManager.addPlayer(session.id, "Ben", null);
    }

    @Test
    void startRound_picksRandomDrawer_andSetsPhase() {
        gameEngine.startRound(session, "tiere");
        assertEquals(GamePhase.DRAWING, session.phase);
        assertNotNull(session.currentRound);
        assertNotNull(session.currentRound.drawerId);
        assertTrue(session.players.containsKey(session.currentRound.drawerId));
    }

    @Test
    void startRound_wordAssignedFromWordService() {
        gameEngine.startRound(session, "tiere");
        assertEquals("Schmetterling", session.currentRound.word);
    }

    @Test
    void endDrawingPhase_setsCountdownPhase() {
        gameEngine.startRound(session, "tiere");
        gameEngine.endDrawingPhase(session);
        assertEquals(GamePhase.COUNTDOWN, session.phase);
    }

    @Test
    void processGuess_correct_awardsPoints() {
        gameEngine.startRound(session, "tiere");
        gameEngine.endDrawingPhase(session);
        // fast-forward to GUESSING phase
        session.phase = GamePhase.GUESSING;
        session.currentRound.guessingStartedAt = java.time.Instant.now();

        String guesserPlayerId = session.players.values().stream()
            .filter(p -> !p.id.equals(session.currentRound.drawerId))
            .findFirst().get().id;

        boolean correct = gameEngine.processGuess(session, guesserPlayerId, "Schmetterling");
        assertTrue(correct);
        assertEquals(1, session.players.get(guesserPlayerId).score);
        assertEquals(2, session.players.get(session.currentRound.drawerId).score);
        assertEquals(GamePhase.RESULT, session.phase);
    }

    @Test
    void processGuess_wrong_noPoints() {
        gameEngine.startRound(session, "tiere");
        session.phase = GamePhase.GUESSING;
        session.currentRound.guessingStartedAt = java.time.Instant.now();

        String guesserPlayerId = session.players.values().stream()
            .filter(p -> !p.id.equals(session.currentRound.drawerId))
            .findFirst().get().id;

        boolean correct = gameEngine.processGuess(session, guesserPlayerId, "wrongword");
        assertFalse(correct);
        assertEquals(0, session.players.get(guesserPlayerId).score);
    }

    @Test
    void buildHint_revealsByIndex() {
        String[] hint = gameEngine.buildHint("Schmetterling", 0);  // 0 letters revealed beyond first
        assertEquals("S", hint[0]);
        assertEquals("_", hint[1]);

        String[] hint2 = gameEngine.buildHint("Schmetterling", 2); // reveal 3rd letter too
        assertEquals("S", hint2[0]);
        assertEquals("_", hint2[1]);
        assertEquals("h", hint2[2]);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend
./mvnw test -Dtest=GameEngineTest
```

Expected: FAIL — `GameEngine` class not found.

- [ ] **Step 3: Implement GameEngine**

`backend/src/main/java/com/canvas/session/GameEngine.java`:
```java
package com.canvas.session;

import com.canvas.model.*;
import com.canvas.words.WordService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.*;

@ApplicationScoped
public class GameEngine {

    @Inject WordService wordService;

    private final Random random = new Random();

    /**
     * Pick a random drawer, fetch a word, transition to DRAWING phase.
     */
    public String startRound(Session session, String category) {
        List<String> playerIds = new ArrayList<>(session.players.keySet());
        String drawerId = playerIds.get(random.nextInt(playerIds.size()));
        String word = wordService.getRandomWord(category, session.language);

        session.currentRound = new Round(drawerId, word, category);
        session.phase = GamePhase.DRAWING;
        return drawerId;
    }

    /**
     * End the drawing phase → transition to COUNTDOWN.
     */
    public void endDrawingPhase(Session session) {
        session.phase = GamePhase.COUNTDOWN;
    }

    /**
     * Transition from COUNTDOWN to GUESSING.
     */
    public void startGuessingPhase(Session session) {
        session.phase = GamePhase.GUESSING;
        session.currentRound.guessingStartedAt = Instant.now();
    }

    /**
     * Process a guess. Returns true if correct.
     * Awards points and transitions to RESULT on correct guess.
     */
    public boolean processGuess(Session session, String guesserPlayerId, String guess) {
        if (session.phase != GamePhase.GUESSING) return false;
        if (guesserPlayerId.equals(session.currentRound.drawerId)) return false;

        boolean correct = session.currentRound.word.equalsIgnoreCase(guess.trim());
        if (correct) {
            session.players.get(guesserPlayerId).score += 1;
            session.players.get(session.currentRound.drawerId).score += 2;
            session.phase = GamePhase.RESULT;
        }
        return correct;
    }

    /**
     * Time ran out — transition to RESULT, award no points.
     */
    public void endGuessingPhase(Session session) {
        session.phase = GamePhase.RESULT;
    }

    /**
     * Build the letter hint array.
     * @param word        the secret word
     * @param revealCount how many letters beyond the first to reveal (0 = only first letter shown)
     * @return array of single-char strings: revealed letters or "_"
     */
    public String[] buildHint(String word, int revealCount) {
        String[] result = new String[word.length()];
        for (int i = 0; i < word.length(); i++) {
            char c = word.charAt(i);
            if (c == ' ') {
                result[i] = " ";
            } else if (i == 0 || i <= revealCount) {
                result[i] = String.valueOf(c);
            } else {
                result[i] = "_";
            }
        }
        return result;
    }

    /**
     * How many hint letters to reveal based on elapsed guessing seconds.
     * At 20s → reveal 2nd letter (revealCount=1)
     * At 40s → reveal 3rd letter (revealCount=2)
     * At 50s → reveal 4th letter (revealCount=3)
     */
    public int hintRevealCount(long elapsedSeconds) {
        if (elapsedSeconds >= 50) return 3;
        if (elapsedSeconds >= 40) return 2;
        if (elapsedSeconds >= 20) return 1;
        return 0;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
./mvnw test -Dtest=GameEngineTest
```

Expected: `Tests run: 6, Failures: 0, Errors: 0`

- [ ] **Step 5: Commit**

```bash
cd /d/GIT/canvas
git add backend/src/main/java/com/canvas/session/GameEngine.java backend/src/test/java/com/canvas/session/GameEngineTest.java
git commit -m "feat: add GameEngine with phase transitions, scoring, and hint logic"
```

---

## Task 7: REST Endpoint (Create Session)

**Files:**
- Create: `backend/src/main/java/com/canvas/rest/SessionResource.java`
- Create: `backend/src/test/java/com/canvas/rest/SessionResourceTest.java`

- [ ] **Step 1: Write the failing test**

`backend/src/test/java/com/canvas/rest/SessionResourceTest.java`:
```java
package com.canvas.rest;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class SessionResourceTest {

    @Test
    void createSession_returnsSessionIdAndJoinUrl() {
        RestAssured.given()
            .contentType(ContentType.JSON)
            .body("""
                {"nickname":"Anna","displayMode":"OWN_DEVICE","language":"DE"}
                """)
            .when().post("/api/sessions")
            .then()
            .statusCode(201)
            .body("sessionId", matchesPattern("[A-Z0-9]{6}"))
            .body("joinUrl", containsString("/join/"));
    }

    @Test
    void createSession_missingNickname_returns400() {
        RestAssured.given()
            .contentType(ContentType.JSON)
            .body("""
                {"displayMode":"OWN_DEVICE","language":"DE"}
                """)
            .when().post("/api/sessions")
            .then()
            .statusCode(400);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend
./mvnw test -Dtest=SessionResourceTest
```

Expected: FAIL — 404 (endpoint not yet defined).

- [ ] **Step 3: Implement SessionResource**

`backend/src/main/java/com/canvas/rest/SessionResource.java`:
```java
package com.canvas.rest;

import com.canvas.model.DisplayMode;
import com.canvas.model.Language;
import com.canvas.model.Session;
import com.canvas.session.SessionManager;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@Path("/api/sessions")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SessionResource {

    @Inject SessionManager sessionManager;

    @ConfigProperty(name = "app.base-url", defaultValue = "http://localhost:8080")
    String baseUrl;

    public record CreateSessionRequest(String nickname, String displayMode, String language) {}
    public record CreateSessionResponse(String sessionId, String joinUrl, String playerId) {}

    @POST
    public Response createSession(CreateSessionRequest req) {
        if (req == null || req.nickname() == null || req.nickname().isBlank()) {
            return Response.status(400).entity("{\"error\":\"nickname is required\"}").build();
        }

        DisplayMode mode = DisplayMode.OWN_DEVICE;
        if (req.displayMode() != null) {
            try { mode = DisplayMode.valueOf(req.displayMode()); }
            catch (IllegalArgumentException e) { /* default */ }
        }

        Language lang = Language.DE;
        if (req.language() != null) {
            try { lang = Language.valueOf(req.language()); }
            catch (IllegalArgumentException e) { /* default */ }
        }

        Session session = sessionManager.createSession(mode, lang, req.nickname());
        String playerId = session.players.values().stream()
            .filter(p -> p.isHost).findFirst().get().id;
        String joinUrl = baseUrl + "/join/" + session.id;

        return Response.status(201)
            .entity(new CreateSessionResponse(session.id, joinUrl, playerId))
            .build();
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
./mvnw test -Dtest=SessionResourceTest
```

Expected: `Tests run: 2, Failures: 0, Errors: 0`

- [ ] **Step 5: Commit**

```bash
cd /d/GIT/canvas
git add backend/src/main/java/com/canvas/rest/ backend/src/test/java/com/canvas/rest/
git commit -m "feat: add REST endpoint POST /api/sessions"
```

---

## Task 8: WebSocket Endpoint

**Files:**
- Create: `backend/src/main/java/com/canvas/websocket/GameWebSocket.java`

This is the largest single file. It routes all incoming WS messages to SessionManager and GameEngine, and broadcasts results.

- [ ] **Step 1: Implement GameWebSocket**

`backend/src/main/java/com/canvas/websocket/GameWebSocket.java`:
```java
package com.canvas.websocket;

import com.canvas.model.*;
import com.canvas.session.GameEngine;
import com.canvas.session.SessionManager;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.websocket.*;
import jakarta.websocket.server.PathParam;
import jakarta.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

@ServerEndpoint("/ws/{sessionId}")
@ApplicationScoped
public class GameWebSocket {

    @Inject SessionManager sessionManager;
    @Inject GameEngine gameEngine;

    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<Session, String> wsToPlayerId = new ConcurrentHashMap<>();
    private final Map<String, ScheduledFuture<?>> activeTimers = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);

    @OnOpen
    public void onOpen(Session ws, @PathParam("sessionId") String sessionId) {
        // Player must send JOIN as first message to register
    }

    @OnMessage
    public void onMessage(String raw, Session ws, @PathParam("sessionId") String sessionId) {
        try {
            WsMessage msg = mapper.readValue(raw, WsMessage.class);
            com.canvas.model.Session gameSession = sessionManager.getSession(sessionId);

            switch (msg.type) {
                case JOIN -> handleJoin(ws, gameSession, msg.payload);
                case START_GAME -> handleStartGame(ws, gameSession);
                case SELECT_CATEGORY -> handleSelectCategory(ws, gameSession, msg.payload);
                case STROKE -> handleStroke(ws, gameSession, msg.payload);
                case DRAWING_DONE -> handleDrawingDone(ws, gameSession);
                case GUESS -> handleGuess(ws, gameSession, msg.payload);
                default -> sendTo(ws, WsMessage.error("Unknown message type: " + msg.type));
            }
        } catch (Exception e) {
            sendTo(ws, WsMessage.error("Invalid message format"));
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
        if (gameSession == null) { sendTo(ws, WsMessage.error("Session not found")); return; }

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

        sendTo(ws, WsMessage.of(MessageType.GAME_STATE, Map.of(
            "playerId", player.id,
            "isHost", player.isHost,
            "phase", gameSession.phase.name(),
            "displayMode", gameSession.displayMode.name(),
            "language", gameSession.language.name(),
            "players", playerList,
            "strokeHistory", strokeReplay
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
        List<String> categories = List.of("tiere", "pflanzen", "natur", "maerchen", "garten");
        broadcast(gameSession, WsMessage.of(MessageType.CATEGORY_OPTIONS,
            Map.of("categories", categories)));
    }

    private void handleSelectCategory(Session ws, com.canvas.model.Session gameSession, Map<String, Object> payload) {
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
            if (ws.isOpen()) ws.getBasicRemote().sendText(json);
        } catch (IOException ignored) {}
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
            .map(p -> (Map<String, Object>) new HashMap<>(Map.of(
                "id", p.id, "nickname", p.nickname,
                "score", p.score, "connected", p.connected, "isHost", p.isHost
            )))
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
```

- [ ] **Step 2: Compile**

```bash
cd backend
./mvnw compile
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Start the application and verify WebSocket endpoint is reachable**

```bash
cd backend
./mvnw quarkus:dev &
sleep 5
# Check REST endpoint
curl -s -X POST http://localhost:8080/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"nickname":"TestHost","displayMode":"OWN_DEVICE","language":"DE"}' | python -m json.tool
```

Expected: JSON with `sessionId` (6 chars) and `joinUrl`.

Stop dev server: `kill %1`

- [ ] **Step 4: Commit**

```bash
cd /d/GIT/canvas
git add backend/src/main/java/com/canvas/websocket/
git commit -m "feat: add WebSocket endpoint with full game flow (join, draw, guess, timer)"
```

---

## Task 9: Docker Compose + Quarkus Serves React Build

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/src/main/docker/Dockerfile.jvm`
- Modify: `backend/src/main/resources/application.properties`

- [ ] **Step 1: Create docker-compose.yml**

`docker-compose.yml`:
```yaml
version: "3.9"

services:
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

  backend:
    build:
      context: backend
      dockerfile: src/main/docker/Dockerfile.jvm
    ports:
      - "8080:8080"
    environment:
      QUARKUS_MONGODB_CONNECTION_STRING: mongodb://mongodb:27017
      QUARKUS_MONGODB_DATABASE: canvas
      APP_BASE_URL: http://localhost:8080
    depends_on:
      - mongodb

volumes:
  mongo-data:
```

- [ ] **Step 2: Create JVM Dockerfile**

`backend/src/main/docker/Dockerfile.jvm`:
```dockerfile
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY target/quarkus-app/lib/ /app/lib/
COPY target/quarkus-app/*.jar /app/
COPY target/quarkus-app/app/ /app/app/
COPY target/quarkus-app/quarkus/ /app/quarkus/
# React build is placed here by the frontend build step (see frontend plan)
COPY target/classes/META-INF/resources/ /app/META-INF/resources/
EXPOSE 8080
CMD ["java", "-jar", "/app/quarkus-run.jar"]
```

- [ ] **Step 3: Add React static resource path to application.properties**

In `backend/src/main/resources/application.properties`, the default Quarkus setup already serves `src/main/resources/META-INF/resources/` as static files. The frontend plan will copy the React build there. No extra config needed.

Add the production base URL property:
```properties
# Production override via environment variable
app.base-url=http://localhost:8080
```

- [ ] **Step 4: Test docker-compose builds**

```bash
cd /d/GIT/canvas/backend
./mvnw package -DskipTests
cd /d/GIT/canvas
docker-compose build
docker-compose up -d
sleep 5
curl -s http://localhost:8080/api/sessions \
  -X POST -H "Content-Type: application/json" \
  -d '{"nickname":"Test","displayMode":"OWN_DEVICE","language":"DE"}' | python -m json.tool
docker-compose down
```

Expected: session JSON returned from containerised app.

- [ ] **Step 5: Commit**

```bash
cd /d/GIT/canvas
git add docker-compose.yml backend/src/main/docker/
git commit -m "feat: add Docker Compose and JVM Dockerfile"
```

---

## Task 10: Run All Tests

- [ ] **Step 1: Run the full test suite**

```bash
cd backend
./mvnw test
```

Expected: all tests pass, zero failures.

- [ ] **Step 2: If any test fails, fix it before proceeding**

Common pitfalls:
- `WordServiceTest` fails if MongoDB is not running → start with `docker-compose up -d mongodb`
- `GameEngineTest` mock not wiring → ensure `@InjectMock` annotation is correct for Quarkus CDI

- [ ] **Step 3: Commit if any fixes were made**

```bash
cd /d/GIT/canvas
git add -A
git commit -m "fix: resolve test failures in full suite run"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - Session lifecycle (LOBBY → CATEGORY → DRAWING → COUNTDOWN → GUESSING → RESULT) ✓ Task 6+8
  - Display modes (OWN_DEVICE / SHARED_SCREEN stored in session) ✓ Task 4
  - Five categories with DE+EN word lists ✓ Task 3
  - Drawing tools minimal set (pencil, eraser, 3 sizes, 20 colors — enforced on frontend, backend relays strokes as-is) ✓
  - Scoring: drawer +2, first guesser +1, nobody if timeout ✓ Task 6
  - Hint system: first letter + blanks, reveal at 20s/40s/50s ✓ Tasks 6+8
  - Reconnect with stroke replay ✓ Task 8 (handleJoin)
  - REST: POST /api/sessions → sessionId + joinUrl ✓ Task 7
  - WebSocket protocol: all 16 events ✓ Task 8
  - Docker Compose ✓ Task 9

- [x] **No placeholders found**

- [x] **Type consistency:** `StrokeEvent`, `Player`, `Round`, `Session`, `GamePhase` all defined in Task 2 and used consistently in Tasks 4, 6, 8.
