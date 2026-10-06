'use client';

import { useState } from 'react';
import type { Analysis } from '@/lib/cycle';
import { MONTHS, WD_SHORT, nFromYmd, weekday, ymd } from '@/lib/dates';

export function dayClass(a: Analysis, n: number) {
  const d = a.day(n);
  if (!d) return '';
  const c = [`ph-${d.phase}`];
  if (d.phase === 'period' && d.predicted) c.push('pred');
  if (d.late) c.push('late');
  return c.join(' ');
}

export default function MonthCalendar({
  analysis,
  intimacy,
  today,
  selected,
  onPick,
}: {
  analysis: Analysis;
  intimacy: Set<number>;
  today: number;
  selected?: number | null;
  onPick: (n: number) => void;
}) {
  const t = ymd(today);
  const [ym, setYm] = useState({ y: t.y, m: t.m });

  const first = nFromYmd(ym.y, ym.m, 1);
  const lastDay = nFromYmd(ym.y, ym.m + 1, 0);
  const gridStart = first - weekday(first);
  const gridEnd = lastDay + (6 - weekday(lastDay));
  const cells: number[] = [];
  for (let n = gridStart; n <= gridEnd; n++) cells.push(n);

  const shift = (k: number) => {
    const d = new Date(Date.UTC(ym.y, ym.m + k, 1));
    setYm({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };
  const isCurrent = ym.y === t.y && ym.m === t.m;

  return (
    <div className="cal">
      <div className="cal-head">
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Предыдущий месяц">
          ‹
        </button>
        <button className="cal-title" onClick={() => setYm({ y: t.y, m: t.m })} disabled={isCurrent}>
          {MONTHS[ym.m]} {ym.y !== t.y ? ym.y : ''}
          {!isCurrent && <span className="cal-today-hint">к сегодня</span>}
        </button>
        <button className="icon-btn" onClick={() => shift(1)} aria-label="Следующий месяц">
          ›
        </button>
      </div>
      <div className="cal-grid">
        {WD_SHORT.map((w) => (
          <div key={w} className="cal-wd">
            {w}
          </div>
        ))}
        {cells.map((n) => {
          const inMonth = ymd(n).m === ym.m;
          const cls = [
            'cal-cell',
            dayClass(analysis, n),
            inMonth ? '' : 'out',
            n === today ? 'today' : '',
            n === selected ? 'sel' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button key={n} className={cls} onClick={() => onPick(n)}>
              <span className="num">{ymd(n).d}</span>
              {intimacy.has(n) && <span className="heart">♥</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Legend() {
  return (
    <div className="legend">
      <span>
        <i className="lg ph-period" /> Месячные
      </span>
      <span>
        <i className="lg ph-period pred" /> Прогноз
      </span>
      <span>
        <i className="lg ph-fertile" /> Фертильное окно
      </span>
      <span>
        <i className="lg ph-ovulation" /> Овуляция
      </span>
      <span>
        <i className="lg ph-pms" /> ПМС
      </span>
      <span>
        <i className="lg heart-lg">♥</i> Близость
      </span>
    </div>
  );
}
