import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sync } from "./index.js";

vi.mock("@ledgermem/memory", () => ({
  LedgerMem: vi.fn().mockImplementation(() => ({ add: vi.fn() })),
}));

function makeFetch(pages: unknown[]): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    const body = pages[i] ?? { count: 0, nextPageCursor: null, results: [] };
    i += 1;
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

let tmpDir: string;
beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "lm-rw-"));
});
afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("sync", () => {
  it("imports highlights across paginated responses", async () => {
    const add = vi.fn().mockResolvedValue({});
    const client = { add };
    const fetchImpl = makeFetch([
      {
        count: 1,
        nextPageCursor: "p2",
        results: [
          {
            user_book_id: 1,
            title: "Book A",
            author: "Author A",
            highlights: [{ id: 10, text: "highlight one", location: 100 }],
          },
        ],
      },
      {
        count: 1,
        nextPageCursor: null,
        results: [
          {
            user_book_id: 2,
            title: "Book B",
            author: "Author B",
            highlights: [
              { id: 20, text: "highlight two", note: "annotated" },
              { id: 21, text: "highlight three" },
            ],
          },
        ],
      },
    ]);

    const result = await sync({
      readwiseToken: "rw_test",
      apiKey: "lm_test",
      workspaceId: "ws_test",
      statePath: join(tmpDir, "state.json"),
      fetchImpl,
      client,
      now: () => new Date("2026-04-28T00:00:00Z"),
    });

    expect(result.imported).toBe(3);
    expect(result.books).toBe(2);
    expect(result.lastSync).toBe("2026-04-28T00:00:00.000Z");
    expect(add).toHaveBeenCalledTimes(3);

    const [content, opts] = add.mock.calls[0];
    expect(content).toContain("highlight one");
    expect(content).toContain("Book A");
    expect(opts.metadata).toMatchObject({
      source: "readwise",
      bookId: 1,
      bookTitle: "Book A",
      author: "Author A",
      highlightId: 10,
      location: 100,
    });

    const persisted = JSON.parse(await readFile(join(tmpDir, "state.json"), "utf8")) as { lastSync: string };
    expect(persisted.lastSync).toBe("2026-04-28T00:00:00.000Z");
  });

  it("passes lastSync as updatedAfter on subsequent runs", async () => {
    await import("node:fs/promises").then((fs) =>
      fs.writeFile(join(tmpDir, "state.json"), JSON.stringify({ lastSync: "2026-04-01T00:00:00.000Z" })),
    );
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain("updatedAfter=2026-04-01T00%3A00%3A00.000Z");
      return new Response(JSON.stringify({ count: 0, nextPageCursor: null, results: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    await sync({
      readwiseToken: "rw_test",
      apiKey: "lm_test",
      workspaceId: "ws_test",
      statePath: join(tmpDir, "state.json"),
      fetchImpl,
      client: { add: vi.fn() },
    });
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("throws on missing credentials", async () => {
    await expect(
      sync({ readwiseToken: "", apiKey: "k", workspaceId: "w", statePath: join(tmpDir, "s.json") }),
    ).rejects.toThrow(/READWISE_TOKEN/);
    await expect(
      sync({ readwiseToken: "r", apiKey: "", workspaceId: "w", statePath: join(tmpDir, "s.json") }),
    ).rejects.toThrow(/LEDGERMEM_API_KEY/);
    await expect(
      sync({ readwiseToken: "r", apiKey: "k", workspaceId: "", statePath: join(tmpDir, "s.json") }),
    ).rejects.toThrow(/LEDGERMEM_WORKSPACE_ID/);
  });

  it("propagates Readwise API errors", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    await expect(
      sync({
        readwiseToken: "r",
        apiKey: "k",
        workspaceId: "w",
        statePath: join(tmpDir, "s.json"),
        fetchImpl,
        client: { add: vi.fn() },
      }),
    ).rejects.toThrow(/Readwise API 500/);
  });
});
