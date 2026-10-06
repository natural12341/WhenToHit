'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Sheet from './Sheet';
import NumInput from './NumInput';
import { newId, useStore } from '@/lib/store';
import { COLORS, type Woman } from '@/lib/types';
import { fromN, todayN } from '@/lib/dates';

export default function AddWomanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, update } = useStore();
  const router = useRouter();
  const [name, setName] = useState('');
  const [last, setLast] = useState('');
  const [cycle, setCycle] = useState(28);
  const [period, setPeriod] = useState(5);
  const usedColors = new Set(data.women.map((w) => w.color));
  const defaultColor = COLORS.find((c) => !usedColors.has(c)) ?? COLORS[data.women.length % COLORS.length];
  const [color, setColor] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const w: Woman = {
      id: newId(),
      name: name.trim(),
      color: color ?? defaultColor,
      periods: last ? [{ start: last }] : [],
      intimacy: [],
      notes: { likes: '', concerns: '', other: '' },
      cycleLength: cycle,
      periodLength: period,
      createdAt: new Date().toISOString(),
    };
    update((d) => ({ ...d, women: [...d.women, w] }));
    setName('');
    setLast('');
    setColor(null);
    onClose();
    router.push(`/w/${w.id}`);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Новая карточка">
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Имя</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, Аня"
            autoFocus
            maxLength={40}
          />
        </label>
        <div className="field">
          <span>Цвет</span>
          <div className="swatches">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`swatch ${(color ?? defaultColor) === c ? 'on' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <label className="field">
          <span>Начало последних месячных (если знаешь)</span>
          <input
            className="input"
            type="date"
            value={last}
            max={fromN(todayN())}
            onChange={(e) => setLast(e.target.value)}
          />
        </label>
        <div className="row2">
          <label className="field">
            <span>Цикл, дней</span>
            <NumInput value={cycle} min={20} max={45} onCommit={setCycle} />
          </label>
          <label className="field">
            <span>Месячные, дней</span>
            <NumInput value={period} min={2} max={10} onCommit={setPeriod} />
          </label>
        </div>
        <p className="hint">
          Не знаешь точно — оставь 28 и 5. Прошлые месячные можно отметить потом в календаре: чем больше
          отметок, тем точнее прогноз.
        </p>
        <button className="btn primary wide" type="submit" disabled={!name.trim()}>
          Создать
        </button>
      </form>
    </Sheet>
  );
}
