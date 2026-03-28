'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let activePanel = 'history';
let allHistory  = [];
let allSaved    = [];
let filterText  = '';

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadPanel();

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activePanel = btn.dataset.panel;
      filterText  = '';
      document.getElementById('search-input').value = '';
      renderList();
    });
  });

  // Search filter
  document.getElementById('search-input').addEventListener('input', e => {
    filterText = e.target.value.toLowerCase().trim();
    renderList();
  });

  // Clear button
  document.getElementById('clear-btn').addEventListener('click', () => {
    const msg = activePanel === 'history'
      ? 'Clear your entire lookup history?'
      : 'Remove all saved words?';
    if (!confirm(msg)) return;

    const type = activePanel === 'history' ? 'CLEAR_HISTORY' : 'CLEAR_SAVED';
    chrome.runtime.sendMessage({ type }, () => {
      if (activePanel === 'history') allHistory = [];
      else allSaved = [];
      renderList();
    });
  });
});

// ── Load data from background ──────────────────────────────────────────────
function loadPanel() {
  chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, r => {
    allHistory = r?.history || [];
    chrome.runtime.sendMessage({ type: 'GET_SAVED' }, r2 => {
      allSaved = r2?.saved || [];
      renderList();
    });
  });
}

// ── Render list ────────────────────────────────────────────────────────────
function renderList() {
  const list = document.getElementById('word-list');
  const data = activePanel === 'history' ? allHistory : allSaved;

  // Filter
  const filtered = filterText
    ? data.filter(e => e.word.toLowerCase().includes(filterText))
    : data;

  if (filtered.length === 0) {
    list.innerHTML = emptyHTML();
    return;
  }

  if (activePanel === 'history') {
    renderHistoryList(list, filtered);
  } else {
    renderSavedList(list, filtered);
  }
}

function renderHistoryList(list, items) {
  // Group by date
  const groups = {};
  items.forEach(item => {
    const label = dateLabel(item.lookedUpAt);
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });

  let html = '';
  Object.entries(groups).forEach(([label, group]) => {
    html += `<div class="list-date-header">${label}</div>`;
    group.forEach(item => {
      const savedClass = allSaved.some(s => s.word.toLowerCase() === item.word.toLowerCase());
      html += wordItemHTML(item, savedClass);
    });
  });

  list.innerHTML = html;
  attachItemListeners(list);
}

function renderSavedList(list, items) {
  let html = '';
  items.forEach(item => {
    html += wordItemHTML(item, true);
  });
  list.innerHTML = html;
  attachItemListeners(list);
}

function wordItemHTML(item, isSaved) {
  const shortDef = item.definition
    ? (item.definition.length > 60 ? item.definition.slice(0, 57) + '…' : item.definition)
    : '';
  const timeStr  = timeAgo(item.lookedUpAt);

  return `
    <div class="word-item" data-word="${escapeAttr(item.word)}">
      <div class="word-item-text">
        <div class="word-item-word">${escapeHTML(item.word)}</div>
        <div class="word-item-meta">
          ${item.pos ? `<span class="word-item-pos">${escapeHTML(item.pos)}</span>` : ''}
          ${escapeHTML(shortDef)}
        </div>
      </div>
      <span class="word-item-time">${timeStr}</span>
      <button class="star-toggle" data-word="${escapeAttr(item.word)}" data-saved="${isSaved}"
        aria-label="${isSaved ? 'Remove from saved' : 'Save word'}" title="${isSaved ? 'Unsave' : 'Save'}">
        <svg width="15" height="15" viewBox="0 0 24 24"
          fill="${isSaved ? 'currentColor' : 'none'}"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </button>
    </div>`;
}

function attachItemListeners(list) {
  // Click word row → open new tab and define
  list.querySelectorAll('.word-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.star-toggle')) return;
      const word = item.dataset.word;
      // Open a new tab with the word searched on the free dictionary site
      chrome.tabs.create({ url: `https://www.thefreedictionary.com/${encodeURIComponent(word)}` });
    });
  });

  // Star toggle
  list.querySelectorAll('.star-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const word     = btn.dataset.word;
      const isSaved  = btn.dataset.saved === 'true';
      const source   = activePanel === 'history' ? allHistory : allSaved;
      const entry    = source.find(e => e.word.toLowerCase() === word.toLowerCase())
                    || allHistory.find(e => e.word.toLowerCase() === word.toLowerCase());
      if (!entry) return;

      chrome.runtime.sendMessage({ type: 'TOGGLE_SAVED', entry }, r => {
        const nowSaved = r?.isSaved || false;
        // Update local saved cache
        if (nowSaved) {
          if (!allSaved.find(s => s.word.toLowerCase() === word.toLowerCase())) {
            allSaved.unshift({ ...entry, savedAt: Date.now() });
          }
        } else {
          allSaved = allSaved.filter(s => s.word.toLowerCase() !== word.toLowerCase());
        }

        // Update the button in-place without re-rendering entire list
        btn.dataset.saved = nowSaved ? 'true' : 'false';
        const svg = btn.querySelector('svg');
        if (svg) svg.setAttribute('fill', nowSaved ? 'currentColor' : 'none');

        // If on saved panel and removing, re-render
        if (activePanel === 'saved' && !nowSaved) renderList();
      });
    });
  });
}

// ── Empty state ────────────────────────────────────────────────────────────
function emptyHTML() {
  const isHistory = activePanel === 'history';
  const icon = isHistory
    ? `<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
    : `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>`;
  const title = filterText
    ? `No matches for "${filterText}"`
    : isHistory ? 'No words looked up yet' : 'No saved words yet';
  const body = filterText
    ? 'Try a different search term.'
    : isHistory
      ? 'Highlight any word on a webpage to look it up.'
      : 'Star words from the popup or History tab to save them here.';

  return `
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="24" height="24" viewBox="0 0 24 24">${icon}</svg>
      </div>
      <div class="empty-title">${title}</div>
      <div class="empty-body">${body}</div>
    </div>`;
}

// ── Utilities ──────────────────────────────────────────────────────────────
function dateLabel(ts) {
  if (!ts) return 'Earlier';
  const now  = Date.now();
  const diff = now - ts;
  const d    = new Date(ts);
  if (diff < 86400000) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  if (diff < 604800000) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000)    return 'just now';
  if (diff < 3600000)  return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff/86400000)}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function escapeAttr(str) {
  return escapeHTML(str);
}
