'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { analyze, status, upcomingEvents, type WeekEvent } from '@/lib/cycle';
import { WD_SHORT, fmtLong, fmtShort, rel, toN, todayN, weekday, ymd } from '@/lib/dates';
import AddWomanSheet from '@/components/AddWomanSheet';
import { Legend, dayClass } from '@/components/MonthCalendar';
import type { AppData } from '@/lib/types';

const EVENT_TEXT: Record<WeekEvent['kind'], string> = {
  period: 'месячные',
  ovulation: 'овуляция',
  fertile: 'начало фертильного окна',
  pms: 'начало ПМС',
};

export default function Home() {
  const { data, replaceAll } = useStore();
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = todayN();

  const rows = useMemo(
    () =>
      data.women.map((w) => {
        const a = analyze(w, today);
        return { w, a, s: status(a, today), intimacy: new Set(w.intimacy.map(toN)) };
      }),
    [data.women, today],
  );

  const events = useMemo(
    () =>
      rows
        .flatMap((r) => upcomingEvents(r.a, r.w.id, today, 7))
        .sort((a, b) => a.day - b.day || order(a.kind) - order(b.kind)),
    [rows, today],
  );
  const byId = new Map(rows.map((r) => [r.w.id, r.w]));
  const weekDays = Array.from({ length: 7 }, (_, i) => today + i);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cycle-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (f: File) => {
    try {
      const d = JSON.parse(await f.text()) as AppData;
      if (!d || !Array.isArray(d.women)) throw new Error();
      if (confirm(`Заменить текущие данные (${data.women.length} карт.) на данные из файла (${d.women.length} карт.)?`)) {
        replaceAll({ version: 1, women: d.women, updatedAt: Date.now() });
      }
    } catch {
      alert('Не получилось прочитать файл');
    }
  };

  return (
    <main className="page">
      <header className="top">
        <div>
          <div className="eyebrow">{fmtLong(today)}</div>
          <h1 className="h1">Цикл</h1>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}>
          + Карточка
        </button>
      </header>

      {rows.length === 0 ? (
        <section className="empty">
          <div className="empty-art">
            <span className="ea ph-period" />
            <span className="ea ph-fertile" />
            <span className="ea ph-ovulation" />
            <span className="ea ph-pms" />
          </div>
          <h2>Пока пусто</h2>
          <p>Создай первую карточку: имя и, если знаешь, дату начала последних месячных.</p>
          <button className="btn primary" onClick={() => setAdding(true)}>
            Создать карточку
          </button>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="card-head">
              <h2>Ближайшие 7 дней</h2>
            </div>
            <div className="week" style={{ ['--cols' as string]: 7 }}>
              <div className="week-name" />
              {weekDays.map((n) => (
                <div key={n} className={`week-day ${n === today ? 'is-today' : ''} ${weekday(n) >= 5 ? 'we' : ''}`}>
                  <span>{WD_SHORT[weekday(n)]}</span>
                  <b>{ymd(n).d}</b>
                </div>
              ))}
              {rows.map(({ w, a, intimacy }) => (
                <WeekRow key={w.id} name={w.name} color={w.color} id={w.id}>
                  {weekDays.map((n) => (
                    <div key={n} className={`week-cell ${dayClass(a, n)}`}>
                      {a.day(n)?.phase === 'ovulation' && <span className="o">О</span>}
                      {intimacy.has(n) && <span className="heart">♥</span>}
                    </div>
                  ))}
                </WeekRow>
              ))}
            </div>
            <Legend />
          </section>

          {events.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h2>События недели</h2>
              </div>
              <ul className="events">
                {events.map((e, i) => {
                  const w = byId.get(e.womanId)!;
                  return (
                    <li key={i}>
                      <span className="ev-when">
                        <b>{e.day === today ? 'Сегодня' : e.day === today + 1 ? 'Завтра' : WD_SHORT[weekday(e.day)]}</b>
                        <small>{fmtShort(e.day)}</small>
                      </span>
                      <span className={`ev-dot ph-${e.kind}`} />
                      <span className="ev-text">
                        <Link href={`/w/${w.id}`} style={{ color: w.color }}>
                          {w.name}
                        </Link>{' '}
                        — {EVENT_TEXT[e.kind]}
                        {e.kind === 'period' && e.predicted ? ' (прогноз)' : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="list">
            {rows.map(({ w, a, s }) => (
              <Link key={w.id} href={`/w/${w.id}`} className="person">
                <span className="avatar" style={{ background: w.color }}>
                  {w.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="person-main">
                  <b>{w.name}</b>
                  <span className={`pill ph-${s.phase}`}>{s.title}</span>
                  {s.sub && <small>{s.sub}</small>}
                </span>
                <span className="person-side">
                  {a.nextPeriod !== null && (
                    <>
                      <small>месячные</small>
                      <b>{rel(a.nextPeriod - today)}</b>
                    </>
                  )}
                </span>
              </Link>
            ))}
          </section>
        </>
      )}

      <footer className="foot">
        <div className="foot-actions">
          <button className="btn ghost sm" onClick={exportJson}>
            Скачать бэкап
          </button>
          <button className="btn ghost sm" onClick={() => fileRef.current?.click()}>
            Загрузить бэкап
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = '';
            }}
          />
        </div>
        <p>Прогноз — оценка по среднему циклу, а не метод контрацепции.</p>
      </footer>

      <AddWomanSheet open={adding} onClose={() => setAdding(false)} />
    </main>
  );
}

function WeekRow({
  name,
  color,
  id,
  children,
}: {
  name: string;
  color: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Link href={`/w/${id}`} className="week-name">
        <i style={{ background: color }} />
        <span>{name}</span>
      </Link>
      {children}
    </>
  );
}

function order(k: WeekEvent['kind']) {
  return { period: 0, ovulation: 1, fertile: 2, pms: 3 }[k];
}
