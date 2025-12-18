import type { AiAnalysis } from "./types";

// Very naive AI stub. In a real project you would plug in OpenAI, Claude, etc.
export function analyzeText(text: string): AiAnalysis {
  const lowered = text.toLowerCase();

  let sentiment: AiAnalysis["sentiment"] = "neutral";
  if (lowered.includes("thank") || lowered.includes("спасибо")) {
    sentiment = "positive";
  } else if (lowered.includes("hate") || lowered.includes("ненавижу") || lowered.includes("refund")) {
    sentiment = "negative";
  }

  const entities: string[] = [];
  const emailMatch = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g);
  if (emailMatch) {
    entities.push(...emailMatch);
  }

  const intent =
    lowered.includes("help") || lowered.includes("support")
      ? "support"
      : lowered.includes("buy") || lowered.includes("order")
        ? "purchase"
        : null;

  return {
    sentiment,
    intent,
    entities
  };
}


