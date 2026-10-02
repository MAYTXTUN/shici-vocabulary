/* Only bundled in the Android APK. Connect the existing app to native TTS/files. */
(() => {
  'use strict';
  if (!window.ShiciAndroid) return;
  const native = window.ShiciAndroid;
  const utterances = new Map();
  let sequence = 0;
  function Utterance(text) { this.text = text; this.rate = 0.8; this.lang = 'en-US'; }
  const synth = {
    paused: false,
    getVoices: () => [{ lang: 'en-US', localService: true, name: '手机英文语音' }],
    resume() {},
    cancel() { utterances.clear(); native.stopSpeech(); },
    speak(utterance) {
      const id = String(++sequence);
      utterances.set(id, utterance);
      native.speak(String(utterance.text), Number(utterance.rate) || 0.8, id);
    }
  };
  window.__shiciSpeechEvent = (id, event) => {
    const utterance = utterances.get(id);
    if (!utterance) return;
    if (event === 'start') utterance.onstart?.();
    else {
      utterances.delete(id);
      if (event === 'end') utterance.onend?.();
      else utterance.onerror?.({ error: event });
    }
  };
  window.ShiciNative = {
    speechSynthesis: synth,
    Utterance,
    download(filename, content, type) { native.saveDocument(filename, content, type); },
    openSpeechSettings() { native.openSpeechSettings(); }
  };
  // Make the current storage error message useful on mobile if WebView is obsolete.
  if (!window.structuredClone) window.structuredClone = value => JSON.parse(JSON.stringify(value));
})();
