'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';

export default function Shell({ children }: { children: React.ReactNode }) {
  const { status, mode, saveState, submitPin, pinError } = useStore();
  const [pin, setPin] = useState('');

  if (status === 'loading') {
    return (
      <main className="center">
        <div className="spinner" aria-label="Загрузка" />
      </main>
    );
  }

  if (status === 'pin') {
    return (
      <main className="center">
        <form
          className="pin-card"
          onSubmit={(e) => {
            e.preventDefault();
            submitPin(pin);
          }}
        >
          <div className="logo-dot" />
          <h1>Введите PIN</h1>
          <input
            className="input pin-input"
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
          />
          {pinError && <p className="err">Неверный PIN</p>}
          <button className="btn primary wide" type="submit">
            Открыть
          </button>
        </form>
      </main>
    );
  }

  return (
    <>
      {mode === 'local' && (
        <div className="banner">
          База не подключена — данные хранятся только в этом браузере. Инструкция в README.
        </div>
      )}
      {mode === 'offline' && (
        <div className="banner warn">Нет связи с сервером — показаны сохранённые данные.</div>
      )}
      {saveState === 'error' && (
        <div className="banner warn">Не удалось сохранить в облако. Повторю при следующем изменении.</div>
      )}
      {children}
    </>
  );
}
