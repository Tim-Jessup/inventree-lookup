// InvenTree Item Lookup - Background Service Worker

const MAX_HISTORY = 20;

// Get the configured base URL
async function getBaseUrl() {
  const { inventreeUrl } = await chrome.storage.sync.get('inventreeUrl');
  if (!inventreeUrl) return null;
  return inventreeUrl.replace(/\/+$/, ''); // Remove trailing slashes
}

// Define patterns and their corresponding API endpoints and URL templates
// Each pattern has: regex, apiEndpoint, apiParam, urlTemplate
const PATTERNS = [
  {
    name: 'Part',
    // CE followed by 3-4 digits, optional revision letter, optional variant (-XX), optional variant revision letter
    regex: /^CE\d{3,4}[A-Z]?(-\d{2}[A-Z]?)?$/i,
    apiEndpoint: '/api/part/',
    apiParam: 'IPN',
    urlTemplate: '/web/part/{id}/details'
  },
  {
    name: 'Build Order',
    // BO followed by 1-4+ digits
    regex: /^BO\d+$/i,
    apiEndpoint: '/api/build/',
    apiParam: 'reference',
    urlTemplate: '/web/manufacturing/build-order/{id}/details'
  },
  {
    name: 'Purchase Order',
    // PO followed by 1-4+ digits
    regex: /^PO\d+$/i,
    apiEndpoint: '/api/order/po/',
    apiParam: 'reference',
    urlTemplate: '/web/purchasing/purchase-order/{id}/detail'
  },
  {
    name: 'Sales Order',
    // CSO followed by 1-4+ digits
    regex: /^CSO\d+$/i,
    apiEndpoint: '/api/order/so/',
    apiParam: 'reference',
    urlTemplate: '/web/sales/sales-order/{id}/detail'
  },
  {
    name: 'Return Order',
    // RMA followed by 1-4+ digits
    regex: /^RMA\d+$/i,
    apiEndpoint: '/api/order/ro/',
    apiParam: 'reference',
    urlTemplate: '/web/sales/return-order/{id}/detail'
  }
];

// Fallback URL when no pattern matches
const FALLBACK_URL = '/web/part/category/index/parts';

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'search-inventree',
    title: 'Search InvenTree for "%s"',
    contexts: ['selection']
  });
});

// Find matching pattern for selected text
function findMatchingPattern(text) {
  for (const pattern of PATTERNS) {
    if (pattern.regex.test(text)) {
      return pattern;
    }
  }
  return null;
}

// Copy text to clipboard
async function copyToClipboard(text, tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (textToCopy) => {
        navigator.clipboard.writeText(textToCopy);
      },
      args: [text]
    });
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
  }
}

// Add item to lookup history
async function addToHistory(reference, type, url, success) {
  const { lookupHistory = [] } = await chrome.storage.local.get('lookupHistory');
  
  // Remove duplicate if exists
  const filtered = lookupHistory.filter(item => item.reference !== reference);
  
  // Add new entry at the beginning
  filtered.unshift({
    reference,
    type,
    url,
    success,
    timestamp: Date.now()
  });
  
  // Keep only the most recent entries
  const trimmed = filtered.slice(0, MAX_HISTORY);
  
  await chrome.storage.local.set({ lookupHistory: trimmed });
}

// Main lookup function - used by context menu, keyboard shortcut, and omnibox
async function performLookup(searchText, tabId = null) {
  const baseUrl = await getBaseUrl();
  
  // Check if URL is configured
  if (!baseUrl) {
    chrome.runtime.openOptionsPage();
    return;
  }
  
  const selectedText = searchText.trim().toUpperCase();
  const pattern = findMatchingPattern(selectedText);
  
  // If no pattern matches, copy to clipboard and open fallback URL
  if (!pattern) {
    if (tabId) {
      await copyToClipboard(searchText.trim(), tabId);
    }
    await addToHistory(searchText.trim(), 'Search', `${baseUrl}${FALLBACK_URL}`, false);
    chrome.tabs.create({
      url: `${baseUrl}${FALLBACK_URL}`
    });
    return;
  }
  
  // Get API token from storage
  const { apiToken } = await chrome.storage.sync.get('apiToken');
  
  if (!apiToken) {
    // No token configured - copy to clipboard and open fallback
    if (tabId) {
      await copyToClipboard(searchText.trim(), tabId);
    }
    await addToHistory(selectedText, pattern.name, `${baseUrl}${FALLBACK_URL}`, false);
    chrome.tabs.create({
      url: `${baseUrl}${FALLBACK_URL}`
    });
    return;
  }
  
  try {
    // Query InvenTree API
    const response = await fetch(
      `${baseUrl}${pattern.apiEndpoint}?${pattern.apiParam}=${encodeURIComponent(selectedText)}`,
      {
        headers: {
          'Authorization': `Token ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      // API error - copy to clipboard and open fallback
      if (tabId) {
        await copyToClipboard(searchText.trim(), tabId);
      }
      await addToHistory(selectedText, pattern.name, `${baseUrl}${FALLBACK_URL}`, false);
      chrome.tabs.create({
        url: `${baseUrl}${FALLBACK_URL}`
      });
      return;
    }
    
    const data = await response.json();
    
    // Handle paginated results (check for 'results' array) or direct array
    const results = data.results || data;
    
    if (!results || results.length === 0) {
      // No match found - copy to clipboard and open fallback
      if (tabId) {
        await copyToClipboard(searchText.trim(), tabId);
      }
      await addToHistory(selectedText, pattern.name, `${baseUrl}${FALLBACK_URL}`, false);
      chrome.tabs.create({
        url: `${baseUrl}${FALLBACK_URL}`
      });
      return;
    }
    
    // Open the first matching item directly
    const itemId = results[0].pk;
    const url = `${baseUrl}${pattern.urlTemplate.replace('{id}', itemId)}`;
    await addToHistory(selectedText, pattern.name, url, true);
    chrome.tabs.create({ url });
    
  } catch (error) {
    console.error('InvenTree lookup failed:', error);
    // On any error, copy to clipboard and open fallback
    if (tabId) {
      await copyToClipboard(searchText.trim(), tabId);
    }
    await addToHistory(selectedText, pattern.name, `${baseUrl}${FALLBACK_URL}`, false);
    chrome.tabs.create({
      url: `${baseUrl}${FALLBACK_URL}`
    });
  }
}

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'search-inventree') return;
  await performLookup(info.selectionText, tab.id);
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'lookup-selection') return;
  
  // Get the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  
  // Get selected text from the page
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString()
    });
    
    if (result?.result) {
      await performLookup(result.result, tab.id);
    }
  } catch (error) {
    console.error('Failed to get selection:', error);
  }
});

// Handle omnibox input
chrome.omnibox.onInputEntered.addListener(async (text) => {
  await performLookup(text);
});

// Provide suggestions in omnibox
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const pattern = findMatchingPattern(text.trim().toUpperCase());
  if (pattern) {
    suggest([{
      content: text,
      description: `Look up ${pattern.name}: <match>${text.toUpperCase()}</match>`
    }]);
  } else {
    suggest([{
      content: text,
      description: `Search InvenTree for: <match>${text}</match>`
    }]);
  }
});

// Set default omnibox suggestion
chrome.omnibox.setDefaultSuggestion({
  description: 'InvenTree Lookup: <match>%s</match>'
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'lookup' && message.text) {
    performLookup(message.text);
  }
});

