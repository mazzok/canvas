package com.canvas.words;

import io.quarkus.mongodb.panache.PanacheMongoEntity;
import io.quarkus.mongodb.panache.common.MongoEntity;
import java.util.List;

@MongoEntity(collection = "word_lists")
public class WordDocument extends PanacheMongoEntity {
    public String category;
    public String language;
    public List<String> words;
}
