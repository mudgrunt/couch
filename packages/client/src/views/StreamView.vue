<template>
  <div class="stream-view">
    <!-- Window picker: shown when no hwnd was provided or launch failed -->
    <div v-if="pickingWindow" class="window-picker">
      <h2>Pick a window to stream</h2>
      <p v-if="windowsError" class="error">{{ windowsError }}</p>
      <p v-else-if="windows.length === 0">Loading windows…</p>
      <ul v-else class="window-list">
        <li
          v-for="w in windows"
          :key="w.hwnd"
          class="window-list__item"
          @click="pickWindow(w.hwnd)"
        >
          <span class="window-list__hwnd">#{{ w.hwnd }}</span>
          <span class="window-list__title">{{ w.title }}</span>
        </li>
      </ul>
      <button class="window-list__refresh" @click="fetchWindows">Refresh</button>
    </div>

    <template v-else>
      <div v-if="!streaming" class="state-idle">
        <p v-if="error" class="error">{{ error }}</p>
        <p v-else>Connecting…</p>
      </div>

      <video ref="videoEl" class="stream-video" autoplay playsinline muted />

      <div v-if="streaming" class="overlay-hint">
        Press any gamepad button to activate controller pass-through
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Device } from 'mediasoup-client'
import type { ConsumerOptions, RtpCapabilities, TransportOptions } from 'mediasoup-client/types'

interface WindowEntry {
  hwnd: number
  title: string
}

const route = useRoute()
const router = useRouter()
const videoEl = ref<HTMLVideoElement | null>(null)
const streaming = ref(false)
const error = ref('')
const pickingWindow = ref(false)
const windows = ref<WindowEntry[]>([])
const windowsError = ref('')
// ── Window picker ───────────────────────────────────────────────────────────────────

async function fetchWindows() {
  windowsError.value = ''
  try {
    windows.value = await get<WindowEntry[]>('/stream/windows')
  } catch (err) {
    windowsError.value = err instanceof Error ? err.message : 'Failed to load windows'
  }
}

function pickWindow(hwnd: number) {
  pickingWindow.value = false
  router.replace({ query: { hwnd: String(hwnd) } })
  void startStream(hwnd)
}
// ── State ──────────────────────────────────────────────────────────────────

let sessionId = ''
let viewerId = ''
let diagnosticsIntervalId: number | null = null
let removeVideoListeners: (() => void) | null = null
let closeTransport: (() => void) | null = null
let closeConsumer: (() => void) | null = null

function summarizeRtcStats(report: RTCStatsReport) {
  const summary: Record<string, unknown> = {}

  report.forEach((stat) => {
    if (stat.type === 'inbound-rtp' && (stat as RTCInboundRtpStreamStats).kind === 'video') {
      const inbound = stat as RTCInboundRtpStreamStats
      summary.inbound = {
        bytesReceived: inbound.bytesReceived,
        packetsReceived: inbound.packetsReceived,
        packetsLost: inbound.packetsLost,
        framesDecoded: inbound.framesDecoded,
        frameWidth: inbound.frameWidth,
        frameHeight: inbound.frameHeight,
        keyFramesDecoded: inbound.keyFramesDecoded,
        framesPerSecond: inbound.framesPerSecond,
        pliCount: inbound.pliCount,
        firCount: inbound.firCount,
        nackCount: inbound.nackCount,
      }
    }

    if (stat.type === 'track') {
      const track = stat as RTCStats & Record<string, unknown>
      if (track.kind !== 'video') return

      summary.track = {
        framesReceived: track.framesReceived,
        framesDecoded: track.framesDecoded,
        framesDropped: track.framesDropped,
        frameWidth: track.frameWidth,
        frameHeight: track.frameHeight,
      }
    }

    if (
      stat.type === 'candidate-pair' &&
      (stat as RTCIceCandidatePairStats).state === 'succeeded'
    ) {
      const pair = stat as RTCIceCandidatePairStats
      summary.candidatePair = {
        currentRoundTripTime: pair.currentRoundTripTime,
        availableIncomingBitrate: pair.availableIncomingBitrate,
        availableOutgoingBitrate: pair.availableOutgoingBitrate,
        bytesReceived: pair.bytesReceived,
        bytesSent: pair.bytesSent,
      }
    }
  })

  return summary
}

