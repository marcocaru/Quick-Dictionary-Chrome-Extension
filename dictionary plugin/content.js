(() => {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────
  const API_BASE     = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
  const MAX_CRUMBS   = 8;
  const POPUP_MARGIN = 14;

  // ── State ──────────────────────────────────────────────────────────────
  let mouseX = 0, mouseY = 0;
  let sessionHistory  = [];
  let historyIndex    = -1;
  let hideTimer       = null;
  let currentWord     = '';
  let currentAudio    = null;
  let audioState      = 'idle';
  let currentAudioUrl = null;
  let activeTab       = 'definition';
  let currentData     = null;
  let isCurrentSaved  = false;

  // ── Create popup ───────────────────────────────────────────────────────
  const popup = document.createElement('div');
  popup.id = 'dict-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'Dictionary definition');
  document.body.appendChild(popup);

  // ── Track mouse ────────────────────────────────────────────────────────
  document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

  // ── Hide on outside click ──────────────────────────────────────────────
  document.addEventListener('mousedown', e => { if (!popup.contains(e.target)) hidePopup(); });

  // ── Escape key ────────────────────────────────────────────────────────
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hidePopup(); });

  // ── Text selection ─────────────────────────────────────────────────────
  document.addEventListener('mouseup', async e => {
    if (popup.contains(e.target)) return;
    await delay(60);
    const sel  = window.getSelection();
    const word = sel?.toString().trim().replace(/[^a-zA-Z'-]/g, '');
    if (!word || word.length < 2 || word.includes(' ')) return;
    if (word === currentWord && popup.classList.contains('visible')) return;
    sessionHistory = []; historyIndex = -1; activeTab = 'definition';
    await lookupWord(word, true);
  });

  // ── Message from background (context menu) ────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'DEFINE_WORD') {
      sessionHistory = []; historyIndex = -1; activeTab = 'definition';
      mouseX = window.innerWidth / 2;
      mouseY = window.innerHeight / 3;
      lookupWord(msg.word, true);
    }
  });

  // ── Popup click delegation ─────────────────────────────────────────────
  popup.addEventListener('click', async e => {
    if (e.target.closest('#dict-close-btn'))  { hidePopup();      return; }
    if (e.target.closest('#dict-audio-btn'))  { playAudio();      return; }
    if (e.target.closest('#dict-star-btn'))   { handleStar();     return; }

    const tab = e.target.closest('[data-tab]');
    if (tab) {
      const t = tab.dataset.tab;
      if (t !== activeTab) { activeTab = t; if (currentData) renderDefinition(currentData, false); }
      return;
    }

    const crumb = e.target.closest('[data-crumb-index]');
    if (crumb) { navigateToHistoryIndex(parseInt(crumb.dataset.crumbIndex, 10)); return; }

    const wordEl = e.target.closest('.dict-clickable-word');
    if (wordEl?.dataset.word) {
      sessionHistory = sessionHistory.slice(0, historyIndex + 1);
      activeTab = 'definition';
      await lookupWord(wordEl.dataset.word, true);
    }
  });

  // ── Core lookup ────────────────────────────────────────────────────────
  async function lookupWord(word, addToHistory = true) {
    currentWord = word;
    renderLoading(word);
    positionPopup();

    try {
      const res = await fetch(`${API_BASE}${encodeURIComponent(word.toLowerCase())}`);
      if (word !== currentWord) return;
      if (!res.ok) throw new Error('not_found');

      const data = await res.json();
      currentData = data;

      if (addToHistory) {
        sessionHistory.push({ word, data });
        if (sessionHistory.length > MAX_CRUMBS) sessionHistory.shift();
        historyIndex = sessionHistory.length - 1;

        chrome.runtime.sendMessage({ type: 'ADD_TO_HISTORY', entry: buildStorageEntry(data) });
        chrome.runtime.sendMessage({ type: 'IS_SAVED', word }, r => {
          isCurrentSaved = r?.isSaved || false;
          updateStarBtn();
        });
      }

      renderDefinition(data);

    } catch {
      if (word !== currentWord) return;
      renderError(word);
    }
  }

  function buildStorageEntry(data) {
    const e = data[0], m = e.meanings[0];
    return {
      word:       e.word,
      phonetic:   e.phonetic || '',
      pos:        m?.partOfSpeech || '',
      definition: m?.definitions[0]?.definition || '',
      lookedUpAt: Date.now(),
    };
  }

  function navigateToHistoryIndex(idx) {
    if (idx < 0 || idx >= sessionHistory.length) return;
    historyIndex = idx;
    currentWord  = sessionHistory[idx].word;
    currentData  = sessionHistory[idx].data;
    activeTab    = 'definition';
    chrome.runtime.sendMessage({ type: 'IS_SAVED', word: currentWord }, r => {
      isCurrentSaved = r?.isSaved || false;
      renderDefinition(currentData, false);
    });
  }

  // ── Star ───────────────────────────────────────────────────────────────
  function handleStar() {
    if (!currentData) return;
    chrome.runtime.sendMessage({ type: 'TOGGLE_SAVED', entry: buildStorageEntry(currentData) }, r => {
      isCurrentSaved = r?.isSaved || false;
      updateStarBtn();
      showStarToast(isCurrentSaved);
    });
  }

  function updateStarBtn() {
    const btn = document.getElementById('dict-star-btn');
    if (!btn) return;
    btn.dataset.saved = isCurrentSaved ? 'true' : 'false';
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', isCurrentSaved ? 'currentColor' : 'none');
  }

  function showStarToast(saved) {
    document.getElementById('dict-toast')?.remove();
    const t = document.createElement('div');
    t.id = 'dict-toast';
    t.textContent = saved ? '★  Word saved' : 'Word removed';
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('visible'));
    setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 300); }, 2200);
  }

  // ── Positioning ────────────────────────────────────────────────────────
  function positionPopup() {
    popup.classList.remove('hiding');
    popup.classList.add('visible');
    requestAnimationFrame(() => {
      const pw = popup.offsetWidth  || 360;
      const ph = popup.offsetHeight || 320;
      const vw = window.innerWidth, vh = window.innerHeight;
      let x = mouseX + POPUP_MARGIN, y = mouseY + POPUP_MARGIN;
      if (x + pw > vw - POPUP_MARGIN) x = mouseX - pw - POPUP_MARGIN;
      if (y + ph > vh - POPUP_MARGIN) y = mouseY - ph - POPUP_MARGIN;
      popup.style.left = Math.max(POPUP_MARGIN, x) + 'px';
      popup.style.top  = Math.max(POPUP_MARGIN, y) + 'px';
    });
  }

  // ── Hide ───────────────────────────────────────────────────────────────
  function hidePopup() {
    if (!popup.classList.contains('visible')) return;
    stopAudio();
    popup.classList.add('hiding');
    popup.classList.remove('visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      popup.classList.remove('hiding');
      currentWord = '';
    }, 300);
  }

  // ── Render: loading ────────────────────────────────────────────────────
  function renderLoading(word) {
    popup.innerHTML = `
      ${headerHTML(word)}
      <div class="dict-loading-section">
        <div class="dict-skeleton dict-skeleton-word"></div>
        <div class="dict-skeleton dict-skeleton-ph"></div>
        <div class="dict-skeleton dict-skeleton-line1"></div>
        <div class="dict-skeleton dict-skeleton-line2"></div>
        <div class="dict-skeleton dict-skeleton-line3"></div>
      </div>`;
  }

  // ── Render: definition ─────────────────────────────────────────────────
  function renderDefinition(data, reposition = true) {
    const entry        = data[0];
    const word         = entry.word;
    const phoneticInfo = getPhoneticInfo(entry);
    currentAudioUrl    = phoneticInfo.audio ? normalizeAudio(phoneticInfo.audio) : null;
    audioState         = 'idle';

    // Collect synonyms / antonyms across all meanings + definitions
    const synSet = new Set(), antSet = new Set();
    entry.meanings.forEach(m => {
      m.synonyms?.forEach(s => synSet.add(s));
      m.antonyms?.forEach(a => antSet.add(a));
      m.definitions?.forEach(d => {
        d.synonyms?.forEach(s => synSet.add(s));
        d.antonyms?.forEach(a => antSet.add(a));
      });
    });
    const synonyms = [...synSet].slice(0, 20);
    const antonyms = [...antSet].slice(0, 20);
    const hasSynTab = synonyms.length > 0 || antonyms.length > 0;

    // Meanings
    let meaningsHTML = '';
    entry.meanings.slice(0, 3).forEach((m, i) => {
      const def = m.definitions[0]?.definition || '';
      const ex  = m.definitions[0]?.example    || '';
      meaningsHTML += `
        <div class="dict-meaning-block" style="animation-delay:${i*55}ms">
          <div class="dict-pos-chip">${escapeHTML(m.partOfSpeech)}</div>
          <div class="dict-def">${makeClickable(def)}</div>
          ${ex ? `<div class="dict-example">"${escapeHTML(ex)}"</div>` : ''}
        </div>`;
    });

    popup.innerHTML = `
      ${headerHTML(word)}
      ${breadcrumbHTML()}
      <div class="dict-word-section">
        <div class="dict-word-row">
          <div class="dict-word">${escapeHTML(word)}</div>
          <div class="dict-word-actions">
            ${currentAudioUrl ? `
            <button id="dict-audio-btn" class="dict-audio-btn" data-state="idle"
              aria-label="Play pronunciation" title="Hear pronunciation">
              <svg class="dict-audio-icon" width="17" height="17" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              </svg>
            </button>` : ''}
            <button id="dict-star-btn" class="dict-star-btn"
              data-saved="${isCurrentSaved}"
              aria-label="${isCurrentSaved ? 'Remove from saved' : 'Save word'}"
              title="${isCurrentSaved ? 'Remove from saved' : 'Save word'}">
              <svg width="17" height="17" viewBox="0 0 24 24"
                fill="${isCurrentSaved ? 'currentColor' : 'none'}"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
          </div>
        </div>
        ${phoneticInfo.text ? `<div class="dict-phonetic">${escapeHTML(phoneticInfo.text)}</div>` : ''}
      </div>

      ${hasSynTab ? `
      <div class="dict-tabs">
        <button class="dict-tab${activeTab==='definition'?' active':''}" data-tab="definition">Definition</button>
        <button class="dict-tab${activeTab==='synonyms'?' active':''}" data-tab="synonyms">Synonyms</button>
      </div>` : '<div class="dict-divider"></div>'}

      <div class="dict-tab-content">
        <div class="dict-pane${activeTab==='definition'?' active':''}">
          <div class="dict-meanings">${meaningsHTML}</div>
        </div>
        <div class="dict-pane${activeTab==='synonyms'?' active':''}">
          ${buildSynonymHTML(synonyms, antonyms)}
        </div>
      </div>

      <div class="dict-footer">
        <span class="dict-hint-text"><span class="dict-hint-dot"></span>Click any word to define it</span>
        <span class="dict-source-link">Free Dictionary</span>
      </div>`;

    if (reposition) positionPopup();
  }

  function buildSynonymHTML(synonyms, antonyms) {
    if (synonyms.length === 0 && antonyms.length === 0)
      return `<div class="dict-syn-section"><p class="dict-syn-empty">No synonyms or antonyms found.</p></div>`;
    let html = '<div class="dict-syn-section">';
    if (synonyms.length) {
      html += `<div class="dict-syn-label">Synonyms</div><div class="dict-syn-chips">`;
      synonyms.forEach(s => {
        html += `<span class="dict-syn-chip dict-clickable-word" data-word="${escapeHTML(s.toLowerCase())}">${escapeHTML(s)}</span>`;
      });
      html += `</div>`;
    }
    if (antonyms.length) {
      html += `<div class="dict-syn-label" style="margin-top:14px">Antonyms</div><div class="dict-syn-chips">`;
      antonyms.forEach(a => {
        html += `<span class="dict-syn-chip dict-ant-chip dict-clickable-word" data-word="${escapeHTML(a.toLowerCase())}">${escapeHTML(a)}</span>`;
      });
      html += `</div>`;
    }
    return html + '</div>';
  }

  // ── Render: error ──────────────────────────────────────────────────────
  function renderError(word) {
    popup.innerHTML = `
      ${headerHTML(word)}
      ${breadcrumbHTML()}
      <div class="dict-error-section">
        <div class="dict-error-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8"    x2="12"    y2="12"/>
            <line x1="12" y1="16"   x2="12.01" y2="16"/>
          </svg>
        </div>
        <div>
          <div class="dict-error-title">No results for "${escapeHTML(word)}"</div>
          <div class="dict-error-body">Try a different spelling or check the word.</div>
        </div>
      </div>`;
  }

  // ── Shared HTML builders ───────────────────────────────────────────────
  function headerHTML() {
    return `
      <div class="dict-header">
        <svg class="dict-logo" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
            10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
            fill="currentColor" opacity="0.7"/>
        </svg>
        <span class="dict-label">Define</span>
        <button id="dict-close-btn" class="dict-close-btn" aria-label="Close" title="Close (Esc)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6"  x2="6"  y2="18"/>
            <line x1="6"  y1="6"  x2="18" y2="18"/>
          </svg>
        </button>
      </div>`;
  }

  function breadcrumbHTML() {
    if (sessionHistory.length <= 1) return '';
    return `<div class="dict-breadcrumb">${
      sessionHistory.map((item, i) => `
        ${i > 0 ? '<span class="dict-crumb-sep">›</span>' : ''}
        <span class="dict-crumb${i === historyIndex ? ' active' : ''}"
          data-crumb-index="${i}">${escapeHTML(item.word)}</span>
      `).join('')
    }</div>`;
  }

  // ── Audio ──────────────────────────────────────────────────────────────
  function playAudio() {
    if (!currentAudioUrl) return;
    if (currentAudio && audioState === 'playing') { stopAudio(); return; }
    stopAudio();
    currentAudio = new Audio(currentAudioUrl);
    audioState   = 'playing';
    setAudioBtnState('playing');
    currentAudio.addEventListener('ended', () => { audioState = 'idle'; setAudioBtnState('idle'); });
    currentAudio.addEventListener('error', () => {
      audioState = 'error'; setAudioBtnState('error');
      setTimeout(() => { audioState = 'idle'; setAudioBtnState('idle'); }, 2000);
    });
    currentAudio.play().catch(() => { audioState = 'error'; setAudioBtnState('error'); });
  }

  function stopAudio() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    audioState = 'idle';
  }

  function setAudioBtnState(state) {
    const btn  = document.getElementById('dict-audio-btn');
    const icon = btn?.querySelector('.dict-audio-icon');
    if (!btn || !icon) return;
    btn.dataset.state = state;
    if (state === 'playing') {
      icon.innerHTML = `<rect x="6" y="5" width="3" height="14" rx="1"/>
                        <rect x="15" y="5" width="3" height="14" rx="1"/>`;
    } else if (state === 'error') {
      icon.innerHTML = `<line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6"  y1="6" x2="18" y2="18"/>`;
    } else {
      icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>`;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  function getPhoneticInfo(entry) {
    if (entry.phonetics) {
      const b = entry.phonetics.find(p => p.text && p.audio);
      if (b) return { text: b.text, audio: b.audio };
      const a = entry.phonetics.find(p => p.audio);
      if (a) return { text: a.text || entry.phonetic || '', audio: a.audio };
      const t = entry.phonetics.find(p => p.text);
      if (t) return { text: t.text, audio: null };
    }
    return { text: entry.phonetic || '', audio: null };
  }

  function normalizeAudio(url) {
    if (!url) return null;
    return url.startsWith('//') ? 'https:' + url : url;
  }

  function makeClickable(text) {
    if (!text) return '';
    return escapeHTML(text).replace(/([a-zA-Z''-]{2,})/g, m =>
      `<span class="dict-clickable-word" data-word="${m.toLowerCase()}">${m}</span>`
    );
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;')
              .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

})();
