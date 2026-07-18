import dgram from "dgram";
import { EventEmitter } from "events";
import os from "os";
import * as mediasoup from "mediasoup";
import type {
  Worker,
  Router,
  PlainTransport,
  Producer,
  WebRtcTransport,
  Consumer,
  RtpCodecCapability,
  RtpCapabilities,
} from "mediasoup/types";
import { logger } from "../utils/logger.js";

// TODO: restore when native addon is built
const startCapture: (
  hwnd: number,
  cb: (buf: Buffer) => void,
) => void = () => {};
const stopCapture: (hwnd: number) => void = () => {};
const requestKeyframe: (hwnd: number) => void = () => {};

// ── mediasoup globals ─────────────────────────────────────────────────────

const H264_PROFILE_LEVEL_ID = "42e02a";
const VIDEO_RTCP_FEEDBACK: NonNullable<RtpCodecCapability["rtcpFeedback"]> = [
  { type: "nack" },
  { type: "nack", parameter: "pli" },
  { type: "ccm", parameter: "fir" },
  { type: "goog-remb" },
  { type: "transport-cc" },
];

// ── RTP H264 packetization (RFC 6184) ─────────────────────────────────────
//
// The native layer outputs H264 in Annex B format (start-code prefixed NAL
// units from avcodec_receive_packet). We parse those NAL units, then either
// send each one as a Single NAL Unit RTP packet (≤ MTU) or fragment it
// across FU-A packets (> MTU), and fire them via a local UDP socket directly
// into mediasoup's PlainTransport — no FFmpeg subprocess required.

/** Maximum RTP payload size in bytes (1200 byte UDP payload − 12 byte RTP header). */
const RTP_MAX_PAYLOAD = 1188;

/** Parse an Annex B H264 bitstream into individual NAL unit Buffers. */
function parseAnnexB(buf: Buffer): Buffer[] {
  const nals: Buffer[] = [];
  const len = buf.length;
  let i = 0;
  let start = -1;

  while (i < len) {
    if (i + 2 < len && buf[i] === 0 && buf[i + 1] === 0 && buf[i + 2] === 1) {
      if (start >= 0) nals.push(buf.subarray(start, i));
      i += 3;
      start = i;
    } else if (
      i + 3 < len &&
      buf[i] === 0 &&
      buf[i + 1] === 0 &&
      buf[i + 2] === 0 &&
      buf[i + 3] === 1
    ) {
      if (start >= 0) nals.push(buf.subarray(start, i));
      i += 4;
      start = i;
    } else {
      i++;
    }
  }
  if (start >= 0 && start < len) nals.push(buf.subarray(start));
  return nals.filter((n) => n.length > 0);
}

function getNalType(nal: Buffer): number {
  return nal.length > 0 ? nal[0]! & 0x1f : -1;
}

function hasNalType(nals: Buffer[], type: number): boolean {
  return nals.some((nal) => getNalType(nal) === type);
}

function writeRtpHeader(
  out: Buffer,
  marker: boolean,
  seq: number,
  timestamp: number,
  ssrc: number,
): void {
  out[0] = 0x80; // V=2, P=0, X=0, CC=0
  out[1] = (marker ? 0x80 : 0x00) | 96; // M + PT=96
  out.writeUInt16BE(seq & 0xffff, 2);
  out.writeUInt32BE(timestamp >>> 0, 4);
  out.writeUInt32BE(ssrc >>> 0, 8);
}

/**
 * Packetize one NAL unit into RTP packets (RFC 6184).
 * Single NAL unit packet if ≤ RTP_MAX_PAYLOAD, FU-A fragments otherwise.
 * The marker bit is set on the last packet of the last NAL in a frame.
 */
function packetizeNal(
  nal: Buffer,
  marker: boolean,
  seq: { n: number },
  timestamp: number,
  ssrc: number,
  send: (pkt: Buffer) => void,
): void {
  if (nal.length <= RTP_MAX_PAYLOAD) {
    const pkt = Buffer.allocUnsafe(12 + nal.length);
    writeRtpHeader(pkt, marker, seq.n++, timestamp, ssrc);
    nal.copy(pkt, 12);
    send(pkt);
    return;
  }

  // FU-A fragmentation
  const nalNri = nal[0] & 0x60;
  const nalType = nal[0] & 0x1f;
  const fuIndicator = nalNri | 28; // type 28 = FU-A
  const maxChunk = RTP_MAX_PAYLOAD - 2; // minus FU indicator + FU header
  let offset = 1; // skip original NAL header byte
  let first = true;

  while (offset < nal.length) {
    const end = Math.min(offset + maxChunk, nal.length);
    const isLast = end === nal.length;
    const fuHeader = (first ? 0x80 : 0x00) | (isLast ? 0x40 : 0x00) | nalType;
    const chunk = nal.subarray(offset, end);
    const pkt = Buffer.allocUnsafe(14 + chunk.length);
    writeRtpHeader(pkt, isLast && marker, seq.n++, timestamp, ssrc);
    pkt[12] = fuIndicator;
    pkt[13] = fuHeader;
    chunk.copy(pkt, 14);
    send(pkt);
    offset = end;
    first = false;
  }
}