function logVideoState(reason: string) {
  const video = videoEl.value
  if (!video) return

  const quality =
    typeof video.getVideoPlaybackQuality === 'function' ? video.getVideoPlaybackQuality() : null

  console.log('[stream] video state', {
    reason,
    readyState: video.readyState,
    networkState: video.networkState,
    currentTime: video.currentTime,
    paused: video.paused,
    ended: video.ended,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    quality: quality
      ? {
          totalVideoFrames: quality.totalVideoFrames,
          droppedVideoFrames: quality.droppedVideoFrames,
          corruptedVideoFrames: quality.corruptedVideoFrames,
        }
      : null,
  })
}

function startDiagnostics(
  transport: { getStats(): Promise<RTCStatsReport> },
  consumer: { getStats(): Promise<RTCStatsReport>; close(): void },
  track: MediaStreamTrack,
) {
  const video = videoEl.value
  if (!video) return

  const eventNames: Array<keyof HTMLMediaElementEventMap> = [
    'loadedmetadata',
    'loadeddata',
    'canplay',
    'playing',
    'waiting',
    'stalled',
    'suspend',
    'pause',
    'ended',
    'error',
    'resize',
  ]

  const listeners = eventNames.map((eventName) => {
    const listener = () => logVideoState(eventName)
    video.addEventListener(eventName, listener)
    return { eventName, listener }
  })

  const handleTrackEnded = () => {
    console.warn('[stream] track ended')
    logVideoState('track-ended')
  }

  track.addEventListener('ended', handleTrackEnded)

  removeVideoListeners = () => {
    listeners.forEach(({ eventName, listener }) => video.removeEventListener(eventName, listener))
    track.removeEventListener('ended', handleTrackEnded)
    removeVideoListeners = null
  }

  const poll = async () => {
    try {
      const [transportStats, consumerStats] = await Promise.all([
        transport.getStats(),
        consumer.getStats(),
      ])

      console.log('[stream] transport stats', summarizeRtcStats(transportStats))
      console.log('[stream] consumer stats', summarizeRtcStats(consumerStats))
      logVideoState('periodic')
    } catch (err) {
      console.error('[stream] stats poll failed:', err)
    }
  }

  void poll()
  diagnosticsIntervalId = window.setInterval(() => {
    void poll()
  }, 5000)
}

