// Сезонка и дефектовочные акты: подсчёты по сезону, состав акта, списание и отмена.
// Модуль без обращений к окну — его проверяют тесты.

import { hoseName, isLive, kindById, seasonOf, uid } from './hoses.js';

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

// Сезон «2026-10» длится с 1 октября по 31 марта, «2026-04» — с 1 апреля по 30 сентября.
export function seasonRange(season) {
  const [y, m] = season.split('-').map(Number);
  return m === 4 ? [`${y}-04-01`, `${y}-09-30`] : [`${y}-10-01`, `${y + 1}-03-31`];
}

// Испытание рукава в этот сезон — последнее по дате.
export function seasonTest(h, season) {
  return h.events.filter(e => e.type === 'test' && seasonOf(e.date) === season)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).at(-1) ?? null;
}

// Сезоны, в которые были испытания, и текущий — новые сверху.
export function knownSeasons(data, today) {
  const set = new Set([seasonOf(today)]);
  for (const h of data.hoses) for (const e of h.events) if (e.type === 'test' && e.date) set.add(seasonOf(e.date));
  return [...set].filter(Boolean).sort().reverse();
}

// Кто подлежит испытанию в сезон: был в части в начале сезона (или поставлен в нём) и не списан до него.
export function seasonPool(data, season) {
  const [start, end] = seasonRange(season);
  return data.hoses.filter(h => (!h.setDate || h.setDate <= end)
    && (h.status !== 'off' || (h.offDate ?? '') >= start || !!seasonTest(h, season)));
}

// Итог сезона по видам рукавов: подлежит, испытано, годны, в ремонт, на списание, осталось.
export function seasonStats(data, season) {
  const pool = seasonPool(data, season);
  const empty = () => ({ total: 0, tested: 0, ok: 0, repair: 0, off: 0, left: 0 });
  const byKind = {};
  const total = empty();
  const untested = [];
  for (const h of pool) {
    const row = byKind[h.kind] ??= empty();
    const t = seasonTest(h, season);
    for (const r of [row, total]) {
      r.total++;
      if (!t) r.left++;
      else {
        r.tested++;
        if (t.ok) r.ok++;
        else if ((t.then ?? (h.status === 'repair' ? 'repair' : 'wait')) === 'repair') r.repair++;
        else r.off++;
      }
    }
    if (!t && isLive(h)) untested.push(h);
  }
  return { pool, byKind, total, untested };
}

// --- Дефектовочный акт ---

// «D-77 мм №31, 82, 78»; у не напорных — вид впереди, у Ø 150 — длина.
export function actList(rows) {
  const groups = new Map();
  for (const r of rows) {
    const type = r.type === 'Напорный' ? '' : `${r.type.toLowerCase()} `;
    const len = r.lenInName ? ` (${r.len} м)` : '';
    const key = `${type}D-${r.d} мм${len}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r.n);
  }
  return [...groups].map(([k, ns]) => `${k} №${ns.join(', ')}`).join('; ');
}

// Снимок рукава в акте: акт хранится всегда и не должен меняться, если рукав потом исправят.
export function actRow(kinds, h) {
  const k = kindById(kinds, h.kind);
  return { id: h.id, name: hoseName(kinds, h), kind: h.kind, type: k.type, d: k.d, n: h.n, len: h.len, lenInName: !!k.lenInName,
    inv: h.inv ?? '', model: h.model ?? '', year: h.year ?? null, damage: h.damage ?? '' };
}

export const defaultDamage = rows => [...new Set(rows.map(r => r.damage).filter(Boolean))].join(', ');

// «Иванов И.И.» → «И.И. Иванов» — для строки подписи.
export function signName(name) {
  const m = String(name ?? '').trim().match(/^(\S+)\s+((?:[А-ЯЁA-Z]\.\s?){1,2})$/u);
  return m ? `${m[2].replace(/\s/g, '')} ${m[1]}` : String(name ?? '').trim();
}

export const COMMISSION_ROLES = [['chair', 'Председатель комиссии'], ['m1', 'Член комиссии'], ['m2', 'Член комиссии'], ['sec', 'Секретарь комиссии']];

// Постоянная комиссия из «Людей для документов»; null — если кто-то не выбран.
export function commissionPeople(data) {
  const c = data.settings.commission ?? {};
  const list = COMMISSION_ROLES.map(([role]) => data.people.find(p => p.id === c[role]));
  return list.every(Boolean) ? Object.fromEntries(COMMISSION_ROLES.map(([role], i) => [role, { ...list[i] }])) : null;
}

// Комиссия, вписанная в акте вручную: пустые строки не считаются, если никого нет — null.
export function cleanCommission(commission) {
  const out = {};
  for (const [role] of COMMISSION_ROLES) {
    const p = commission?.[role];
    const person = { rank: (p?.rank ?? '').trim(), name: (p?.name ?? '').trim(), post: (p?.post ?? '').trim() };
    if (person.rank || person.name || person.post) out[role] = person;
  }
  return Object.keys(out).length ? out : null;
}

// Составление акта: рукава получают «Списан» со ссылкой на акт.
export function makeAct(data, hoses, { damage, testKind, commission, org, place }, today) {
  const rows = hoses.map(h => actRow(data.kinds, h));
  const act = { id: uid(), created: today, season: seasonOf(today), rows, damage, testKind, commission: commission ?? null,
    org: org ?? data.settings.actOrg ?? '', place: place ?? data.settings.place ?? '',
    status: 'made', handed: '', cancelled: '', cancelReason: '' };
  for (const h of hoses) {
    h.status = 'off';
    h.offDate = today;
    h.actId = act.id;
    h.events.push({ id: uid(), date: today, type: 'writeoff', actId: act.id, text: `Списан по дефектовочному акту от ${dmyText(today)}` });
  }
  data.acts.unshift(act);
  return act;
}

// Отмена акта: акт остаётся в архиве с отметкой, рукава возвращаются «на списание».
export function cancelAct(data, act, reason, today) {
  act.status = 'cancelled';
  act.cancelled = today;
  act.cancelReason = reason;
  const back = [];
  for (const r of act.rows) {
    const h = data.hoses.find(x => x.id === r.id);
    if (!h || h.actId !== act.id) continue;
    h.status = 'wait';
    delete h.offDate;
    delete h.actId;
    h.events.push({ id: uid(), date: today, type: 'move', text: `Акт от ${dmyText(act.created)} отменён — снова на списание${reason ? `: ${reason}` : ''}` });
    back.push(h);
  }
  return back;
}

export const dmyText = iso => (/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') ? iso.split('-').reverse().join('.') : '');
export const longDate = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_GEN[m - 1]} ${y}`;
};
