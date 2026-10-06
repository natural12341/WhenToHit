'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  CHANCE_LABEL,
  CONFIDENCE_LABEL,
  PHASE_LABEL,
  analyze,
  currentCycle,
  status,
  type Analysis,
} from '@/lib/cycle';
import { days, fmtFull, fmtLong, fmtShort, fromN, rel, toN, todayN } from '@/lib/dates';
import MonthCalendar, { Legend, dayClass } from '@/components/MonthCalendar';
import Sheet from '@/components/Sheet';
import NumInput from '@/components/NumInput';
import { COLORS, type Notes, type Period, type Woman } from '@/lib/types';

export default function WomanPage() {
  const { id } = useParams<{ id: string }>();
  const { data, updateWoman, update } = useStore();
  const router = useRouter();
  const today = todayN();
  const w = data.women.find((x) => x.id === id);
  const [picked, setPicked] = useState<number | null>(null);
  const [settings, setSettings] = useState(false);

  const a = useMemo(() => (w ? analyze(w, today) : null), [w, today]);
  const intimacy = useMemo(() => new Set((w?.intimacy ?? []).map(toN)), [w]);

  if (!w || !a) {
    return (
      <main className="page">
        <Link href="/" className="back">
          ‹ Назад
        </Link>
        <p className="muted">Карточка не найдена.</p>
      </main>
    );
  }

  const s = status(a, today);
  const todayInPeriod = a.day(today)?.phase === 'period' && !a.day(today)?.predicted;
  const sexToday = intimacy.has(today);

  const setW = (fn: (w: Woman) => Woman) => updateWoman(w.id, fn);

  const startPeriod = (n: number) =>
    setW((w) => {
      // если рядом (до 7 дней позже) уже есть начало — сдвигаем его, а не создаём дубль
      const near = w.periods.find((p) => toN(p.start) > n && toN(p.start) - n <= 7);
      const periods = near
        ? w.periods.map((p) => (p === near ? { ...p, start: fromN(n) } : p))
        : [...w.periods, { start: fromN(n) }];
      return { ...w, periods: sortPeriods(periods) };
    });

  const toggleSex = (n: number) =>
    setW((w) => {
      const iso = fromN(n);
      const has = w.intimacy.includes(iso);
      return {
        ...w,
        intimacy: has ? w.intimacy.filter((x) => x !== iso) : [...w.intimacy, iso].sort(),
      };
    });

  const setNotes = (k: keyof Notes, v: string) => setW((w) => ({ ...w, notes: { ...w.notes, [k]: v } }));

  const cc = currentCycle(a, today);

  return (
    <main className="page">
      <div className="nav-row">
        <Link href="/" className="back">
          ‹ Все
        </Link>
        <button className="btn ghost sm" onClick={() => setSettings(true)}>
          Настройки
        </button>
      </div>

      <header className="hero" style={{ ['--accent' as string]: w.color }}>
        <div className="hero-name">
          <span className="avatar lg" style={{ background: w.color }}>
            {w.name.slice(0, 1).toUpperCase()}
          </span>
          <h1 className="h1">{w.name}</h1>
        </div>
        <div className={`status ph-${s.phase}`}>
          <b>{s.title}</b>
          {s.sub && <span>{s.sub}</span>}
        </div>
        {a.stale && (
          <p className="hint warn-text">
            Давно не было отметок — прогноз примерный. Отметь последние месячные в календаре.
          </p>
        )}
        {cc && <CycleBar a={a} start={cc.start} next={cc.next} today={today} />}

        <div className="quick">
          {!todayInPeriod && (
            <button className="btn period" onClick={() => startPeriod(today)}>
              Месячные начались сегодня
            </button>
          )}
          <button className={`btn ${sexToday ? 'love on' : 'love'}`} onClick={() => toggleSex(today)}>
            ♥ {sexToday ? 'Близость сегодня ✓' : 'Близость сегодня'}
          </button>
        </div>
      </header>

      {a.hasData && (
        <section className="stats">
          <Stat label="След. месячные" value={a.nextPeriod !== null ? fmtShort(a.nextPeriod) : '—'} sub={a.nextPeriod !== null ? rel(a.nextPeriod - today) : ''} />
          <Stat label="Овуляция" value={a.nextOvulation !== null ? fmtShort(a.nextOvulation) : '—'} sub={a.nextOvulation !== null ? rel(a.nextOvulation - today) : ''} />
          <Stat label="Средний цикл" value={days(a.avgCycle)} sub={a.cycleLengths.length ? `по ${a.cycleLengths.length} цикл.` : 'по умолчанию'} />
          <Stat label="Точность" value={CONFIDENCE_LABEL[a.confidence]} sub={a.sd !== null ? `±${Math.round(a.sd)} дн.` : 'мало данных'} />
        </section>
      )}

      <section className="card">
        <MonthCalendar analysis={a} intimacy={intimacy} today={today} selected={picked} onPick={setPicked} />
        <Legend />
        <p className="hint center-text">Нажми на день, чтобы отметить месячные или близость</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Заметки</h2>
        </div>
        <NoteField label="Что любит" value={w.notes.likes} onChange={(v) => setNotes('likes', v)} placeholder="Цветы, кухня, музыка, подарки…" />
        <NoteField label="Что волнует" value={w.notes.concerns} onChange={(v) => setNotes('concerns', v)} placeholder="О чём переживает, что важно…" />
        <NoteField label="Другое" value={w.notes.other} onChange={(v) => setNotes('other', v)} placeholder="Самочувствие, даты, мелочи…" />
      </section>

      <History w={w} a={a} onDelete={(p) => setW((w) => ({ ...w, periods: w.periods.filter((x) => x !== p) }))} />

      {picked !== null && (
        <DaySheet
          n={picked}
          today={today}
          w={w}
          a={a}
          intimacy={intimacy}
          onClose={() => setPicked(null)}
          onStart={() => startPeriod(picked)}
          onSex={() => toggleSex(picked)}
          setW={setW}
        />
      )}

      <SettingsSheet
        open={settings}
        onClose={() => setSettings(false)}
        w={w}
        setW={setW}
        onDelete={() => {
          if (confirm(`Удалить карточку «${w.name}» со всей историей?`)) {
            update((d) => ({ ...d, women: d.women.filter((x) => x.id !== w.id) }));
            router.push('/');
          }
        }}
      />
    </main>
  );
}

