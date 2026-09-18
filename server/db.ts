import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

// Pool sizing is a direct cost lever: managed Postgres plans are priced by
// connection ceiling, and every autoscaled instance multiplies whatever `max` is set
// here. This app's requests are short, indexed queries, so a small pool per instance
// saturates fine and keeps the whole fleet inside a cheap plan's connection limit —
// with N instances the fleet needs N * max + N (the LISTEN client) connections.
// Override per environment with DB_POOL_MAX if a single instance ever needs more.
const poolMax = Math.max(1, Number(process.env.DB_POOL_MAX) || 5);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: poolMax,
  // Hand idle connections back quickly so scaled-out instances stop holding sockets
  // (and the DB stops paying for their backends) between traffic bursts.
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  // Let the pool drop to zero connections while idle — on Cloud Run an instance can
  // sit unused for long stretches before it's reclaimed.
  allowExitOnIdle: false,
});

export const db = drizzle(pool, { schema });
