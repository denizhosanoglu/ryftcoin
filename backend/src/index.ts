import express, { Request, Response } from "express";
import cors from "cors";

const app = express();
const PORT: number = parseInt(process.env.PORT || "8080");

app.use(cors());
app.use(express.json());

// In-memory storage (SQL yok)
interface User {
  username: string;
  coins: number;
  createdAt: string;
}

const users: Map<string, User> = new Map();

// Test endpoint
app.get("/api/ping", (_req: Request, res: Response): void => {
  res.json({
    message: "Backend çalışıyor! 🚀",
    timestamp: new Date().toISOString()
  });
});

// Kullanıcı oluştur
app.post("/api/user", (req: Request, res: Response): void => {
  const { username } = req.body as { username: string };
  if (!username) {
    res.status(400).json({ error: "username gerekli" });
    return;
  }
  const user: User = {
    username,
    coins: 0,
    createdAt: new Date().toISOString()
  };
  users.set(username, user);
  res.json({ ok: true, user });
});

// Kullanıcı getir
app.get("/api/user/:username", (req: Request, res: Response): void => {
  const user = users.get(req.params.username);
  if (!user) {
    res.status(404).json({ error: "Kullanıcı bulunamadı" });
    return;
  }
  res.json(user);
});

app.listen(PORT, (): void => {
  console.log(`✅ RyftCoin backend çalışıyor: http://localhost:${PORT}`);
});
