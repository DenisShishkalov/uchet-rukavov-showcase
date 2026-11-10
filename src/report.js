// Цифры для ведомости и анализа: группы по диаметру, штуки и километры, оснащённость.
// Модуль без обращений к окну — его проверяют тесты.

import { seasonPool, seasonRange, seasonTest } from './acts.js';
import { inStock, isLive, kindById, normByDiam } from './hoses.js';

// Строки документов как в образцах: напорные по диаметру, всасывающие и напорно-всасывающие вместе.
export const PRESSURE_ROWS = [51, 66, 77, 150, 38, 25];
export const SUCTION_ROWS = [77, 125, 200];

const isPressure = k => k.type === 'Напорный';
// Группа рукава: «p51» — напорный Ø 51, «s125» — всасывающий или напорно-всасывающий Ø 125.
export const groupOf = (kinds, h) => {
  const k = kindById(kinds, h.kind);
  return `${isPressure(k) ? 'p' : 's'}${k.d}`;
};

// Километры с запятой, без лишних нулей: 0,44 · 1,36 · 0,056.
export const km = metres => String(Math.round(metres) / 1000).replace('.', ',');
export const pct = (have, norm) => (norm ? Math.round((have / norm) * 100) : 0);

function tally(kinds, hoses) {
  const c = {};
  for (const h of hoses) {
    const g = groupOf(kinds, h);
    c[g] ??= { n: 0, m: 0 };
    c[g].n++;
    c[g].m += Number(h.len) || 0;
  }
  return c;
}

// Норма в штуках: напорные — от техники × кратность, всасывающие — сумма норм по видам этого диаметра × кратность.
export function normCount(data, group, mult) {
  const d = Number(group.slice(1));
  if (group[0] === 'p') return normByDiam(data.vehicles, d) * mult;
  return data.kinds.filter(k => !isPressure(k) && k.d === d).reduce((s, k) => s + (Number(data.suctionNorm[k.id]) || 0), 0) * mult;
}

// Длина рукава по умолчанию для группы — чтобы перевести норму в километры.
function defaultLen(data, group) {
  const d = Number(group.slice(1));
  const k = data.kinds.find(x => (group[0] === 'p') === isPressure(x) && x.d === d);
  return k?.len ?? 20;
}

const inYear = (iso, year) => (iso ?? '').startsWith(year);

// Ведомость наличия и состояния на год сезонки.
export function vedomost(data, year) {
  const live = data.hoses.filter(isLive);
  const have = tally(data.kinds, live.filter(h => inStock(data, h)));
  const train = tally(data.kinds, live.filter(h => h.marks.includes('training')));
  const repaired = data.hoses.filter(h => h.events.some(e => inYear(e.date, year)
    && (e.type === 'repair' || (e.type === 'test' && !e.ok && e.then === 'repair'))));
  const repair = tally(data.kinds, repaired);
  const off = tally(data.kinds, data.hoses.filter(h => h.status === 'wait' || (h.status === 'off' && inYear(h.offDate, year))));
  const row = group => {
    const norm = normCount(data, group, group[0] === 'p' ? 2 : 1);
    const n = have[group]?.n ?? 0;
    return { group, d: Number(group.slice(1)), norm, have: n, train: train[group]?.n ?? 0, repair: repair[group]?.n ?? 0,
      off: off[group]?.n ?? 0, pct: pct(n, norm), need: Math.max(norm - n, 0) };
  };
  return { pressure: PRESSURE_ROWS.map(d => row(`p${d}`)), suction: SUCTION_ROWS.map(d => row(`s${d}`)) };
}

// Анализ за полугодие: итоги сезонки в штуках и км, наличие на начало, обеспеченность.
export function analysis(data, season, mult = 2) {
  const pool = seasonPool(data, season);
  const tested = pool.filter(h => seasonTest(h, season));
  const result = (h, want) => {
    const t = seasonTest(h, season);
    if (!t) return false;
    if (want === 'ok') return t.ok;
    const then = t.then ?? (h.status === 'repair' ? 'repair' : 'wait');
    return !t.ok && then === want;
  };
  const cols = {
    total: tally(data.kinds, pool),
    tested: tally(data.kinds, tested),
    ok: tally(data.kinds, tested.filter(h => result(h, 'ok'))),
    repair: tally(data.kinds, tested.filter(h => result(h, 'repair'))),
    store: tally(data.kinds, pool.filter(h => h.status === 'reserve')),
    off: tally(data.kinds, tested.filter(h => result(h, 'wait'))),
  };
  const groups = [...new Set(pool.map(h => groupOf(data.kinds, h)))];
  const line = g => Object.fromEntries(Object.entries(cols).map(([key, c]) => [key, { n: c[g]?.n ?? 0, km: km(c[g]?.m ?? 0) }]));
  const order = (a, b) => Number(a.slice(1)) - Number(b.slice(1));
  const pressure = groups.filter(g => g[0] === 'p').sort(order).map(g => ({ group: g, d: Number(g.slice(1)), ...line(g) }));
  const suction = groups.filter(g => g[0] === 's').sort(order).map(g => ({ group: g, d: Number(g.slice(1)), ...line(g) }));

  // Тот же сезон годом раньше — для сравнения «что в соответствии с аналогичным периодом».
  const [y, m] = season.split('-');
  const prevPool = seasonPool(data, `${Number(y) - 1}-${m}`);
  const prev = Object.fromEntries(Object.entries(tally(data.kinds, prevPool)).map(([g, v]) => [g, v.n]));
  // Сравнивать есть с чем, только если программа вела испытания и в тот сезон.
  const prevKnown = prevPool.some(h => seasonTest(h, `${Number(y) - 1}-${m}`));

  // Обеспеченность в км: в запасе к технике против нормы.
  const stock = tally(data.kinds, data.hoses.filter(h => inStock(data, h)));
  const supply = group => {
    const normKm = (normCount(data, group, mult) * defaultLen(data, group)) / 1000;
    const haveM = stock[group]?.m ?? 0;
    return { group, d: Number(group.slice(1)), norm: km(normKm * 1000), have: km(haveM), pct: pct(haveM / 1000, normKm),
      need: km(Math.max(normKm * 1000 - haveM, 0)), normM: normKm * 1000, haveM };
  };
  const supplyPressure = [51, 66, 77].map(d => supply(`p${d}`));
  const supplySuction = [77, 125].map(d => supply(`s${d}`));
  const totalNorm = supplyPressure.reduce((s, r) => s + r.normM, 0);
  const totalHave = supplyPressure.reduce((s, r) => s + r.haveM, 0);
  const [start, end] = seasonRange(season);
  return { season, start, end, pressure, suction, prev, prevKnown, supplyPressure, supplySuction, totalPct: pct(totalHave, totalNorm) };
}

