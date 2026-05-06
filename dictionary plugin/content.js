const STORAGE_KEY = 'qd_saved_words';
const HISTORY_KEY = 'qd_lookup_history';
const MAX_SAVED = 500;
const MAX_HISTORY = 300;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'quickdictionary-define',
      title: 'QuickDictionary: "%s"',
      contexts: ['selection']
    });
  });
  refreshBadge();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'quickdictionary-define') return;
  if (!tab?.id) return;

  const word = sanitizeSelection(info.selectionText || '');
  if (!word) return;

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'QD_LOOKUP_WORD',
      word,
      selectionText: info.selectionText || ''
    });
  } catch (error) {
    try {
      await chrome.tabs.reload(tab.id);
    } catch (_) {}
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case 'QD_ADD_HISTORY': {
        await addToHistory(msg.entry);
        sendResponse({ ok: true });
        break;
      }
      case 'QD_TOGGLE_SAVED': {
        const isSaved = await toggleSaved(msg.entry);
        sendResponse({ ok: true, isSaved });
        break;
      }
      case 'QD_IS_SAVED': {
        const saved = await getSavedWords();
        sendResponse({ isSaved: saved.some(item => item.word.toLowerCase() === String(msg.word || '').toLowerCase()) });
        break;
      }
      case 'QD_GET_HISTORY': {
        sendResponse({ history: await getHistory() });
        break;
      }
      case 'QD_GET_SAVED': {
        sendResponse({ saved: await getSavedWords() });
        break;
      }
      case 'QD_CLEAR_HISTORY': {
        await chrome.storage.local.remove(HISTORY_KEY);
        await refreshBadge();
        sendResponse({ ok: true });
        break;
      }
      case 'QD_CLEAR_SAVED': {
        await chrome.storage.local.remove(STORAGE_KEY);
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();

  return true;
});

function sanitizeSelection(text) {
  const clean = String(text).trim().replace(/\s+/g, ' ');
  if (!clean || clean.includes(' ')) return '';
  return clean.replace(/^[^\p{L}'-]+|[^\p{L}'-]+$/gu, '');
}

async function getHistory() {
  const result = await chrome.storage.local.get(HISTORY_KEY);
  return result[HISTORY_KEY] || [];
}

async function getSavedWords() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

async function addToHistory(entry) {
  const history = await getHistory();
  const normalizedWord = String(entry.word || '').toLowerCase();
  const next = history.filter(item => String(item.word || '').toLowerCase() !== normalizedWord);
  next.unshift({ ...entry, lookedUpAt: Date.now() });
  await chrome.storage.local.set({ [HISTORY_KEY]: next.slice(0, MAX_HISTORY) });
  await refreshBadge();
}

async function toggleSaved(entry) {
  const saved = await getSavedWords();
  const normalizedWord = String(entry.word || '').toLowerCase();
  const existingIndex = saved.findIndex(item => String(item.word || '').toLowerCase() === normalizedWord);
  let next = [...saved];
  let isSaved = false;

  if (existingIndex >= 0) {
    next.splice(existingIndex, 1);
  } else {
    next.unshift({ ...entry, savedAt: Date.now() });
    next = next.slice(0, MAX_SAVED);
    isSaved = true;
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return isSaved;
}

async function refreshBadge() {
  const history = await getHistory();
  const count = history.length;
  await chrome.action.setBadgeText({ text: count > 0 ? (count > 99 ? '99+' : String(count)) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#4F378B' });
}