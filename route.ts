import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const KEY = 'cycle-tracker:data';

// Vercel → Storage → Upstash Redis сам добавит эти переменные в проект.
function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Необязательный PIN: если задать переменную APP_PIN, без него данные не откроются.
function pinOk(req: Request) {
  const pin = process.env.APP_PIN;
  if (!pin) return true;
  return req.headers.get('x-app-pin') === pin;
}

export async function GET(req: Request) {
  if (!pinOk(req)) return NextResponse.json({ error: 'pin' }, { status: 401 });
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: 'no-db' }, { status: 503 });
  try {
    const data = await redis.get(KEY);
    return NextResponse.json(data ?? { version: 1, women: [], updatedAt: 0 }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return NextResponse.json({ error: 'db', message: String(e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!pinOk(req)) return NextResponse.json({ error: 'pin' }, { status: 401 });
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: 'no-db' }, { status: 503 });
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
    await redis.set(KEY, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'db', message: String(e) }, { status: 500 });
  }
}
