import Groq from "groq-sdk";

export const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
export const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS ?? 1500);
export const REASONING_EFFORT = (process.env.REASONING_EFFORT ?? "low") as "low" | "medium" | "high";

let client: Groq | null = null;
export const getClient = () => (client ??= new Groq()); // reads GROQ_API_KEY

// Swap this prompt to turn the assistant into whatever the client needs.
export const SYSTEM_PROMPT = [
  "You are Clearly, a friendly assistant that helps with writing and everyday tasks.",
  "Be concise and direct. Use markdown sparingly: short lists and bold for key terms only.",
  "Reply in the same language the user writes in. If you are not sure about something, say so instead of guessing.",
].join("\n");