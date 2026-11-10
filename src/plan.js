// План-график испытаний и перекатки: рукава каждого вида раскладываются по дням сезонки равномерно.
// Модуль без обращений к окну — его проверяют тесты.

import { isLive, kindById } from './hoses.js';

export const DEFAULT_PLAN = { aprDay: 3, octDay: 4, step: 4, rollOffset: 5, rollStep: 4, chunk: 6 };

const pad = n => String(n).padStart(2, '0');
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// «03.04.26» — как в образце.
export const shortDate = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}`;

// Дни испытаний: с первого числа каждые step дней до конца месяца.
export function testDays(year, month, first, step) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = [];
  for (let d = Math.max(1, first); d <= last; d += Math.max(1, step)) days.push(`${year}-${pad(month)}-${pad(d)}`);
  return days;
}

// Список рукавов для плана: без списанных, по порядку видов и номеров.
export function planHoses(data) {
  const order = id => data.kinds.findIndex(k => k.id === id);
  return data.hoses.filter(isLive).sort((a, b) => order(a.kind) - order(b.kind) || a.len - b.len
    || String(a.n).localeCompare(String(b.n), 'ru', { numeric: true }));
}

// Подписи столбцов «Тип рукава» и «Диаметр рукава»: у Ø 150 длина в диаметре, как на бирке.
const typeOf = (kinds, h) => kindById(kinds, h.kind).type;
const diamOf = (kinds, h) => {
  const k = kindById(kinds, h.kind);
  return k.lenInName ? `D-${k.d}-${h.len}` : `D-${k.d}`;
};

// Один месяц сезонки: испытания (все рукава) и перекатка (только напорные, пачками по chunk номеров).
export function planMonth(data, year, month, opts) {
  const o = { ...DEFAULT_PLAN, ...opts };
  const days = testDays(year, month, month === 4 ? o.aprDay : o.octDay, o.step);
  const hoses = planHoses(data);
  const groups = new Map();
  for (const h of hoses) {
    const key = `${h.kind}|${kindById(data.kinds, h.kind).lenInName ? h.len : ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(h);
  }
  const tests = [];
  for (const list of groups.values()) {
    list.forEach((h, j) => tests.push({ id: h.id, type: typeOf(data.kinds, h), diam: diamOf(data.kinds, h), n: h.n,
      date: days[Math.floor((j * days.length) / list.length)] }));
  }
  const rollDays = days.map((_, i) => addDays(days[0], o.rollOffset + i * o.rollStep));
  const rolls = [];
  for (const list of groups.values()) {
    if (typeOf(data.kinds, list[0]) !== 'Напорный') continue;
    const chunks = [];
    for (let i = 0; i < list.length; i += Math.max(1, o.chunk)) chunks.push(list.slice(i, i + Math.max(1, o.chunk)));
    chunks.forEach((c, i) => rolls.push({ type: 'Напорный', diam: diamOf(data.kinds, c[0]), nums: c.map(h => h.n).join(','),
      date: rollDays[Math.floor((i * rollDays.length) / chunks.length)] }));
  }
  return { month, days, tests, rolls };
}

export function buildPlan(data, year, opts) {
  return { year, months: [planMonth(data, year, 4, opts), planMonth(data, year, 10, opts)] };
}
