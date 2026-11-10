import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, planMonth, shortDate, testDays } from '../src/plan.js';
import { defaultData, unitData } from './fixture.mjs';

const hose = (kind, n, extra = {}) => ({ id: `${kind}-${n}`, kind, n: String(n), len: 20, status: 'calc', marks: [], events: [], ...extra });

test('дни испытаний как в образце: с 3 апреля и с 4 октября каждые 4 дня', () => {
  assert.deepEqual(testDays(2026, 4, 3, 4).map(shortDate), ['03.04.26', '07.04.26', '11.04.26', '15.04.26', '19.04.26', '23.04.26', '27.04.26']);
  assert.equal(testDays(2026, 10, 4, 4).at(-1), '2026-10-28');
});

test('план: каждый вид раскладывается по дням, перекатка — только напорные пачками', () => {
  const data = unitData();
  data.hoses = [
    ...Array.from({ length: 14 }, (_, i) => hose('n51', i + 1)),
    hose('n150', 17, { len: 20 }), hose('n150', 17, { id: 'x', len: 100 }),
    hose('vs125', 1, { len: 4 }), hose('n51', 99, { status: 'off' }),
  ];
  const m = planMonth(data, 2026, 4, {});
  assert.equal(m.tests.length, 17, 'списанный не входит');
  const d51 = m.tests.filter(t => t.diam === 'D-51');
  assert.equal(d51[0].date, '2026-04-03');
  assert.equal(d51.at(-1).date, '2026-04-27');
  assert.deepEqual(m.tests.filter(t => t.diam.startsWith('D-150')).map(t => t.diam), ['D-150-20', 'D-150-100']);
  assert.equal(m.rolls.filter(r => r.diam === 'D-51').length, 3, '14 рукавов пачками по 6');
  assert.equal(m.rolls[0].nums, '1,2,3,4,5,6');
  assert.equal(m.rolls[0].date, '2026-04-08');
  assert.ok(!m.rolls.some(r => r.diam === 'D-125'), 'всасывающие не перекатывают');
  assert.deepEqual(buildPlan(data, 2026, {}).months.map(x => x.month), [4, 10]);
});
