// Рукава: виды и бирки, нахождение, подсчёты, нормы, загрузка из реестра.
// Модуль без обращений к окну — его проверяют тесты.

export const uid = () => globalThis.crypto.randomUUID();

// Виды рукавов как на бирках («Бирки общий»): цвет бирки, надпись, длина по умолчанию.
export const DEFAULT_KINDS = [
  { id: 'n51', type: 'Напорный', d: 51, tag: 'Ø 51', len: 20, color: '#FFFFFF', colorName: 'белая' },
  { id: 'n66', type: 'Напорный', d: 66, tag: 'Ø 66', len: 20, color: '#92D050', colorName: 'зелёная' },
  { id: 'n77', type: 'Напорный', d: 77, tag: 'Ø 77', len: 20, color: '#FFFF00', colorName: 'жёлтая' },
  { id: 'n150', type: 'Напорный', d: 150, tag: 'Ø 150', len: 20, color: '#00B0F0', colorName: 'голубая', lenInName: true },
  { id: 'n38', type: 'Напорный', d: 38, tag: 'Ø 38', len: 20, color: '#D9D9D9', colorName: 'серая' },
  { id: 'nv77', type: 'Напорно-всасывающий', d: 77, tag: 'Н.В. Ø 77', len: 4, color: '#FF0000', colorName: 'красная' },
  { id: 'nv125', type: 'Напорно-всасывающий', d: 125, tag: 'Н.В. Ø 125', len: 4, color: '#FFC000', colorName: 'оранжевая' },
  { id: 'vs125', type: 'Всасывающий', d: 125, tag: 'ВС Ø 125', len: 4, color: '#FFC000', colorName: 'оранжевая' },
];

const TYPE_PREFIX = { 'Напорный': 'n', 'Напорно-всасывающий': 'nv', 'Всасывающий': 'vs' };
const TAG_PREFIX = { 'Напорный': '', 'Напорно-всасывающий': 'Н.В. ', 'Всасывающий': 'ВС ' };

// Нахождение рукава. «На списание» — не выдержал испытание и ждёт дефектовочного акта.
export const STATUSES = [
  ['calc', 'В расчёте', 'green'],
  ['reserve', 'Резерв', 'blue'],
  ['repair', 'Ремонт', 'amber'],
  ['wait', 'На списание', 'red'],
  ['off', 'Списан', 'gray'],
];
export const STATUS = Object.fromEntries(STATUSES.map(([id, label, color]) => [id, { label, color }]));

// Отметки у рукава — не нахождение, а признак: учебный, неучтённый и т. п. Список меняется в «Настройках».
// apart — рукав есть в части (в общем счёте), но не идёт в запас к технике: не считается в некомплекте и в сведениях.
export const DEFAULT_MARKS = [
  { id: 'training', name: 'Учебный', apart: true },
  { id: 'unacc', name: 'Неучтён' },
  { id: 'cabinet', name: 'Пожарный шкаф', apart: true },
  { id: 'china', name: 'Китайский' },
];
export const markNames = (marks, h) => (h.marks ?? []).map(id => marks.find(m => m.id === id)?.name).filter(Boolean);
export const isApart = (marks, h) => (h.marks ?? []).some(id => marks.find(m => m.id === id)?.apart);
// В запасе к технике: не списан и без отметки «не идёт в запас».
export const inStock = (data, h) => isLive(h) && !isApart(data.marks ?? [], h);

// Техника и норма положенности для примеров знакомства. В новой базе техники нет — её вносят в «Нормах».
export const DEMO_VEHICLES = [
  { name: 'АЦ', count: 2, norm: { 51: 8, 66: 4, 77: 10 } },
  { name: 'АЛ', count: 1, norm: { 66: 3 } },
  { name: 'АПП', count: 1, norm: { 51: 4, 66: 4 } },
  { name: 'ПАНРК', count: 1, norm: { 51: 4, 77: 4, 150: 20 } },
];
export const NORM_DIAMS = [51, 66, 77, 150];
// Всасывающие и напорно-всасывающие: норма 100% по видам (в новой базе — ноль, вносится в «Нормах»).
export const DEFAULT_SUCTION_NORM = { nv77: 0, vs125: 0 };
export const DEMO_SUCTION_NORM = { nv77: 6, vs125: 8 };

export const isLive = h => h.status !== 'off';
// «Неучтён» — рукав есть в части, но не числится: по учёту его нет.
export const isUnaccounted = h => (h.marks ?? []).includes('unacc');

export function kindById(kinds, id) {
  return kinds.find(k => k.id === id) ?? { id, type: 'Напорный', d: 0, tag: id, len: 20, color: '#D9D9D9', colorName: 'серая' };
}

