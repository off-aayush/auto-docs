import { GoogleGenerativeAI } from "@google/generative-ai";
import chalk from "chalk";

// ─────────────────────────────────────────────────────────────
//  Initialise the Gemini client once per run
// ─────────────────────────────────────────────────────────────
function createClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
        throw new Error(
            "GEMINI_API_KEY is not set.\n" +
            "  1. Get a free key at https://aistudio.google.com/apikey\n" +
            "     → Click 'Create API key in new project' to ensure free-tier quota.\n" +
            "  2. Paste it into your .env file:\n" +
            "     GEMINI_API_KEY=your_key_here"
        );
    }
    return new GoogleGenerativeAI(apiKey);
}

// ─────────────────────────────────────────────────────────────
//  Build a compact, token-efficient prompt for a single file
// ─────────────────────────────────────────────────────────────
function buildPrompt(fileModel) {
    const lines = [
        `You are a senior technical documentation writer.`,
        `Given the metadata below extracted from a JavaScript file, write a concise (3–5 sentence) plain-English description of:`,
        `  - What this file does and its purpose in the project`,
        `  - What its key exports/functions/classes are for`,
        `  - Any notable architectural patterns (e.g. React components, Express routes)`,
        ``,
        `Do NOT restate the raw data as a list. Write flowing, readable prose.`,
        ``,
        `--- FILE METADATA ---`,
        `File: ${fileModel.path}`,
    ];

    if (fileModel.exports?.length > 0) {
        lines.push(`Exports: ${fileModel.exports.map(e => `${e.name || e.source} (${e.type})`).join(", ")}`);
    }

    if (fileModel.functions?.length > 0) {
        const fnSummaries = fileModel.functions.map(f =>
            `${f.name}(${f.params?.join(", ") || ""})${f.async ? " [async]" : ""}`
        );
        lines.push(`Functions: ${fnSummaries.join(", ")}`);
    }

    if (fileModel.classes?.length > 0) {
        const clsSummaries = fileModel.classes.map(c =>
            `${c.name}${c.superClass ? ` extends ${c.superClass}` : ""} [methods: ${c.methods?.map(m => m.name).join(", ") || "none"}]`
        );
        lines.push(`Classes: ${clsSummaries.join("; ")}`);
    }

    if (fileModel.routes?.length > 0) {
        const routeSummaries = fileModel.routes.map(r => `${r.method.toUpperCase()} ${r.path}`);
        lines.push(`Routes: ${routeSummaries.join(", ")}`);
    }

    if (fileModel.components?.length > 0) {
        const compSummaries = fileModel.components.map(c =>
            `${c.name} [props: ${c.props?.join(", ") || "none"}, hooks: ${c.hooks?.join(", ") || "none"}]`
        );
        lines.push(`React Components: ${compSummaries.join("; ")}`);
    }

    if (fileModel.imports?.length > 0) {
        const externalDeps = fileModel.imports.filter(i => i.type === "external").map(i => i.source);
        const internalDeps = fileModel.imports.filter(i => i.type === "internal").map(i => i.source);
        if (externalDeps.length > 0) lines.push(`External deps: ${externalDeps.join(", ")}`);
        if (internalDeps.length > 0) lines.push(`Internal deps: ${internalDeps.join(", ")}`);
    }

    lines.push(`--- END METADATA ---`);
    return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────
//  Check if a file has any meaningful content worth summarising
// ─────────────────────────────────────────────────────────────
function hasContent(fileModel) {
    return (
        (fileModel.exports?.length > 0) ||
        (fileModel.functions?.length > 0) ||
        (fileModel.classes?.length > 0) ||
        (fileModel.routes?.length > 0) ||
        (fileModel.components?.length > 0)
    );
}

// ─────────────────────────────────────────────────────────────
//  Parse the retryDelay seconds out of a 429 error message
// ─────────────────────────────────────────────────────────────
function parseRetryDelay(errMessage) {
    // The API embeds: "retryDelay":"Xs" in the JSON body
    const match = errMessage.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
    if (match) return Math.ceil(parseFloat(match[1])) * 1000;
    return null;
}

// ─────────────────────────────────────────────────────────────
//  Detect a hard "limit: 0" quota error (not a temporary spike)
// ─────────────────────────────────────────────────────────────
function isHardQuotaError(errMessage) {
    return errMessage.includes("limit: 0");
}

// ─────────────────────────────────────────────────────────────
//  Delay helper
// ─────────────────────────────────────────────────────────────
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────
//  Call the model with smart retry + backoff (up to maxRetries)
// ─────────────────────────────────────────────────────────────
async function generateWithRetry(model, prompt, maxRetries = 3) {
    let attempt = 0;
    while (attempt <= maxRetries) {
        try {
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        } catch (err) {
            const is429 = err.message?.includes("429");
            const isHard = isHardQuotaError(err.message ?? "");

            // Hard quota (limit: 0) — no point retrying, surface clearly
            if (isHard) {
                throw new Error(
                    "Your API key's project has a free-tier quota of 0 for this model.\n" +
                    "  → At https://aistudio.google.com/apikey, click\n" +
                    "    'Create API key in new project' to get a fresh key with free-tier quota.\n" +
                    "  → Or enable billing on your Google Cloud project."
                );
            }

            // Temporary 429 — wait the server-advised delay then retry
            if (is429 && attempt < maxRetries) {
                const retryMs = parseRetryDelay(err.message ?? "") ?? (5000 * (attempt + 1));
                process.stdout.write(chalk.yellow(` (rate-limited, waiting ${Math.round(retryMs / 1000)}s…)`));
                await sleep(retryMs);
                attempt++;
                continue;
            }

            throw err; // non-retryable error
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  Main export: generate AI summaries and attach to fileModels
// ─────────────────────────────────────────────────────────────
export async function generateAISummaries(projectModel) {
    const genAI = createClient();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const filesToProcess = projectModel.files.filter(hasContent);
    const total = filesToProcess.length;

    if (total === 0) {
        console.log(chalk.yellow("  No files with extractable content found — skipping AI summaries."));
        return;
    }

    console.log(chalk.blue(`  Generating AI summaries for ${total} file(s) via gemini-2.0-flash...`));

    let hardQuotaDetected = false;

    for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        process.stdout.write(chalk.dim(`  [${i + 1}/${total}] ${file.path}...`));

        // Stop firing requests once we know quota is 0 — avoids spamming error output
        if (hardQuotaDetected) {
            process.stdout.write(chalk.yellow(" skipped (quota issue)\n"));
            file.aiSummary = null;
            continue;
        }

        try {
            const prompt = buildPrompt(file);
            const summary = await generateWithRetry(model, prompt);
            file.aiSummary = summary;
            process.stdout.write(chalk.green(" ✓\n"));
        } catch (err) {
            if (isHardQuotaError(err.message ?? "") || err.message?.includes("free-tier quota of 0")) {
                hardQuotaDetected = true;
                process.stdout.write(chalk.red(" ✗\n"));
                console.log(chalk.red(`\n  ⚠ Hard quota limit detected. Stopping AI generation.\n`));
                console.log(chalk.yellow(`  ${err.message}\n`));
            } else {
                process.stdout.write(chalk.red(` ✗ (${err.message.split("\n")[0]})\n`));
            }
            file.aiSummary = null;
        }

        // 4-second inter-request gap to stay within free-tier RPM limits
        if (!hardQuotaDetected && i < filesToProcess.length - 1) {
            await sleep(4000);
        }
    }
}
