package com.canvas.words;

import io.quarkus.mongodb.panache.PanacheMongoRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;

@ApplicationScoped
public class WordRepository implements PanacheMongoRepository<WordDocument> {

    public Optional<WordDocument> findByCategoryAndLanguage(String category, String language) {
        return find("category = ?1 and language = ?2", category, language).firstResultOptional();
    }
}
