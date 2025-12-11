// InvenTree Item Lookup - Background Service Worker

const MAX_HISTORY = 20;

// Get the configured base URL
async function getBaseUrl() {
  const { inventreeUrl } = await chrome.storage.sync.get('inventreeUrl');
  if (!inventreeUrl) return null;
  return inventreeUrl.replace(/\/+$/, ''); // Remove trailing slashes
}

// Default prefixes (used if not detected from API)
const DEFAULT_PREFIXES = {
  buildOrderPrefix: 'BO-',
  purchaseOrderPrefix: 'PO-',
  salesOrderPrefix: 'SO-',
  returnOrderPrefix: 'RMA-'
};

// Escape special regex characters in a string
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build dynamic patterns based on detected/configured prefixes
function buildPatterns(prefixes) {
  const p = { ...DEFAULT_PREFIXES, ...prefixes };

  return [
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
      // Prefix followed by digits
      regex: new RegExp(`^${escapeRegex(p.buildOrderPrefix)}\\d+$`, 'i'),
      apiEndpoint: '/api/build/',
      apiParam: 'reference',
      urlTemplate: '/web/manufacturing/build-order/{id}/details'
    },
    {
      name: 'Purchase Order',
      // Prefix followed by digits
      regex: new RegExp(`^${escapeRegex(p.purchaseOrderPrefix)}\\d+$`, 'i'),
      apiEndpoint: '/api/order/po/',
      apiParam: 'reference',
      urlTemplate: '/web/purchasing/purchase-order/{id}/detail'
    },
    {
      name: 'Sales Order',
      // Prefix followed by digits
      regex: new RegExp(`^${escapeRegex(p.salesOrderPrefix)}\\d+$`, 'i'),
      apiEndpoint: '/api/order/so/',
      apiParam: 'reference',
      urlTemplate: '/web/sales/sales-order/{id}/detail'
    },
    {
      name: 'Return Order',
      // Prefix followed by digits
      regex: new RegExp(`^${escapeRegex(p.returnOrderPrefix)}\\d+$`, 'i'),
      apiEndpoint: '/api/order/ro/',
      apiParam: 'reference',
      urlTemplate: '/web/sales/return-order/{id}/detail'
    }
  ];
}

// Get patterns with current prefixes from storage
async function getPatterns() {
  const { referencePrefixes } = await chrome.storage.sync.get('referencePrefixes');
  return buildPatterns(referencePrefixes || {});
}

// Default landing page options
const LANDING_PAGES = {
  parts: '/web/part/category/index/parts',
  salesOrders: '/web/sales/index/salesorders',
  purchaseOrders: '/web/purchasing/index/purchaseorders',
  buildOrders: '/web/manufacturing/index/buildorders',
  returnOrders: '/web/sales/index/returnorders'
};

// Get the fallback URL based on user preference
async function getFallbackUrl() {
  const { defaultLandingPage } = await chrome.storage.sync.get('defaultLandingPage');
  return LANDING_PAGES[defaultLandingPage] || LANDING_PAGES.parts;
}

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'search-inventree',
    title: 'Search InvenTree for "%s"',
    contexts: ['selection']
  });
});

// Find matching pattern for selected text
async function findMatchingPattern(text) {
  const patterns = await getPatterns();
  for (const pattern of patterns) {
    if (pattern.regex.test(text)) {
      return pattern;
    }
  }
  return null;
}

// Copy text to clipboard using tab context (for context menu)
async function copyToClipboard(text, tabId) {
  if (!tabId) return;
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
  const pattern = await findMatchingPattern(selectedText);
  const fallbackUrl = await getFallbackUrl();

  // If no pattern matches, copy to clipboard and open fallback URL
  if (!pattern) {
    await copyToClipboard(searchText.trim(), tabId);
    await addToHistory(searchText.trim(), 'Search', `${baseUrl}${fallbackUrl}`, false);
    chrome.tabs.create({
      url: `${baseUrl}${fallbackUrl}`
    });
    return;
  }

  // Get API token from storage
  const { apiToken } = await chrome.storage.sync.get('apiToken');

  if (!apiToken) {
    // No token configured - copy to clipboard and open fallback
    await copyToClipboard(searchText.trim(), tabId);
    await addToHistory(selectedText, pattern.name, `${baseUrl}${fallbackUrl}`, false);
    chrome.tabs.create({
      url: `${baseUrl}${fallbackUrl}`
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
      await copyToClipboard(searchText.trim(), tabId);
      await addToHistory(selectedText, pattern.name, `${baseUrl}${fallbackUrl}`, false);
      chrome.tabs.create({
        url: `${baseUrl}${fallbackUrl}`
      });
      return;
    }

    const data = await response.json();

    // Handle paginated results (check for 'results' array) or direct array
    const results = data.results || data;

    if (!results || results.length === 0) {
      // No match found - copy to clipboard and open fallback
      await copyToClipboard(searchText.trim(), tabId);
      await addToHistory(selectedText, pattern.name, `${baseUrl}${fallbackUrl}`, false);
      chrome.tabs.create({
        url: `${baseUrl}${fallbackUrl}`
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
    await copyToClipboard(searchText.trim(), tabId);
    await addToHistory(selectedText, pattern.name, `${baseUrl}${fallbackUrl}`, false);
    chrome.tabs.create({
      url: `${baseUrl}${fallbackUrl}`
    });
  }
}

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'search-inventree') return;
  await performLookup(info.selectionText, tab.id);
});


// Handle omnibox input
chrome.omnibox.onInputEntered.addListener(async (text) => {
  await performLookup(text);
});

// Provide suggestions in omnibox
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const pattern = await findMatchingPattern(text.trim().toUpperCase());
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

