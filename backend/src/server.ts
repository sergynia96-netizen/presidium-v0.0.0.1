import express, { type Request, type Response } from "express";
import cors from "cors";
import { StorageService, type ChatMessage } from "./services/storage.service";

const app = express();

// Enable CORS with origin: '*'
app.use(cors({ origin: '*' }));
app.use(express.json());

// GET endpoint to retrieve chat history
app.get("/api/history", async (_req: Request, res: Response) => {
  try {
    const history = await StorageService.getHistory();
    res.json(history);
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// POST endpoint /api/chat
app.post("/api/chat", async (req: Request, res: Response) => {
  const { message } = req.body as { message?: string };

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    // Create user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      text: message,
      sender: "user",
      timestamp: new Date().toISOString()
    };

    // Save user message to storage
    await StorageService.saveMessage(userMessage);

    // Create AI response
    const aiResponse: ChatMessage = {
      id: crypto.randomUUID(),
      text: `Presidium Core (Mobile) received: ${message}`,
      sender: "server",
      timestamp: new Date().toISOString()
    };

    // Save AI response to storage
    await StorageService.saveMessage(aiResponse);

    // Return response to client
    res.json({
      reply: aiResponse.text,
      timestamp: aiResponse.timestamp
    });
  } catch (error) {
    console.error("Error processing chat message:", error);
    res.status(500).json({ error: "Failed to process message" });
  }
});

// Listen on port 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Presidium backend listening on http://localhost:${PORT}`);
});