// Оценка состояния для вывода — по проценту укомплектованности.
export const stateWord = p => (p < 50 ? 'неудовлетворительном' : p < 80 ? 'удовлетворительном' : 'хорошем');

// --- Сведения отряда и Форма-12 ---

// Сведения о количестве и состоянии: те же цифры, что в ведомости, разложенные по группам «p51», «s77»…
// «На хранении» — 0: в файле отряда % оснащённости = (всего + на хранении) / норма, а резерв уже входит во «всего».
export function svodValues(data, year) {
  const v = vedomost(data, year);
  const out = { norm: {}, have: {}, repair: {}, off: {}, train: {}, store: {} };
  for (const r of [...v.pressure, ...v.suction]) {
    for (const key of ['norm', 'have', 'repair', 'off', 'train']) out[key][r.group] = r[key];
    out.store[r.group] = 0;
  }
  return out;
}

// Таблицы 3–4 сведений: порядок столбцов как в файле отряда.
export const EQUIP3 = ['Помещение для хранения — имеется', 'Помещение для хранения — требует ремонта', 'Помещение для обслуживания — имеется',
  'Помещение для обслуживания — требует ремонта', 'Башня для сушки — имеется', 'Башня для сушки — требует ремонта',
  'Стеллажи для хранения рукавов', 'Малобюджетное устройство для сушки'];
export const EQUIP4 = ['Ванна для отмачивания', 'Оборудование для испытания', 'Оборудование для ремонта', 'Вулканизатор',
  'Оборудование для мойки', 'Оборудование для сушки и талькирования', 'Оборудование типа ЛОПР', 'Скатка и перекатка — заводское',
  'Скатка и перекатка — кустарное', 'Навязка головок — заводское', 'Навязка головок — кустарное', 'Примечание'];

// Значения по умолчанию — из «Помещений и оборудования» анализа.
export function defaultEquip(data) {
  const e = name => data.equipment.find(x => x.name.toLowerCase().includes(name)) ?? { have: 0, repair: 0 };
  const [store, service, tower] = [e('хранения'), e('обслуживания'), e('башни')];
  return {
    equip3: [store.have, store.repair, service.have, service.repair, tower.have, tower.repair, 0, 0],
    equip4: [e('ванна').have, e('испытания').have, 0, 0, e('мойки').have, e('талькирования').have, e('лопр').have, e('скатки').have, 0, e('навязки').have, 0, ''],
  };
}

export const F12_VEHICLES = ['ПНС', 'АР', 'АНР', 'ПАНРК', 'НРК'];
const round = (x, n = 3) => Math.round(x * 10 ** n) / 10 ** n;

// Форма-12: положено — напорные ×3, всасывающие ×2; имеется (годных) — все в запасе к технике, как во «всего» сведений.
export function f12Values(data, vehicles) {
  const stock = tally(data.kinds, data.hoses.filter(h => inStock(data, h)));
  const rows = {};
  for (const g of [...PRESSURE_ROWS.slice(0, 4).map(d => `p${d}`), ...SUCTION_ROWS.map(d => `s${d}`)]) {
    const n = normCount(data, g, g[0] === 'p' ? 3 : 2);
    const have = stock[g]?.n ?? 0;
    const normKm = round((n * defaultLen(data, g)) / 1000);
    const haveKm = round((stock[g]?.m ?? 0) / 1000);
    rows[g] = { d: Number(g.slice(1)), norm: n, normKm, have, haveKm, pct: pct(have, n), need: Math.max(n - have, 0), needKm: round(Math.max(normKm - haveKm, 0)) };
  }
  const veh = Object.fromEntries(F12_VEHICLES.map(name => [name, vehicles?.[name] ?? (() => {
    const c = data.vehicles.filter(v => v.name.replace(/\s/g, '').toUpperCase() === name).reduce((s, v) => s + (Number(v.count) || 0), 0);
    return { norm: c, have: c, ok: c, bad: 0 };
  })()]));
  const sum = key => F12_VEHICLES.reduce((s, n) => s + (Number(veh[n][key]) || 0), 0);
  veh['ИТОГО:'] = { norm: sum('norm'), have: sum('have'), ok: sum('ok'), bad: sum('bad') };
  return { rows, vehicles: veh };
}
