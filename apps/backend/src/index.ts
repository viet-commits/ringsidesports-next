import express from "express";
import { Pool } from "pg";
import { createClient } from "redis";

const app = express();
const PORT = parseInt(process.env.PORT || "9000", 10);

// --- Dependency clients ---

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://ringsidesports:ringsidesports@localhost:5433/ringsidesports";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6380";

const MEILISEARCH_HOST = process.env.MEILISEARCH_HOST || "http://localhost:7700";
const MEILI_MASTER_KEY = process.env.MEILI_MASTER_KEY || "ringsidesports-meili-key";

const pgPool = new Pool({ connectionString: DATABASE_URL, max: 2 });

const redis = createClient({ url: REDIS_URL });
redis.on("error", () => {
  // errors surfaced via health check, not crash
});

// --- Health endpoint with dependency checks ---

interface DependencyStatus {
  status: "connected" | "disconnected";
  error?: string;
}

interface HealthResponse {
  status: "ok" | "degraded" | "down";
  timestamp: string;
  uptime: number;
  dependencies: {
    postgres: DependencyStatus;
    redis: DependencyStatus;
    meilisearch: DependencyStatus;
  };
}

async function checkPostgres(): Promise<DependencyStatus> {
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 3000)
    );
    const query = pgPool.query("SELECT 1");
    await Promise.race([query, timeout]);
    return { status: "connected" };
  } catch (err) {
    return {
      status: "disconnected",
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}

async function checkRedis(): Promise<DependencyStatus> {
  try {
    if (!redis.isOpen) {
      const timeout = new Promise<"OK">((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 3000)
      );
      const connect = redis.connect().then(() => "OK" as const);
      await Promise.race([connect, timeout]);
    }
    const pong = await redis.ping();
    if (pong === "PONG") {
      return { status: "connected" };
    }
    return { status: "disconnected", error: `unexpected ping response: ${pong}` };
  } catch (err) {
    return {
      status: "disconnected",
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}

async function checkMeiliSearch(): Promise<DependencyStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${MEILISEARCH_HOST}/health`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${MEILI_MASTER_KEY}` },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return {
        status: "disconnected",
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    }
    const body = (await res.json()) as { status?: string };
    if (body.status === "available") {
      return { status: "connected" };
    }
    return {
      status: "disconnected",
      error: `unexpected MeiliSearch status: ${body.status ?? "null"}`,
    };
  } catch (err) {
    return {
      status: "disconnected",
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}

app.get("/health", async (_req, res) => {
  const [postgres, redisStatus, meilisearch] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkMeiliSearch(),
  ]);

  const allUp =
    postgres.status === "connected" &&
    redisStatus.status === "connected" &&
    meilisearch.status === "connected";

  const allDown =
    postgres.status === "disconnected" &&
    redisStatus.status === "disconnected" &&
    meilisearch.status === "disconnected";

  const overallStatus = allDown ? "down" : allUp ? "ok" : "degraded";

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    dependencies: {
      postgres,
      redis: redisStatus,
      meilisearch,
    },
  };

  const httpStatus = overallStatus === "ok" ? 200 : overallStatus === "degraded" ? 200 : 503;
  res.status(httpStatus).json(response);
});

// Medusa v2 will mount its full router here in later phases.

// Graceful shutdown
async function shutdown() {
  console.log("[ringsidesports-backend] shutting down...");
  try {
    await pgPool.end();
  } catch {
    // ignore
  }
  try {
    await redis.quit();
  } catch {
    // ignore
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.listen(PORT, () => {
  console.log(`[ringsidesports-backend] listening on :${PORT}`);
});

export default app;
