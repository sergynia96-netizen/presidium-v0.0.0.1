import express, { type Request, type Response } from "express";
import cors from "cors";

const app = express();

// Enable CORS with origin: '*'
app.use(cors({ origin: '*' }));
app.use(express.json());

// POST endpoint /api/chat
app.post("/api/chat", (req: Request, res: Response) => {
  const { message } = req.body as { message?: string };

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  res.json({
    reply: `Presidium Core (Mobile) received: ${message}`,
    timestamp: new Date()
  });
});

// Listen on port 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Presidium backend listening on http://localhost:${PORT}`);
});
