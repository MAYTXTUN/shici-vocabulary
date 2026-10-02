(function (root) {
  'use strict';
  const normalize = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const source = word => `https://www.etymonline.com/word/${word}`;
  const roots = (parts, explanation, scene, reference, note = '') => ({ kind: 'roots', parts: parts.map(([form, meaning]) => ({ form, meaning })), explanation, scene, source: source(reference), note });
  const story = (scene, explanation) => ({ kind: 'story', parts: [], scene, explanation, note: '这是帮助记忆的情境联想。' });
  // Reviewed entries only: a matching sequence of letters alone is never treated as a word root.
  const bank = {
    abandon: story('想象你拼了一半的拼图，决定不再继续，把它放到一边。这个“放弃”的动作，就贴上 abandon 的标签。', '把“不再继续做”和 abandon 连起来，再联想到“抛弃”。'),
    abstract: roots([['abs-', '离开、脱离（ab- 的变体）'], ['tract', '拉、抽取']], '从具体事物中“抽取出来”的概念 → 抽象的；从长文中抽取要点 → 摘要。', '从苹果、树叶、青草中抽出共同的“绿色”，留下的是 abstract 的概念。', 'abstract'),
    acquire: roots([['ac-', '朝向（ad- 的变体）'], ['quire', '寻求、取得，来自拉丁语 quaerere']], '朝着目标寻求并得到 → 获得；通过学习获得能力 → 习得。', '连续练习骑车，终于学会了一项技能：acquire a skill。', 'acquire', '这是按词源整理的记忆拆解。'),
    adapt: roots([['ad-', '朝向、使适合于'], ['apt', '适合、匹配']], '使自己与新环境匹配 → 适应；使作品适合另一种形式 → 改编。', '到新学校后慢慢适应新的作息，把自己调到合适的状态：adapt。', 'adapt'),
    adequate: roots([['ad-', '达到、朝向'], ['equ', '相等，来自拉丁语 aequus'], ['-ate', '这里是形容词词尾']], '达到所需的水平，与要求相等 → 足够的、合适的。', '瓶子里的水刚好到“所需水量”的刻度，这个量就是 adequate。', 'adequate'),
    ambition: story('想象一个同学在墙上贴下“有一天我要完成自己的大项目”，每天为这个目标努力。把这幅画面记作 ambition。', '不是今天的小任务，而是想在将来成就一番事业的“抱负、雄心”。'),
    approach: story('你沿小路一步步走近目的地：这是 approach 的“接近”。这条通向目的地的路，又可以联想到解决问题的“方法”。', '一条通向目标的路，串起“接近”和“方法”两个意思。'),
    assume: story('讨论时，你先说“我们先假设明天会下雨”：assume。后来，你接过队长的工作：assume responsibility。', '用两幅画面分别记住：先把一件事当成真的 → 假设；接下职责 → 承担。'),
    benefit: roots([['bene-', '好、善'], ['fit', '做，词源来自 facere']], '做有益的事 → 产生益处；得到这些好处 → 受益。', '每天散步带来健康上的好处，这些好处就是 benefit。', 'benefit', '这里的 fit 来自“做”的词源，不能按现代单词 fit（适合）来解释。'),
    complicated: roots([['com-', '一起'], ['plic', '折叠、交织'], ['-ate', '构成动词 complicate'], ['-ed', '过去分词作形容词']], '许多部分交织、折叠在一起 → 复杂的。', '几根耳机线缠在一起，越解越绕：a complicated problem。', 'complicate', 'complicate 加 -ed 时，末尾的 e 去掉，拼成 complicated。'),
    consistent: roots([['con-', '一起'], ['sist', '站立、保持'], ['-ent', '构成形容词']], '各部分站在一起、保持相合 → 一致的；前后保持同样标准 → 持续一致的。', '今天、明天、后天都按同一个标准做事，把这条不变的线记成 consistent。', 'consistent'),
    derive: roots([['de-', '从……'], ['riv(e)', '河流，来自拉丁语 rivus']], '水从源头引出 → 引出、获得；追溯到源头 → 源自。', '沿着一条小河往上找水源，再联想到一个想法 derive from 某个来源。', 'derive', 'riv(e) 是便于对应拼写的词源分组，末尾 e 不单独表示意思。'),
    efficient: story('两个人完成同样的整理工作，一个绕来绕去，另一个按顺序很快完成。把少走弯路、节省时间的那个人标作 efficient。', '抓住“同样的成果，用更少的时间或资源” → 效率高的。'),
    essential: story('整理出门背包时，你拿掉零食和装饰，只留下必须带的钥匙、证件。把这些“不能缺少”的东西贴上 essential。', '拿掉它就无法正常完成事情 → 必不可少的。'),
    maintain: story('想象你不断给自行车补气、上油，让它一直保持良好状态。把“维持状态”和“维护设备”这两件事连到 maintain。', '持续做一些事，让原来的状态保持下去 → 维持、维护。'),
    perceive: story('房间里有一点焦味，你停下脚步察觉到了它；听完解释后，你又理解了对方的意思。把“察觉”和“理解”贴上 perceive。', '用感官察觉，或用头脑理解 → perceive。'),
    reliable: roots([['reli-', 'rely 的变形：依靠、信赖'], ['-able', '可以……的']], '可以依靠、值得信赖的 → 可靠的。', '朋友答应准时来，而且每次都做到：a reliable friend。', 'reliable', 'rely 加 -able 时，y 变为 i，形成 reliable。'),
    retain: roots([['re-', '向后、留住'], ['tain', '握住、保持，来自拉丁语 tenere']], '把东西握住、留在手里 → 保留；把知识留在脑中 → 记住。', '把新单词像小纸条一样留在脑海里：retain the word。', 'retain'),
    significant: story('比较两张图表时，一个变化很小，另一个变化大到一眼看见。把后者记作 significant；再想到它对结果很“重要”。', '用“大到值得注意的变化”连接“显著的”和“重要的”。'),
    temporary: story('你在桌上贴一张“只用到明天”的标签，明天就取下来。把这个有结束日期的安排记作 temporary。', '只维持一段时间，之后结束 → 暂时的。')
  };
  // Transparent modern formations are whitelisted, rather than guessed from a suffix.
  const formations = [
    ['unhappy', 'un-', '不', 'happy', '快乐的', '', '不快乐 → 不高兴的'],
    ['unable', 'un-', '不', 'able', '能够的', '', '不能做到 → 不能的'],
    ['unreliable', 'un-', '不', 'reliable', '可靠的', '', '不能依靠 → 不可靠的'],
    ['careful', 'care', '关心、留心', '-ful', '充满……的', '', '做事充满留心 → 小心的、仔细的'],
    ['careless', 'care', '留心', '-less', '没有……的', '', '缺少留心 → 粗心的'],
    ['helpful', 'help', '帮助', '-ful', '具有……的', '', '能提供帮助 → 有帮助的'],
    ['useful', 'use', '用途、使用', '-ful', '具有……的', '', '具有用途 → 有用的'],
    ['useless', 'use', '用途', '-less', '没有……的', '', '没有用途 → 无用的'],
    ['hopeless', 'hope', '希望', '-less', '没有……的', '', '没有希望 → 无望的'],
    ['hopeful', 'hope', '希望', '-ful', '充满……的', '', '充满希望 → 有希望的'],
    ['teacher', 'teach', '教', '-er', '做这件事的人', '', '教书的人 → 教师'],
    ['learner', 'learn', '学习', '-er', '做这件事的人', '', '学习的人 → 学习者'],
    ['reader', 'read', '阅读', '-er', '做这件事的人', '', '阅读的人 → 读者'],
    ['writer', 'writ(e)', '写', '-er', '做这件事的人', 'write 加 -er 时，末尾 e 去掉。', '写作的人 → 作者、作家'],
    ['rewrite', 're-', '再一次', 'write', '写', '', '再写一次 → 重写'],
    ['reread', 're-', '再一次', 'read', '读', '', '再读一次 → 重读'],
    ['readable', 'read', '读', '-able', '可以……的', '', '可以读的 → 可读的、易读的'],
    ['happiness', 'happi-', 'happy 的变形：快乐的', '-ness', '性质、状态', 'happy 加 -ness 时，y 变为 i。', '快乐的状态 → 幸福、快乐'],
    ['kindness', 'kind', '友善的', '-ness', '性质、状态', '', '友善的品质 → 善良、好意'],
    ['darkness', 'dark', '黑暗的', '-ness', '性质、状态', '', '黑暗的状态 → 黑暗']
  ];
  for (const [word, a, am, b, bm, note, explanation] of formations) {
    bank[word] = { kind: 'roots', parts: [{ form: a, meaning: am }, { form: b, meaning: bm }], explanation: `${explanation}。`, scene: '', note, source: '' };
  }
  function memoryAid(word) {
    const english = String(word.english || '').trim(), meaning = String(word.meaning || '').trim();
    const key = normalize(english);
    const entry = Object.prototype.hasOwnProperty.call(bank, key) ? bank[key] : null;
    const imported = String(word.mnemonic || '').trim();
    if (entry) return { ...entry, parts: entry.parts.map(part => ({ ...part })), imported, label: entry.kind === 'roots' ? '词根词缀 / 构词记忆' : '情境记忆' };
    if (imported) return { kind: 'imported', label: '词库中的记忆方法', parts: [], explanation: imported, scene: '', imported: '', note: '' };
    const firstMeaning = meaning.split(/[；;\n]/)[0].trim() || meaning;
    return {
      kind: 'association', label: '释义联想练习', parts: [], imported: '',
      explanation: `把“${english} ↔ ${firstMeaning}”当成这张画面的标题。听一次英文，闭眼回放，再遮住中文回忆。`,
      scene: word.example ? `先想象例句里发生的事：${word.example}${word.exampleTranslation ? `（${word.exampleTranslation}）` : ''}。在画面里找出“${firstMeaning}”，把它与 ${english} 连起来。` : `先想一个你亲身经历、能体现“${firstMeaning}”的场景。把 ${english} 写进这幅画面里，选一个人物、动作或细节作为提示。`,
      note: '这是按你的释义给出的联想练习，暂未收录这个词的可靠构词拆解。'
    };
  }
  function speechCue(session, word, enabled = true) {
    if (!enabled || !session || session.done || !word || !word.english) return null;
    if (session.stage === 'verify' && !session.revealed) return null;
    return { text: word.english, key: JSON.stringify([session.id, session.round, session.stage, word.id || word.english, session.stage === 'verify' ? 'solution' : 'english']) };
  }
  function createSpeechController({ synth, Utterance, status = () => {} }) {
    let lastKey = null, current = null, generation = 0;
    function cancel(reset = false) {
      generation++; if (synth) synth.cancel(); current = null;
      if (reset) lastKey = null;
    }
    function speak(text) {
      if (!synth || !Utterance) { status('当前浏览器不支持发音，请使用支持语音的浏览器。'); return false; }
      cancel(); const ticket = generation;
      const utterance = new Utterance(text); current = utterance;
      utterance.lang = 'en-US'; utterance.rate = 0.8;
      const voices = synth.getVoices ? synth.getVoices() : [];
      const voice = voices.find(v => /^en[-_]US$/i.test(v.lang) && v.localService) || voices.find(v => /^en[-_]US$/i.test(v.lang)) || voices.find(v => /^en\b/i.test(v.lang));
      if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
      utterance.onstart = () => { if (ticket === generation) status(''); };
      utterance.onend = () => { if (ticket === generation) current = null; };
      utterance.onerror = event => {
        if (ticket !== generation || ['canceled', 'interrupted'].includes(event.error)) return;
        status(event.error === 'not-allowed' ? '请点一次“听发音”启用声音，之后会自动朗读。' : '暂时无法发音，请检查设备的英文语音或点“听发音”重试。');
      };
      try { if (synth.paused) synth.resume(); synth.speak(utterance); return true; }
      catch { current = null; status('暂时无法发音，请点“听发音”重试。'); return false; }
    }
    return {
      update(session, word, enabled) {
        const cue = speechCue(session, word, enabled);
        if (!cue) { cancel(true); return; }
        if (cue.key === lastKey) return;
        lastKey = cue.key; speak(cue.text);
      },
      replay(word) { if (word) speak(word.english); },
      stop() { cancel(true); },
      pause() { cancel(); }
    };
  }
  const api = { memoryAid, speechCue, createSpeechController, coveredWords: Object.keys(bank) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LearningAids = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
