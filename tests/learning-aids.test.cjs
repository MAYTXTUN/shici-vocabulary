const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../learning-aids.js');
function harness() {
  const spoken = [], messages = [];
  let canceled = 0;
  class Utterance { constructor(text) { this.text = text; } }
  const synth = { cancel() { canceled++; }, getVoices: () => [{ lang: 'zh-CN' }, { lang: 'en-US', localService: true }], speak(utterance) { spoken.push(utterance); } };
  return { controller: A.createSpeechController({ synth, Utterance, status: text => messages.push(text) }), spoken, messages, get canceled() { return canceled; } };
}
const word = { id: 'word-1', english: 'reliable', meaning: '可靠的' };
const initial = { id: 'session-1', round: 1, stage: 'initial', revealed: false, done: false };
test('English cards auto-speak once, without replay when revealing the same card', () => {
  const h = harness(); h.controller.update(initial, word, true);
  h.controller.update({ ...initial, revealed: true }, word, true);
  h.controller.update({ ...initial, revealed: true }, word, true);
  assert.equal(h.spoken.length, 1); assert.equal(h.spoken[0].text, 'reliable'); assert.equal(h.spoken[0].voice.lang, 'en-US');
  h.controller.update(initial, { ...word, id: 'word-2', english: 'adapt' }, true);
  assert.equal(h.spoken.length, 2); assert.equal(h.spoken[1].text, 'adapt');
});
test('Chinese questions stop previous speech, and only reveal the correct word after an answer', () => {
  for (const answer of ['known', 'unknown']) {
    const h = harness(), verify = { ...initial, round: 3, stage: 'verify' };
    h.controller.update(initial, word, true); const before = h.canceled;
    h.controller.update(verify, word, true); assert.equal(h.spoken.length, 1); assert.ok(h.canceled > before);
    h.controller.update({ ...verify, revealed: true, answer }, word, true);
    assert.equal(h.spoken.length, 2); assert.equal(h.spoken[1].text, 'reliable');
    h.controller.update({ ...verify, revealed: true, answer }, word, true); assert.equal(h.spoken.length, 2);
  }
});
test('returning in another round repeats the word; completion and opt-out stop playback', () => {
  const h = harness(); h.controller.update(initial, word, true);
  h.controller.update({ ...initial, round: 2, stage: 'recall' }, word, true); assert.equal(h.spoken.length, 2);
  h.controller.update(initial, word, false); assert.equal(h.spoken.length, 2);
  h.controller.update({ ...initial, done: true }, word, true); assert.equal(h.spoken.length, 2);
  h.controller.replay(word); assert.equal(h.spoken.length, 3);
  h.controller.stop(); h.controller.update(initial, word, true); assert.equal(h.spoken.length, 4);
});
test('canceled speech errors cannot display stale warnings on a later question', () => {
  const h = harness(); h.controller.update(initial, word, true); const old = h.spoken[0];
  h.controller.update({ ...initial, round: 3, stage: 'verify' }, word, true);
  old.onerror({ error: 'not-allowed' }); assert.deepEqual(h.messages, []);
  h.controller.update({ ...initial, round: 3, stage: 'verify', revealed: true }, word, true);
  h.spoken[1].onerror({ error: 'not-allowed' }); assert.match(h.messages[0], /听发音/);
});
test('all sample words have authored roots or a specific story, with spelling changes explained', () => {
  const samples = ['abandon','abstract','acquire','adapt','adequate','ambition','approach','assume','benefit','complicated','consistent','derive','efficient','essential','maintain','perceive','reliable','retain','significant','temporary'];
  for (const english of samples) {
    const aid = A.memoryAid({ english, meaning: '中文' }); assert.ok(['roots','story'].includes(aid.kind)); assert.ok(aid.explanation && aid.scene);
    if (aid.kind === 'roots') { assert.ok(aid.parts.length >= 2); assert.ok(aid.parts.every(part => part.form && part.meaning)); assert.match(aid.source, /^https:\/\/www\.etymonline\.com\/word\//); }
  }
  assert.match(A.memoryAid(word).note, /y 变为 i/);
});
test('unknown words receive an honest meaning-based exercise, not a guessed root', () => {
  for (const english of ['corner', 'constructor', 'temporaryxyz', 'randomable', '__proto__']) {
    const aid = A.memoryAid({ english, meaning: '角落；转角' }); assert.equal(aid.kind, 'association'); assert.equal(aid.parts.length, 0); assert.match(aid.scene, /角落/); assert.match(aid.note, /暂未收录/);
  }
  const imported = A.memoryAid({ english: 'corner', meaning: '角落', mnemonic: '房间的拐角' }); assert.equal(imported.kind, 'imported'); assert.equal(imported.explanation, '房间的拐角');
  const reviewed = A.memoryAid({ ...word, mnemonic: '我信得过的朋友' }); assert.equal(reviewed.kind, 'roots'); assert.equal(reviewed.imported, '我信得过的朋友');
  assert.equal(A.memoryAid({ english: ' CARELESS ', meaning: '粗心的' }).kind, 'roots');
});
