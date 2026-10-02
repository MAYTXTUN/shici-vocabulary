/* 拾词: local-first, no build step or external dependencies. */
(() => {
  'use strict';
  const C = WordCore;
  const A = LearningAids;
  const app = document.querySelector('#app');
  const settingsDefault = { planDays: 20, dailyOverride: 0, successRule: 'half', intervals: [...C.DEFAULT_INTERVALS], autoSpeak: true };
  let db, words = [], books = [], settings, session = null;
  let wordMap = new Map(), route = 'today', libraryPage = 0, libraryQuery = '', libraryBook = 'all';
  let weakBook = 'all', weakScope = 'today', weakReveal = false, importPreview = null, importText = '', importBook = '';
  let busy = false, deferredInstall = null;
  let speechMessage = '';
  const nativeApp = window.ShiciNative;
  const canSpeak = Boolean(nativeApp || window.speechSynthesis);
  const speech = A.createSpeechController({
    synth: nativeApp?.speechSynthesis || window.speechSynthesis,
    Utterance: nativeApp?.Utterance || window.SpeechSynthesisUtterance,
    status(message) {
      speechMessage = message;
      const element = app.querySelector('[data-speech-status]');
      if (element) { element.textContent = message; element.hidden = !message; }
    }
  });
  const sample = [
    ['abandon', 'v.', '放弃；抛弃', '/əˈbændən/'], ['abstract', 'adj. / n.', '抽象的；摘要', '/ˈæbstrækt/'],
    ['acquire', 'v.', '获得；习得', '/əˈkwaɪə(r)/'], ['adapt', 'v.', '适应；改编', '/əˈdæpt/'],
    ['adequate', 'adj.', '足够的；合适的', '/ˈædɪkwət/'], ['ambition', 'n.', '抱负；雄心', '/æmˈbɪʃən/'],
    ['approach', 'n. / v.', '方法；接近', '/əˈprəʊtʃ/'], ['assume', 'v.', '假设；承担', '/əˈsjuːm/'],
    ['benefit', 'n. / v.', '益处；使受益', '/ˈbenɪfɪt/'], ['complicated', 'adj.', '复杂的', '/ˈkɒmplɪkeɪtɪd/'],
    ['consistent', 'adj.', '一致的；持续的', '/kənˈsɪstənt/'], ['derive', 'v.', '源自；获得', '/dɪˈraɪv/'],
    ['efficient', 'adj.', '效率高的', '/ɪˈfɪʃənt/'], ['essential', 'adj.', '必不可少的', '/ɪˈsenʃəl/'],
    ['maintain', 'v.', '维持；维护', '/meɪnˈteɪn/'], ['perceive', 'v.', '察觉；理解', '/pəˈsiːv/'],
    ['reliable', 'adj.', '可靠的', '/rɪˈlaɪəbl/'], ['retain', 'v.', '保留；记住', '/rɪˈteɪn/'],
    ['significant', 'adj.', '重要的；显著的', '/sɪɡˈnɪfɪkənt/'], ['temporary', 'adj.', '暂时的', '/ˈtempərəri/']
  ];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('shici-vocabulary', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('words', { keyPath: 'id' }); request.result.createObjectStore('meta'); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  function read(store, key) {
    return new Promise((resolve, reject) => {
      const request = key === undefined ? db.transaction(store).objectStore(store).getAll() : db.transaction(store).objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
  }
  function commit(changed = [], meta = {}) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['words', 'meta'], 'readwrite');
      for (const word of changed) tx.objectStore('words').put(word);
      for (const [key, value] of Object.entries(meta)) tx.objectStore('meta').put(value, key);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('保存被中断'));
    });
  }
  function rebuild() { words.sort((a, b) => a.order - b.order); wordMap = new Map(words.map(word => [word.id, word])); }
  function today() { return C.dayKey(); }
  function toast(message) {
    const element = document.querySelector('#toast'); element.textContent = message; element.classList.add('visible');
    clearTimeout(toast.timeout); toast.timeout = setTimeout(() => element.classList.remove('visible'), 3500);
  }
  function bookOptions(selected = 'all', all = true) {
    return `${all ? '<option value="all">全部词库</option>' : ''}${books.map(book => `<option value="${esc(book.id)}" ${selected === book.id ? 'selected' : ''}>${esc(book.name)}</option>`).join('')}`;
  }
  function bookName(id) { return books.find(book => book.id === id)?.name || '我的词库'; }
  function enabledWords() { const enabled = new Set(books.filter(book => book.enabled).map(book => book.id)); return words.filter(word => enabled.has(word.bookId)); }
  function planInfo() {
    const all = enabledWords(), learned = all.filter(word => word.started).length;
    const quota = settings.dailyOverride || C.dailyQuota(all.length, settings.planDays);
    const newDone = all.filter(word => word.started === today()).length;
    const newWords = all.filter(word => !word.started).slice(0, Math.max(0, quota - newDone));
    const dueWords = all.filter(word => word.due && word.due <= today() && word.lastFormal !== today()).sort((a, b) => b.score - a.score || a.due.localeCompare(b.due) || a.order - b.order);
    return { all, learned, quota, newDone, newWords, dueWords, formalDone: all.filter(word => word.lastFormal === today()).length };
  }
  function weakWords() {
    return words.filter(word => (word.score > 0 || word.weakDay === today()) && (weakBook === 'all' || word.bookId === weakBook) && (weakScope !== 'today' || word.weakDay === today()))
      .sort((a, b) => b.score - a.score || a.order - b.order);
  }
  function pageHeading(kicker, title, sub, extra = '') {
    return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${sub}</p></div>${extra}</div>`;
  }
  function renderToday() {
    const info = planInfo(), weak = words.filter(word => word.weakDay === today());
    const progress = info.all.length ? Math.round(info.learned / info.all.length * 100) : 0;
    const resume = session && !session.done;
    const preview = weak.slice().sort((a, b) => b.score - a.score || a.order - b.order).slice(0, 3);
    app.innerHTML = `${pageHeading('A LITTLE, EVERY DAY', '今天，记牢一点。', '新的单词按顺序学，旧的单词按日期复习。', '<span class="pill">✳ 按自己的节奏来</span>')}
      <section class="hero"><div class="hero-copy"><span class="hero-label">你的 ${settings.planDays} 天学习计划</span><h2>${resume ? '接着上一次，<br>把剩下的词记牢。' : info.newWords.length || info.dueWords.length ? '每一个记住的词，<br>都是一点新的积累。' : info.all.length ? '今天的任务已完成，<br>让记忆再沉淀一下。' : '从你的第一本词库，<br>开始今天的积累。'}</h2><p>正式复习按天计算，下午和晚上的加练独立记录。</p><div class="hero-buttons"><button class="primary" data-action="start-all" ${!resume && !info.newWords.length && !info.dueWords.length ? 'disabled' : ''}>${resume ? '继续上次练习' : '开始今日学习'} <span>→</span></button><a href="#library" class="hero-link">导入自己的单词 ↗</a></div></div><div class="hero-art" aria-hidden="true"><div class="art-orbit"></div><div class="art-card back"></div><div class="art-card front"><span>Aa</span><small>one word at a time</small><div class="art-line"></div><div class="art-line short"></div></div><span class="art-spark">✳</span><span class="art-dot"></span></div></section>
      <div class="stat-grid"><div class="stat-card"><span>今日新词 <i class="stat-icon green">＋</i></span><strong>${info.newWords.length}<small>个待学习</small></strong><p>每日目标 ${info.quota} 个 · 已开始 ${info.newDone} 个</p></div><div class="stat-card"><span>到期复习 <i class="stat-icon peach">↻</i></span><strong>${info.dueWords.length}<small>个待复习</small></strong><p>按日期到期 · 困难分数高的优先</p></div><div class="stat-card"><span>今日薄弱词 <i class="stat-icon violet">◇</i></span><strong>${weak.length}<small>个可加练</small></strong><p>不会或模糊的词，单独放在这里</p></div></div>
      <div class="dashboard-grid"><section class="panel"><div class="section-head"><h2>今天怎么学</h2><span class="muted">一步一步来</span></div><div class="task-row"><span class="step">01</span><div><h3>按顺序学新词</h3><p>保留单词书和笔记里的原始顺序</p></div><button class="small-button" data-action="start-new" ${!info.newWords.length || resume && session.type === 'formal' ? 'disabled' : ''}>学新词 →</button></div><div class="task-row"><span class="step">02</span><div><h3>完成到期复习</h3><p>第一遍的回答，决定今天的困难分数</p></div><button class="small-button" data-action="start-review" ${!info.dueWords.length || resume && session.type === 'formal' ? 'disabled' : ''}>去复习 →</button></div><div class="task-row"><span class="step">03</span><div><h3>空闲时，再巩固一下</h3><p>单独练薄弱词，不改变正式复习日期</p></div><a class="small-button" href="#weak">去加练 →</a></div><div class="soft-note">✓ 不会的词先回忆，再用中文选英文验证，直到本轮通过。</div></section><section class="panel plan-panel"><div class="section-head"><h2>词库进度</h2><span class="pill tiny">${settings.planDays} 天一遍</span></div><div class="progress-ring" style="--progress:${progress}%"><div><strong>${progress}<small>%</small></strong><span>已开始学习</span></div></div><div class="plan-caption">${info.learned} / ${info.all.length} 个单词</div><div class="linear-progress"><i style="width:${progress}%"></i></div><p class="muted centered">${settings.dailyOverride ? `每天 ${settings.dailyOverride} 个 · 手动每日目标` : `每天约 ${info.quota} 个新词 · 自动分配`}<br>复习继续进行，不限于 ${settings.planDays} 天</p></section></div>
      <section class="panel weak-preview"><div class="section-head"><div><h2>留给下一次的小练习</h2><p class="muted">今天卡住的词，记住之后也会留在这里。</p></div><a href="#weak" class="text-link">全部薄弱词 →</a></div>${preview.length ? `<div class="preview-grid">${preview.map(word => `<div class="preview-word"><span class="difficulty">困难 ${word.score} 分</span><h3>${esc(word.english)}</h3><p>${esc(word.pos)} ${esc(word.meaning)}</p><small>${esc(bookName(word.bookId))}</small></div>`).join('')}</div>` : '<div class="empty-inline"><span>◇</span><p>还没有今天的薄弱词。开始学习后，这里会收集需要多看几次的单词。</p></div>'}</section>
      ${books.some(book => book.demo) ? '<div class="demo-note">当前含 20 个示例单词，方便体验。<button class="text-button" data-action="demo">体验 10 词练习 →</button> 你可以在词库中停用示例，导入自己的单词。</div>' : ''}`;
  }
  function renderWeak() {
    const filtered = weakWords();
    app.innerHTML = `${pageHeading('A SECOND LOOK', '把不熟悉，变成熟悉。', '困难分数越高，排得越靠前。加练不会移动下次正式复习日期。')}
      <div class="toolbar"><div class="segmented"><button data-action="weak-today" class="${weakScope === 'today' ? 'active' : ''}">今天的薄弱词</button><button data-action="weak-all" class="${weakScope === 'all' ? 'active' : ''}">全部薄弱词</button></div><select id="weak-book" aria-label="筛选词库">${bookOptions(weakBook)}</select><button class="secondary" data-action="weak-reveal">${weakReveal ? '隐藏释义' : '显示释义'}</button></div>
      <section class="panel"><div class="section-head"><h2>${filtered.length} 个词，值得再看一眼</h2><div class="button-group"><button class="secondary" data-action="export-weak" ${filtered.length ? '' : 'disabled'}>导出单词</button><button class="primary compact" data-action="practice-weak" ${filtered.length ? '' : 'disabled'}>开始加练 →</button></div></div>${filtered.length ? `<div class="word-list">${filtered.slice(0, 100).map((word, index) => `<div class="word-row"><span class="row-number">${index + 1}</span><div class="word-main"><h3>${esc(word.english)} <small>${esc(word.phonetic || '')}</small></h3><p>${weakReveal ? `${esc(word.pos)} ${esc(word.meaning)}` : esc(bookName(word.bookId))}</p><small>正式不会 ${word.formalFailures || 0} 次 · 今天加练不会 ${word.practiceDay === today() ? word.practiceFailures || 0 : 0} 次 · 下次复习 ${esc(word.due || '尚未正式学习')}</small></div><span class="difficulty">${word.score || 0} 分</span><button class="small-button" data-action="practice-one" data-id="${esc(word.id)}">练一下</button></div>`).join('')}</div>${filtered.length > 100 ? '<p class="muted">列表展示前 100 个，开始加练和导出会包含所有筛选结果。</p>' : ''}` : '<div class="empty-state"><span>◇</span><h3>这里暂时很清爽</h3><p>在学习中选择“不会”或“模糊”，单词就会收集到这里。</p><a class="primary compact" href="#today">去今日学习</a></div>'}</section><p class="page-note">困难分数来自正式学习的第一遍回答。当日加练只记录练习次数；正式复习答对后分数下降。</p>`;
  }
  function renderLibrary() {
    const query = libraryQuery.trim().toLowerCase();
    const filtered = words.filter(word => (libraryBook === 'all' || word.bookId === libraryBook) && (!query || word.english.toLowerCase().includes(query) || word.meaning.includes(query)));
    const pages = Math.max(1, Math.ceil(filtered.length / 30)); libraryPage = Math.min(libraryPage, pages - 1);
    const visible = filtered.slice(libraryPage * 30, (libraryPage + 1) * 30);
    app.innerHTML = `${pageHeading('YOUR WORDS, YOUR ORDER', '我的词库', '单词书、考试和笔记，各自整理。导入的顺序，就是学习的顺序。', '<button class="primary compact" data-action="show-import">＋ 导入单词</button>')}
      <div class="book-grid">${books.map(book => {
        const list = words.filter(word => word.bookId === book.id), count = list.filter(word => word.started).length;
        return `<article class="book-card ${book.enabled ? '' : 'disabled-book'}"><div class="section-head"><span class="book-icon">▤</span><label class="toggle"><input type="checkbox" data-book-toggle="${esc(book.id)}" ${book.enabled ? 'checked' : ''}><span></span><em>${book.enabled ? '加入计划' : '已停用'}</em></label></div><h3>${esc(book.name)} ${book.demo ? '<span class="pill tiny">示例</span>' : ''}</h3><p>${list.length} 个单词 · 已学习 ${count} 个</p><div class="linear-progress"><i style="width:${list.length ? count / list.length * 100 : 0}%"></i></div><div class="book-card-actions"><button class="text-button" data-action="view-book" data-id="${esc(book.id)}">查看单词 →</button><button class="text-button" data-action="rename-book" data-id="${esc(book.id)}">改名</button></div></article>`;
      }).join('')}<button class="book-card add-book" data-action="new-book"><span>＋</span><h3>新建词库</h3><p>整理你自己的单词来源</p></button></div>
      <section class="panel"><div class="section-head"><h2>单词列表 <small class="muted">${filtered.length} 个</small></h2><button class="secondary" data-action="export-library">导出当前词库</button></div><div class="toolbar"><div class="search-wrap"><span>⌕</span><input id="library-search" type="search" value="${esc(libraryQuery)}" placeholder="搜索英文或中文释义" aria-label="搜索单词"></div><select id="library-book" aria-label="筛选词库">${bookOptions(libraryBook)}</select></div><div class="table-wrap"><table><thead><tr><th>顺序</th><th>单词 / 音标</th><th>词性</th><th>中文释义</th><th>学习状态</th></tr></thead><tbody>${visible.map((word, index) => `<tr><td class="muted">${libraryPage * 30 + index + 1}</td><td><strong>${esc(word.english)}</strong><small>${esc(word.phonetic || '')}</small></td><td>${esc(word.pos || '—')}</td><td>${esc(word.meaning)}</td><td><span class="pill tiny ${word.started ? '' : 'neutral'}">${word.started ? `${word.score || 0} 分` : '未学习'}</span></td></tr>`).join('')}</tbody></table></div>${!filtered.length ? '<div class="empty-inline"><p>没有匹配的单词，可以换个关键词或导入词库。</p></div>' : ''}<div class="pagination"><span>第 ${libraryPage + 1} / ${pages} 页</span><div><button class="secondary" data-action="page-prev" ${libraryPage ? '' : 'disabled'}>上一页</button><button class="secondary" data-action="page-next" ${libraryPage + 1 < pages ? '' : 'disabled'}>下一页</button></div></div></section>`;
  }
  function renderImport() {
    app.innerHTML = `${pageHeading('BRING YOUR OWN WORDS', '导入你的单词', '可以直接粘贴，或选择 UTF-8 编码的 CSV、TSV、TXT 文件。')}
      <section class="panel import-panel"><form id="import-form"><div class="form-row"><label>存入词库<select id="import-book">${bookOptions(importBook || books[0]?.id, false)}</select></label><button class="secondary" type="button" data-action="new-book-import">＋ 新建词库</button></div><div class="section-head"><label for="import-content" class="form-label">粘贴单词内容</label><label class="file-button">选择文件<input type="file" id="import-file" accept=".csv,.tsv,.txt,text/plain,text/csv" hidden></label></div><textarea id="import-content" rows="12" placeholder="abandon v. 放弃；抛弃&#10;acquire v. 获得；习得&#10;adapt v. 适应；改编">${esc(importText)}</textarea><div class="import-hint"><strong>支持的格式</strong><p>每行“英文 词性 中文”，或从表格复制“英文 ⇥ 词性 ⇥ 中文”。两列“英文 ⇥ 中文”也可以。多列文件建议添加表头：英文、词性、中文释义、音标、例句、例句翻译、搭配、记忆方法、近义词、考试年份。</p><p>同一词库内重复的英文会跳过，保留原词和学习记录；不同词库可以分别收录。</p></div><div class="button-group"><button type="submit" class="primary compact">检查并预览 →</button><button type="button" class="secondary" data-action="sample-import">填入 10 个示例</button><button type="button" class="text-button" data-action="back-library">返回词库</button></div></form><div id="import-preview"></div></section>`;
    if (importPreview) showImportPreview();
  }
  function showImportPreview() {
    const preview = document.querySelector('#import-preview'); if (!preview) return;
    const { words: parsed, errors, duplicates } = importPreview;
    preview.innerHTML = `<div class="import-results"><h3>识别出 ${parsed.length} 个单词</h3><p class="muted">内容内重复 ${duplicates} 条 · 无法识别 ${errors.length} 行${errors.length ? '（不会导入）' : ''}</p>${errors.length ? `<div class="error-list">${errors.slice(0, 8).map(error => `<p>第 ${error.line} 行：${esc(error.message)} · ${esc(error.text.slice(0, 100))}</p>`).join('')}</div>` : ''}<div class="table-wrap"><table><thead><tr><th>英文</th><th>词性</th><th>中文释义</th></tr></thead><tbody>${parsed.slice(0, 10).map(word => `<tr><td>${esc(word.english)}</td><td>${esc(word.pos || '—')}</td><td>${esc(word.meaning)}</td></tr>`).join('')}</tbody></table></div><p class="muted">预览前 10 条；确认后会导入全部有效单词。</p><button class="primary compact" data-action="confirm-import" ${parsed.length ? '' : 'disabled'}>确认导入 ${parsed.length} 个单词</button></div>`;
  }
  function renderSettings() {
    app.innerHTML = `${pageHeading('MAKE IT YOURS', '适合自己的学习节奏', '日期计划和当天加练分开，困难分数也由你看得懂的规则计算。')}
      <div class="settings-grid"><section class="panel"><h2>学习计划</h2><form id="settings-form"><label>新词学习周期 <span class="muted">默认 20 天学完一遍</span><div class="input-unit"><input name="planDays" type="number" min="1" max="365" required value="${settings.planDays}"><span>天</span></div></label><label>每日新词数量 <span class="muted">填 0，按词库总数和周期自动分配</span><div class="input-unit"><input name="dailyOverride" type="number" min="0" max="100000" required value="${settings.dailyOverride}"><span>个</span></div></label><label>正式复习答对后<select name="successRule"><option value="half" ${settings.successRule === 'half' ? 'selected' : ''}>困难分数减半，向下取整</option><option value="subtract" ${settings.successRule === 'subtract' ? 'selected' : ''}>困难分数减 3，最低为 0</option></select></label><label>正式复习日程 <span class="muted">从首次学习日算起的第几天</span><input name="intervals" required value="${settings.intervals.join(', ')}"><small>例如 1, 2, 4, 7, 15, 30。最后一次之后按最后一个间隔继续复习。</small></label><button type="submit" class="primary compact">保存设置</button></form></section><div><section class="panel rule-panel"><span class="pill">分数怎么计算</span><h2>第一次不会 1 分<br>隔天还不会，继续加 2</h2><p>0 → 1 → 3 → 5 → 7 …</p><ul><li>“模糊”在正式第一遍中加 1 分，也进入当天循环练习。</li><li>“认识”在正式第一遍中按所选规则降分。</li><li>每个词每天只计算一次正式结果。</li><li>反复练习和四选一选错，只增加当天练习记录，不再增加困难分数。</li><li>正式复习日期按天安排，加练不会改变日期。</li></ul></section><section class="panel backup-panel"><h2>把词库和进度带走</h2><p class="muted">${nativeApp ? '数据存于本手机应用。卸载、清除数据或更换手机前，请导出完整备份。' : '数据存于当前浏览器。更换手机或清理浏览器前，请导出备份；电脑和手机之间可以用备份迁移。'}</p><div class="button-group"><button class="secondary" data-action="backup">导出完整备份</button><label class="file-button">恢复备份<input type="file" id="restore-file" accept=".json,application/json" hidden></label></div><p class="muted small">恢复会替换当前词库、设置和练习进度，请先备份现有数据。</p></section>${nativeApp ? '<section class="panel"><h2>手机独立使用</h2><p class="muted">界面、词库和学习进度保存在本手机。电脑关机、没有 Wi-Fi 时，也能添加单词和复习。请定期导出完整备份，卸载应用或清除应用数据会删除本地记录。</p><p class="muted">发音使用手机的英文语音；需要离线朗读时，请在系统中安装英文离线语音。电脑浏览器与此应用的数据通过完整备份迁移，暂不自动同步。</p><button class="secondary" data-action="speech-settings">英文语音设置</button></section>' : '<section class="panel"><h2>安卓手机怎么用</h2><p class="muted">安卓独立安装包“拾词-安卓安装包.apk”已在项目文件夹中。传到手机安装后，无需电脑运行，可直接添加单词并离线复习。</p><p class="muted">也可以连接同一 Wi-Fi，打开电脑启动时显示的手机地址；此浏览器方式需要电脑保持运行。手机应用与浏览器的数据可用完整备份迁移。</p></section>'}</div></div>`;
    document.querySelector('#settings-form button[type="submit"]').insertAdjacentHTML('beforebegin', `<label class="audio-setting"><input name="autoSpeak" type="checkbox" ${settings.autoSpeak ? 'checked' : ''}><span>自动朗读英文<small>英文卡片出现时读一次；中文选英文在公布答案后才读。</small></span></label>`);
  }
  function renderMemoryAid(word) {
    const aid = A.memoryAid(word);
    return `<section class="memory-aid" aria-label="记忆方法"><div class="memory-heading"><span>✳ 记忆方法</span><span class="pill tiny">${esc(aid.label)}</span></div>${aid.parts.length ? `<div class="root-parts">${aid.parts.map((part, index) => `${index ? '<span class="root-plus" aria-hidden="true">＋</span>' : ''}<div class="root-part"><strong>${esc(part.form)}</strong><span>${esc(part.meaning)}</span></div>`).join('')}</div><p class="memory-bridge"><span>合起来理解</span>${esc(aid.explanation)}</p>` : `<p class="memory-bridge">${esc(aid.explanation)}</p>`}${aid.scene ? `<div class="memory-scene"><span>记一幅画面</span><p>${esc(aid.scene)}</p></div>` : ''}${aid.imported ? `<div class="memory-scene"><span>词库中的记忆方法</span><p>${esc(aid.imported)}</p></div>` : ''}${aid.note ? `<p class="memory-note">${esc(aid.note)}</p>` : ''}${aid.source ? `<a class="memory-source" href="${esc(aid.source)}" target="_blank" rel="noopener noreferrer">查看词源依据 ↗</a>` : ''}</section>`;
  }
  function renderStudy() {
    if (!session) { speech.stop(); location.hash = '#today'; return; }
    if (session.done) {
      speech.stop();
      app.innerHTML = `<section class="completion panel"><div class="completion-icon">✓</div><span class="eyebrow">ONE STEP FURTHER</span><h1>这轮的 ${session.total} 个词，完成了。</h1><p>不会的词经过了重复回忆和答案验证。<br>今天的薄弱词还会保留，空闲时可以继续加练。</p><div class="completion-stats"><div><strong>${session.total}</strong><span>本轮完成</span></div><div><strong>${session.round}</strong><span>练习轮次</span></div></div><div class="button-group"><a class="primary compact" href="#today">回到今日学习 →</a><a class="secondary" href="#weak">查看薄弱词</a></div></section>`; return;
    }
    const word = wordMap.get(session.queue[0]);
    if (!word) { speech.stop(); app.innerHTML = '<section class="panel"><h2>练习中的词已不在词库里</h2><button class="secondary" data-action="end-session">结束本轮</button></section>'; return; }
    const labels = { initial: '第一遍 · 回忆中文', recall: '再巩固 · 回忆中文', verify: '验证记忆 · 中文选英文' };
    const progress = Math.round(session.completed.length / session.total * 100);
    let choices = [];
    if (session.stage === 'verify') choices = (session.choices || []).map(id => wordMap.get(id)).filter(Boolean);
    const reveal = session.revealed;
    app.innerHTML = `<div class="study-heading"><button class="text-button" data-action="leave-study">← 保存并返回</button><span class="pill ${session.type === 'practice' ? 'neutral' : ''}">${session.type === 'practice' ? '独立加练 · 不改变日期与分数' : '正式学习 · 每天只记一次分数'}</span></div><div class="study-progress"><div><span>${labels[session.stage]}</span><span>完成 ${session.completed.length} / ${session.total} · 第 ${session.round} 轮</span></div><div class="linear-progress"><i style="width:${progress}%"></i></div></div>
      <section class="study-card"><div class="card-top"><span>${esc(bookName(word.bookId))}</span><span class="difficulty">困难 ${word.score || 0} 分</span></div><div class="word-display"><span class="tiny-label">${session.stage === 'verify' ? '根据中文，选择对应的英文' : '先在心里回忆，再选择熟悉程度'}</span><h1 class="${session.stage === 'verify' ? 'meaning-prompt' : ''}">${esc(session.stage === 'verify' ? word.meaning : word.english)}</h1><p class="phonetic">${esc(session.stage === 'verify' ? word.pos || '' : word.phonetic || '')}</p>${session.stage !== 'verify' && canSpeak ? '<button class="pronounce" data-action="speak" aria-label="朗读英文单词">♫ 听发音</button>' : ''}</div>
      ${reveal ? `<div class="answer-panel"><span class="answer-result ${session.answer === 'known' ? 'correct' : ''}">${session.stage === 'verify' ? session.answer === 'known' ? '✓ 选对了，这个词通过验证' : '再记一次，稍后会重新出现' : ({ unknown: '没关系，再给它一点时间', fuzzy: '差一点就记牢了，再巩固一下', known: '记住了，继续保持' })[session.answer]}</span><h2>${esc(word.english)} <small>${esc(word.pos || '')}</small></h2><p class="translation">${esc(word.meaning)}</p>${[['例句', word.example], ['例句翻译', word.exampleTranslation], ['词组搭配', word.collocations], ['近义词', word.synonyms], ['考试年份 / 次数', word.exam]].filter(([, value]) => value).map(([label, value]) => `<div class="extra-detail"><span>${label}</span><p>${esc(value)}</p></div>`).join('')}<button class="primary next-button" data-action="next-word">记好了，继续 →</button></div>` : session.stage === 'verify' ? choices.length === 4 ? `<div class="choice-grid">${choices.map((choice, index) => `<button class="choice" data-action="choice" data-id="${esc(choice.id)}"><span>${'ABCD'[index]}</span>${esc(choice.english)}</button>`).join('')}</div><button class="text-button dont-know" data-action="answer" data-answer="unknown">还不会，重新记一次</button>` : '<div class="fallback-verify"><p>词库里不足 4 个不同选项，请直接输入对应的英文验证。</p><form id="spelling-form"><input name="english" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="输入英文" aria-label="英文答案" required><button class="primary compact">验证</button></form><button class="text-button" data-action="answer" data-answer="unknown">还不会，重新记一次</button></div>' : '<div class="answer-buttons"><button data-action="answer" data-answer="unknown" class="answer-unknown"><span>再学一次</span><strong>不会</strong></button><button data-action="answer" data-answer="fuzzy" class="answer-fuzzy"><span>有点印象</span><strong>模糊</strong></button><button data-action="answer" data-answer="known" class="answer-known"><span>能想起意思</span><strong>认识</strong></button></div>'}</section><p class="study-note">${session.stage === 'verify' ? '选错的词会回到英文卡片练习，再通过验证。' : '选择后显示中文释义，再点击“记好了，继续”。'}</p>`;
    if (reveal) {
      app.querySelector('.translation').insertAdjacentHTML('afterend', renderMemoryAid(word));
      if (session.stage === 'verify') app.querySelector('.answer-panel h2').insertAdjacentHTML('afterend', `<div class="solution-speech"><span>${esc(word.phonetic || '')}</span>${canSpeak ? '<button class="pronounce" data-action="speak" aria-label="朗读正确英文单词">♫ 再听一次</button>' : ''}</div>`);
    }
    app.insertAdjacentHTML('beforeend', `<p class="speech-status" data-speech-status role="status" ${speechMessage ? '' : 'hidden'}>${esc(speechMessage)}</p>`);
    speech.update(session, word, settings.autoSpeak);
  }
  function render() {
    route = location.hash.slice(1) || 'today';
    if (route !== 'study') speech.stop();
    document.querySelectorAll('[data-route]').forEach(link => link.classList.toggle('active', link.dataset.route === route || route === 'study' && link.dataset.route === 'today' || route === 'import' && link.dataset.route === 'library'));
    document.querySelector('#date-label').textContent = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
    const renderers = { today: renderToday, weak: renderWeak, library: renderLibrary, settings: renderSettings, import: renderImport, study: renderStudy };
    (renderers[route] || renderToday)();
  }
  async function startSession(selected, type = 'formal') {
    if (session && !session.done) {
      if (type === 'resume' || type === 'formal' && session.type === 'formal') {
        if (session.day !== today()) { session.type = 'practice'; session.day = today(); await commit([], { session }); toast('继续昨日的剩余练习，本轮按独立加练记录。'); }
        location.hash = '#study'; if (route === 'study') render(); return;
      }
      if (!confirm('已有未完成的练习。开始新练习会替换当前练习队列，已保存的学习记录会保留。是否开始？')) return;
    }
    if (!selected.length) { toast('当前没有待练习的单词。'); return; }
    session = { id: uid(), day: today(), type, stage: 'initial', round: 1, queue: selected.map(word => word.id), retry: [], verify: [], completed: [], total: selected.length, revealed: false, choices: null, done: false };
    await commit([], { session }); location.hash = '#study'; if (route === 'study') render();
  }
  async function answer(value) {
    if (!session || session.done || session.revealed) return;
    const previousWord = structuredClone(wordMap.get(session.queue[0]));
    const previousSession = structuredClone(session);
    const word = wordMap.get(session.queue[0]);
    if (session.day !== today()) { session.day = today(); session.type = 'practice'; toast('日期已变化，本轮剩余单词按加练记录。'); }
    if (session.type === 'formal' && session.stage === 'initial') C.recordFormal(word, value, today(), settings);
    else C.recordPractice(word, value, today());
    session.revealed = true; session.answer = value;
    try { await commit([word], { session }); }
    catch (error) { for (const key of Object.keys(word)) delete word[key]; Object.assign(word, previousWord); session = previousSession; throw error; }
    renderStudy();
  }
  function prepareChoices() {
    session.choices = session.stage === 'verify' && session.queue.length ? C.selectChoices(wordMap.get(session.queue[0]), words).map(word => word.id) : null;
  }
  async function nextWord() {
    if (!session?.revealed || session.done) return;
    const before = structuredClone(session);
    const id = session.queue.shift(), answer = session.answer;
    if (answer === 'known') {
      if (session.stage === 'recall') session.verify.push(id);
      else session.completed.push(id);
    } else session.retry.push(id);
    session.revealed = false; session.answer = null;
    if (!session.queue.length) {
      if (session.verify.length) { session.queue = session.verify.splice(0); session.stage = 'verify'; session.round++; }
      else if (session.retry.length) { session.queue = session.retry.splice(0); session.stage = 'recall'; session.round++; }
      else session.done = true;
    }
    prepareChoices();
    try { await commit([], { session }); } catch (error) { session = before; throw error; }
    renderStudy();
  }
  function download(filename, content, type) {
    if (nativeApp) { nativeApp.download(filename, content, type); return; }
    const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a');
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function createBook(forImport = false) {
    const name = prompt('新词库叫什么？例如：单词书、考试生词、笔记生词');
    if (!name?.trim()) return;
    const book = { id: uid(), name: name.trim().slice(0, 80), enabled: true, created: today() };
    const nextBooks = [...books, book]; await commit([], { books: nextBooks }); books = nextBooks;
    if (forImport) { importText = document.querySelector('#import-content')?.value || importText; importBook = book.id; renderImport(); }
    else renderLibrary();
  }
  async function confirmImport() {
    if (!importPreview?.words.length) return;
    const bookId = document.querySelector('#import-book').value;
    if (!books.some(book => book.id === bookId)) throw new Error('请先新建或选择一个词库。');
    const existing = new Set(words.filter(word => word.bookId === bookId).map(word => C.normalizeEnglish(word.english)));
    let order = words.reduce((max, word) => Math.max(max, word.order), -1) + 1, skipped = 0;
    const additions = importPreview.words.filter(word => {
      const key = C.normalizeEnglish(word.english); if (existing.has(key)) { skipped++; return false; } existing.add(key); return true;
    }).map(word => ({ ...word, id: uid(), bookId, order: order++, score: 0, started: null, due: null }));
    await commit(additions); words = words.concat(additions); rebuild();
    importPreview = null; importText = ''; libraryBook = bookId; libraryPage = 0;
    location.hash = '#library'; toast(`已导入 ${additions.length} 个单词，跳过词库内重复 ${skipped} 个。`);
  }
  function validateBackup(data) {
    if (data?.format !== 'shici-backup' || data.version !== 1 || !Array.isArray(data.words) || !Array.isArray(data.books)) throw new Error('这不是拾词生成的有效备份。');
    const bookIds = new Set();
    data.books.forEach(book => {
      if (typeof book.id !== 'string' || !book.id || bookIds.has(book.id) || typeof book.name !== 'string' || typeof book.enabled !== 'boolean') throw new Error('备份中的词库信息不完整。');
      bookIds.add(book.id);
    });
    const wordIds = new Set(), datePattern = /^\d{4}-\d{2}-\d{2}$/;
    data.words.forEach(word => {
      if (typeof word.id !== 'string' || !word.id || wordIds.has(word.id) || !bookIds.has(word.bookId) || typeof word.english !== 'string' || !word.english.trim() || typeof word.meaning !== 'string' || !word.meaning.trim() || !Number.isFinite(word.order) || !Number.isFinite(word.score) || word.score < 0) throw new Error('备份中的单词数据不完整。');
      for (const field of ['started', 'due', 'lastFormal', 'weakDay', 'practiceDay']) if (word[field] != null && !datePattern.test(word[field])) throw new Error('备份中包含无效日期。');
      for (const field of ['pos', 'phonetic', 'example', 'exampleTranslation', 'collocations', 'mnemonic', 'synonyms', 'exam']) if (word[field] != null && typeof word[field] !== 'string') throw new Error('备份中包含无效单词字段。');
      wordIds.add(word.id);
    });
    const config = data.settings;
    if (config?.autoSpeak != null && typeof config.autoSpeak !== 'boolean') throw new Error('备份中的自动发音设置无效。');
    if (!config || !Number.isInteger(config.planDays) || config.planDays < 1 || config.planDays > 365 || !Number.isInteger(config.dailyOverride) || config.dailyOverride < 0 || config.dailyOverride > 100000 || !['half', 'subtract'].includes(config.successRule) || !Array.isArray(config.intervals) || !config.intervals.length || config.intervals.some((value, index) => !Number.isInteger(value) || value < 1 || value > 3650 || index && value <= config.intervals[index - 1])) throw new Error('备份中的学习设置无效。');
    const s = data.session;
    if (s != null && (!['formal', 'practice'].includes(s.type) || !['initial', 'recall', 'verify'].includes(s.stage) || !datePattern.test(s.day) || !Number.isInteger(s.total) || s.total < 1 || !Number.isInteger(s.round) || s.round < 1 || ['queue', 'retry', 'verify', 'completed'].some(key => !Array.isArray(s[key]) || s[key].some(id => !wordIds.has(id))) || !Array.isArray(s.choices || []) || (s.choices || []).some(id => !wordIds.has(id)) || (!s.done && !s.queue.length))) throw new Error('备份中的练习进度无效。');
    return data;
  }
  async function restoreFile(file) {
    const data = validateBackup(JSON.parse(await file.text()));
    if (!confirm(`恢复 ${data.books.length} 个词库、${data.words.length} 个单词及其学习进度？这会替换当前数据。建议先导出完整备份。`)) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['words', 'meta'], 'readwrite'); tx.objectStore('words').clear(); tx.objectStore('meta').clear();
      data.words.forEach(word => tx.objectStore('words').put(word));
      const meta = tx.objectStore('meta'); meta.put(data.books, 'books'); meta.put(data.settings, 'settings'); meta.put(data.session || null, 'session'); meta.put(true, 'initialized');
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
    words = data.words; books = data.books; settings = { ...settingsDefault, ...data.settings }; session = data.session || null; rebuild(); render(); toast('词库和学习进度已恢复。');
  }
  async function dispatch(action, element) {
    const info = planInfo();
    switch (action) {
      case 'start-all': return startSession([...info.dueWords, ...info.newWords], session && !session.done ? 'resume' : 'formal');
      case 'start-new': return startSession(info.newWords);
      case 'start-review': return startSession(info.dueWords);
      case 'demo': return startSession(words.filter(word => books.find(book => book.id === word.bookId)?.demo).slice(0, 10), 'practice');
      case 'practice-weak': return startSession(weakWords(), 'practice');
      case 'practice-one': return startSession([wordMap.get(element.dataset.id)], 'practice');
      case 'answer': return answer(element.dataset.answer);
      case 'choice': return answer(element.dataset.id === session.queue[0] ? 'known' : 'unknown');
      case 'next-word': return nextWord();
      case 'leave-study': location.hash = '#today'; return;
      case 'end-session': session = null; await commit([], { session }); location.hash = '#today'; return;
      case 'speak': {
        if (session?.stage === 'verify' && !session.revealed) return;
        speech.replay(wordMap.get(session?.queue[0])); return;
      }
      case 'weak-today': weakScope = 'today'; return renderWeak();
      case 'weak-all': weakScope = 'all'; return renderWeak();
      case 'weak-reveal': weakReveal = !weakReveal; return renderWeak();
      case 'export-weak': return download(`拾词-薄弱词-${today()}.csv`, C.exportCSV(weakWords()), 'text/csv;charset=utf-8');
      case 'export-library': return download(`拾词-词库-${today()}.csv`, C.exportCSV(words.filter(word => libraryBook === 'all' || word.bookId === libraryBook)), 'text/csv;charset=utf-8');
      case 'speech-settings': nativeApp?.openSpeechSettings(); return;
      case 'show-import': importPreview = null; location.hash = '#import'; return;
      case 'back-library': location.hash = '#library'; return;
      case 'new-book': return createBook();
      case 'new-book-import': return createBook(true);
      case 'view-book': libraryBook = element.dataset.id; libraryQuery = ''; libraryPage = 0; return renderLibrary();
      case 'rename-book': {
        const book = books.find(book => book.id === element.dataset.id), name = prompt('修改词库名称', book.name);
        if (!name?.trim()) return; const nextBooks = books.map(b => b.id === book.id ? { ...b, name: name.trim().slice(0, 80) } : b);
        await commit([], { books: nextBooks }); books = nextBooks; return renderLibrary();
      }
      case 'sample-import': importText = sample.slice(0, 10).map(row => row.slice(0, 3).join('\t')).join('\n'); importPreview = null; importBook = document.querySelector('#import-book').value; return renderImport();
      case 'confirm-import': return confirmImport();
      case 'page-prev': libraryPage = Math.max(0, libraryPage - 1); return renderLibrary();
      case 'page-next': libraryPage++; return renderLibrary();
      case 'backup': return download(`拾词-完整备份-${today()}.json`, JSON.stringify({ format: 'shici-backup', version: 1, exportedAt: new Date().toISOString(), words, books, settings, session }, null, 2), 'application/json;charset=utf-8');
    }
  }
  async function guarded(fn) {
    if (busy) return; busy = true;
    document.body.classList.add('busy');
    try { await fn(); } catch (error) { console.error(error); toast(error.name === 'QuotaExceededError' ? '设备存储空间不足，请先导出备份并释放空间。' : error.message || '操作未完成，请重试。'); }
    finally { busy = false; document.body.classList.remove('busy'); }
  }
  app.addEventListener('click', event => {
    const element = event.target.closest('[data-action]'); if (element && !element.disabled) guarded(() => dispatch(element.dataset.action, element));
  });
  app.addEventListener('change', event => guarded(async () => {
    const target = event.target;
    if (target.id === 'weak-book') { weakBook = target.value; renderWeak(); }
    if (target.id === 'library-book') { libraryBook = target.value; libraryPage = 0; renderLibrary(); }
    if (target.id === 'import-book') { importBook = target.value; }
    if (target.dataset.bookToggle) {
      const nextBooks = books.map(book => book.id === target.dataset.bookToggle ? { ...book, enabled: target.checked } : book);
      await commit([], { books: nextBooks }); books = nextBooks; renderLibrary();
    }
    if (target.id === 'import-file' && target.files[0]) {
      importText = await target.files[0].text(); if (importText.includes('\uFFFD')) throw new Error('文件不是有效 UTF-8 编码，请在保存文件时选择 UTF-8。');
      importPreview = null; importBook = document.querySelector('#import-book').value; renderImport(); toast('文件已读取，请检查并预览。');
    }
    if (target.id === 'restore-file' && target.files[0]) { await restoreFile(target.files[0]); target.value = ''; }
  }));
  app.addEventListener('input', event => {
    if (event.target.id === 'import-content') { importText = event.target.value; importPreview = null; document.querySelector('#import-preview').innerHTML = ''; }
    if (event.target.id === 'library-search') {
      libraryQuery = event.target.value; libraryPage = 0;
      clearTimeout(renderLibrary.timeout); renderLibrary.timeout = setTimeout(() => {
        if (route !== 'library') return;
        const input = document.querySelector('#library-search'); const focused = document.activeElement === input;
        renderLibrary(); if (focused) { const next = document.querySelector('#library-search'); next.focus(); }
      }, 220);
    }
  });
  app.addEventListener('submit', event => {
    event.preventDefault(); const form = event.target;
    guarded(async () => {
      if (form.id === 'import-form') { importText = document.querySelector('#import-content').value; importPreview = C.parseImport(importText); showImportPreview(); }
      if (form.id === 'spelling-form') await answer(C.normalizeEnglish(new FormData(form).get('english')) === C.normalizeEnglish(wordMap.get(session.queue[0]).english) ? 'known' : 'unknown');
      if (form.id === 'settings-form') {
        const data = new FormData(form), intervals = String(data.get('intervals')).split(/[,，\s]+/).filter(Boolean).map(Number);
        const nextSettings = { planDays: Number(data.get('planDays')), dailyOverride: Number(data.get('dailyOverride')), successRule: data.get('successRule'), intervals, autoSpeak: data.has('autoSpeak') };
        if (!Number.isInteger(nextSettings.planDays) || !Number.isInteger(nextSettings.dailyOverride) || !intervals.length || intervals.some((value, index) => !Number.isInteger(value) || value < 1 || value > 3650 || index && value <= intervals[index - 1])) throw new Error('请输入递增的正整数复习天数，例如 1, 2, 4, 7, 15, 30。');
        await commit([], { settings: nextSettings }); settings = nextSettings; toast('设置已保存，已安排的复习日期保留；后续正式结果使用新日程。');
      }
    });
  });
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; document.querySelector('#install-button').hidden = false; });
  document.querySelector('#install-button').addEventListener('click', async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; document.querySelector('#install-button').hidden = true; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) speech.pause(); else if (db) render(); });
  window.addEventListener('pagehide', () => speech.stop());
  async function initialize() {
    try {
      db = await openDB();
      const initialized = await read('meta', 'initialized');
      if (!initialized) {
        const book = { id: uid(), name: '先试一试 · 示例词库', enabled: true, demo: true, created: today() };
        const seeded = sample.map(([english, pos, meaning, phonetic], order) => ({ id: uid(), bookId: book.id, english, pos, meaning, phonetic, order, score: 0, started: null, due: null }));
        await commit(seeded, { books: [book], settings: settingsDefault, session: null, initialized: true });
      }
      [words, books, settings, session] = await Promise.all([read('words'), read('meta', 'books'), read('meta', 'settings'), read('meta', 'session')]);
      settings = { ...settingsDefault, ...settings }; books = books || []; rebuild(); render();
      if (!nativeApp && 'serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Offline cache unavailable', error));
      if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
    } catch (error) {
      console.error(error); app.innerHTML = '<section class="panel empty-state"><h1>浏览器存储暂时不可用</h1><p>请在正常浏览模式下，通过启动脚本提供的网址打开，允许浏览器保存网站数据，然后重新加载。</p><button class="primary compact" onclick="location.reload()">重新加载</button></section>';
    }
  }
  initialize();
})();
