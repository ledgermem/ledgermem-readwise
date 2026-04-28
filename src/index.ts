import { LedgerMem } from "@ledgermem/memory";
import { fetchHighlights, type FetchFn, type ReadwiseBook, type ReadwiseHighlight } from "./readwise.js";
import { loadState, saveState, type SyncState } from "./state.js";

export interface MemoryClient {
  add(content: string, opts: { metadata: Record<string, unknown> }): Promise<unknown>;
}

export interface SyncOptions {
  readwiseToken: string;
  apiKey: string;
  workspaceId: string;
  statePath?: string;
  fetchImpl?: FetchFn;
  client?: MemoryClient;
  now?: () => Date;
}

export interface SyncResult {
  imported: number;
  books: number;
  lastSync: string;
}

export function buildContent(book: ReadwiseBook, h: ReadwiseHighlight): string {
  const parts = [h.text.trim()];
  if (h.note) parts.push(`\nNote: ${h.note.trim()}`);
  parts.push(`\n— ${book.title}${book.author ? `, ${book.author}` : ""}`);
  return parts.join("");
}

export async function sync(opts: SyncOptions): Promise<SyncResult> {
  if (!opts.readwiseToken) throw new Error("READWISE_TOKEN is required");
  if (!opts.apiKey) throw new Error("LEDGERMEM_API_KEY is required");
  if (!opts.workspaceId) throw new Error("LEDGERMEM_WORKSPACE_ID is required");

  const state: SyncState = await loadState(opts.statePath);
  const client: MemoryClient =
    opts.client ?? new LedgerMem({ apiKey: opts.apiKey, workspaceId: opts.workspaceId });

  let imported = 0;
  let books = 0;
  // Track the most recent highlight timestamp seen so we can advance the cursor
  // even if the run is interrupted. Falls back to start-of-run timestamp.
  let highWaterMark: string | null = state.lastSync;
  for await (const book of fetchHighlights(
    { token: opts.readwiseToken, fetchImpl: opts.fetchImpl },
    state.lastSync,
  )) {
    books += 1;
    for (const h of book.highlights) {
      // Skip highlights whose text was deleted on the source (Readwise sets
      // text to empty when a highlight is deleted but still surfaces it in
      // export). Empty text adds no signal to retrieval.
      if (!h.text || h.text.trim().length === 0) continue;
      await client.add(buildContent(book, h), {
        metadata: {
          source: "readwise",
          sourceId: String(h.id),
          bookId: book.user_book_id,
          bookTitle: book.title,
          author: book.author ?? null,
          category: book.category ?? null,
          highlightId: h.id,
          location: h.location ?? null,
          locationType: h.location_type ?? null,
          highlightedAt: h.highlighted_at ?? null,
          syncedAt: new Date().toISOString(),
        },
      });
      imported += 1;
      const ts = h.updated ?? h.highlighted_at ?? null;
      if (ts && (!highWaterMark || ts > highWaterMark)) highWaterMark = ts;
    }
    // Persist after each book so a mid-run failure doesn't replay all imports.
    if (highWaterMark) {
      await saveState({ lastSync: highWaterMark }, opts.statePath);
    }
  }

  const stamp = (opts.now?.() ?? new Date()).toISOString();
  await saveState({ lastSync: stamp }, opts.statePath);
  return { imported, books, lastSync: stamp };
}

export { fetchHighlights } from "./readwise.js";
export { loadState, saveState } from "./state.js";
