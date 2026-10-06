// Даты храним строками YYYY-MM-DD, считаем в «номерах дней» (целые числа),
// чтобы не было проблем с часовыми поясами и переходом на летнее время.

const DAY = 86400000;

const pad = (n: number) => String(n).padStart(2, '0');

export function toN(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
}

export function fromN(n: number): string {
  const dt = new Date(n * DAY);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function todayN(): number {
  const t = new Date();
  return Math.round(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / DAY);
}

export function ymd(n: number) {
  const dt = new Date(n * DAY);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() };
}

export function nFromYmd(y: number, m: number, d: number) {
  return Math.round(Date.UTC(y, m, d) / DAY);
}

/** 0 = понедельник … 6 = воскресенье */
export function weekday(n: number): number {
  return (new Date(n * DAY).getUTCDay() + 6) % 7;
}

export const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];
export const WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WD_LONG = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];

export function fmtShort(n: number) {
  const { m, d } = ymd(n);
  return `${d} ${MONTHS_SHORT[m]}`;
}

export function fmtLong(n: number) {
  const { m, d } = ymd(n);
  return `${WD_LONG[weekday(n)]}, ${d} ${MONTHS_GEN[m]}`;
}

export function fmtFull(n: number) {
  const { y, m, d } = ymd(n);
  return `${d} ${MONTHS_GEN[m]} ${y}`;
}

export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export function days(n: number) {
  return `${n} ${plural(n, 'день', 'дня', 'дней')}`;
}

/** «сегодня», «завтра», «через 3 дня», «вчера», «4 дня назад» */
export function rel(diff: number) {
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === 2) return 'послезавтра';
  if (diff === -1) return 'вчера';
  if (diff > 0) return `через ${days(diff)}`;
  return `${days(-diff)} назад`;
}
