// Cot's parser against real row shapes from the Yankees sheet.
const { parseTeam, money } = require('../src/fetch-salaries.js');

let fails = 0;
const ok = (c, l, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const near = (a, b, t, l) => ok(a != null && Math.abs(a - b) <= t, l, `got ${a} want ~${b}`);

// money() forms seen in Cot's
ok(money('$42,500,000') === 42.5, 'full-dollar salary');
ok(money('$42.500') === 42.5, '$M salary');
ok(money('$775,000') === 0.775, 'pre-arb full dollars');
ok(money('FA') === null && money('') === null, 'FA/blank -> null');

const rows = [
  ['NEW YORK'],
  ['', '', '', '', '', '', '', '', '', '', '', '', 'Projected 40-man Year-End Labor Relations Payrolls'],
  ['', '', '', '', '', '', '', '', '', '', '', '', '2026', '2027', '2028', '2029', '2030', '', '2026', '2027', '2028', '2029', '2030'],
  ['Player', 'Pos.', 'Year', '', '', '', '', 'Opts left 1/26', 'Agent', '', 'Length / Total Value'],
  ['Bellinger, Cody', 'cf', '2013', '4', '124', '30', '8.160', '3 / 3', 'Boras Corp.', '', '5 y/$162.5M (26-30)', '', '$42,500,000', '$42.500', '$25.800', '$25.800', '$25.900', '', '$44,750,000', '$44.750', '$24.300', '$24.300', '$24.400'],
  ['Cole, Gerrit', 'rhp-s', '2011', '1', '1', '35', '12.111', '3 / 3', 'Boras Corp.', '', '9 y/$324M (20-28)', '', '$36,000,000', '$36.000', '$36.000', 'FA', '', '', '$36,000,000', '$36.000', '$36.000', '', ''],
  ['Arb Guy, Sample', '2b', '2019', '2', '55', '27', '3.142', '', 'Agency', '', '1 y/$4.1M (26)', '', '$4,100,000', '', '', '', '', '', '$4,100,000', '', '', '', ''],
  ['Rookie, Fresh', 'ss', '2023', '1', '9', '22', '0.045', '', 'Agency', '', '1 y/$775k (26)', '', '$775,000', '', '', '', '', '', '$775,000', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', 'not a player row'],
];

const players = parseTeam(rows, 2026);
ok(players.length === 4, 'four player rows parsed', 'got ' + players.length);

const bell = players.find(p => p.name === 'Cody Bellinger');
ok(bell && bell.control === 4.5, 'Bellinger control 4.5 (thru 2030)', bell && bell.control);
near(bell && bell.remM, 0.5 * 42.5 + 42.5 + 25.8 + 25.8 + 25.9, 0.2, 'Bellinger remaining $M');

const cole = players.find(p => p.name === 'Gerrit Cole');
ok(cole && cole.control === 2.5, 'Cole control 2.5 (FA 2029)', cole && cole.control);
near(cole && cole.salaryM, (0.5 * 36 + 36 + 36) / 2.5, 0.2, 'Cole annualized salary');

const arb = players.find(p => p.name === 'Sample Arb Guy');
ok(arb && arb.control === 2.5, 'arb guy control from service 3.142 -> 2.5', arb && arb.control);
ok(arb && arb.salaryM === 4.1, 'arb guy salary 4.1M');

const rook = players.find(p => p.name === 'Fresh Rookie');
ok(rook && rook.control === 5.5, 'rookie control 5.5 from service 0.045', rook && rook.control);


// Arb markers (A1/A2/A3) and asterisked names from the Angels published sheet
const rows2 = [
  ['', '', '', '', '', '', '', '', '', '', '', '', '2026', '2027', '2028', '2029', '2030'],
  ['Rendon, Anthony*', '3b', '2011', '1', '6', '36', '12.130', '1 / 3', 'Boras', '', '7 y/$245M*', '', '$34,693,677', '', '', '', ''],
  ['Neto, Zach', 'ss', '2022', '1', '24', '25', '2.170', '3 / 3', 'CAA', '', '1 y/$4.15M (26)', '', '$4,150,000', 'A2', 'A3', 'A4', 'FA'],
];
const p2 = parseTeam(rows2, 2026);
const rendon = p2.find(p => p.name === 'Anthony Rendon');
ok(!!rendon, 'asterisk stripped from name', rendon && rendon.name);
const neto = p2.find(p => p.name === 'Zach Neto');
ok(neto && neto.control === 3.5, 'arb markers stop salary count; control from service 2.170 -> 3.5', neto && neto.control);
ok(neto && neto.salaryM === 4.15, 'Neto current arb salary kept');

console.log(fails ? `\n${fails} FAILURES` : '\nSALARIES TESTS OK');
process.exit(fails ? 1 : 0);
