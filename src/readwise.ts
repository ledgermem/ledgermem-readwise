export interface ReadwiseHighlight {
  id: number;
  text: string;
  note?: string | null;
  location?: number;
  location_type?: string;
  highlighted_at?: string | null;
  updated?: string | null;
  url?: string | null;
}

export interface ReadwiseBook {
  user_book_id: number;
  title: string;
  author?: string | null;
  category?: string | null;
  source?: string | null;
  cover_image_url?: string | null;
  highlights: ReadwiseHighlight[];
}

export interface ReadwiseExportResponse {
  count: number;
  nextPageCursor: string | null;
  results: ReadwiseBook[];
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface ReadwiseClientOptions {
  token: string;
  fetchImpl?: FetchFn;
  baseUrl?: string;
}

export async function* fetchHighlights(
  opts: ReadwiseClientOptions,
  updatedAfter: string | null,
): AsyncGenerator<ReadwiseBook, void, unknown> {
  const fetchImpl: FetchFn = opts.fetchImpl ?? fetch;
  const baseUrl = opts.baseUrl ?? "https://readwise.io/api/v2";
  let cursor: string | null = null;
  const seenCursors = new Set<string>();
  const MAX_PAGES = 10000;
  let pages = 0;
  do {
    const url = new URL(`${baseUrl}/export/`);
    if (updatedAfter) url.searchParams.set("updatedAfter", updatedAfter);
    if (cursor) url.searchParams.set("pageCursor", cursor);

    const res = await fetchImpl(url.toString(), {
      headers: { Authorization: `Token ${opts.token}` },
    });
    if (!res.ok) {
      throw new Error(`Readwise API ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as ReadwiseExportResponse;
    for (const book of body.results) yield book;
    const next = body.nextPageCursor;
    // Guard against an upstream bug returning the same cursor (infinite loop).
    if (next && seenCursors.has(next)) break;
    if (next) seenCursors.add(next);
    cursor = next;
    pages += 1;
    if (pages >= MAX_PAGES) break;
  } while (cursor);
}
