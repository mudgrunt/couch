import type { Request, Response } from "express";
import { SettingsService } from "../services/settings.service.js";

const settingsService = new SettingsService();

export function getSettings(_req: Request, res: Response) {
  res.json(settingsService.read());
}

export function updateSettings(req: Request, res: Response) {
  const next = settingsService.write(req.body);
  res.json(next);
}
