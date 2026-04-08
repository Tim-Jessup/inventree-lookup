// InvenTree Item Lookup - Background Script (Firefox MV2)

const MAX_HISTORY = 20;

// Get the configured base URL
async function getBaseUrl() {
  const { inventreeUrl } = await browser.storage.sync.get('inventreeUrl');
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

// Build dynamic patterns for orders based on detected/configured prefixes
function buildPatterns(prefixes) {
  const p = { ...DEFAULT_PREFIXES, ...prefixes };

  return [
    {
      name: 'Build Order',
      // Prefix followed by digits
      regex: new RegExp(`^${escapeRegex(p.buildOrderPrefix)}\\d+$`, 'i'),
      apiEndpoint: '/api/build/',
      apiParam: 'reference',
      urlTemplate: '/web/manufacturing/build-order/{id}/details',
      indexUrl: '/web/manufacturing/index/buildorders'
    },
    {
      name: 'Purchase Order',
      // Prefix followed by digits
      regex: new RegExp(`^${escapeRegex(p.purchaseOrderPrefix)}\\d+$`, 'i'),
      apiEndpoint: '/api/order/po/',
      apiParam: 'reference',
      urlTemplate: '/web/purchasing/purchase-order/{id}/detail',
      indexUrl: '/web/purchasing/index/purchaseorders'
    },
    {
      name: 'Sales Order',
      // Prefix followed by digits
      regex: new RegExp(`^${escapeRegex(p.salesOrderPrefix)}\\d+$`, 'i'),
      apiEndpoint: '/api/order/so/',
      apiParam: 'reference',
      urlTemplate: '/web/sales/sales-order/{id}/detail',
      indexUrl: '/web/sales/index/salesorders'
    },
    {
      name: 'Return Order',
      // Prefix followed by digits
      regex: new RegExp(`^${escapeRegex(p.returnOrderPrefix)}\\d+$`, 'i'),
      apiEndpoint: '/api/order/ro/',
      apiParam: 'reference',
      urlTemplate: '/web/sales/return-order/{id}/detail',
      indexUrl: '/web/sales/index/returnorders'
    }
  ];
}

// Get patterns with current prefixes from storage
async function getPatterns() {
  const { referencePrefixes } = await browser.storage.sync.get('referencePrefixes');
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
  const { defaultLandingPage } = await browser.storage.sync.get('defaultLandingPage');
  return LANDING_PAGES[defaultLandingPage] || LANDING_PAGES.parts;
}

// Create context menu on install
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
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
    await browser.tabs.executeScript(tabId, {
      code: `navigator.clipboard.writeText(${JSON.stringify(text)}).catch(() => {
        const el = document.createElement('textarea');
        el.value = ${JSON.stringify(text)};
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      });`
    });
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
  }
}

// Add item to lookup history
async function addToHistory(reference, type, url, success) {
  const { lookupHistory = [] } = await browser.storage.local.get('lookupHistory');

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

  await browser.storage.local.set({ lookupHistory: trimmed });
}

// Query an API endpoint and return results
async function queryApi(baseUrl, apiToken, endpoint, param, searchText) {
  const response = await fetch(
    `${baseUrl}${endpoint}?${param}=${encodeURIComponent(searchText)}`,
    {
      headers: {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const results = data.results || data;

  if (!results || results.length === 0) {
    return null;
  }

  return results[0];
}

// Main lookup function - used by context menu, keyboard shortcut, and omnibox
async function performLookup(searchText, tabId = null) {
  const baseUrl = await getBaseUrl();

  // Check if URL is configured
  if (!baseUrl) {
    browser.runtime.openOptionsPage();
    return;
  }

  const selectedText = searchText.trim().toUpperCase();
  const pattern = await findMatchingPattern(selectedText);
  const fallbackUrl = await getFallbackUrl();

  // Get API token from storage
  const { apiToken } = await browser.storage.sync.get('apiToken');

  // If we have an order pattern match, look it up
  if (pattern && apiToken) {
    try {
      const result = await queryApi(baseUrl, apiToken, pattern.apiEndpoint, pattern.apiParam, selectedText);
      if (result) {
        const url = `${baseUrl}${pattern.urlTemplate.replace('{id}', result.pk)}`;
        await addToHistory(selectedText, pattern.name, url, true);
        browser.tabs.create({ url });
        return;
      }
    } catch (error) {
      console.error('Order lookup failed:', error);
    }
    // Pattern matched but item not found - go to the relevant index page
    const indexUrl = `${baseUrl}${pattern.indexUrl}`;
    await addToHistory(selectedText, pattern.name, indexUrl, false);
    browser.tabs.create({ url: indexUrl });
    return;
  }

  // No order pattern match - try parts API
  if (apiToken) {
    try {
      const result = await queryApi(baseUrl, apiToken, '/api/part/', 'IPN', selectedText);
      if (result) {
        const url = `${baseUrl}/web/part/${result.pk}/details`;
        await addToHistory(selectedText, 'Part', url, true);
        browser.tabs.create({ url });
        return;
      }
    } catch (error) {
      console.error('Part lookup failed:', error);
    }
  }

  // No match found - copy to clipboard and open fallback
  await copyToClipboard(searchText.trim(), tabId);
  await addToHistory(searchText.trim(), 'Search', `${baseUrl}${fallbackUrl}`, false);
  browser.tabs.create({
    url: `${baseUrl}${fallbackUrl}`
  });
}

// Handle context menu click
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'search-inventree') return;
  await performLookup(info.selectionText, tab.id);
});


// Handle omnibox input
browser.omnibox.onInputEntered.addListener(async (text) => {
  await performLookup(text);
});

// Provide suggestions in omnibox
browser.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const pattern = await findMatchingPattern(text.trim().toUpperCase());
  if (pattern) {
    suggest([{
      content: text,
      description: `Look up ${pattern.name}: ${text.toUpperCase()}`
    }]);
  } else {
    suggest([{
      content: text,
      description: `Look up in InvenTree: ${text.toUpperCase()}`
    }]);
  }
});

// Set default omnibox suggestion
browser.omnibox.setDefaultSuggestion({
  description: 'InvenTree Lookup: %s'
});

// Handle messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'lookup' && message.text) {
    performLookup(message.text);
  }
});
