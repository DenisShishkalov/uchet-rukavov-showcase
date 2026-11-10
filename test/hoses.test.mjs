import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_VEHICLES, isUnaccounted, parseReg, typeFromText, mergeRegistry, hoseName, regNumber, hoseKey, countByKind, normByDiam, shortage, seasonOf, testedInSeason } from '../src/hoses.js';
import { defaultData, unitData } from './fixture.mjs';

const row = (line, type, reg, extra = {}) => ({ line, type, reg, model: '', maker: '', year: null, status: 'Исправно', unit: '5 ПСЧ', setDate: '', testDate: '', testStatus: '', ...extra });

test('номер из реестра разбирается на диаметр, длину и номер', () => {
  assert.deepEqual(parseReg('51/1'), { d: 51, len: null, n: '1' });
  assert.deepEqual(parseReg('150-20/31'), { d: 150, len: 20, n: '31' });
  assert.deepEqual(parseReg('150-50\\8'), { d: 150, len: 50, n: '8' });
  assert.equal(parseReg('абв'), null);
  assert.equal(typeFromText('Напорно-всасывающий пожарный рукав'), 'Напорно-всасывающий');
  assert.equal(typeFromText('Всасывающий пожарный рукав'), 'Всасывающий');
  assert.equal(typeFromText('Напорный пожарный рукав'), 'Напорный');
});

test('загрузка реестра: виды, повторы, опечатки в подразделении, повторная загрузка', () => {
  const data = unitData();
  const rows = [
    row(2, 'Напорный пожарный рукав', '51/1', { model: 'РПМ(В)-50-1,6-УХЛ1', maker: 'РУСАРСЕНАЛ', year: 2026, testDate: '2026-10-08', testStatus: 'Пройдено' }),
    row(3, 'Напорный пожарный рукав', '77/1'),
    row(4, 'Напорно-всасывающий пожарный рукав', '77/1', { unit: '15 ПСЧ' }),
    row(5, 'Напорный пожарный рукав', '150-20/17'),
    row(6, 'Напорный пожарный рукав', '150-100/17'),
    row(7, 'Напорный пожарный рукав', '51/1'),
    row(8, 'Всасывающий пожарный рукав', '125/3', { status: 'Ремонт' }),
    row(9, 'Напорный пожарный рукав', 'нет номера'),
  ];
  const r = mergeRegistry(data, rows, '2026-11-03');
  assert.equal(r.added, 6);
  assert.equal(r.duplicates.length, 1);
  assert.match(r.duplicates[0], /Ø 51 №1/);
  assert.equal(r.unitTypos.length, 1);
  assert.equal(r.bad.length, 1);
  const names = data.hoses.map(h => hoseName(data.kinds, h));
  assert.deepEqual(names, ['Ø 51 №1', 'Ø 77 №1', 'Н.В. Ø 77 №1', 'Ø 150-20 №17', 'Ø 150-100 №17', 'ВС Ø 125 №3']);
  assert.equal(regNumber(data.kinds, data.hoses[3]), '150-20/17');
  assert.equal(data.hoses[0].lastTest, '2026-10-08');
  assert.equal(data.hoses[5].status, 'repair');

  // Повторная загрузка не задваивает и не затирает.
  data.hoses[0].maker = 'Вписано вручную';
  const again = mergeRegistry(data, rows, '2026-11-04');
  assert.equal(again.added, 0);
  assert.equal(data.hoses.length, 6);
  assert.equal(data.hoses[0].maker, 'Вписано вручную');
  assert.equal(data.hoses[0].events.filter(e => e.type === 'test').length, 1);
  assert.notEqual(hoseKey(data.kinds, data.hoses[3]), hoseKey(data.kinds, data.hoses[4]));
});

test('подсчёты: ремонт в общем счёте, списанные — нет; нормы и некомплект', () => {
  const data = defaultData();
  data.hoses = [
    { kind: 'n51', n: '1', status: 'calc' }, { kind: 'n51', n: '2', status: 'repair' },
    { kind: 'n51', n: '3', status: 'off' }, { kind: 'nv77', n: '1', status: 'calc' },
  ];
  assert.deepEqual(countByKind(data.hoses), { n51: 2, nv77: 1 });
  assert.deepEqual(data.vehicles, []);
  data.vehicles = DEMO_VEHICLES;
  assert.deepEqual([51, 66, 77, 150].map(d => normByDiam(data.vehicles, d)), [24, 15, 24, 20]);
  assert.equal(shortage(data, 51, 2), 48 - 2);
  assert.equal(shortage(data, 77, 3), 72);
});

test('сезонка: апрель и октябрь', () => {
  assert.equal(seasonOf('2026-04-20'), '2026-04');
  assert.equal(seasonOf('2026-10-08'), '2026-10');
  assert.equal(seasonOf('2027-01-15'), '2026-10');
  assert.equal(testedInSeason({ lastTest: '2026-10-08' }, '2026-10'), true);
  assert.equal(testedInSeason({ lastTest: '2026-04-24' }, '2026-10'), false);
});

test('по учёту: без рукавов с отметкой «Неучтён»', () => {
  assert.equal(isUnaccounted({ marks: ['china', 'unacc'] }), true);
  assert.equal(isUnaccounted({ marks: ['china'] }), false);
  assert.equal(isUnaccounted({}), false);
});