const MEDIA_CODECS: RtpCodecCapability[] = [
  {
    kind: "video",
    mimeType: "video/H264",
    clockRate: 90000,
    preferredPayloadType: 96,
    rtcpFeedback: VIDEO_RTCP_FEEDBACK,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": H264_PROFILE_LEVEL_ID,
      "level-asymmetry-allowed": 1,
    },
  },
];

let worker: Worker;
let router: Router;

export async function initMediasoup() {
  worker = await mediasoup.createWorker({
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
    logLevel: "debug",
    logTags: ["ice", "dtls"],
  });

  worker.on("died", (err: Error) => {
    logger.error({ err }, "mediasoup worker died — exiting");
    process.exit(1);
  });

  router = await worker.createRouter({ mediaCodecs: MEDIA_CODECS });
  logger.info("mediasoup worker and router ready");
}

export function getRouterRtpCapabilities(): RtpCapabilities {
  return router.rtpCapabilities;
}

/** Returns the best LAN IP for ICE candidate announcements. */
export function getAnnouncedIp(): string {
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const net of list ?? []) {
      if (net.family !== "IPv4" || net.internal) continue;
      // Skip link-local (APIPA) addresses — these are unroutable and
      // typically belong to VM/VPN adapters with no real network path.
      if (net.address.startsWith("169.254.")) continue;
      return net.address;
    }
  }
  return "127.0.0.1";
}

// ── Session ───────────────────────────────────────────────────────────────

interface ViewerEntry {
  transport: WebRtcTransport;
  consumer: Consumer | null;
  statsInterval: ReturnType<typeof setInterval> | null;
}

function summarizeTransportStats(stats: unknown[]) {
  const stat = stats[0] as Record<string, unknown> | undefined;
  if (!stat) return null;

  return {
    type: stat["type"],
    iceState: stat["iceState"],
    dtlsState: stat["dtlsState"],
    bytesReceived: stat["bytesReceived"],
    bytesSent: stat["bytesSent"],
    recvBitrate: stat["recvBitrate"],
    sendBitrate: stat["sendBitrate"],
    rtpBytesReceived: stat["rtpBytesReceived"],
    rtpBytesSent: stat["rtpBytesSent"],
    rtpRecvBitrate: stat["rtpRecvBitrate"],
    rtpSendBitrate: stat["rtpSendBitrate"],
    availableOutgoingBitrate: stat["availableOutgoingBitrate"],
    availableIncomingBitrate: stat["availableIncomingBitrate"],
  };
}

function summarizeConsumerStats(stats: unknown[]) {
  const stat = stats[0] as Record<string, unknown> | undefined;
  if (!stat) return null;

  return {
    type: stat["type"],
    kind: stat["kind"],
    mimeType: stat["mimeType"],
    score: stat["score"],
    packetsLost: stat["packetsLost"],
    fractionLost: stat["fractionLost"],
    packetCount: stat["packetCount"],
    byteCount: stat["byteCount"],
    bitrate: stat["bitrate"],
    nackCount: stat["nackCount"],
    pliCount: stat["pliCount"],
    firCount: stat["firCount"],
    roundTripTime: stat["roundTripTime"],
  };
}

/**
 * One active streaming session — one game window, N viewers.
 *
 * Lifecycle:
 *   createSession() → session.init(hwnd) → session.createViewerTransport()
 *   → connectViewerTransport() → consumeViewer() → resumeViewer()
 *   → session.close()
 *
 * Video pipeline:
 *   WGC capture → BGRA frames → FFmpeg stdin
 *   FFmpeg → RTP/UDP → mediasoup PlainTransport → Producer
 *   Producer → WebRtcTransport Consumer (per viewer) → browser
 */
