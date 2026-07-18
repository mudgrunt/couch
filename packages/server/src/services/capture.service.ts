import { spawn, exec } from "child_process";
import path from "path";
import { promisify } from "util";
import { logger } from "../utils/logger.js";

// TODO: restore when native addon is built
const listWindows: () => { hwnd: number; title: string }[] = () => [];
const findWindowByPid: (pid: number) => number = () => 0;

const execAsync = promisify(exec);

const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 60_000;

export interface LaunchResult {
  pid: number;
  hwnd: number;
}

function isUriScheme(launchTarget: string): boolean {
  return /^[a-z][a-z0-9+\-.]*:\/\//i.test(launchTarget);
}

/**
 * Titles (substring match, case-insensitive) that belong to launcher UI
 * rather than the game itself. These windows are excluded from detection.
 */
const LAUNCHER_TITLE_BLOCKLIST = [
  "steam",
  "epic games",
  "gog galaxy",
  "launching",
  "preparing",
  "updating",
];

function isLauncherWindow(title: string): boolean {
  const lower = title.toLowerCase();
  return LAUNCHER_TITLE_BLOCKLIST.some((t) => lower.includes(t));
}

/** Number of consecutive stable poll ticks required before resolving. */
const STABLE_TICKS_REQUIRED = 3;

/**
 * Polls listWindows() until a non-launcher window appears whose HWND was
 * not in `knownHwnds` AND remains visible for STABLE_TICKS_REQUIRED
 * consecutive poll intervals. This filters out transient Steam/Epic
 * "Launching…" dialogs that briefly appear before the game window.
 */
function waitForNewWindow(knownHwnds: Set<number>): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let candidate: number | null = null;
    let stableTicks = 0;

    const poll = () => {
      if (Date.now() - start > POLL_TIMEOUT_MS) {
        reject(new Error("Timed out waiting for game window to appear"));
        return;
      }
      const current = listWindows();
      const currentMap = new Map<number, string>(
        current.map((w: { hwnd: number; title: string }) => [w.hwnd, w.title]),
      );

      if (candidate !== null) {
        if (currentMap.has(candidate)) {
          stableTicks++;
          if (stableTicks >= STABLE_TICKS_REQUIRED) {
            resolve(candidate);
            return;
          }
        } else {
          // Disappeared — discard and keep looking
          candidate = null;
          stableTicks = 0;
        }
      }

      if (candidate === null) {
        const newWin = current.find(
          (w: { hwnd: number; title: string }) =>
            !knownHwnds.has(w.hwnd) && !isLauncherWindow(w.title),
        );
        if (newWin) {
          candidate = newWin.hwnd;
          stableTicks = 1;
        }
      }

      setTimeout(poll, POLL_INTERVAL_MS);
    };
    setTimeout(poll, POLL_INTERVAL_MS);
  });
}

/**
 * Polls until a visible window owned by `pid` appears, then returns its HWND.
 */
function waitForWindowByPid(pid: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = () => {
      if (Date.now() - start > POLL_TIMEOUT_MS) {
        reject(new Error(`Timed out waiting for window (pid ${pid})`));
        return;
      }
      const hwnd = findWindowByPid(pid);
      if (hwnd !== 0) {
        resolve(hwnd);
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    };
    setTimeout(poll, POLL_INTERVAL_MS);
  });
}

/**
 * Launches a game and resolves with its main window HWND once it appears.
 *
 * @param launchTarget  Steam/Epic URI or absolute path to an executable.
 */
export async function launchGame(launchTarget: string): Promise<LaunchResult> {
  // Snapshot existing windows so we can detect the new one universally
  const knownHwnds = new Set<number>(
    listWindows().map((w: { hwnd: number }) => w.hwnd),
  );

  if (isUriScheme(launchTarget)) {
    // URI scheme (steam://, com.epicgames.launcher://) — open via shell
    logger.info(`Launching via URI: ${launchTarget}`);
    await execAsync(`start "" "${launchTarget}"`, { shell: "cmd.exe" });

    const hwnd = await waitForNewWindow(knownHwnds);
    logger.info(`Game window found: HWND ${hwnd}`);
    return { pid: 0, hwnd };
  } else {
    // Direct executable (GOG, or any bare .exe path)
    const resolvedExe = path.resolve(launchTarget);
    logger.info(`Launching executable: ${resolvedExe}`);

    const child = spawn(resolvedExe, [], {
      detached: true,
      stdio: "ignore",
      cwd: path.dirname(resolvedExe),
    });
    child.unref();

    const pid = child.pid ?? 0;

    // For direct exe we know the PID, so prefer PID-based detection.
    // Fall back to new-window detection if spawn didn't give us a PID.
    const hwnd = pid
      ? await waitForWindowByPid(pid)
      : await waitForNewWindow(knownHwnds);

    logger.info(`Game window found: PID ${pid} HWND ${hwnd}`);
    return { pid, hwnd };
  }
}
