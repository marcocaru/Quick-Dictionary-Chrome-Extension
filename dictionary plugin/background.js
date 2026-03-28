// ── Context Menu Setup ─────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'dict-define',
    title: 'Define "%s"',
    contexts: ['selection'],
  });
});

// ── Context Menu Click → send to content script ────────────────────────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'dict-define') return;
  const word = info.selectionText?.trim().replace(/[^a-zA-Z'-]/g, '');
  if (!word || !tab?.id) return;

  chrome.tabs.sendMessage(tab.id, {
    type: 'DEFINE_WORD',
    word,
    fromContextMenu: true,
  });
});

// ── Storage helpers ────────────────────────────────────────────────────────
const STORAGE_KEY = 'dict_saved_words';
const HISTORY_KEY = 'dict_lookup_history';
const MAX_SAVED   = 500;
const MAX_HISTORY = 200;

// Save a word to the persistent word history log
async function addToLookupHistory(entry) {
  const result = await chrome.storage.local.get(HISTORY_KEY);
  let log = result[HISTORY_KEY] || [];

  // Deduplicate: remove existing entry for same word, push new one to front
  log = log.filter(e => e.word.toLowerCase() !== entry.word.toLowerCase());
  log.unshift(entry);

  // Cap
  if (log.length > MAX_HISTORY) log = log.slice(0, MAX_HISTORY);

  await chrome.storage.local.set({ [HISTORY_KEY]: log });

  // Update badge with count
  updateBadge(log.length);
}

// Toggle a word in the saved (starred) list
async function toggleSavedWord(entry) {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  let saved = result[STORAGE_KEY] || [];

  const exists = saved.findIndex(e => e.word.toLowerCase() === entry.word.toLowerCase());
  let isSaved;

  if (exists >= 0) {
    saved.splice(exists, 1);
    isSaved = false;
  } else {
    saved.unshift({ ...entry, savedAt: Date.now() });
    if (saved.length > MAX_SAVED) saved = saved.slice(0, MAX_SAVED);
    isSaved = true;
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: saved });
  return isSaved;
}

async function getSavedWords() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

async function isWordSaved(word) {
  const saved = await getSavedWords();
  return saved.some(e => e.word.toLowerCase() === word.toLowerCase());
}

async function clearHistory() {
  await chrome.storage.local.remove(HISTORY_KEY);
  updateBadge(0);
}

async function clearSaved() {
  await chrome.storage.local.remove(STORAGE_KEY);
}

function updateBadge(count) {
  const text = count > 0 ? (count > 99 ? '99+' : String(count)) : '';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: '#4F378B' });
}

// ── Message handler from content script ───────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {

      case 'ADD_TO_HISTORY':
        await addToLookupHistory(msg.entry);
        sendResponse({ ok: true });
        break;

      case 'TOGGLE_SAVED':
        const isSaved = await toggleSavedWord(msg.entry);
        sendResponse({ isSaved });
        break;

      case 'IS_SAVED':
        const saved = await isWordSaved(msg.word);
        sendResponse({ isSaved: saved });
        break;

      case 'GET_HISTORY':
        const result = await chrome.storage.local.get(HISTORY_KEY);
        sendResponse({ history: result[HISTORY_KEY] || [] });
        break;

      case 'GET_SAVED':
        const words = await getSavedWords();
        sendResponse({ saved: words });
        break;

      case 'CLEAR_HISTORY':
        await clearHistory();
        sendResponse({ ok: true });
        break;

      case 'CLEAR_SAVED':
        await clearSaved();
        sendResponse({ ok: true });
        break;

      default:
        sendResponse({ error: 'unknown message type' });
    }
  })();
  return true; // keep channel open for async response
});
