import { toN, rel, days } from './dates';
import type { Woman } from './types';

/*
  Как считается прогноз
  ---------------------
  • Длина цикла = дни между началами соседних месячных.
    Пока истории нет — берём длину из настроек карточки (по умолчанию 28).
    Когда есть 1–2 цикла — смешиваем их с длиной из настроек.
    С 3+ циклов — взвешенное среднее последних 6 (свежие весят больше).
  • Овуляция ≈ за 14 дней до следующих месячных (лютеиновая фаза почти постоянна).
  • Фертильное окно = 5 дней до овуляции + день овуляции + день после.
  • ПМС = 5 дней перед месячными.
  • Если месячные опаздывают до 14 дней — «задержка», прогноз сдвигается на сегодня.
    Если отметок нет дольше — прогноз продолжается по среднему, но помечается как устаревший.
*/

export type Phase = 'period' | 'ovulation' | 'fertile' | 'pms' | 'none';
export type Chance = 'high' | 'medium' | 'low';
export type Confidence = 'none' | 'low' | 'medium' | 'high';

export interface DayInfo {
  phase: Phase;
  predicted: boolean; // для месячных: прогноз, а не отметка
  late: boolean; // день задержки
  cycleDay: number;
  chance: Chance;
  cycleStart: number;
}

export interface Cycle {
  start: number;
  next: number; // начало следующих месячных
  periodEnd: number;
  ovulation: number;
  pmsStart: number;
  predicted: boolean; // начало цикла — прогноз
  current: boolean;
}

export interface Analysis {
  hasData: boolean;
  avgCycle: number;
  avgPeriod: number;
  sd: number | null;
  confidence: Confidence;
  cycleLengths: number[];
  periodLengths: number[];
  cycles: Cycle[];
  lastStart: number | null;
  nextPeriod: number | null;
  nextOvulation: number | null;
  delay: number;
  stale: boolean;
  day: (n: number) => DayInfo | null;
}

