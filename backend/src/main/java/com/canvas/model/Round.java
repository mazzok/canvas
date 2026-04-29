package com.canvas.model;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public class Round {
    public String drawerId;
    public String word;
    public String category;
    // CopyOnWriteArrayList: multiple WebSocket threads append strokes concurrently
    public List<StrokeEvent> strokeHistory = new CopyOnWriteArrayList<>();
    public Instant drawingStartedAt;
    public Instant guessingStartedAt; // set when phase transitions to GUESSING

    public Round() {}

    public Round(String drawerId, String word, String category) {
        this.drawerId = drawerId;
        this.word = word;
        this.category = category;
        this.drawingStartedAt = Instant.now();
    }
}
