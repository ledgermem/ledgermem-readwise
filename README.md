# LedgerMem for Readwise

Pull [Readwise](https://readwise.io) highlights into [LedgerMem](https://proofly.dev) on a schedule or on demand.

## Features

- Incremental sync via Readwise's `/api/v2/export/` endpoint with `updatedAfter`
- Last-sync timestamp persisted to `~/.ledgermem/readwise.json` (configurable)
- Pagination handled automatically (`nextPageCursor`)
- Each highlight becomes a memory with rich book + location metadata
- CLI: `npx @ledgermem/readwise sync`

## Install

```bash
npm install -g @ledgermem/readwise
```

Or invoke directly:

```bash
npx @ledgermem/readwise sync
```

## Configure

Set environment variables (or create a `.env` and load it however you like):

| Var | Description |
| --- | --- |
| `READWISE_TOKEN` | Get one at https://readwise.io/access_token |
| `LEDGERMEM_API_KEY` | Your LedgerMem API key |
| `LEDGERMEM_WORKSPACE_ID` | Target workspace ID |
| `LEDGERMEM_STATE_PATH` | Optional override of the state-file path |

## Schedule

cron example (every 30 minutes):

```cron
*/30 * * * * /usr/bin/env READWISE_TOKEN=… LEDGERMEM_API_KEY=… LEDGERMEM_WORKSPACE_ID=… npx -y @ledgermem/readwise sync >> /var/log/ledgermem-readwise.log 2>&1
```

## Develop

```bash
npm install
npm run dev        # tsx src/cli.ts sync
npm test           # vitest
npm run build
```

## License

MIT