export const LUTEAL = 14;
const MIN_CYCLE = 18;
const MAX_CYCLE = 50;
const MAX_DELAY_SHIFT = 14;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function analyze(w: Woman, today: number): Analysis {
  const starts = Array.from(new Set(w.periods.map((p) => toN(p.start)))).sort((a, b) => a - b);
  const ends = new Map<number, number>();
  for (const p of w.periods) if (p.end) ends.set(toN(p.start), toN(p.end));

  // --- длины циклов
  const cycleLengths: number[] = [];
  for (let i = 0; i + 1 < starts.length; i++) {
    const d = starts[i + 1] - starts[i];
    if (d >= MIN_CYCLE && d <= MAX_CYCLE) cycleLengths.push(d);
  }
  const recent = cycleLengths.slice(-6);
  let avgCycle = w.cycleLength;
  if (recent.length) {
    let sw = 0;
    let s = 0;
    recent.forEach((l, i) => {
      sw += i + 1;
      s += l * (i + 1);
    });
    const wm = s / sw;
    avgCycle = recent.length < 3 ? (wm * recent.length + w.cycleLength) / (recent.length + 1) : wm;
  }
  avgCycle = clamp(Math.round(avgCycle), 20, 45);

  // --- длительность месячных
  const periodLengths: number[] = [];
  for (const s of starts) {
    const e = ends.get(s);
    if (e !== undefined) {
      const l = e - s + 1;
      if (l >= 1 && l <= 12) periodLengths.push(l);
    }
  }
  const recentP = periodLengths.slice(-6);
  const avgPeriod = clamp(
    Math.round(recentP.length ? recentP.reduce((a, b) => a + b, 0) / recentP.length : w.periodLength),
    2,
    10,
  );

  let sd: number | null = null;
  if (recent.length >= 2) {
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    sd = Math.sqrt(recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length);
  }

  let confidence: Confidence = 'none';
  if (starts.length) {
    if (cycleLengths.length < 2) confidence = 'low';
    else if (cycleLengths.length < 4 || (sd ?? 0) > 3) confidence = 'medium';
    else confidence = 'high';
  }

  const map = new Map<number, DayInfo>();
  const cycles: Cycle[] = [];

  const empty: Analysis = {
    hasData: false,
    avgCycle,
    avgPeriod,
    sd,
    confidence,
    cycleLengths,
    periodLengths,
    cycles,
    lastStart: null,
    nextPeriod: null,
    nextOvulation: null,
    delay: 0,
    stale: false,
    day: () => null,
  };
  if (!starts.length) return empty;

  const addCycle = (c: Cycle, lateFrom?: number) => {
    cycles.push(c);
    const ov = c.ovulation;
    for (let n = c.start; n < c.next; n++) {
      let phase: Phase = 'none';
      if (n <= c.periodEnd) phase = 'period';
      else if (n === ov) phase = 'ovulation';
      else if (n >= ov - 5 && n <= ov + 1) phase = 'fertile';
      else if (n >= c.pmsStart) phase = 'pms';

      let chance: Chance = 'low';
      if (phase !== 'period') {
        if (n >= ov - 2 && n <= ov) chance = 'high';
        else if (n >= ov - 5 && n <= ov + 1) chance = 'medium';
      }
      map.set(n, {
        phase,
        predicted: c.predicted,
        late: lateFrom !== undefined && n >= lateFrom,
        cycleDay: n - c.start + 1,
        chance,
        cycleStart: c.start,
      });
    }
  };

  const periodEndFor = (s: number, next: number) =>
    Math.min(ends.get(s) ?? s + avgPeriod - 1, next - 1);

  // прошлые (завершённые) циклы
  for (let i = 0; i + 1 < starts.length; i++) {
    const s = starts[i];
    const next = starts[i + 1];
    addCycle({
      start: s,
      next,
      periodEnd: periodEndFor(s, next),
      ovulation: next - LUTEAL,
      pmsStart: next - 5,
      predicted: false,
      current: false,
    });
  }

  // текущий цикл
  const last = starts[starts.length - 1];
  const expected = last + avgCycle;
  let next = expected;
  let delay = 0;
  let stale = false;
  if (expected < today) {
    const late = today - expected;
    if (late <= MAX_DELAY_SHIFT) {
      delay = late;
      next = today;
    } else {
      stale = true;
    }
  }
  addCycle(
    {
      start: last,
      next,
      periodEnd: periodEndFor(last, next),
      ovulation: expected - LUTEAL,
      pmsStart: expected - 5,
      predicted: false,
      current: !stale,
    },
    delay > 0 ? expected : undefined,
  );

  // будущие циклы — прогноз примерно на год вперёд
  let s = next;
  const horizon = Math.max(today, s) + 400;
  while (s < horizon) {
    const n2 = s + avgCycle;
    addCycle({
      start: s,
      next: n2,
      periodEnd: s + avgPeriod - 1,
      ovulation: n2 - LUTEAL,
      pmsStart: n2 - 5,
      predicted: true,
      current: stale && s <= today && today < n2,
    });
    s = n2;
  }

  const upcoming = cycles.find((c) => c.predicted && c.start >= today);
  const ovs = cycles.map((c) => c.ovulation).filter((o) => o >= today);

  return {
    ...empty,
    hasData: true,
    cycles,
    lastStart: last,
    nextPeriod: upcoming ? upcoming.start : null,
    nextOvulation: ovs.length ? Math.min(...ovs) : null,
    delay,
    stale,
    day: (n: number) => map.get(n) ?? null,
  };
}

export function currentCycle(a: Analysis, today: number): Cycle | null {
  // при задержке показываем текущий (затянувшийся) цикл, а не следующий прогнозный
  if (a.delay > 0) {
    const c = a.cycles.find((x) => x.current && !x.predicted);
    if (c) return { ...c, next: today + 1 };
  }
  return a.cycles.find((c) => c.start <= today && today < c.next) ?? null;
}

