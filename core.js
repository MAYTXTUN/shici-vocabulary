(function (root) {
  'use strict';
  const DEFAULT_INTERVALS = [1, 2, 4, 7, 15, 30];
  function dayKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function addDays(day, count) {
    const date = new Date(`${day}T12:00:00`);
    date.setDate(date.getDate() + count);
    return dayKey(date);
  }
  function dayDistance(from, to) {
    return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
  }
  function normalizeEnglish(value) { return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
  function scoreAfter(score, answer, mode = 'half') {
    score = Number(score) || 0;
    if (answer === 'unknown') return score === 0 ? 1 : score + 2;
    if (answer === 'fuzzy') return score + 1;
    return mode === 'subtract' ? Math.max(0, score - 3) : Math.floor(score / 2);
  }
  function nextDue(started, today, intervals = DEFAULT_INTERVALS) {
    const elapsed = dayDistance(started, today);
    const offset = intervals.find(value => value > elapsed);
    return offset == null ? addDays(today, intervals[intervals.length - 1]) : addDays(started, offset);
  }
  // Only the first answer in a formal session on a calendar day changes the score and schedule.
  function recordFormal(word, answer, today, settings) {
    if (word.lastFormal === today) return false;
    word.started = word.started || today;
    word.score = scoreAfter(word.score, answer, settings.successRule);
    word.formalFailures = (word.formalFailures || 0) + (answer === 'unknown' ? 1 : 0);
    word.formalFuzzy = (word.formalFuzzy || 0) + (answer === 'fuzzy' ? 1 : 0);
    word.lastFormal = today;
    word.lastAnswer = answer;
    word.due = nextDue(word.started, today, settings.intervals);
    if (answer !== 'known') word.weakDay = today;
    return true;
  }
  function recordPractice(word, answer, today) {
    if (word.practiceDay !== today) {
      word.practiceDay = today;
      word.practiceFailures = 0;
      word.practiceFuzzy = 0;
      word.practiceCorrect = 0;
    }
    if (answer === 'unknown') word.practiceFailures++;
    else if (answer === 'fuzzy') word.practiceFuzzy++;
    else word.practiceCorrect++;
    if (answer !== 'known') word.weakDay = today;
  }
  function tokenizeCSV(input) {
    const rows = []; let row = [], cell = '', quoted = false;
    const text = input.replace(/^\uFEFF/, '');
    const firstLine = text.split(/\r?\n/, 1)[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
        else if (quoted || cell === '') quoted = !quoted;
        else cell += c;
      } else if (!quoted && c === delimiter) { row.push(cell.trim()); cell = ''; }
      else if (!quoted && (c === '\n' || c === '\r')) {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
        row = []; cell = '';
      } else cell += c;
    }
    if (quoted) throw new Error('有一处引号没有闭合，请检查导入内容。');
    row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
    return rows;
  }
  const aliases = {
    english: ['英文', '单词', 'english', 'word'], meaning: ['中文', '中文释义', '释义', 'meaning', 'translation'],
    pos: ['词性', 'pos'], phonetic: ['音标', 'phonetic', 'ipa'], example: ['例句', 'example'],
    exampleTranslation: ['例句翻译', 'exampletranslation'], collocations: ['搭配', '词组搭配', 'collocations'],
    mnemonic: ['记忆方法', 'mnemonic'], synonyms: ['近义词', 'synonyms'], exam: ['考试年份', '年份次数', 'exam']
  };
  const fields = ['english', 'pos', 'meaning', 'phonetic', 'example', 'exampleTranslation', 'collocations', 'mnemonic', 'synonyms', 'exam'];
  function parseImport(input) {
    if (!input.trim()) return { words: [], errors: [], duplicates: 0 };
    let rows;
    const firstLine = input.trim().split(/\r?\n/, 1)[0];
    const firstCell = firstLine.split(',')[0].trim().toLowerCase();
    const columnFormat = firstLine.includes('\t') || firstLine.includes(',') &&
      (/^"/.test(firstLine) || /^[a-z][a-z0-9\s'’\-]*$/i.test(firstCell) || Object.values(aliases).some(values => values.includes(firstCell)));
    if (columnFormat) rows = tokenizeCSV(input);
    else rows = input.replace(/^\uFEFF/, '').split(/\r?\n/).filter(s => s.trim()).map(line => {
      const match = line.trim().match(/^([A-Za-z][A-Za-z\s'’\-]*?)\s+((?:n|v|vt|vi|adj|adv|prep|pron|conj|interj|num|art|aux|phr)\.)\s*(.+)$/i);
      if (match) return [match[1], match[2], match[3]];
      const simple = line.trim().match(/^([A-Za-z][A-Za-z\s'’\-]*?)\s+([^A-Za-z].*)$/);
      return simple ? [simple[1], '', simple[2]] : [line.trim()];
    });
    const header = rows[0] || [];
    const mapping = header.map(value => Object.keys(aliases).find(key => aliases[key].includes(value.toLowerCase().trim())));
    const hasHeader = mapping.includes('english') && mapping.includes('meaning');
    const words = [], errors = [], seen = new Set(); let duplicates = 0;
    rows.slice(hasHeader ? 1 : 0).forEach((row, index) => {
      const word = {};
      if (hasHeader) row.forEach((value, column) => { if (mapping[column]) word[mapping[column]] = value; });
      else {
        const order = row.length === 2 ? ['english', 'meaning'] : fields;
        row.forEach((value, column) => { if (order[column]) word[order[column]] = value; });
      }
      word.english = String(word.english || '').trim();
      word.meaning = String(word.meaning || '').trim();
      if (!word.english || !word.meaning || !/[a-z]/i.test(word.english)) {
        errors.push({ line: index + (hasHeader ? 2 : 1), message: '缺少英文或中文释义', text: row.join(' / ') }); return;
      }
      const key = normalizeEnglish(word.english);
      if (seen.has(key)) { duplicates++; return; }
      seen.add(key); words.push(word);
    });
    return { words, errors, duplicates };
  }
  function csvCell(value) { return '"' + String(value || '').replace(/"/g, '""') + '"'; }
  function exportCSV(words) {
    return '\uFEFF' + [['英文', '词性', '中文释义', '音标', '例句', '例句翻译', '搭配', '记忆方法', '近义词', '考试年份'], ...words.map(word => fields.map(field => word[field]))].map(row => row.map(csvCell).join(',')).join('\r\n');
  }
  function selectChoices(target, pool, random = Math.random) {
    const choices = [target], used = new Set([normalizeEnglish(target.english)]);
    const options = pool.filter(word => normalizeEnglish(word.english) !== normalizeEnglish(target.english) && word.meaning.trim() !== target.meaning.trim());
    // Bounded partial shuffle also works for very large vocabularies.
    for (let i = 0; i < options.length && choices.length < 4; i++) {
      const j = i + Math.floor(random() * (options.length - i));
      [options[i], options[j]] = [options[j], options[i]];
      const word = options[i], key = normalizeEnglish(word.english);
      if (!used.has(key)) { used.add(key); choices.push(word); }
    }
    if (choices.length < 4) return [];
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return choices;
  }
  function dailyQuota(total, days = 20) { return Math.ceil(total / days); }
  const api = { DEFAULT_INTERVALS, dayKey, addDays, dayDistance, normalizeEnglish, scoreAfter, nextDue, recordFormal, recordPractice, parseImport, exportCSV, selectChoices, dailyQuota };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WordCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
