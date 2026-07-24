import Groq from "groq-sdk";
import readline from "readline";
import chalk from "chalk";
import "dotenv/config";
import { searchRepository } from "../knowledge/searchEngine.js";

const GROQ_MODEL = "llama-3.1-8b-instant";

/**
 * Initialize Groq API client from environment variables.
 *
 * @returns {Groq}
 */
function createGroqClient() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
        throw new Error(
            "GROQ_API_KEY is not set in environment or .env file.\n" +
            "  1. Get a free key at https://console.groq.com/keys\n" +
            "  2. Add it to your .env file: GROQ_API_KEY=gsk_your_key_here"
        );
    }
    return new Groq({ apiKey });
}

/**
 * Build a RAG context prompt from retrieved code chunks.
 *
 * @param {string} query
 * @param {Array<{ score: number, chunk: Object }>} searchResults
 * @returns {string}
 */
export function buildRAGPrompt(query, searchResults) {
    const lines = [
        `You are AutoDocs AI, the lead repository intelligence assistant.`,
        `Your task is to answer user questions about this codebase accurately, using the retrieved code context below.`,
        `Rules:`,
        `1. Rely primarily on the provided Code Context chunks.`,
        `2. Always reference file paths and line ranges (e.g. \`src/core/DependencyGraph.js:L4-L54\`) when explaining code.`,
        `3. Provide clear, concise, professional code explanations and refactoring suggestions when asked.`,
        ``,
        `--- RETRIEVED CODE CONTEXT ---`
    ];

    if (!searchResults || searchResults.length === 0) {
        lines.push(`(No specific code chunks were retrieved for this query.)`);
    } else {
        searchResults.forEach((res, index) => {
            const chunk = res.chunk;
            const locStr = chunk.loc ? ` (Lines L${chunk.loc.start.line}-L${chunk.loc.end.line})` : "";
            lines.push(`[Chunk ${index + 1}] ${chunk.type.toUpperCase()}: ${chunk.filePath}${locStr}`);
            lines.push(`Content:\n${chunk.content}`);
            lines.push(`---`);
        });
    }

    lines.push(`--- END RETRIEVED CONTEXT ---`);
    lines.push(`\nUser Question: ${query}`);

    return lines.join("\n");
}

/**
 * Perform a single-shot RAG Q&A query against the repository knowledge store.
 *
 * @param {string} query
 * @param {string} outputDir
 * @returns {Promise<string>}
 */
export async function askRepository(query, outputDir = "output") {
    const groq = createGroqClient();

    console.log(chalk.blue(`🔍 Retrieving repository context for query: "${query}"...`));
    const searchResults = await searchRepository(query, outputDir, 5);

    if (searchResults.length > 0) {
        console.log(chalk.dim(`  Found ${searchResults.length} relevant code chunks in knowledge store.\n`));
    } else {
        console.log(chalk.yellow(`  No direct vector matches found. Proceeding with general model knowledge...\n`));
    }

    const prompt = buildRAGPrompt(query, searchResults);

    console.log(chalk.cyan("🤖 AutoDocs AI is thinking...\n"));

    const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0.2,
    });

    const answer = completion.choices[0]?.message?.content?.trim() || "No response generated.";
    
    console.log(chalk.green("--- Repository Assistant Response ---"));
    console.log(answer);
    console.log(chalk.green("------------------------------------\n"));

    return answer;
}

/**
 * Start an interactive terminal REPL chat session.
 *
 * @param {string} outputDir
 * @returns {Promise<void>}
 */
export async function startInteractiveChat(outputDir = "output") {
    const groq = createGroqClient();

    console.log(chalk.bold.cyan("\n======================================================="));
    console.log(chalk.bold.cyan(" 🤖 Welcome to AutoDocs Repository Intelligence Chat"));
    console.log(chalk.dim(" Type your questions about architecture, functions, files, or flow."));
    console.log(chalk.dim(" Type 'exit', 'quit', or 'q' to end the session."));
    console.log(chalk.bold.cyan("=======================================================\n"));

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.bold.green("AutoDocs > ")
    });

    const conversationHistory = [
        {
            role: "system",
            content: "You are AutoDocs AI, an expert software architect and assistant for this repository. Answer accurately using retrieved code context and reference file locations."
        }
    ];

    rl.prompt();

    rl.on("line", async (line) => {
        const input = line.trim();

        if (!input) {
            rl.prompt();
            return;
        }

        if (["exit", "quit", "q"].includes(input.toLowerCase())) {
            console.log(chalk.yellow("\nEnding chat session. Goodbye!\n"));
            rl.close();
            return;
        }

        try {
            console.log(chalk.dim(`\n  Searching knowledge store...`));
            const searchResults = await searchRepository(input, outputDir, 4);

            const ragPrompt = buildRAGPrompt(input, searchResults);

            conversationHistory.push({ role: "user", content: ragPrompt });

            process.stdout.write(chalk.cyan("  Thinking..."));
            const completion = await groq.chat.completions.create({
                model: GROQ_MODEL,
                messages: conversationHistory,
                max_tokens: 1024,
                temperature: 0.3,
            });

            const reply = completion.choices[0]?.message?.content?.trim() || "No response generated.";
            
            // Keep history manageable (system prompt + last 6 messages)
            conversationHistory.push({ role: "assistant", content: reply });
            if (conversationHistory.length > 7) {
                conversationHistory.splice(1, conversationHistory.length - 7);
            }

            process.stdout.write("\r" + " ".repeat(20) + "\r"); // Clear 'Thinking...'
            console.log(chalk.green("\n🤖 Assistant:"));
            console.log(reply + "\n");
        } catch (err) {
            console.error(chalk.red(`\n  Error: ${err.message}\n`));
        }

        rl.prompt();
    });
}
