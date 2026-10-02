const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../learning-aids.js');

function phone() {
  const calls = [];
  const window = { ShiciAndroid: {
    stopSpeech() { calls.push(['stop']); },
    speak(...args) { calls.push(['speak', ...args]); },
    saveDocument(...args) { calls.push(['save', ...args]); },
    openSpeechSettings() { calls.push(['settings']); }
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../android/native-adapter.js'), 'utf8'), { window });
  return { window, calls };
}
test('native adapter preserves silent Chinese questions, speaks revealed answers, and ignores stale TTS events', () => {
  const { window, calls } = phone();
  const messages = [];
  const controller = A.createSpeechController({ synth: window.ShiciNative.speechSynthesis, Utterance: window.ShiciNative.Utterance, status: value => messages.push(value) });
  const word = { id: 'w1', english: 'adapt' };
  const session = { id: 's1', round: 1, stage: 'initial', revealed: false };
  controller.update(session, word, true);
  assert.equal(calls.filter(c => c[0] === 'speak').length, 1);
  const firstId = calls.find(c => c[0] === 'speak')[3];
  controller.update({ ...session, revealed: true }, word, true);
  assert.equal(calls.filter(c => c[0] === 'speak').length, 1);
  const verify = { ...session, stage: 'verify', round: 2 };
  controller.update(verify, word, true);
  assert.equal(calls.at(-1)[0], 'stop');
  window.__shiciSpeechEvent(firstId, 'unavailable');
  assert.equal(messages.length, 0);
  controller.update({ ...verify, revealed: true }, word, true);
  const spoken = calls.at(-1);
  assert.deepEqual(spoken.slice(0, 3), ['speak', 'adapt', 0.8]);
  window.__shiciSpeechEvent(spoken[3], 'start');
  assert.equal(messages.at(-1), '');
  window.__shiciSpeechEvent(spoken[3], 'unavailable');
  assert.match(messages.at(-1), /英文语音/);
  controller.stop();
  assert.equal(calls.at(-1)[0], 'stop');
});
test('native export passes complete Unicode JSON/CSV to the system document writer', () => {
  const { window, calls } = phone();
  const content = '\uFEFF英文,中文释义\nadapt,适应；改编\n';
  window.ShiciNative.download('薄弱词.csv', content, 'text/csv;charset=utf-8');
  assert.deepEqual(calls.at(-1), ['save', '薄弱词.csv', content, 'text/csv;charset=utf-8']);
  const backup = JSON.stringify({ format: 'shici-backup', version: 1, words: [{ english: 'adapt', score: 3, meaning: '适应', due: '2026-10-03' }] });
  window.ShiciNative.download('拾词备份.json', backup, 'application/json');
  assert.equal(calls.at(-1)[2], backup);
});
test('Android-only fallback clones nested learning state without mutating it', () => {
  const { window } = phone();
  const state = { queue: ['w1'], word: { score: 3 }, revealed: true };
  const clone = window.structuredClone(state);
  clone.word.score = 0;
  clone.queue.push('w2');
  assert.equal(state.word.score, 3);
  assert.deepEqual(state.queue, ['w1']);
});
