import express, { type Request, type Response } from "express";
import cors from "cors";
import { createServer } from "http";
import apiRoutes from "./routes";
import { WebRTCSignalingServer } from "./core/p2p-webrtc-signaling";
import { initRealtimeServer } from "./realtime";

const app = express();

// Enable CORS with configured origins
const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
  'https://presidium-frontend.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json());

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ 
    status: "ok", 
    service: "Presidium Backend",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use("/api", apiRoutes);

// Root endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({ 
    service: "Presidium Backend API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      api: "/api",
      dashboard: "/api/dashboard",
      metrics: "/api/metrics",
      p2p: "/api/p2p/network",
      crdt: "/api/crdt",
      economy: "/api/economy/wallet",
      reputation: "/api/reputation",
      vault: "/api/vault/keys",
      chats: "/api/chats",
      legacy: {
        history: "/api/history",
        chat: "/api/chat"
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false,
    error: err.message || "Internal server error",
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    success: false,
    error: "Endpoint not found",
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Listen on port 3000 (HTTP + WebSocket signaling)
const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);

// WebRTC signaling server (used by frontend P2P WebRTC)
const signalingServer = new WebRTCSignalingServer(Number(process.env.WS_PORT || PORT));
signalingServer.initialize(httpServer);
initRealtimeServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`🚀 Presidium Backend API`);
  console.log(`========================================`);
  console.log(`📍 Listening on http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log(`💚 Health: http://localhost:${PORT}/health`);
  console.log(`🧭 P2P Signaling: ws://localhost:${PORT}/p2p-signaling`);
  console.log(`========================================`);
});
