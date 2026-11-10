import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analysis, km, pct, stateWord, vedomost } from '../src/report.js';
import { defaultData, unitData } from './fixture.mjs';

const hose = (kind, n, extra = {}) => ({ id: `${kind}-${n}`, kind, n: String(n), len: 20, status: 'calc', marks: [], events: [], ...extra });
const t = (date, ok, then = '') => ({ id: `${date}${ok}${then}`, type: 'test', date, ok, then });

test('километры и проценты как в образцах', () => {
  assert.equal(km(440), '0,44');
  assert.equal(km(1360), '1,36');
  assert.equal(km(56), '0,056');
  assert.equal(km(0), '0');
  assert.equal(pct(19, 84), 23);
  assert.equal(pct(5, 0), 0);
  assert.equal(stateWord(22), 'неудовлетворительном');
});

test('ведомость: норма ×2, учебные отдельно, ремонт и списание с начала года', () => {
  const data = unitData();
  data.hoses = [
    hose('n51', 1), hose('n51', 2, { marks: ['training'] }),
    hose('n51', 3, { status: 'repair', events: [{ id: 'r', type: 'repair', date: '2026-04-10' }] }),
    hose('n51', 4, { status: 'wait' }),
    hose('n51', 5, { status: 'off', offDate: '2025-10-20' }),
    hose('n77', 6, { status: 'off', offDate: '2026-04-28' }),
    hose('nv77', 1, { len: 4 }), hose('vs125', 1, { len: 4 }),
  ];
  const v = vedomost(data, '2026');
  const r51 = v.pressure.find(r => r.d === 51);
  assert.deepEqual({ ...r51 }, { group: 'p51', d: 51, norm: 72, have: 3, train: 1, repair: 1, off: 1, pct: 4, need: 69 });
  assert.equal(v.pressure.find(r => r.d === 77).off, 1, 'списан в этом году');
  assert.equal(v.suction.find(r => r.d === 77).norm, 14, 'всасывающие — 100%');
  assert.equal(v.suction.find(r => r.d === 125).have, 1);
});

test('анализ: итоги сезонки в штуках и км, обеспеченность', () => {
  const data = unitData();
  data.hoses = [
    hose('n51', 1, { events: [t('2026-04-05', true)] }),
    hose('n51', 2, { status: 'repair', events: [t('2026-04-05', false, 'repair')] }),
    hose('n51', 3, { status: 'off', offDate: '2026-04-28', events: [t('2026-04-05', false, 'wait')] }),
    hose('n51', 4, { status: 'reserve' }),
    hose('n150', 17, { len: 100, events: [t('2026-04-06', true)] }),
  ];
  const a = analysis(data, '2026-04');
  const p51 = a.pressure.find(r => r.d === 51);
  assert.deepEqual(p51.total, { n: 4, km: '0,08' });
  assert.deepEqual(p51.tested, { n: 3, km: '0,06' });
  assert.deepEqual([p51.ok.n, p51.repair.n, p51.off.n, p51.store.n], [1, 1, 1, 1]);
  assert.deepEqual(a.pressure.find(r => r.d === 150).total, { n: 1, km: '0,1' });
  const s51 = a.supplyPressure.find(r => r.d === 51);
  assert.equal(s51.norm, '1,44', 'норма 36 × 2 × 20 м');
  assert.equal(s51.have, '0,06', 'в запасе: годный, в ремонте и резерв; списанный — нет');
  assert.equal(a.start, '2026-04-01');
});

test('сведения и Форма-12: группы, кратность, техника', async () => {
  const { svodValues, f12Values } = await import('../src/report.js');
  const data = unitData();
  data.hoses = [hose('n51', 1), hose('n51', 2, { status: 'reserve' }), hose('n51', 3, { marks: ['training'] }), hose('n150', 17, { len: 100 }), hose('vs125', 1, { len: 4 })];
  const s = svodValues(data, '2026');
  assert.equal(s.norm.p51, 72);
  assert.equal(s.have.p51, 2, 'резерв во «всего», учебный — нет');
  assert.equal(s.train.p51, 1);
  assert.equal(s.store.p51, 0);
  assert.equal(s.norm.s125, 16);
  const f = f12Values(data);
  assert.deepEqual(f.rows.p51, { d: 51, norm: 108, normKm: 2.16, have: 2, haveKm: 0.04, pct: 2, need: 106, needKm: 2.12 });
  assert.equal(f.rows.p150.haveKm, 0.1);
  assert.equal(f.rows.s125.norm, 32);
  assert.deepEqual(f.vehicles.ПАНРК, { norm: 1, have: 1, ok: 1, bad: 0 });
  assert.equal(f.vehicles['ИТОГО:'].norm, 1);
});
