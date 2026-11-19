/* x-小说拓展 · 后台服务（MV3） */
const DEFAULTS = {
  enabled: true,
  autoEnter: true,
  autoThreshold: 55,
  settingsVersion: 2,
  mergeParts: true,
  purify: true,
  theme: 'paper',
  fontSize: 19,
  lineHeight: 1.95,
  pageWidth: 720,
  fontFamily: 'serif',
  indent: true,
  autoNext: false,
  showPill: true,
  siteOverrides: {}
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['xn_settings'], (res) => {
    if (!res || !res.xn_settings) {
      chrome.storage.local.set({ xn_settings: DEFAULTS });
    }
  });
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-reader') return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) return;
    chrome.tabs.sendMessage(tab.id, { type: 'XN_TOGGLE' }, () => void chrome.runtime.lastError);
  });
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'XN_BADGE') return;
  const tabId = sender && sender.tab ? sender.tab.id : null;
  if (!tabId) return;
  try {
    chrome.action.setBadgeBackgroundColor({ color: '#2b2a26', tabId: tabId });
    if (chrome.action.setBadgeTextColor) {
      chrome.action.setBadgeTextColor({ color: '#faf7f0', tabId: tabId });
    }
    chrome.action.setBadgeText({ text: msg.text || '', tabId: tabId });
  } catch (e) {
    /* ignore */
  }
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') {
    try {
      chrome.action.setBadgeText({ text: '', tabId: tabId });
    } catch (e) {
      /* ignore */
    }
  }
});