function sortPeriods(p: Period[]) {
  return [...p].sort((a, b) => a.start.localeCompare(b.start));
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <small>{label}</small>
      <b>{value}</b>
      {sub && <span>{sub}</span>}
    </div>
  );
}

function CycleBar({ a, start, next, today }: { a: Analysis; start: number; next: number; today: number }) {
  const len = next - start;
  const cells = Array.from({ length: len }, (_, i) => start + i);
  return (
    <div className="cyclebar">
      <div className="cyclebar-track" style={{ gridTemplateColumns: `repeat(${len}, 1fr)` }}>
        {cells.map((n) => (
          <div key={n} className={`cb ${dayClass(a, n)} ${n === today ? 'now' : ''}`} />
        ))}
      </div>
      <div className="cyclebar-legend">
        <span>{fmtShort(start)}</span>
        <span>
          день {Math.min(today - start + 1, len)} из {len}
        </span>
        <span>{fmtShort(next)}</span>
      </div>
    </div>
  );
}

function NoteField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea className="input area" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} rows={2} />
    </label>
  );
}

function History({ w, a, onDelete }: { w: Woman; a: Analysis; onDelete: (p: Period) => void }) {
  const list = sortPeriods(w.periods).reverse();
  if (!list.length) return null;
  return (
    <section className="card">
      <div className="card-head">
        <h2>История месячных</h2>
        <small className="muted">{list.length}</small>
      </div>
      <ul className="hist">
        {list.map((p, i) => {
          const s = toN(p.start);
          const prev = list[i + 1];
          const nextStart = i > 0 ? toN(list[i - 1].start) : null;
          const len = nextStart !== null ? nextStart - s : null;
          const dur = p.end ? toN(p.end) - s + 1 : null;
          return (
            <li key={p.start}>
              <span className="hist-date">
                <b>{fmtFull(s)}</b>
                <small>
                  {dur ? `${days(dur)}` : `~${days(a.avgPeriod)} (конец не отмечен)`}
                  {len !== null ? ` · цикл ${days(len)}` : prev ? '' : ''}
                </small>
              </span>
              <button
                className="icon-btn danger"
                aria-label="Удалить"
                onClick={() => confirm(`Удалить месячные от ${fmtFull(s)}?`) && onDelete(p)}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DaySheet({
  n,
  today,
  w,
  a,
  intimacy,
  onClose,
  onStart,
  onSex,
  setW,
}: {
  n: number;
  today: number;
  w: Woman;
  a: Analysis;
  intimacy: Set<number>;
  onClose: () => void;
  onStart: () => void;
  onSex: () => void;
  setW: (fn: (w: Woman) => Woman) => void;
}) {
  const info = a.day(n);
  const future = n > today;

  // логированные месячные, в которые попадает день
  const covering = w.periods.find((p) => {
    const s = toN(p.start);
    const e = p.end ? toN(p.end) : s + a.avgPeriod - 1;
    return n >= s && n <= e;
  });
  // месячные, которые можно «продлить» до этого дня
  const extendable = !covering
    ? sortPeriods(w.periods)
        .reverse()
        .find((p) => toN(p.start) < n && n - toN(p.start) <= 11)
    : undefined;

  const setEnd = (p: Period) =>
    setW((w) => ({ ...w, periods: w.periods.map((x) => (x === p ? { ...x, end: fromN(n) } : x)) }));
  const remove = (p: Period) => setW((w) => ({ ...w, periods: w.periods.filter((x) => x !== p) }));

  return (
    <Sheet open onClose={onClose} title={<span className="cap">{fmtLong(n)}</span>}>
      <div className="day-info">
        {info ? (
          <>
            <span className={`pill ph-${info.phase} ${info.phase === 'period' && info.predicted ? 'pred' : ''}`}>
              {info.late ? 'Задержка' : PHASE_LABEL[info.phase]}
              {info.phase === 'period' && info.predicted ? ' (прогноз)' : ''}
            </span>
            <span className="muted">день цикла {info.cycleDay}</span>
            {info.phase !== 'period' && (
              <span className={`chance c-${info.chance}`}>Шанс зачатия: {CHANCE_LABEL[info.chance]}</span>
            )}
          </>
        ) : (
          <span className="muted">Нет данных для этого дня</span>
        )}
      </div>

      <div className="sheet-actions">
        {future ? (
          <p className="hint">Это будущий день — отметки ставятся по факту.</p>
        ) : (
          <>
            {covering ? (
              <>
                {toN(covering.start) !== n && (
                  <button className="btn period" onClick={() => (setEnd(covering), onClose())}>
                    {covering.end && toN(covering.end) === n ? '✓ Последний день месячных' : 'Месячные закончились в этот день'}
                  </button>
                )}
                <button className="btn ghost danger" onClick={() => (remove(covering), onClose())}>
                  Удалить эти месячные ({fmtShort(toN(covering.start))})
                </button>
              </>
            ) : (
              <>
                <button className="btn period" onClick={() => (onStart(), onClose())}>
                  Начались месячные
                </button>
                {extendable && (
                  <button className="btn ghost" onClick={() => (setEnd(extendable), onClose())}>
                    Закончились в этот день (с {fmtShort(toN(extendable.start))})
                  </button>
                )}
              </>
            )}
            <button className={`btn ${intimacy.has(n) ? 'love on' : 'love'}`} onClick={onSex}>
              ♥ {intimacy.has(n) ? 'Близость отмечена — убрать' : 'Отметить близость'}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function SettingsSheet({
  open,
  onClose,
  w,
  setW,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  w: Woman;
  setW: (fn: (w: Woman) => Woman) => void;
  onDelete: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Настройки карточки">
      <div className="form">
        <label className="field">
          <span>Имя</span>
          <input className="input" value={w.name} maxLength={40} onChange={(e) => setW((w) => ({ ...w, name: e.target.value }))} />
        </label>
        <div className="field">
          <span>Цвет</span>
          <div className="swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${w.color === c ? 'on' : ''}`}
                style={{ background: c }}
                onClick={() => setW((w) => ({ ...w, color: c }))}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <div className="row2">
          <label className="field">
            <span>Цикл по умолчанию</span>
            <NumInput value={w.cycleLength} min={20} max={45} onCommit={(v) => setW((w) => ({ ...w, cycleLength: v }))} />
          </label>
          <label className="field">
            <span>Месячные по умолч.</span>
            <NumInput value={w.periodLength} min={2} max={10} onCommit={(v) => setW((w) => ({ ...w, periodLength: v }))} />
          </label>
        </div>
        <p className="hint">
          Эти значения используются, пока истории мало. С 3+ отмеченных циклов прогноз считается по
          истории.
        </p>
        <button className="btn primary wide" onClick={onClose}>
          Готово
        </button>
        <button className="btn ghost danger wide" onClick={onDelete}>
          Удалить карточку
        </button>
      </div>
    </Sheet>
  );
}
