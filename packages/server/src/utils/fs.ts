import fs from "fs";
import path from "path";

/**
 * Downloads a remote image to destPath, creating intermediate directories.
 * Returns the destination path. Throws on non-2xx HTTP status.
 */
export async function downloadImage(
  url: string,
  destPath: string,
): Promise<string> {
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(
      `Failed to download image: ${res.status} ${res.statusText}`,
    );
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(destPath, buffer);
  return destPath;
}

export async function computeInstallSize(installPath: string): Promise<number> {
  const stat = await fs.promises.stat(installPath);
  if (stat.isFile()) return stat.size;

  let total = 0;
  const entries = await fs.promises.readdir(installPath, {
    withFileTypes: true,
    recursive: true,
  });

  for (const entry of entries) {
    if (entry.isFile()) {
      const s = await fs.promises.stat(path.join(entry.parentPath, entry.name));
      total += s.size;
    }
  }

  return total;
}