// Надпись на бирке: «Ø 150-20 №31», «Н.В. Ø 77 №1».
export function tagLabel(kinds, h) {
  const k = kindById(kinds, h.kind);
  return k.lenInName ? `${k.tag}-${h.len}` : k.tag;
}
export const hoseName = (kinds, h) => `${tagLabel(kinds, h)} №${h.n}`;

// Номер в реестре: «51/1», «150-20/31».
export function regNumber(kinds, h) {
  const k = kindById(kinds, h.kind);
  return `${k.d}${k.lenInName ? `-${h.len}` : ''}/${h.n}`;
}

// Один и тот же номер у разных видов (Ø 77 №1 и Н.В. Ø 77 №1) и у Ø 150 разной длины — разные рукава.
export function hoseKey(kinds, h) {
  const k = kindById(kinds, h.kind);
  return `${h.kind}|${k.lenInName ? h.len : ''}|${String(h.n).trim()}`;
}

export function typeFromText(text) {
  const t = String(text ?? '').toLowerCase();
  if (t.includes('напорно-всасыв')) return 'Напорно-всасывающий';
  if (t.includes('всасыв')) return 'Всасывающий';
  return 'Напорный';
}

// «51/1», «150-20/31», «150-50\8» → диаметр, длина, номер.
export function parseReg(reg) {
  const m = String(reg ?? '').trim().match(/^(\d{2,3})(?:\s*-\s*(\d{1,3}))?\s*[/\\]\s*(\d+[а-яa-z]?)$/i);
  if (!m) return null;
  return { d: Number(m[1]), len: m[2] ? Number(m[2]) : null, n: m[3] };
}

// Находит вид по типу и диаметру; если такого нет — добавляет новый (серая бирка).
export function ensureKind(kinds, type, d) {
  const id = `${TYPE_PREFIX[type] ?? 'n'}${d}`;
  let k = kinds.find(x => x.id === id);
  if (!k) {
    k = { id, type, d, tag: `${TAG_PREFIX[type] ?? ''}Ø ${d}`, len: type === 'Напорный' ? 20 : 4, color: '#D9D9D9', colorName: 'серая', lenInName: d === 150 };
    kinds.push(k);
  }
  return k;
}

const REG_STATUS = { 'исправно': 'calc', 'склад': 'reserve', 'ремонт': 'repair', 'неисправно': 'repair', 'под списание': 'wait', 'списано': 'off' };

// Загрузка строк реестра в список рукавов. Ничего не удаляет: новые добавляет,
// у уже известных заполняет пустые поля и дописывает испытание, если его ещё нет.
const squash = s => String(s ?? '').replace(/\s+/g, '').toLowerCase();

export function mergeRegistry(data, rows, today) {
  const report = { added: 0, updated: 0, duplicates: [], unitTypos: [], bad: [] };
  const byKey = new Map(data.hoses.map(h => [hoseKey(data.kinds, h), h]));
  const seen = new Set();
  for (const r of rows) {
    const p = parseReg(r.reg);
    if (!p) { report.bad.push(`строка ${r.line}: «${r.reg}»`); continue; }
    const type = typeFromText(r.type);
    const kind = ensureKind(data.kinds, type, p.d);
    const draft = { kind: kind.id, n: p.n, len: p.len ?? kind.len };
    const key = hoseKey(data.kinds, draft);
    if (seen.has(key)) { report.duplicates.push(`${hoseName(data.kinds, draft)} (строка ${r.line})`); continue; }
    seen.add(key);
    if (r.unit && data.settings.unitShort && squash(r.unit) !== squash(data.settings.unitShort)) report.unitTypos.push(`${hoseName(data.kinds, draft)}: «${r.unit}» (строка ${r.line})`);

    let h = byKey.get(key);
    const isNew = !h;
    if (isNew) {
      h = { id: uid(), ...draft, model: '', maker: '', year: null, inv: '', setDate: '', lastTest: '', lastTestOk: true,
        status: REG_STATUS[r.status.toLowerCase()] ?? 'calc', marks: [], note: '', events: [] };
      h.events.push({ id: uid(), date: today, type: 'import', text: `Загружен из реестра (${r.reg})` });
      data.hoses.push(h);
      byKey.set(key, h);
      report.added++;
    }
    let changed = false;
    for (const [field, value] of [['model', r.model], ['maker', r.maker], ['year', r.year], ['setDate', r.setDate]]) {
      if (value && !h[field]) { h[field] = value; changed = true; }
    }
    if (r.testDate && !h.events.some(e => e.type === 'test' && e.date === r.testDate)) {
      const ok = !/не/i.test(r.testStatus);
      h.events.push({ id: uid(), date: r.testDate, type: 'test', ok, reason: 'Сезонное ТО', text: ok ? 'Испытание пройдено (из реестра)' : 'Испытание не пройдено (из реестра)' });
      if (!h.lastTest || r.testDate > h.lastTest) { h.lastTest = r.testDate; h.lastTestOk = ok; }
      changed = true;
    }
    if (!isNew && changed) report.updated++;
  }
  return report;
}