export interface Status {
  phase: Phase | 'nodata';
  title: string;
  sub: string;
}

export function status(a: Analysis, today: number): Status {
  if (!a.hasData) {
    return { phase: 'nodata', title: 'Нет данных', sub: 'Отметь начало последних месячных' };
  }
  const info = a.day(today);
  if (!info) return { phase: 'nodata', title: 'Нет данных', sub: 'Отметь начало месячных' };

  const toPeriod = a.nextPeriod !== null ? a.nextPeriod - today : null;
  const toOv = a.nextOvulation !== null ? a.nextOvulation - today : null;
  const periodWhen = toPeriod !== null ? `месячные ${rel(toPeriod)}` : '';
  const ovWhen = toOv !== null ? `овуляция ${rel(toOv)}` : '';

  if (a.delay > 0) {
    return {
      phase: 'pms',
      title: `Задержка ${days(a.delay)}`,
      sub: 'Месячные ожидаются в любой день',
    };
  }

  switch (info.phase) {
    case 'period':
      if (info.predicted) {
        return {
          phase: 'period',
          title: info.cycleDay === 1 ? 'Месячные ожидаются сегодня' : `Месячные (прогноз), день ${info.cycleDay}`,
          sub: 'Отметь, когда начнутся — прогноз станет точнее',
        };
      }
      return { phase: 'period', title: `Месячные, день ${info.cycleDay}`, sub: ovWhen };
    case 'ovulation':
      return { phase: 'ovulation', title: 'Овуляция сегодня', sub: 'Пик фертильности' };
    case 'fertile':
      return {
        phase: 'fertile',
        title: 'Фертильное окно',
        sub: toOv !== null && a.nextOvulation! <= today + 6 ? ovWhen : 'Высокий шанс зачатия',
      };
    case 'pms':
      return { phase: 'pms', title: 'ПМС', sub: periodWhen };
    default: {
      const beforeOv = toOv !== null && toOv < (toPeriod ?? Infinity);
      return {
        phase: 'none',
        title: `День цикла ${info.cycleDay}`,
        sub: beforeOv ? ovWhen : periodWhen,
      };
    }
  }
}

export const PHASE_LABEL: Record<Phase, string> = {
  period: 'Месячные',
  ovulation: 'Овуляция',
  fertile: 'Фертильное окно',
  pms: 'ПМС',
  none: 'Обычный день',
};

export const CHANCE_LABEL: Record<Chance, string> = {
  high: 'высокий',
  medium: 'средний',
  low: 'низкий',
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  none: '—',
  low: 'низкая',
  medium: 'средняя',
  high: 'высокая',
};

export interface WeekEvent {
  day: number;
  womanId: string;
  kind: 'period' | 'ovulation' | 'fertile' | 'pms';
  predicted: boolean;
}

/** Ключевые события на ближайшие `span` дней */
export function upcomingEvents(a: Analysis, womanId: string, today: number, span = 7): WeekEvent[] {
  const out: WeekEvent[] = [];
  if (!a.hasData) return out;
  for (let n = today; n < today + span; n++) {
    const d = a.day(n);
    if (!d) continue;
    const p = a.day(n - 1);
    const newCycle = d.cycleStart === n;
    if (d.phase === 'period') {
      if (newCycle) out.push({ day: n, womanId, kind: 'period', predicted: d.predicted });
    } else if (d.phase === 'ovulation') {
      out.push({ day: n, womanId, kind: 'ovulation', predicted: true });
    } else if (d.phase === 'fertile' && p?.phase !== 'fertile' && p?.phase !== 'ovulation') {
      out.push({ day: n, womanId, kind: 'fertile', predicted: true });
    } else if (d.phase === 'pms' && p?.phase !== 'pms' && !d.late) {
      out.push({ day: n, womanId, kind: 'pms', predicted: true });
    }
  }
  return out;
}
