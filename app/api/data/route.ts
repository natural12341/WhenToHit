import { Redis } from '@upstash/redis';
import { createClient } from 'redis';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const KEY = 'cycle-tracker:data';

/*
  База подключается автоматически, какие бы имена переменных ни выдал Vercel:
  • Upstash (REST): *_KV_REST_API_URL + *_KV_REST_API_TOKEN или UPSTASH_REDIS_REST_URL + _TOKEN
  • любой Redis по адресу redis:// / rediss://: REDIS_URL, KV_URL, *_REDIS_URL и т.п.
*/

interface Store {
  get(): Promise<unknown>;
  set(v: unknown): Promise<void>;
}

function findEnv(suffixes: string[]): string | undefined {
  for (const s of suffixes) if (process.env[s]) return process.env[s];
  for (const [k, v] of Object.entries(process.env)) {
    if (v && suffixes.some((s) => k.endsWith(`_${s}`))) return v;
  }
  return undefined;
}

type RedisTcp = ReturnType<typeof createClient>;
type G = typeof globalThis & { __ctRedis?: RedisTcp };

async function getStore(): Promise<Store | null> {
  const restUrl = findEnv(['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL']);
  const restToken = findEnv(['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN']);
  if (restUrl && restToken) {
    const r = new Redis({ url: restUrl, token: restToken });
    return {
      get: () => r.get(KEY),
      set: async (v) => {
        await r.set(KEY, v);
      },
    };
  }

  const url = findEnv(['REDIS_URL', 'KV_URL']);
  if (url && /^rediss?:\/\//.test(url)) {
    const g = globalThis as G;
    let c: RedisTcp | undefined = g.__ctRedis;
    if (!c) {
      c = createClient({ url }) as unknown as RedisTcp;
      c.on('error', () => {});
      g.__ctRedis = c;
    }
    const client = c;
    if (!client.isOpen) await client.connect();
    return {
      get: async () => {
        const raw = await client.get(KEY);
        return raw ? JSON.parse(raw) : null;
      },
      set: async (v) => {
        await client.set(KEY, JSON.stringify(v));
      },
    };
  }
  return null;
}

// Необязательный PIN: если задать переменную APP_PIN, без него данные не откроются.
function pinOk(req: Request) {
  const pin = process.env.APP_PIN;
  if (!pin) return true;
  return req.headers.get('x-app-pin') === pin;
}

// только имена переменных (без значений) — чтобы понять, что подключено
function envHint() {
  return Object.keys(process.env).filter((k) => /REDIS|KV|UPSTASH/i.test(k));
}

export async function GET(req: Request) {
  if (!pinOk(req)) return NextResponse.json({ error: 'pin' }, { status: 401 });
  try {
    const store = await getStore();
    if (!store) return NextResponse.json({ error: 'no-db', env: envHint() }, { status: 503 });
    const data = await store.get();
    return NextResponse.json(data ?? { version: 1, women: [], updatedAt: 0 }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return NextResponse.json({ error: 'db', message: String(e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!pinOk(req)) return NextResponse.json({ error: 'pin' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 });
  }
  const b = body as { women?: unknown };
  if (!b || typeof b !== 'object' || !Array.isArray(b.women)) {
    return NextResponse.json({ error: 'bad-shape' }, { status: 400 });
  }
  try {
    const store = await getStore();
    if (!store) return NextResponse.json({ error: 'no-db', env: envHint() }, { status: 503 });
    await store.set(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'db', message: String(e) }, { status: 500 });
  }
}
