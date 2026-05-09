package com.canvas.rest;

import com.canvas.model.DisplayMode;
import com.canvas.model.Language;
import com.canvas.model.Session;
import com.canvas.session.SessionManager;
import jakarta.inject.Inject;
import java.util.List;
import java.util.stream.Collectors;
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

    public record SessionSummary(String id, String hostNickname, int playerCount, String phase, String joinUrl) {}

    @GET
    public Response listSessions() {
        List<SessionSummary> result = sessionManager.listSessions().stream()
            .map(s -> {
                String hostNickname = s.players.values().stream()
                    .filter(p -> p.isHost).findFirst()
                    .map(p -> p.nickname).orElse("?");
                String joinUrl = baseUrl + "/join/" + s.id;
                return new SessionSummary(s.id, hostNickname, s.players.size(), s.phase.name(), joinUrl);
            })
            .collect(Collectors.toList());
        return Response.ok(result).build();
    }
}
