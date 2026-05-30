import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client, LocalAuth } = require("whatsapp-web.js");

export type WAStatus = "disconnected" | "connecting" | "qr" | "ready";

interface WASession {
  client: any;
  status: WAStatus;
  qr?: string;
}

const sessions = new Map<number, WASession>();

export function getStatus(clinicId: number): { status: WAStatus; qr?: string } {
  const s = sessions.get(clinicId);
  if (!s) return { status: "disconnected" };
  return { status: s.status, qr: s.qr };
}

export async function initClient(clinicId: number): Promise<void> {
  const existing = sessions.get(clinicId);
  if (existing) {
    if (existing.status === "ready" || existing.status === "qr") return;
    // already initializing — nothing to do
    if (existing.status === "connecting") return;
    try { await existing.client.destroy(); } catch { /* ignore */ }
    sessions.delete(clinicId);
  }

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: `clinic-${String(clinicId)}` }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
      ],
    },
  });

  const session: WASession = { client, status: "connecting" };
  sessions.set(clinicId, session);

  client.on("qr", (qr: string) => {
    session.status = "qr";
    session.qr = qr;
  });

  client.on("ready", () => {
    session.status = "ready";
    session.qr = undefined;
    console.log(`[WA Web] Client ready for clinic ${clinicId}`);
  });

  client.on("authenticated", () => {
    session.status = "connecting";
    session.qr = undefined;
  });

  client.on("auth_failure", (msg: string) => {
    console.error(`[WA Web] Auth failure for clinic ${clinicId}:`, msg);
    session.status = "disconnected";
    sessions.delete(clinicId);
  });

  client.on("disconnected", (reason: string) => {
    console.log(`[WA Web] Disconnected for clinic ${clinicId}:`, reason);
    session.status = "disconnected";
    sessions.delete(clinicId);
  });

  client.initialize().catch((err: any) => {
    console.error(`[WA Web] Init error for clinic ${clinicId}:`, err?.message);
    session.status = "disconnected";
    sessions.delete(clinicId);
  });
}

export async function disconnectClient(clinicId: number): Promise<void> {
  const session = sessions.get(clinicId);
  if (!session) return;
  try {
    await session.client.logout();
    await session.client.destroy();
  } catch { /* ignore errors on logout */ }
  sessions.delete(clinicId);
}

export async function sendMessage(clinicId: number, phone: string, message: string): Promise<void> {
  const session = sessions.get(clinicId);
  if (!session || session.status !== "ready") {
    throw new Error("WhatsApp Web is not connected. Go to Settings → WhatsApp and scan the QR code.");
  }
  // Normalize to international format with @c.us suffix
  const digits = phone.replace(/\D/g, "");
  const normalized = (digits.length === 10 ? "91" + digits : digits) + "@c.us";
  await session.client.sendMessage(normalized, message);
}