function stopDiagnostics() {
  if (diagnosticsIntervalId !== null) {
    window.clearInterval(diagnosticsIntervalId)
    diagnosticsIntervalId = null
  }
  removeVideoListeners?.()
  closeConsumer?.()
  closeConsumer = null
  closeTransport?.()
  closeTransport = null
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`)
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => String(res.status))
    throw new Error(`POST ${path} → ${res.status}: ${msg}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Streaming ──────────────────────────────────────────────────────────────

async function startStream(hwnd: number) {
  // 1. Create server-side session — this starts WGC capture + FFmpeg
  const { sessionId: sid } = await post<{ sessionId: string }>('/stream/session', { hwnd })
  sessionId = sid

  // 2. Fetch router RTP capabilities and load them into a mediasoup Device.
  //    The Device uses them to know which codecs the server supports and to
  //    produce a compatible set of consumer RTP parameters.
  const { rtpCapabilities } = await get<{ rtpCapabilities: RtpCapabilities }>(
    '/stream/rtp-capabilities',
  )
  const device = new Device()
  await device.load({ routerRtpCapabilities: rtpCapabilities })

  // 3. Ask the server to create a WebRTC receive transport and get back its
  //    ICE/DTLS parameters so we can create the local transport mirror.
  const transportParams = await post<TransportOptions & { viewerId: string }>(
    `/stream/session/${sessionId}/viewer`,
  )
  viewerId = transportParams.viewerId

  // 4. Create the local RecvTransport. When mediasoup-client needs to
  //    complete the DTLS handshake it fires 'connect' — we forward the
  //    DTLS parameters to the server to finalize the transport.
  console.log('[stream] ICE candidates:', transportParams.iceCandidates)
  const transport = device.createRecvTransport({
    id: transportParams.id,
    iceParameters: transportParams.iceParameters,
    iceCandidates: transportParams.iceCandidates,
    dtlsParameters: transportParams.dtlsParameters,
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  })
  closeTransport = () => transport.close()
  transport.on('icegatheringstatechange', (state) =>
    console.log('[stream] ICE gathering state:', state),
  )

  // Promise that resolves once DTLS is done and RTP can flow.
  const connected = new Promise<void>((resolve, reject) => {
    transport.on('connectionstatechange', (state) => {
      console.log('[stream] connection state:', state)
      if (state === 'connected') resolve()
      else if (state === 'failed' || state === 'closed') reject(new Error(`Transport ${state}`))
    })
  })

  transport.on('connect', ({ dtlsParameters }, callback, errback) => {
    console.log('[stream] connect fired — sending DTLS params to server')
    post(`/stream/session/${sessionId}/viewer/${viewerId}/connect`, { dtlsParameters })
      .then(() => {
        console.log('[stream] connect POST succeeded')
        callback()
      })
      .catch((err) => {
        console.error('[stream] connect POST failed:', err)
        errback(err)
      })
  })

  // 5. Ask the server to create a Consumer (server sends our device's RTP
  //    capabilities so it can produce a compatible set of parameters).
  //    The consumer is created paused server-side; we resume in step 7.
  const consumerParams = await post<
    Pick<ConsumerOptions, 'id' | 'producerId' | 'kind' | 'rtpParameters'>
  >(`/stream/session/${sessionId}/viewer/${viewerId}/consume`, {
    rtpCapabilities: device.rtpCapabilities,
  })

  // 6. Create the local Consumer — triggers ICE/DTLS negotiation.
  const consumer = await transport.consume(consumerParams)
  closeConsumer = () => consumer.close()
  console.log('[stream] consumer created, track muted:', consumer.track.muted)

  // 7. Wait until ICE+DTLS is fully connected before asking the server to
  //    start sending RTP. This avoids a race where media starts flowing while
  //    the recv transport is still negotiating.
  await connected
  console.log('[stream] transport connected, track muted:', consumer.track.muted)

  // 8. Resume server-side consumer (unpauses producer → consumer pipeline).
  await post(`/stream/session/${sessionId}/viewer/${viewerId}/resume`)
  await consumer.resume()
  console.log('[stream] consumer resumed after transport connect')

  // 9. Now attach and play — frames are actually arriving at this point.
  if (videoEl.value) {
    videoEl.value.srcObject = new MediaStream([consumer.track])
    startDiagnostics(transport, consumer, consumer.track)
    videoEl.value
      .play()
      .then(() => console.log('[stream] play() OK'))
      .catch((e: unknown) => {
        if (e instanceof Error) {
          console.error('[stream] play() error:', e.name, e.message)
          return
        }

        console.error('[stream] play() error:', e)
      })
  } else {
    console.error('[stream] videoEl is null at play time!')
  }

  streaming.value = true
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

onMounted(async () => {
  const hwnd = Number(route.query.hwnd)
  if (!hwnd) {
    pickingWindow.value = true
    await fetchWindows()
    return
  }

  try {
    await startStream(hwnd)
  } catch (err) {
    error.value = String(err)
  }
})

onUnmounted(async () => {
  stopDiagnostics()
  if (sessionId) {
    await fetch(`/api/stream/session/${sessionId}`, { method: 'DELETE' }).catch(() => {})
  }
})
</script>

<style scoped>
.stream-view {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stream-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.state-idle {
  color: #ccc;
  font-size: 1.1rem;
}

.error {
  color: #f66;
}

.overlay-hint {
  position: absolute;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 0.4rem 1rem;
  border-radius: 4px;
  font-size: 0.85rem;
  pointer-events: none;
}

.window-picker {
  padding: 2rem;
  max-width: 640px;
  margin: 0 auto;
}

.window-picker h2 {
  margin-bottom: 1rem;
}

.window-list {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.window-list__item {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #333;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.12s;
}

.window-list__item:hover {
  background: rgba(124, 124, 255, 0.1);
}

.window-list__hwnd {
  font-size: 0.75rem;
  color: #888;
  flex-shrink: 0;
}

.window-list__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.window-list__refresh {
  background: none;
  border: 1px solid #444;
  color: inherit;
  padding: 0.3rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
}

.window-list__refresh:hover {
  background: rgba(255, 255, 255, 0.06);
}
</style>