class StreamSession extends EventEmitter {
  readonly id: string;
  private static readonly RTP_TIMESTAMP_STEP = 1500;
  private plainTransport: PlainTransport | null = null;
  private producer: Producer | null = null;
  private viewers = new Map<string, ViewerEntry>();
  private viewerCounter = 0;
  private udpSocket: dgram.Socket | null = null;
  private captureStarted = false;
  private closed = false;
  private rtpPort = 0;
  private rtpSeq = 0;
  private baseRtpTimestamp = 0;
  private baseTime = 0;
  private frameCount = 0;
  private cachedSps: Buffer | null = null;
  private cachedPps: Buffer | null = null;
  private loggedFirstAccessUnit = false;
  // Fixed SSRC per session — must match the value sent in RTP packets
  private readonly ssrc: number;

  constructor(id: string) {
    super();
    this.id = id;
    this.ssrc = 1000 + parseInt(id, 10);
  }

  /** Start capture and set up mediasoup producer. Call once after construction. */
  async init(hwnd: number) {
    // 1. Plain UDP transport — comedia learns the sender address from the
    //    first packet; rtcpMux shares one port for both RTP and RTCP.
    this.plainTransport = await router.createPlainTransport({
      listenInfo: { protocol: "udp", ip: "127.0.0.1" },
      rtcpMux: true,
      comedia: true,
    });
    this.rtpPort = this.plainTransport.tuple.localPort;

    // 2. Video producer — fixed SSRC must match what FFmpeg sends (-ssrc)
    this.producer = await this.plainTransport.produce({
      kind: "video",
      rtpParameters: {
        codecs: [
          {
            mimeType: "video/H264",
            payloadType: 96,
            clockRate: 90000,
            parameters: {
              "packetization-mode": 1,
              "profile-level-id": H264_PROFILE_LEVEL_ID,
              "level-asymmetry-allowed": 1,
            },
            rtcpFeedback: VIDEO_RTCP_FEEDBACK,
          },
        ],
        encodings: [{ ssrc: this.ssrc }],
        headerExtensions: [],
        rtcp: {},
      },
    });

    logger.info(
      { sessionId: this.id, rtpPort: this.rtpPort, ssrc: this.ssrc },
      "mediasoup producer ready — starting capture",
    );

    // Poll producer stats 5s after start to confirm RTP is flowing
    setTimeout(async () => {
      if (this.closed || !this.producer) return;
      const stats = await this.producer.getStats();
      logger.info({ sessionId: this.id, stats }, "producer RTP stats (5s)");
    }, 5000);

    // 3. WGC capture — frames arrive on the Node.js main thread.
    //    Guard against the race where createSession() supersedes this session
    //    while we were awaiting mediasoup setup above: if the session was
    //    already closed, do not call startCapture() — another session may have
    //    taken the native singleton by now.
    if (this.closed) return;
    this.captureStarted = true;

    // Bind a local UDP socket to send RTP to mediasoup's PlainTransport.
    // comedia=true means mediasoup auto-learns our src address from the first packet.
    this.udpSocket = dgram.createSocket("udp4");
    await new Promise<void>((resolve) =>
      this.udpSocket!.bind(0, "127.0.0.1", resolve),
    );
    try {
      this.udpSocket.setSendBufferSize(8 * 1024 * 1024);
    } catch {
      // Ignore if OS does not allow a large buffer
    }

    // Listen for incoming RTCP packets from mediasoup (comedia sends them back
    // on the same port we send from). RTCP payload type 205 (RTPFB) with
    // FMT=1 is PLI; PT=192 is FIR. Either means the browser needs a keyframe.
    this.udpSocket.on("message", (msg: Buffer) => {
      if (msg.length < 8) return;
      const version = (msg[0]! >> 6) & 0x3;
      if (version !== 2) return;
      const pt = msg[1]! & 0x7f;
      const fmt = (msg[0]! >> 0) & 0x1f; // RC field repurposed as FMT in PSFB/RTPFB
      // PT=205 RTPFB FMT=1 = Generic NACK (skip)
      // PT=206 PSFB FMT=1 = PLI; PT=206 FMT=4 = FIR; PT=192 = FIR (legacy)
      const isPli = pt === 206 && fmt === 1;
      const isFir = (pt === 206 && fmt === 4) || pt === 192;
      if (isPli || isFir) {
        logger.debug(
          { sessionId: this.id, pt, fmt },
          "RTCP keyframe request → forcing IDR",
        );
        requestKeyframe();
      }
    });

    this.rtpSeq = Math.floor(Math.random() * 0x10000);
    this.baseRtpTimestamp = Math.floor(Math.random() * 0xffffffff) >>> 0;
    this.baseTime = performance.now();

    logger.info({ sessionId: this.id, hwnd }, "calling startCapture");
    startCapture(hwnd, (frameBuf: Buffer, w: number, h: number) => {
      this.frameCount++;
      if (this.frameCount === 1) {
        logger.info({ sessionId: this.id, w, h }, "first H264 frame received");
      }
      if (this.closed) return;
      this.sendEncodedFrame(frameBuf);
    });
  }

