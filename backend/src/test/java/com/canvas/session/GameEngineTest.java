package com.canvas.session;

import com.canvas.model.*;
import com.canvas.words.WordService;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import java.util.List;
import java.util.Map;
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
    void endDrawingPhase_setsGuessingPhase() {
        gameEngine.startRound(session, "tiere");
        gameEngine.endDrawingPhase(session);
        assertEquals(GamePhase.GUESSING, session.phase);
    }

    @Test
    void processGuess_correct_awardsPoints() {
        gameEngine.startRound(session, "tiere");
        gameEngine.endDrawingPhase(session);

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

        String[] hint2 = gameEngine.buildHint("Schmetterling", 2); // reveal up to 3rd letter (cumulative)
        assertEquals("S", hint2[0]);
        assertEquals("c", hint2[1]); // 2nd letter still visible
        assertEquals("h", hint2[2]); // 3rd letter now revealed
    }

    @Test
    void resolveCategory_emptyVotes_returnsFromAllCategories() {
        List<String> all = List.of("tiere", "pflanzen", "natur");
        String result = gameEngine.resolveCategory(new java.util.HashMap<>(), all);
        assertTrue(all.contains(result));
    }

    @Test
    void resolveCategory_singleWinner_returnsThatCategory() {
        Map<String, List<String>> votes = new java.util.HashMap<>();
        votes.put("tiere", List.of("p1", "p2"));
        votes.put("pflanzen", List.of("p3"));
        String result = gameEngine.resolveCategory(votes, List.of("tiere", "pflanzen"));
        assertEquals("tiere", result);
    }
}
