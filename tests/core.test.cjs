const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
const settings = { successRule: 'half', intervals: [1, 2, 4, 7, 15, 30] };
test('formal failures accumulate across days; success halves the current score', () => {
  const word = { score: 0 };
  C.recordFormal(word, 'unknown', '2026-10-02', settings); assert.equal(word.score, 1); assert.equal(word.due, '2026-10-03');
  C.recordFormal(word, 'unknown', '2026-10-03', settings); assert.equal(word.score, 3); assert.equal(word.due, '2026-10-04');
  C.recordFormal(word, 'unknown', '2026-10-04', settings); assert.equal(word.score, 5); assert.equal(word.due, '2026-10-06');
  C.recordFormal(word, 'known', '2026-10-06', settings); assert.equal(word.score, 2); assert.equal(word.formalFailures, 3);
});
test('repeated practice and same-day formal answers never alter score or due', () => {
  const word = { score: 0 };
  C.recordFormal(word, 'unknown', '2026-10-02', settings);
  for (let i = 0; i < 50; i++) C.recordPractice(word, 'unknown', '2026-10-02');
  C.recordPractice(word, 'known', '2026-10-02');
  assert.equal(C.recordFormal(word, 'known', '2026-10-02', settings), false);
  assert.equal(word.score, 1); assert.equal(word.due, '2026-10-03'); assert.equal(word.practiceFailures, 50); assert.equal(word.weakDay, '2026-10-02');
  C.recordPractice(word, 'known', '2026-10-03'); assert.equal(word.practiceFailures, 0); assert.equal(word.score, 1);
});
test('fuzzy is a softer failure; subtraction is optional and clamped', () => {
  assert.equal(C.scoreAfter(0, 'fuzzy'), 1); assert.equal(C.scoreAfter(3, 'fuzzy'), 4);
  assert.equal(C.scoreAfter(5, 'known', 'subtract'), 2); assert.equal(C.scoreAfter(1, 'known'), 0); assert.equal(C.scoreAfter(2, 'known', 'subtract'), 0);
});
test('calendar schedule handles month boundaries, overdue days, and repeated long-term reviews', () => {
  assert.equal(C.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(C.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(C.nextDue('2026-10-02', '2026-10-05'), '2026-10-06');
  assert.equal(C.nextDue('2026-10-02', '2026-11-01'), '2026-12-01');
  assert.equal(C.dayDistance('2026-12-31', '2027-01-01'), 1);
});
test('import supports spaced entries, table copies, headers, phrases and bad lines', () => {
  const plain = C.parseImport('abandon v. 放弃\ntake care of phr. 照顾\nretain 保留\nbadline');
  assert.equal(plain.words.length, 3); assert.equal(plain.words[1].english, 'take care of'); assert.equal(plain.errors.length, 1);
  const table = C.parseImport('英文\t中文释义\t词性\t例句\nacquire\t获得\tv.\tI acquire skills.\nAcquire\t获取\tv.\t');
  assert.equal(table.words[0].meaning, '获得'); assert.equal(table.words[0].example, 'I acquire skills.'); assert.equal(table.duplicates, 1);
  assert.equal(C.parseImport('hello\t你好').words[0].meaning, '你好');
  assert.equal(C.parseImport('abandon v. 放弃,抛弃').words[0].meaning, '放弃,抛弃');
});
test('CSV handles commas, quotes and multiline fields; export round-trips all optional fields', () => {
  const input = '英文,词性,中文释义,例句\r\nhello,n.,"你好，问候","He said ""hello"".\nThen left."';
  const result = C.parseImport(input); assert.equal(result.words.length, 1); assert.equal(result.words[0].example, 'He said "hello".\nThen left.');
  const again = C.parseImport(C.exportCSV(result.words)); assert.equal(again.words[0].example, result.words[0].example); assert.equal(again.words[0].meaning, result.words[0].meaning);
  assert.throws(() => C.parseImport('word,meaning\na,"broken'), /引号/);
});
test('100,000-word import preserves order and detects duplicates', () => {
  const input = Array.from({ length: 100000 }, (_, i) => `word${i}\tn.\t释义${i}`).join('\n');
  const result = C.parseImport(input + '\nword50\tn.\t重复');
  assert.equal(result.words.length, 100000); assert.equal(result.duplicates, 1); assert.equal(result.words[99999].english, 'word99999'); assert.equal(C.dailyQuota(result.words.length, 20), 5000);
});
test('choices exclude duplicate English and identical meanings, and require four candidates', () => {
  const target = { id: '1', english: 'hello', meaning: '你好' };
  const pool = [target, { id: '2', english: 'HELLO', meaning: '问候' }, { id: '3', english: 'hi', meaning: '你好' }, ...['a','b','c','d'].map((english, i) => ({ id: String(i + 4), english, meaning: `不同${i}` }))];
  const choices = C.selectChoices(target, pool, () => .5); assert.equal(choices.length, 4); assert.equal(choices.filter(word => word.id === '1').length, 1); assert.ok(!choices.some(word => word.id === '2' || word.id === '3'));
  assert.deepEqual(C.selectChoices(target, [target]), []);
});