// --- Подсчёты ---

// Сколько рукавов каждого вида в части (без списанных; ремонт идёт в общий счёт).
export function countByKind(hoses) {
  const c = {};
  for (const h of hoses) if (isLive(h)) c[h.kind] = (c[h.kind] ?? 0) + 1;
  return c;
}

// Напорные по диаметру в запасе к технике — для норм и сведений.
export function pressureByDiam(data) {
  const c = {};
  for (const h of data.hoses) {
    if (!inStock(data, h)) continue;
    const k = kindById(data.kinds, h.kind);
    if (k.type === 'Напорный') c[k.d] = (c[k.d] ?? 0) + 1;
  }
  return c;
}

export function normByDiam(vehicles, d) {
  return vehicles.reduce((s, v) => s + (Number(v.count) || 0) * (Number(v.norm?.[d]) || 0), 0);
}

// Некомплект: положено (норма × кратность) минус в наличии. Отрицательное — излишек.
export function shortage(data, d, mult) {
  return normByDiam(data.vehicles, d) * mult - (pressureByDiam(data)[d] ?? 0);
}

// Испытан ли рукав в текущую сезонку (апрель или октябрь этого года).
export function seasonOf(iso) {
  const [y, m] = String(iso ?? '').split('-').map(Number);
  if (!y) return null;
  if (m >= 4 && m <= 9) return `${y}-04`;
  return m >= 10 ? `${y}-10` : `${y - 1}-10`;
}
export function currentSeason(todayIso) {
  return seasonOf(todayIso);
}
export const testedInSeason = (h, season) => !!h.lastTest && seasonOf(h.lastTest) === season;
export function seasonLabel(season) {
  const [y, m] = season.split('-');
  return `${m === '04' ? 'Апрель' : 'Октябрь'} ${y}`;
}

// --- Выгрузка в реестр ПТВиО (шаблон импорта) ---

// Статусы из справочника шаблона: Исправно, Неисправно, Под списание, Склад, Ремонт.
const TO_REG_STATUS = { calc: 'Исправно', reserve: 'Склад', repair: 'Ремонт', wait: 'Под списание', off: 'Под списание' };
export const REGISTRY_HEADERS = ['Категория*', 'Тип*', 'Вид защитного костюма', 'Модель*', 'Инвентарный номер*', 'Заводской номер', 'Год выпуска*',
  'Изготовитель', 'Статус*', 'Наименование территориального пожарно-спасательного гарнизона*', 'Наименование местного пожарно-спасательного гарнизона*',
  'Подразделение*', 'Дата закрепления*', 'Дата открепления', 'Номер акта закрепления', 'Дата испытания', 'Статус испытания', 'Номер акта испытания', 'Примечание'];

// Строки для шаблона: ключ — заголовок без «*», даты — ГГГГ-ММ-ДД. Без списанных, если не попросили.
export function registryRows(data, { withOff = false } = {}) {
  const order = id => data.kinds.findIndex(k => k.id === id);
  return data.hoses.filter(h => withOff || isLive(h))
    .sort((a, b) => order(a.kind) - order(b.kind) || a.len - b.len || String(a.n).localeCompare(String(b.n), 'ru', { numeric: true }))
    .map(h => {
      const k = kindById(data.kinds, h.kind);
      return {
        'Категория': 'Рукав',
        'Тип': `${k.type} пожарный рукав`,
        'Модель': h.model ?? '',
        'Инвентарный номер': regNumber(data.kinds, h),
        'Год выпуска': h.year ?? '',
        'Изготовитель': h.maker ?? '',
        'Статус': TO_REG_STATUS[h.status] ?? 'Исправно',
        'Наименование территориального пожарно-спасательного гарнизона': data.settings.tpsg,
        'Наименование местного пожарно-спасательного гарнизона': data.settings.mpsg,
        'Подразделение': data.settings.unitShort,
        'Дата закрепления': h.setDate ?? '',
        'Дата открепления': h.status === 'off' ? h.offDate ?? '' : '',
        'Дата испытания': h.lastTest ?? '',
        'Статус испытания': h.lastTest ? (h.lastTestOk ? 'Пройдено' : 'Не пройдено') : '',
        'Примечание': h.note ?? '',
      };
    });
}
