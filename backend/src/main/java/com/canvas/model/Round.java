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
