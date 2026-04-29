import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { homedir } from "node:os";

export interface SyncState {
  lastSync: string | null;
}

export function defaultStatePath(): string {
  return process.env["GETMNEMO_STATE_PATH"] ?? `${homedir()}/.getmnemo/readwise.json`;
}

export async function loadState(path: string = defaultStatePath()): Promise<SyncState> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<SyncState>;
    return { lastSync: typeof parsed.lastSync === "string" ? parsed.lastSync : null };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { lastSync: null };
    throw err;
  }
}

export async function saveState(state: SyncState, path: string = defaultStatePath()): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  // Atomic write — fs/promises rename is atomic on POSIX. Prevents partial
  // JSON if the process is killed mid-write.
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  const { rename } = await import("node:fs/promises");
  await rename(tmp, path);
}
