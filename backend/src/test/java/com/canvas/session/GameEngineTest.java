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
