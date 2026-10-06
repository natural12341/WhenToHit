'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { EMPTY_DATA, type AppData, type Woman } from './types';

type Status = 'loading' | 'pin' | 'ready';
type Mode = 'cloud' | 'local' | 'offline';
type SaveState = 'idle' | 'saving' | 'error';

interface Store {
  status: Status;
  mode: Mode;
  saveState: SaveState;
  data: AppData;
  update: (fn: (d: AppData) => AppData) => void;
  updateWoman: (id: string, fn: (w: Woman) => Woman) => void;
  submitPin: (pin: string) => void;
  pinError: boolean;
  replaceAll: (d: AppData) => void;
}

const Ctx = createContext<Store | null>(null);

const LS_DATA = 'ct-data-v1';
const LS_PIN = 'ct-pin';

function readLocal(): AppData {
  try {
    const raw = localStorage.getItem(LS_DATA);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.women)) return d;
    }
  } catch {}
  return EMPTY_DATA;
}

function writeLocal(d: AppData) {
  try {
    localStorage.setItem(LS_DATA, JSON.stringify(d));
  } catch {}
}

function getPin() {
  try {
    return localStorage.getItem(LS_PIN) || '';
  } catch {
    return '';
  }
}

function headers(json = false): HeadersInit {
  const h: Record<string, string> = {};
  const pin = getPin();
  if (pin) h['x-app-pin'] = pin;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [mode, setMode] = useState<Mode>('local');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [pinError, setPinError] = useState(false);
  const dataRef = useRef<AppData>(EMPTY_DATA);
  const modeRef = useRef<Mode>('local');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);

  const apply = (d: AppData) => {
    dataRef.current = d;
    setData(d);
  };
  const setModeBoth = (m: Mode) => {
    modeRef.current = m;
    setMode(m);
  };

  const push = useCallback(async () => {
    if (modeRef.current !== 'cloud') return;
    setSaveState('saving');
    try {
      const r = await fetch('/api/data', {
        method: 'PUT',
        headers: headers(true),
        body: JSON.stringify(dataRef.current),
      });
      if (r.status === 401) {
        setStatus('pin');
        return;
      }
      if (!r.ok) throw new Error(String(r.status));
      pending.current = false;
      setSaveState('idle');
    } catch {
      setSaveState('error');
    }
  }, []);

  const load = useCallback(async () => {
    const local = readLocal();
    try {
      const r = await fetch('/api/data', { headers: headers(), cache: 'no-store' });
      if (r.status === 401) {
        setStatus('pin');
        return;
      }
      if (r.status === 503) {
        setModeBoth('local');
        apply(local);
        setStatus('ready');
        return;
      }
      if (!r.ok) throw new Error(String(r.status));
      const remote = (await r.json()) as AppData;
      setModeBoth('cloud');
      // если в браузере есть более свежие несохранённые правки — отправляем их
      if ((local.updatedAt || 0) > (remote.updatedAt || 0) && local.women.length) {
        apply(local);
        pending.current = true;
        push();
      } else {
        apply(remote);
        writeLocal(remote);
      }
      setStatus('ready');
    } catch {
      setModeBoth('offline');
      apply(local);
      setStatus('ready');
    }
  }, [push]);

  useEffect(() => {
    load();
  }, [load]);

  // при возвращении во вкладку подтягиваем изменения с другого устройства
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState !== 'visible') return;
      if (modeRef.current === 'offline') {
        load();
        return;
      }
      if (modeRef.current !== 'cloud' || pending.current) return;
      try {
        const r = await fetch('/api/data', { headers: headers(), cache: 'no-store' });
        if (!r.ok) return;
        const remote = (await r.json()) as AppData;
        if ((remote.updatedAt || 0) > (dataRef.current.updatedAt || 0)) {
          apply(remote);
          writeLocal(remote);
        }
      } catch {}
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  const commit = useCallback(
    (next: AppData) => {
      const d = { ...next, updatedAt: Date.now() };
      apply(d);
      writeLocal(d);
      if (modeRef.current === 'cloud') {
        pending.current = true;
        setSaveState('saving');
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(push, 500);
      }
    },
    [push],
  );

  const update = useCallback((fn: (d: AppData) => AppData) => commit(fn(dataRef.current)), [commit]);

  const updateWoman = useCallback(
    (id: string, fn: (w: Woman) => Woman) =>
      update((d) => ({ ...d, women: d.women.map((w) => (w.id === id ? fn(w) : w)) })),
    [update],
  );

  const submitPin = useCallback(
    async (pin: string) => {
      try {
        localStorage.setItem(LS_PIN, pin.trim());
      } catch {}
      setPinError(false);
      const r = await fetch('/api/data', { headers: headers(), cache: 'no-store' }).catch(() => null);
      if (r && r.status === 401) {
        setPinError(true);
        return;
      }
      setStatus('loading');
      load();
    },
    [load],
  );

  const replaceAll = useCallback((d: AppData) => commit(d), [commit]);

  // не даём закрыть вкладку, пока данные не ушли в облако
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (pending.current && modeRef.current === 'cloud') {
        push();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [push]);

  return (
    <Ctx.Provider
      value={{ status, mode, saveState, data, update, updateWoman, submitPin, pinError, replaceAll }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

export function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}
