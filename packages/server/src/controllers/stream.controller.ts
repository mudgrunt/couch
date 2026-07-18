import type { Request, Response, NextFunction } from "express";
import {
  createSession,
  getSession,
  closeSession,
  getRouterRtpCapabilities,
  getAnnouncedIp,
} from "../services/stream.service.js";
// TODO: restore when native addon is built
const listWindows: () => { hwnd: number; title: string }[] = () => [];
import { logger } from "../utils/logger.js";

/** GET /stream/rtp-capabilities — client loads these into a mediasoup Device */
export function getRtpCapabilities(_req: Request, res: Response) {
  res.json({ rtpCapabilities: getRouterRtpCapabilities() });
}

/** GET /stream/windows — returns all visible top-level windows (hwnd + title) */
export function getWindows(_req: Request, res: Response) {
  res.json(listWindows());
}

/**
 * POST /stream/session
 * Creates a session, starts WGC capture, and begins encoding.
 * Body: { hwnd: number }
 * Returns: { sessionId: string }
 */
export async function createStreamSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { hwnd } = req.body as { hwnd?: number };
  if (!hwnd || typeof hwnd !== "number") {
    res.status(400).json({ error: "hwnd (number) required" });
    return;
  }

  try {
    const id = createSession();
    await getSession(id)!.init(hwnd);
    res.json({ sessionId: id });
  } catch (err) {
    logger.error({ err }, "createStreamSession failed");
    next(err);
  }
}

/**
 * POST /stream/session/:id/viewer
 * Creates a WebRTC receive transport for a new viewer.
 * Returns the transport parameters needed by mediasoup-client.
 */
export async function createViewerTransport(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const session = getSession(String(req.params["id"]));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // Determine the IP mediasoup should advertise in ICE candidates.
  // Browsers (especially Firefox) block loopback (127.x) ICE candidates,
  // so when the socket address is loopback (which happens when Vite proxies
  // the request) we fall back to the real LAN IP instead.
  function normaliseIp(raw: string): string {
    if (raw.startsWith("::ffff:")) return raw.slice(7);
    if (raw === "::1") return "127.0.0.1";
    return raw;
  }
  function isLoopback(ip: string): boolean {
    return ip === "127.0.0.1" || ip === "::1" || ip.startsWith("127.");
  }
  function getRequestHost(): string | null {
    const source =
      req.headers.origin ?? req.headers.referer ?? req.headers.host;
    if (!source) return null;

    try {
      if (source.startsWith("http://") || source.startsWith("https://")) {
        return new URL(source).hostname;
      }

      return source.split(":")[0] ?? null;
    } catch {
      return null;
    }
  }

  function isLocalHostName(host: string | null): boolean {
    if (!host) return false;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  const socketIp = req.socket.localAddress
    ? normaliseIp(req.socket.localAddress)
    : null;
  const requestHost = getRequestHost();
  const announcedIp =
    process.env.MEDIASOUP_ANNOUNCED_IP ??
    (isLocalHostName(requestHost) ? "127.0.0.1" : null) ??
    (socketIp && !isLoopback(socketIp) ? socketIp : null) ??
    getAnnouncedIp();

  try {
    logger.info(
      { requestHost, socketIp, announcedIp },
      "selected viewer announced IP",
    );
    const params = await session.createViewerTransport(announcedIp);
    res.json(params);
  } catch (err) {
    logger.error({ err }, "createViewerTransport failed");
    next(err);
  }
}

/**
 * POST /stream/session/:id/viewer/:vid/connect
 * Completes the DTLS handshake for a viewer's transport.
 * Body: { dtlsParameters }
 */
export async function connectViewerTransport(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const session = getSession(String(req.params["id"]));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const { dtlsParameters } = req.body as { dtlsParameters?: object };
  if (!dtlsParameters) {
    res.status(400).json({ error: "dtlsParameters required" });
    return;
  }

  try {
    await session.connectViewerTransport(
      String(req.params["vid"]),
      dtlsParameters,
    );
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "connectViewerTransport failed");
    next(err);
  }
}

/**
 * POST /stream/session/:id/viewer/:vid/consume
 * Creates a server-side Consumer and returns its RTP parameters so the
 * client can call transport.consume(params).
 * Body: { rtpCapabilities }
 */
export async function consumeViewer(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const session = getSession(String(req.params["id"]));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const { rtpCapabilities } = req.body as { rtpCapabilities?: object };
  if (!rtpCapabilities) {
    res.status(400).json({ error: "rtpCapabilities required" });
    return;
  }

  try {
    const params = await session.consumeViewer(
      String(req.params["vid"]),
      rtpCapabilities as any,
    );
    res.json(params);
  } catch (err) {
    logger.error({ err }, "consumeViewer failed");
    next(err);
  }
}

/**
 * POST /stream/session/:id/viewer/:vid/resume
 * Unpauses the server-side Consumer so RTP begins flowing to the viewer.
 */
export async function resumeViewer(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const session = getSession(String(req.params["id"]));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  try {
    await session.resumeViewer(String(req.params["vid"]));
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "resumeViewer failed");
    next(err);
  }
}

/** DELETE /stream/session/:id — tears down capture, FFmpeg, and all viewers */
export function deleteStreamSession(req: Request, res: Response) {
  closeSession(String(req.params["id"]));
  res.status(204).send();
}
