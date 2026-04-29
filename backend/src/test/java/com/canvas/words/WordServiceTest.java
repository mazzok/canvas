package com.canvas.words;

import com.canvas.model.Language;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
class WordServiceTest {

    @Inject
    WordService wordService;

    @Test
    void getRandomWord_returnsWordFromCategory() {
        String word = wordService.getRandomWord("tiere", Language.DE);
        assertNotNull(word);
        assertFalse(word.isBlank());
    }

    @Test
    void getRandomWord_unknownCategory_returnsNull() {
        String word = wordService.getRandomWord("unknown", Language.DE);
        assertNull(word);
    }
}
