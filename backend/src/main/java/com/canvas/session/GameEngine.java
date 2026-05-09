package com.canvas.session;

import com.canvas.model.*;
import com.canvas.words.WordService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@ApplicationScoped
public class GameEngine {

    @Inject WordService wordService;

    /**
     * Pick a random drawer, fetch a word, transition to DRAWING phase.
     */
    public String startRound(Session session, String category) {
        List<String> playerIds = new ArrayList<>(session.players.keySet());
        String drawerId = playerIds.get(ThreadLocalRandom.current().nextInt(playerIds.size()));
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

    /**
     * Pick the winning category from votes.
     * Most votes wins; ties broken randomly.
     */
    public String resolveCategory(Map<String, List<String>> votes, List<String> allCategories) {
        if (votes.isEmpty()) {
            return allCategories.get(ThreadLocalRandom.current().nextInt(allCategories.size()));
        }
        int max = votes.values().stream().mapToInt(List::size).max().orElse(0);
        List<String> winners = votes.entrySet().stream()
            .filter(e -> e.getValue().size() == max)
            .map(Map.Entry::getKey)
            .collect(java.util.stream.Collectors.toList());
        return winners.get(ThreadLocalRandom.current().nextInt(winners.size()));
    }
}
