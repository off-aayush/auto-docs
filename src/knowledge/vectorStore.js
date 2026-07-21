import fs from "fs-extra";
import path from "path";
import { calculateCosineSimilarity } from "./embeddingGenerator.js";

/**
 * Vector Store for storing and querying code chunk embeddings.
 */
export class VectorStore {
    constructor() {
        /** @type {Array<{ id: string, vector: number[], chunk: Object }>} */
        this.entries = [];
    }

    /**
     * Add a chunk and its vector representation to the store.
     *
     * @param {Object} chunk
     * @param {number[]} vector
     */
    add(chunk, vector) {
        this.entries.push({
            id: chunk.id,
            vector,
            chunk
        });
    }

    /**
     * Search the vector store for top matching chunks using Cosine Similarity.
     *
     * @param {number[]} queryVector
     * @param {number} topK - Number of top results to return
     * @param {number} minScore - Minimum similarity threshold
     * @returns {Array<{ score: number, chunk: Object }>}
     */
    search(queryVector, topK = 5, minScore = 0.01) {
        const results = [];

        for (const entry of this.entries) {
            const score = calculateCosineSimilarity(queryVector, entry.vector);
            if (score >= minScore) {
                results.push({
                    score: Math.round(score * 10000) / 10000,
                    chunk: entry.chunk
                });
            }
        }

        // Sort descending by similarity score
        results.sort((a, b) => b.score - a.score);

        return results.slice(0, topK);
    }

    /**
     * Serialize and save vector store to outputDir/vector_store.json.
     *
     * @param {string} outputDir
     * @returns {Promise<void>}
     */
    async save(outputDir) {
        const storePath = path.join(outputDir, "vector_store.json");
        await fs.ensureDir(outputDir);
        await fs.writeJson(storePath, {
            totalEntries: this.entries.length,
            entries: this.entries
        }, { spaces: 2 });
    }

    /**
     * Load vector store from outputDir/vector_store.json.
     *
     * @param {string} outputDir
     * @returns {Promise<boolean>} - True if loaded successfully, false if file does not exist
     */
    async load(outputDir) {
        const storePath = path.join(outputDir, "vector_store.json");
        if (!(await fs.pathExists(storePath))) {
            return false;
        }

        const data = await fs.readJson(storePath);
        this.entries = data.entries || [];
        return true;
    }
}
