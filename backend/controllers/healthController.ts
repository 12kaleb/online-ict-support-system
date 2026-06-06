import type { Request, Response } from "express";
import { getHealthStatus } from "../services/healthService.js";

export async function healthCheck(_req: Request, res: Response) {
  try {
    res.json(await getHealthStatus());
  } catch {
    res.status(500).json({ status: "error", database: "disconnected", message: "Database connection failed" });
  }
}
