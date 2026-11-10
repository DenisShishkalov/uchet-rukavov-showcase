// Пустая база и условное подразделение для проверок.

import { DEFAULT_KINDS, DEFAULT_MARKS, DEFAULT_SUCTION_NORM } from '../src/hoses.js';

export function defaultData() {
  return {
    settings: { unit: '', unitShort: '', place: '', commission: {}, signers: {} },
    kinds: DEFAULT_KINDS.map(k => ({ ...k })),
    hoses: [],
    vehicles: [],
    suctionNorm: { ...DEFAULT_SUCTION_NORM },
    marks: DEFAULT_MARKS.map(m => ({ ...m })),
    acts: [],
    people: [],
  };
}

export function unitData() {
  const data = defaultData();
  Object.assign(data.settings, { unit: '5 ПСЧ', unitShort: '5 ПСЧ', place: 'г. Примерск' });
  data.vehicles = [{ name: 'Условная техника', count: 1, norm: { 51: 32, 66: 27, 77: 38 } }, { name: 'ПАНРК', count: 1, norm: { 51: 4, 77: 4, 150: 20 } }];
  data.suctionNorm = { nv77: 14, vs125: 16 };
  return data;
}
