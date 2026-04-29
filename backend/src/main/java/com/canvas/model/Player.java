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
