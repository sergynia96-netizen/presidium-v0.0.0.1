import cors from "cors";
import express, { type Request, type Response } from "express";
import { analyzeText } from "./ai";
import { addMessage, getInboxSummary, getMessages } from "./inbox";
import { config } from "./config";
import { logger } from "./services/logger";
import type { Message } from "./types";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "presidium-backend",
    environment: config.nodeEnv
  });
});

app.get("/api/messages", (_req: Request, res: Response) => {
  const messages = getMessages();
  res.json(messages);
});

app.get("/api/inbox/summary", (_req: Request, res: Response) => {
  const summary = getInboxSummary();
  res.json(summary);
});

app.post("/api/messages", (req: Request, res: Response) => {
  const { channel, from, to, subject, body } = req.body as Partial<Message>;

  if (!channel || !from || !to || !body) {
    return res.status(400).json({ error: "channel, from, to and body are required" });
  }

  const message = addMessage({
    channel,
    from,
    to,
    subject,
    body
  } as Message);

  const analysis = analyzeText(body);

  res.status(201).json({
    message,
    analysis
  });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: unknown, _req: Request, res: Response, _next: () => void) => {
    logger.error("Unhandled error in Express app", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

app.listen(config.port, () => {
  logger.info(`Presidium backend listening on http://localhost:${config.port}`);
});