  // ── Viewer management ─────────────────────────────────────────────────

  async createViewerTransport(announcedIp: string) {
    const viewerId = String(++this.viewerCounter);

    const transport = await router.createWebRtcTransport({
      listenInfos: [
        { protocol: "udp", ip: "0.0.0.0", announcedAddress: announcedIp },
        { protocol: "tcp", ip: "0.0.0.0", announcedAddress: announcedIp },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    transport.on("icestatechange", (iceState: string) => {
      logger.info(
        { sessionId: this.id, viewerId, iceState },
        "ICE state change",
      );
    });

    transport.on("dtlsstatechange", (state: string) => {
      logger.info(
        { sessionId: this.id, viewerId, dtlsState: state },
        "DTLS state change",
      );
      if (state === "closed") this.removeViewer(viewerId);
    });

    logger.info(
      {
        sessionId: this.id,
        viewerId,
        announcedIp,
        candidates: transport.iceCandidates,
      },
      "viewer transport created",
    );

    this.viewers.set(viewerId, {
      transport,
      consumer: null,
      statsInterval: null,
    });

    return {
      viewerId,
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async connectViewerTransport(viewerId: string, dtlsParameters: object) {
    const viewer = this.viewers.get(viewerId);
    if (!viewer) throw new Error(`Viewer ${viewerId} not found`);
    await viewer.transport.connect({ dtlsParameters: dtlsParameters as any });
  }

  /**
   * Create a paused Consumer for a viewer. The consumer is created paused so
   * the client has time to set up its local consumer before RTP starts
   * flowing. Call resumeViewer() once the client signals it is ready.
   */
  async consumeViewer(viewerId: string, rtpCapabilities: RtpCapabilities) {
    const viewer = this.viewers.get(viewerId);
    if (!viewer) throw new Error(`Viewer ${viewerId} not found`);
    if (!this.producer) throw new Error("Producer not ready");

    if (!router.canConsume({ producerId: this.producer.id, rtpCapabilities })) {
      throw new Error("Incompatible RTP capabilities — cannot consume");
    }

    const consumer = await viewer.transport.consume({
      producerId: this.producer.id,
      rtpCapabilities,
      paused: true,
    });

    viewer.consumer = consumer;

    return {
      id: consumer.id,
      producerId: this.producer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  async resumeViewer(viewerId: string) {
    const viewer = this.viewers.get(viewerId);
    if (!viewer?.consumer)
      throw new Error(`Viewer ${viewerId} has no consumer`);
    await viewer.consumer.resume();
    // Force an IDR frame so the browser can start decoding immediately
    // without waiting up to gop_size frames for the next natural keyframe.
    requestKeyframe();
    this.startViewerStatsPolling(viewerId);
  }

  private startViewerStatsPolling(viewerId: string) {
    const viewer = this.viewers.get(viewerId);
    if (!viewer || viewer.statsInterval) return;

    const logViewerStats = async () => {
      const currentViewer = this.viewers.get(viewerId);
      if (!currentViewer?.consumer) return;

      try {
        const [transportStats, consumerStats] = await Promise.all([
          currentViewer.transport.getStats(),
          currentViewer.consumer.getStats(),
        ]);

        logger.info(
          {
            sessionId: this.id,
            viewerId,
            transport: summarizeTransportStats(transportStats),
            consumer: summarizeConsumerStats(consumerStats),
          },
          "viewer WebRTC stats",
        );
      } catch (err) {
        logger.warn(
          { err, sessionId: this.id, viewerId },
          "viewer stats failed",
        );
      }
    };

    void logViewerStats();
    viewer.statsInterval = setInterval(() => {
      void logViewerStats();
    }, 5000);
  }

  private removeViewer(viewerId: string) {
    const viewer = this.viewers.get(viewerId);
    if (!viewer) return;
    if (viewer.statsInterval) {
      clearInterval(viewer.statsInterval);
      viewer.statsInterval = null;
    }
    try {
      viewer.consumer?.close();
    } catch {
      /* ignore */
    }
    try {
      viewer.transport.close();
    } catch {
      /* ignore */
    }
    this.viewers.delete(viewerId);
    logger.info({ sessionId: this.id, viewerId }, "Viewer disconnected");
  }

  // ── RTP output ────────────────────────────────────────────────────────

  /**
   * Parse the Annex B H264 buffer produced by the native encoder, packetize
   * the NAL units per RFC 6184, and fire each RTP packet via UDP directly
   * into mediasoup's PlainTransport. No FFmpeg subprocess involved.
   */
  private udpQueue: Buffer[] = [];
  private isDraining = false;

  private sendEncodedFrame(buf: Buffer): void {
    if (!this.udpSocket || this.closed) return;

    const parsedNals = parseAnnexB(buf);
    if (parsedNals.length === 0) return;

    for (const nal of parsedNals) {
      const nalType = getNalType(nal);
      if (nalType === 7) this.cachedSps = Buffer.from(nal);
      if (nalType === 8) this.cachedPps = Buffer.from(nal);
    }

    const isIdr = hasNalType(parsedNals, 5);
    const hasSps = hasNalType(parsedNals, 7);
    const hasPps = hasNalType(parsedNals, 8);
    const nals = [...parsedNals];

    if (isIdr && !hasSps && this.cachedSps) nals.unshift(this.cachedSps);
    if (isIdr && !hasPps && this.cachedPps) {
      const insertIndex = hasSps || this.cachedSps ? 1 : 0;
      nals.splice(insertIndex, 0, this.cachedPps);
    }

    if (!this.loggedFirstAccessUnit) {
      this.loggedFirstAccessUnit = true;
      logger.info(
        {
          sessionId: this.id,
          nalTypes: parsedNals.map(getNalType),
          injectedSps: isIdr && !hasSps && !!this.cachedSps,
          injectedPps: isIdr && !hasPps && !!this.cachedPps,
          cachedSps: !!this.cachedSps,
          cachedPps: !!this.cachedPps,
        },
        "first H264 access unit packetized",
      );
    }

    const frameIndex = this.frameCount - 1;
    const timestamp =
      (this.baseRtpTimestamp +
        frameIndex * StreamSession.RTP_TIMESTAMP_STEP) >>>
      0;
    const seq = { n: this.rtpSeq };
    const socket = this.udpSocket;
    const port = this.rtpPort;
    const ssrc = this.ssrc;

    const packets: Buffer[] = [];
    nals.forEach((nal, i) => {
      // Marker bit is set on the last RTP packet of the last NAL in the frame
      const isLastNal = i === nals.length - 1;
      packetizeNal(nal, isLastNal, seq, timestamp, ssrc, (pkt) => {
        packets.push(pkt);
      });
    });

    this.rtpSeq = seq.n & 0xffff;

    this.udpQueue.push(...packets);
    if (!this.isDraining) this.drainUdpQueue();
  }

  private drainUdpQueue() {
    if (this.closed || this.udpQueue.length === 0) {
      this.isDraining = false;
      return;
    }
    this.isDraining = true;
    const chunk = this.udpQueue.splice(0, 90);
    chunk.forEach((p) => this.udpSocket!.send(p, this.rtpPort, "127.0.0.1"));

    if (this.udpQueue.length > 0) {
      setImmediate(() => this.drainUdpQueue());
    } else {
      this.isDraining = false;
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;

    if (this.captureStarted) {
      try {
        stopCapture();
      } catch {
        /* ignore */
      }
    }
    try {
      this.udpSocket?.close();
      this.udpSocket = null;
    } catch {
      /* ignore */
    }
    for (const [id] of this.viewers) this.removeViewer(id);
    try {
      this.producer?.close();
    } catch {
      /* ignore */
    }
    try {
      this.plainTransport?.close();
    } catch {
      /* ignore */
    }

    this.emit("close");
  }
}

// ── Service ───────────────────────────────────────────────────────────────

const sessions = new Map<string, StreamSession>();
let sessionCounter = 0;

export function createSession(): string {
  // The native WGC capture is a process-wide singleton — only one capture
  // can run at a time. Close any existing sessions before starting a new one.
  for (const [, session] of sessions) session.close();
  sessions.clear();

  const id = String(++sessionCounter);
  const session = new StreamSession(id);
  session.on("close", () => sessions.delete(id));
  sessions.set(id, session);
  return id;
}

export function getSession(id: string): StreamSession | undefined {
  return sessions.get(id);
}

export function closeSession(id: string) {
  sessions.get(id)?.close();
}

export { StreamSession };
