import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actList, actRow, cancelAct, commissionPeople, defaultDamage, knownSeasons, makeAct, seasonStats, signName } from '../src/acts.js';
import { defaultData, unitData } from './fixture.mjs';

const hose = (kind, n, extra = {}) => ({ id: `${kind}-${n}`, kind, n: String(n), len: 20, status: 'calc', marks: [], events: [], ...extra });
const test1 = (date, ok, then = '') => ({ id: date + ok, type: 'test', date, ok, then });

test('сезонка: подлежит, испытано, годны, ремонт, списание, осталось', () => {
  const data = unitData();
  data.hoses = [
    hose('n51', 1, { events: [test1('2026-10-05', true)] }),
    hose('n51', 2, { status: 'repair', events: [test1('2026-10-05', false, 'repair')] }),
    hose('n77', 3, { status: 'wait', events: [test1('2026-10-09', false, 'wait')] }),
    hose('n77', 4),
    hose('n77', 5, { status: 'off', offDate: '2026-04-28', events: [test1('2026-04-20', false, 'wait')] }),
    hose('n77', 6, { setDate: '2027-05-01' }),
  ];
  const s = seasonStats(data, '2026-10');
  assert.deepEqual(s.total, { total: 4, tested: 3, ok: 1, repair: 1, off: 1, left: 1 }, 'списанный в апреле не входит, поставленный позже — тоже');
  assert.deepEqual(s.byKind.n77, { total: 2, tested: 1, ok: 0, repair: 0, off: 1, left: 1 });
  assert.deepEqual(s.untested.map(h => h.n), ['4']);
  const apr = seasonStats(data, '2026-04');
  assert.equal(apr.total.off, 1, 'апрельский списанный — в апрельской сезонке');
  assert.deepEqual(knownSeasons(data, '2026-11-03'), ['2026-10', '2026-04']);
});

test('акт: перечень по диаметрам, списание, отмена, архив', () => {
  const data = unitData();
  data.hoses = [
    hose('n77', 31, { status: 'wait', damage: 'свищи' }), hose('n77', 82, { status: 'wait', damage: 'свищи' }),
    hose('n150', 17, { status: 'wait', len: 100, damage: 'порыв' }), hose('nv77', 2, { status: 'wait', len: 4 }),
  ];
  const rows = data.hoses.map(h => actRow(data.kinds, h));
  assert.equal(actList(rows), 'D-77 мм №31, 82; D-150 мм (100 м) №17; напорно-всасывающий D-77 мм №2');
  assert.equal(defaultDamage(rows), 'свищи, порыв');
  const act = makeAct(data, data.hoses.slice(0, 2), { damage: 'свищи', testKind: 'сезонные', commission: null }, '2026-10-30');
  assert.equal(data.acts.length, 1);
  assert.deepEqual(data.hoses.map(h => h.status), ['off', 'off', 'wait', 'wait']);
  assert.equal(data.hoses[0].offDate, '2026-10-30');
  data.hoses[0].n = '310'; // правка рукава не меняет акт
  assert.equal(act.rows[0].n, '31');
  const back = cancelAct(data, act, 'ошибся рукавом', '2026-10-31');
  assert.equal(back.length, 2);
  assert.equal(act.status, 'cancelled');
  assert.equal(data.acts.length, 1, 'отменённый акт остаётся в архиве');
  assert.deepEqual(data.hoses.map(h => h.status), ['wait', 'wait', 'wait', 'wait']);
  assert.equal(data.hoses[0].offDate, undefined);
});

test('комиссия и подпись', () => {
  assert.equal(signName('Иванов И.И.'), 'И.И. Иванов');
  assert.equal(signName('Иванов И. И.'), 'И.И. Иванов');
  assert.equal(signName('Иванов'), 'Иванов');
  const data = unitData();
  assert.equal(commissionPeople(data), null, 'по умолчанию людей нет — пустые строки');
  data.people = ['a', 'b', 'c', 'd'].map(id => ({ id, rank: 'ранг', post: 'должность', name: `Фамилия${id} А.А.` }));
  data.settings.commission = { chair: 'a', m1: 'b', m2: 'c' };
  assert.equal(commissionPeople(data), null, 'не выбран секретарь');
  data.settings.commission.sec = 'd';
  assert.equal(commissionPeople(data).sec.name, 'Фамилияd А.А.');
});
