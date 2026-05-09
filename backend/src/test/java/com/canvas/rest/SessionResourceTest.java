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

    @Test
    void listSessions_returnsJsonArray() {
        RestAssured.given()
            .when().get("/api/sessions")
            .then()
            .statusCode(200)
            .contentType(ContentType.JSON)
            .body("$", hasSize(greaterThanOrEqualTo(0)));
    }
}
