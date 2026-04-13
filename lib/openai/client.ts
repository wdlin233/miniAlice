import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  const apiKey =
    process.env.AIHUBMIX_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing API key. Set AIHUBMIX_API_KEY or OPENAI_API_KEY.");
  }

  const baseURL =
    process.env.OPENAI_BASE_URL?.trim() ||
    process.env.AIHUBMIX_BASE_URL?.trim() ||
    undefined;

  if (!client) {
    client = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {})
    });
  }

  return client;
}