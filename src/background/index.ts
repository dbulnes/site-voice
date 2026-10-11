// Site Voice - Background Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  // Register context menu items
  chrome.contextMenus.create({
    id: 'site-voice-read-page',
    title: 'Read article with Site Voice',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'site-voice-read-selection',
    title: 'Read selection with Site Voice',
    contexts: ['selection'],
  });

  console.log('[SiteVoice] Background service worker initialized.');
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === 'site-voice-read-page') {
    chrome.tabs.sendMessage(tab.id, { type: 'START_READING' });
  } else if (info.menuItemId === 'site-voice-read-selection') {
    chrome.tabs.sendMessage(tab.id, { type: 'READ_SELECTION' });
  }
});

// Handle Keyboard Shortcuts defined in manifest commands
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (command === 'toggle-reading') {
    chrome.tabs.sendMessage(tab.id, { type: 'START_READING' });
  } else if (command === 'toggle-play-pause') {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PLAY_PAUSE' });
  }
});

// Relay messages if needed
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ status: 'pong' });
  }
  return true;
});
