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
