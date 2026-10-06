export interface Period {
  start: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD, последний день месячных
}

export interface Notes {
  likes: string;
  concerns: string;
  other: string;
}

export interface Woman {
  id: string;
  name: string;
  color: string;
  periods: Period[];
  intimacy: string[]; // даты YYYY-MM-DD
  notes: Notes;
  cycleLength: number; // длина цикла по умолчанию, пока мало истории
  periodLength: number; // длительность месячных по умолчанию
  createdAt: string;
}

export interface AppData {
  version: 1;
  women: Woman[];
  updatedAt: number;
}

export const EMPTY_DATA: AppData = { version: 1, women: [], updatedAt: 0 };

export const COLORS = [
  '#ff6b8b',
  '#c77dff',
  '#4cc9f0',
  '#f9c74f',
  '#90be6d',
  '#f8961e',
  '#43aa8b',
  '#ef476f',
];
