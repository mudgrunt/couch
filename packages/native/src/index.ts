import path from "path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const addon = require(path.join(__dirname, "../build/Release/capture.node"));

export interface WindowInfo {
  hwnd: number;
  title: string;
}

export const listWindows: () => WindowInfo[] = addon.listWindows;

/** Returns the main visible HWND for the given process ID, or 0 if not found. */
export const findWindowByPid: (pid: number) => number = addon.findWindowByPid;

/** Returns all PIDs whose executable name matches (case-insensitive). Include the .exe extension. */
export const getProcessesByName: (exeName: string) => number[] =
  addon.getProcessesByName;

/**
 * Start capturing the window identified by `hwnd`.
 * `onFrame` is called on the Node.js main thread for every captured frame
 * with a tightly-packed BGRA Buffer (width * height * 4 bytes, no padding).
 */
export const startCapture: (
  hwnd: number,
  onFrame: (buf: Buffer, width: number, height: number) => void,
) => void = addon.startCapture;

/** Stop an in-progress capture started with startCapture(). */
export const stopCapture: () => void = addon.stopCapture;

/**
 * Request that the encoder emit an IDR (keyframe) frame as soon as possible.
 * Call this when a RTCP PLI or FIR is received from a WebRTC consumer.
 */
export const requestKeyframe: () => void = addon.requestKeyframe;
