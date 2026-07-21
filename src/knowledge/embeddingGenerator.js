/**
 * Dimension size of the embedding vectors.
 * 128 provides a strong balance of expressiveness, low memory footprint, and fast similarity search.
 */
export const VECTOR_DIMENSION = 128;

/**
 * Hash a string token to a deterministic bucket index [0, dimension - 1].
 * Uses a simple non-cryptographic FNV-1a 32-bit hash.
 *
 * @param {string} str
 * @param {number} maxDim
 * @returns {number}
 */
function hashString(str, maxDim = VECTOR_DIMENSION) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0;
    }
    return hash % maxDim;
}

/**
 * Tokenize source code / text into subwords, identifiers, and n-grams.
 * Splits camelCase, snake_case, and non-alphanumeric characters.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
    if (!text) return [];

    // Split camelCase: "buildDependencyGraph" -> ["build", "Dependency", "Graph"]
    const splitCamel = text.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
    
    // Extract raw word tokens
    const rawTokens = splitCamel.toLowerCase().split(/[^a-z0-9_$]+/);
    const tokens = [];

    rawTokens.forEach(token => {
        if (token.length < 2) return;
        tokens.push(token);

        // Add 3-gram subwords for fuzzy/partial matching
        if (token.length > 3) {
            for (let i = 0; i <= token.length - 3; i++) {
                tokens.push(token.slice(i, i + 3));
            }
        }
    });

    return tokens;
}

/**
 * Generate a normalized dense vector embedding for a given text or code snippet.
 * Output vector is L2-normalized so that dot product equals Cosine Similarity.
 *
 * @param {string} text
 * @param {number} dimension
 * @returns {number[]} - L2-normalized vector of size `dimension`
 */
export function generateEmbedding(text, dimension = VECTOR_DIMENSION) {
    const vector = new Array(dimension).fill(0);
    const tokens = tokenize(text);

    if (tokens.length === 0) {
        return vector;
    }

    // Accumulate term frequencies into hashed vector dimensions
    tokens.forEach(token => {
        const idx = hashString(token, dimension);
        vector[idx] += 1;
    });

    // Compute L2 norm (Euclidean length)
    let sumSq = 0;
    for (let i = 0; i < dimension; i++) {
        sumSq += vector[i] * vector[i];
    }

    const norm = Math.sqrt(sumSq);

    // Normalize to unit length
    if (norm > 0) {
        for (let i = 0; i < dimension; i++) {
            // Round to 5 decimal places for compact JSON serialization
            vector[i] = Math.round((vector[i] / norm) * 100000) / 100000;
        }
    }

    return vector;
}

/**
 * Calculate Cosine Similarity between two L2-normalized vectors.
 * Since vectors are normalized to unit length (||v|| = 1), dot product = cosine similarity.
 *
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} - Similarity score between 0.0 and 1.0
 */
export function calculateCosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dot = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
    }
    return Math.max(0, Math.min(1, dot));
}
