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

    @Test
    void listSessions_empty() {
        sessionManager.clearAll();
        assertTrue(sessionManager.listSessions().isEmpty());
    }

    @Test
    void listSessions_returnsAllSessions() {
        sessionManager.clearAll();
        sessionManager.createSession(DisplayMode.OWN_DEVICE, Language.DE, "Alice");
        sessionManager.createSession(DisplayMode.OWN_DEVICE, Language.DE, "Bob");
        assertEquals(2, sessionManager.listSessions().size());
    }
}
