import {
  appendFile,
  mkdir,
  open,
  readFile,
  rename,
  rm
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  FlowError,
  SCHEMA_VERSION,
  assert,
  assertNoSecrets,
  stableStringify
} from "./core.mjs";

async function readJsonOrNull(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export class JsonFlowStore {
  constructor(filePath, options = {}) {
    this.filePath = resolve(filePath);
    this.auditPath = resolve(options.auditPath ?? `${this.filePath}.audit.jsonl`);
    this.lockPath = `${this.filePath}.lock`;
  }

  async read() {
    return readJsonOrNull(this.filePath);
  }

  async acquireLock() {
    await mkdir(dirname(this.filePath), { recursive: true });
    let handle;
    try {
      handle = await open(this.lockPath, "wx", 0o600);
      await handle.writeFile(
        `${stableStringify({ pid: process.pid, acquiredAt: new Date().toISOString() })}\n`,
        "utf8"
      );
      await handle.close();
      handle = null;
      return async () => {
        await rm(this.lockPath, { force: true });
      };
    } catch (error) {
      await handle?.close().catch(() => {});
      if (handle) {
        await rm(this.lockPath, { force: true }).catch(() => {});
      }
      if (error.code === "EEXIST") {
        throw new FlowError(
          "STORE_LOCKED",
          `Flow state is locked by another process: ${this.lockPath}.`
        );
      }
      throw error;
    }
  }

  async save(document, options = {}) {
    assert(document && typeof document === "object", "STORE_DOCUMENT_INVALID", "A document is required.");
    assertNoSecrets(document);
    const release = await this.acquireLock();

    try {
      const current = await this.read();
      const expectedRevision = options.expectedStoreRevision;
      if (expectedRevision !== undefined) {
        assert(
          (current?.storeRevision ?? 0) === expectedRevision,
          "STORE_REVISION_CONFLICT",
          "Flow state changed after it was read.",
          {
            expected: expectedRevision,
            actual: current?.storeRevision ?? 0
          }
        );
      }

      const next = {
        ...structuredClone(document),
        schemaVersion: document.schemaVersion ?? SCHEMA_VERSION,
        storeRevision: (current?.storeRevision ?? 0) + 1,
        storedAt: new Date().toISOString()
      };
      const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      const handle = await open(tempPath, "wx", 0o600);

      try {
        await handle.writeFile(`${JSON.stringify(next, null, 2)}\n`, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }

      try {
        await rename(tempPath, this.filePath);
      } catch (error) {
        await rm(tempPath, { force: true }).catch(() => {});
        throw error;
      }
      await appendFile(
        this.auditPath,
        `${stableStringify({
          at: next.storedAt,
          storeRevision: next.storeRevision,
          campaignId: next.campaignId ?? null,
          event: options.event ?? "STATE_SAVED",
          actor: options.actor ?? "system"
        })}\n`,
        { encoding: "utf8", mode: 0o600 }
      );
      return next;
    } finally {
      await release();
    }
  }
}
