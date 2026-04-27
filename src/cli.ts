#!/usr/bin/env node
import { Command } from "commander";
import { sync } from "./index.js";

const program = new Command();
program
  .name("ledgermem-readwise")
  .description("Sync Readwise highlights into LedgerMem.")
  .version("0.1.0");

program
  .command("sync")
  .description("Run a single sync pass.")
  .option("--state <path>", "Path to the state file")
  .action(async (opts: { state?: string }) => {
    const readwiseToken = process.env["READWISE_TOKEN"] ?? "";
    const apiKey = process.env["LEDGERMEM_API_KEY"] ?? "";
    const workspaceId = process.env["LEDGERMEM_WORKSPACE_ID"] ?? "";
    try {
      const result = await sync({
        readwiseToken,
        apiKey,
        workspaceId,
        statePath: opts.state,
      });
      process.stdout.write(
        `[ledgermem-readwise] imported=${result.imported} books=${result.books} lastSync=${result.lastSync}\n`,
      );
    } catch (err) {
      process.stderr.write(`[ledgermem-readwise] error: ${(err as Error).message}\n`);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
