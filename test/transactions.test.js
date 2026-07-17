// Transactions grouping + verdicts against a fixture of the MLB API shape.
const { groupTrades, verdictFor } = require('../src/transactions.js');
const { median } = require('../src/calibrate.js');

let fails = 0;
const ok = (c, l, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const fixture = [
  // 2-for-1 trade, one description shared by all rows
  { typeCode: 'TR', date: '2026-07-05', description: 'Tigers traded RHP Kyle Finnegan to Astros for OF Joseph Sullivan and RHP James Hicks.',
    person: { id: 640448, fullName: 'Kyle Finnegan' }, fromTeam: { id: 116, name: 'Tigers' }, toTeam: { id: 117, name: 'Astros' } },
  { typeCode: 'TR', date: '2026-07-05', description: 'Tigers traded RHP Kyle Finnegan to Astros for OF Joseph Sullivan and RHP James Hicks.',
    person: { id: 813896, fullName: 'Joseph Sullivan' }, fromTeam: { id: 117, name: 'Astros' }, toTeam: { id: 116, name: 'Tigers' } },
  { typeCode: 'TR', date: '2026-07-05', description: 'Tigers traded RHP Kyle Finnegan to Astros for OF Joseph Sullivan and RHP James Hicks.',
    person: { id: 801802, fullName: 'James Hicks' }, fromTeam: { id: 117, name: 'Astros' }, toTeam: { id: 116, name: 'Tigers' } },
  // unrelated non-trade rows must be ignored
  { typeCode: 'SC', date: '2026-07-05', description: 'Astros selected the contract of X.', person: { id: 1, fullName: 'X' }, toTeam: { id: 117, name: 'Astros' } },
  // a second, separate trade on the same day
  { typeCode: 'TR', date: '2026-07-05', description: 'Rockies traded OF Mickey Moniak to Padres for C Prospect Guy.',
    person: { id: 666160, fullName: 'Mickey Moniak' }, fromTeam: { id: 115, name: 'Rockies' }, toTeam: { id: 135, name: 'Padres' } },
  { typeCode: 'TR', date: '2026-07-05', description: 'Rockies traded OF Mickey Moniak to Padres for C Prospect Guy.',
    person: { id: 999999, fullName: 'Prospect Guy' }, fromTeam: { id: 135, name: 'Padres' }, toTeam: { id: 115, name: 'Rockies' } },
];

const trades = groupTrades(fixture);
ok(trades.length === 2, 'two distinct trades grouped', 'got ' + trades.length);
const t1 = trades.find(t => t.desc.includes('Finnegan'));
ok(t1 && t1.sides.size === 2, 'trade has two sides');
ok(t1 && t1.sides.get(117).gets.length === 1 && t1.sides.get(116).gets.length === 2, '1-for-2 shape preserved');

ok(verdictFor(1.0).label === 'Balanced', 'ratio 1.0 balanced');
ok(verdictFor(1.5).label === 'Slight edge', 'ratio 1.5 edge');
ok(verdictFor(2.4).label === 'Lopsided', 'ratio 2.4 lopsided');
ok(verdictFor(null).label === 'Unvalued', 'null unvalued');

ok(median([1, 3, 2]) === 2 && median([1, 2, 3, 4]) === 2.5 && median([]) === null, 'median helper');


// Cash detection
const { cashFor } = require('../src/transactions.js');
const gCash = { desc: 'Astros traded RHP Lance McCullers Jr. and cash considerations to Brewers for OF Prospect.', cashHint: true };
const cash = cashFor(gCash, { team: 'Milwaukee Brewers' });
ok(cash && cash.cashM === 2.1 && cash.tv === 1.1, 'manual cash matched to receiving side', JSON.stringify(cash));
ok(cashFor(gCash, { team: 'Houston Astros' }) === null, 'cash not applied to sending side');
ok(cashFor({ desc: 'Rays traded X to Cubs.' }, { team: 'Cubs' }) === null, 'no cash when none reported');

console.log(fails ? `\n${fails} FAILURES` : '\nTRANSACTIONS TESTS OK');
process.exit(fails ? 1 : 0);
