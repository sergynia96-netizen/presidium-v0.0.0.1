import express, { type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT ?? 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";
const corsOrigins = CORS_ORIGIN.split(",").map((origin) => origin.trim());

// Enable CORS
app.use(cors({ origin: corsOrigins }));
app.use(express.json());

// POST endpoint /api/chat
const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL;
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL ?? "local-model";
const LOCAL_LLM_API_KEY = process.env.LOCAL_LLM_API_KEY;

const buildLocalLlmEndpoint = (baseUrl: string) => {
  if (baseUrl.includes("/v1/chat/completions")) {
    return baseUrl;
  }

  return `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
};

const fetchLocalLlmReply = async (message: string, systemPrompt?: string) => {
  if (!LOCAL_LLM_URL) {
    return null;
  }

  const endpoint = buildLocalLlmEndpoint(LOCAL_LLM_URL);
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (LOCAL_LLM_API_KEY) {
    headers.Authorization = `Bearer ${LOCAL_LLM_API_KEY}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: LOCAL_LLM_MODEL,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: message }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Local LLM error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content ?? null;
};

app.post("/api/chat", async (req: Request, res: Response) => {
  const { message, systemPrompt } = req.body as {
    message?: string;
    systemPrompt?: string;
  };

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const llmReply = await fetchLocalLlmReply(message, systemPrompt);

    if (llmReply) {
      return res.json({
        reply: llmReply,
        source: "local-llm",
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Local LLM request failed:", error);
  }

  return res.json({
    reply: `Presidium Core (Local Stub) received: ${message}`,
    source: "stub",
    timestamp: new Date().toISOString()
  });
});

// Listen on port
app.listen(PORT, () => {
  console.log(`Presidium backend listening on http://localhost:${PORT}`);
});
