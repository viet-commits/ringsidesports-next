/**
 * fetch.ts — Download supplier inventory XML
 *
 * - Pull supplier XML from Extensionsell
 * - HTTPS with certificate verification (not disabled like legacy)
 * - Timeout: 120s
 * - Atomic write: .tmp → rename()
 * - Size sanity: abort if < 100,000 bytes
 * - SHA-256 check: skip processing if unchanged
 * - Log every step to stdout
 */
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rename, access, constants, unlink, stat, readFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { request } from "node:https";
import { IncomingMessage } from "node:http";
import { join } from "node:path";

export interface FetchResult {
  xmlPath: string;
  hash: string;
  skipped: boolean;
  byteCount: number;
}

const SUPPLIER_XML_URL =
  process.env.SUPPLIER_XML_URL ?? "https://extensionsell.com/x/export3/eca6a9-2.xml";

const DATA_DIR = process.env.SYNC_DATA_DIR ?? "/opt/ringsidesports/data";
const RAW_XML = join(DATA_DIR, "raw_product_inventory.xml");
const TMP_XML = join(DATA_DIR, "raw_product_inventory.xml.tmp");
const HASH_FILE = join(DATA_DIR, "sync-hash.txt");

const MIN_SIZE = 100_000;
const TIMEOUT_MS = 120_000;
const USER_AGENT = "RingsideSports-Sync/1.0";

function log(level: string, msg: string): void {
  const ts = new Date().toISOString();
  const line = `${ts} [${level}] fetch.ts: ${msg}`;
  console.log(line);
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function readPreviousHash(): Promise<string | null> {
  try {
    await access(HASH_FILE, constants.R_OK);
    const content = await readFile(HASH_FILE, "utf-8");
    return content.trim() || null;
  } catch {
    return null;
  }
}

async function writeHash(hash: string): Promise<void> {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(HASH_FILE, hash, "utf-8");
}

/**
 * Perform an HTTPS GET with timeout and return the response stream.
 */
function httpsGet(url: string, timeoutMs: number): Promise<IncomingMessage & { statusCode: number }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: "GET",
      timeout: timeoutMs,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/xml, text/xml, */*",
      },
    };

    const req = request(opts, (res) => {
      resolve(res as IncomingMessage & { statusCode: number });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    req.end();
  });
}

async function pipeToFile(
  stream: IncomingMessage,
  filePath: string,
): Promise<number> {
  const ws = createWriteStream(filePath);
  await pipeline(stream, ws);
  const st = await stat(filePath);
  return st.size;
}

export async function fetchXml(): Promise<FetchResult> {
  log("INFO", "=== fetchXml started ===");

  // 1. Download
  log("INFO", `Fetching ${SUPPLIER_XML_URL}`);
  const response = await httpsGet(SUPPLIER_XML_URL, TIMEOUT_MS);

  if (response.statusCode !== 200) {
    log("ERROR", `HTTP ${response.statusCode} from supplier URL`);
    throw new Error(`Supplier returned HTTP ${response.statusCode}`);
  }

  // 2. Write to temp file atomically
  log("INFO", "Writing response to temp file");
  const written = await pipeToFile(response, TMP_XML);

  if (written < MIN_SIZE) {
    log("ERROR", `Response suspiciously small: ${written} bytes (min ${MIN_SIZE})`);
    await unlink(TMP_XML).catch(() => {});
    throw new Error(`XML too small: ${written} bytes`);
  }

  // 3. Read temp file, compute hash
  log("INFO", `Downloaded ${written.toLocaleString()} bytes — computing SHA-256`);
  const buffer = await readFile(TMP_XML);
  const hash = sha256(buffer);
  log("INFO", `SHA-256: ${hash}`);

  // 4. Check against previous hash
  const prevHash = await readPreviousHash();
  if (prevHash === hash) {
    log("INFO", "XML unchanged since last run — skipping");
    await unlink(TMP_XML).catch(() => {});
    return {
      xmlPath: RAW_XML,
      hash,
      skipped: true,
      byteCount: written,
    };
  }

  // 5. Atomically move temp → live
  log("INFO", "XML changed — atomically moving temp to live file");
  await rename(TMP_XML, RAW_XML);
  await writeHash(hash);
  log("INFO", "Hash file updated");

  log("INFO", "=== fetchXml completed successfully ===");
  return {
    xmlPath: RAW_XML,
    hash,
    skipped: false,
    byteCount: written,
  };
}
