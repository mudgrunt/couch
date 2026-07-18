import { Router } from "express";
import {
  importSteamGames,
  enrichSteamGame,
  importSteamLibrary,
} from "../controllers/steam.controller";
import { importGogGames, enrichGogGame } from "../controllers/gog.controller";
import { importEpicGames } from "../controllers/epic.controller";
import { importRoms } from "../controllers/rom.controller";
import {
  enrichIgdbGame,
  enrichIgdbGameById,
  searchIgdb,
} from "../controllers/igdb.controller";
import {
  getGames,
  getGamesListView,
  getGameById,
  launchGameById,
  searchGames,
  syncSearch,
  getPlatforms,
} from "../controllers/game.controller";
import {
  getRtpCapabilities,
  createStreamSession,
  createViewerTransport,
  connectViewerTransport,
  consumeViewer,
  resumeViewer,
  deleteStreamSession,
  getWindows,
} from "../controllers/stream.controller.js";
import {
  getSettings,
  updateSettings,
} from "../controllers/settings.controller.js";

const router = Router();

router.get("/games", getGames);
router.get("/games/list", getGamesListView);
router.get("/games/search", searchGames);
router.get("/platforms", getPlatforms);
router.post("/search/sync", syncSearch);
router.post("/games/:id/launch", launchGameById);
router.post("/games/:id/enrich/steam", enrichSteamGame);
router.post("/games/:id/enrich/gog", enrichGogGame);
router.post("/games/:id/enrich/igdb", enrichIgdbGame);
router.post("/games/:id/enrich/igdb/:igdbId", enrichIgdbGameById);
router.get("/igdb/search", searchIgdb);
router.get("/games/:id", getGameById);
router.post("/steam/import", importSteamGames);
router.post("/steam/import-library", importSteamLibrary);
router.post("/gog/import", importGogGames);
router.post("/epic/import", importEpicGames);
router.post("/roms/import", importRoms);

// Settings
router.get("/settings", getSettings);
router.patch("/settings", updateSettings);

// WebRTC streaming (mediasoup)
router.get("/stream/rtp-capabilities", getRtpCapabilities);
router.get("/stream/windows", getWindows);
router.post("/stream/session", createStreamSession);
router.post("/stream/session/:id/viewer", createViewerTransport);
router.post("/stream/session/:id/viewer/:vid/connect", connectViewerTransport);
router.post("/stream/session/:id/viewer/:vid/consume", consumeViewer);
router.post("/stream/session/:id/viewer/:vid/resume", resumeViewer);
router.delete("/stream/session/:id", deleteStreamSession);

export default router;
