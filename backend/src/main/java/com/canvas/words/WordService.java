package com.canvas.words;

import com.canvas.model.Language;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.io.InputStream;
import java.util.List;
import java.util.Random;

@ApplicationScoped
public class WordService {

    @Inject WordRepository wordRepository;

    private final Random random = new Random();
    private final ObjectMapper mapper = new ObjectMapper();

    void onStart(@Observes StartupEvent ev) {
        seedIfEmpty();
    }

    public void seedIfEmpty() {
        if (wordRepository.count() > 0) return;
        for (String lang : List.of("de", "en")) {
            try (InputStream is = getClass().getResourceAsStream("/words/" + lang + ".json")) {
                List<WordDocument> docs = mapper.readValue(is, new TypeReference<>() {});
                docs.forEach(wordRepository::persist);
            } catch (Exception e) {
                throw new RuntimeException("Failed to seed word lists for language: " + lang, e);
            }
        }
    }

    public String getRandomWord(String category, Language language) {
        return wordRepository
            .findByCategoryAndLanguage(category, language.name().toLowerCase())
            .map(doc -> {
                if (doc.words == null || doc.words.isEmpty()) return null;
                return doc.words.get(random.nextInt(doc.words.size()));
            })
            .orElse(null);
    }
}
