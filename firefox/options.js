// Get the configured base URL
function getBaseUrl() {
  const url = document.getElementById('inventreeUrl').value.trim();
  if (!url) return null;
  return url.replace(/\/+$/, ''); // Remove trailing slashes
}

// Reference pattern setting keys in InvenTree
const REFERENCE_PATTERN_KEYS = {
  'BUILDORDER_REFERENCE_PATTERN': { name: 'Build Order', settingKey: 'buildOrderPrefix' },
  'PURCHASEORDER_REFERENCE_PATTERN': { name: 'Purchase Order', settingKey: 'purchaseOrderPrefix' },
  'SALESORDER_REFERENCE_PATTERN': { name: 'Sales Order', settingKey: 'salesOrderPrefix' },
  'RETURNORDER_REFERENCE_PATTERN': { name: 'Return Order', settingKey: 'returnOrderPrefix' }
};

// Extract prefix from InvenTree reference pattern (e.g., "BO-{ref:04d}" -> "BO-")
function extractPrefixFromPattern(pattern) {
  if (!pattern) return null;
  // Find the position of the first { which starts the variable substitution
  const braceIndex = pattern.indexOf('{');
  if (braceIndex === -1) return null;
  // Everything before the first { is the prefix
  return pattern.substring(0, braceIndex);
}

// Fetch reference patterns from InvenTree global settings API
async function fetchReferencePatterns(baseUrl, apiToken) {
  const patterns = {};

  try {
    // Fetch global settings - need staff access for this endpoint
    const response = await fetch(`${baseUrl}/api/settings/global/`, {
      headers: {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log('Could not fetch global settings (may require staff access)');
      return null;
    }

    const data = await response.json();
    const settings = data.results || data;

    // Extract reference patterns
    for (const setting of settings) {
      if (REFERENCE_PATTERN_KEYS[setting.key]) {
        const prefix = extractPrefixFromPattern(setting.value);
        if (prefix) {
          patterns[REFERENCE_PATTERN_KEYS[setting.key].settingKey] = prefix;
        }
      }
    }

    return Object.keys(patterns).length > 0 ? patterns : null;
  } catch (error) {
    console.error('Error fetching reference patterns:', error);
    return null;
  }
}

// Load saved settings
document.addEventListener('DOMContentLoaded', async () => {
  const { apiToken, inventreeUrl, referencePrefixes, defaultLandingPage } = await browser.storage.sync.get(['apiToken', 'inventreeUrl', 'referencePrefixes', 'defaultLandingPage']);
  if (apiToken) {
    document.getElementById('apiToken').value = apiToken;
  }
  if (inventreeUrl) {
    document.getElementById('inventreeUrl').value = inventreeUrl;
  }
  if (defaultLandingPage) {
    document.getElementById('defaultLandingPage').value = defaultLandingPage;
  }
  // Display saved prefixes
  updatePrefixDisplay(referencePrefixes);
});

// Save settings
document.getElementById('save').addEventListener('click', async () => {
  const apiToken = document.getElementById('apiToken').value.trim();
  const inventreeUrl = getBaseUrl();
  const defaultLandingPage = document.getElementById('defaultLandingPage').value;

  await browser.storage.sync.set({ apiToken, inventreeUrl, defaultLandingPage });

  showStatus('Settings saved successfully!', 'success');
});

// Test connection and fetch reference patterns
document.getElementById('test').addEventListener('click', async () => {
  const apiToken = document.getElementById('apiToken').value.trim();
  const baseUrl = getBaseUrl();

  if (!apiToken) {
    showStatus('Please enter an API token first.', 'error');
    return;
  }

  if (!baseUrl) {
    showStatus('Please enter an InvenTree URL first.', 'error');
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/part/?limit=1`, {
      headers: {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      // Connection successful - now try to fetch reference patterns
      const patterns = await fetchReferencePatterns(baseUrl, apiToken);

      if (patterns) {
        // Save the detected patterns
        await browser.storage.sync.set({ referencePrefixes: patterns });
        updatePrefixDisplay(patterns);
        showStatus('Connection successful! Reference prefixes detected and saved.', 'success');
      } else {
        showStatus('Connection successful! Could not auto-detect prefixes (may require staff access).', 'success');
      }
    } else if (response.status === 401 || response.status === 403) {
      showStatus('Authentication failed. Please check your API token.', 'error');
    } else {
      showStatus(`Connection failed: ${response.status} ${response.statusText}`, 'error');
    }
  } catch (error) {
    showStatus(`Connection error: ${error.message}`, 'error');
  }
});

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;

  // Auto-hide success messages
  if (type === 'success') {
    setTimeout(() => {
      status.className = 'status';
    }, 3000);
  }
}

// Update the prefix display in the UI
function updatePrefixDisplay(prefixes) {
  const container = document.getElementById('prefixDisplay');
  if (!container) return;
  container.textContent = '';

  if (!prefixes || Object.keys(prefixes).length === 0) {
    const p = document.createElement('p');
    p.className = 'help';
    p.textContent = 'No prefixes detected yet. Click "Test Connection" to auto-detect.';
    container.appendChild(p);
    return;
  }

  const labels = {
    buildOrderPrefix: 'Build Order',
    purchaseOrderPrefix: 'Purchase Order',
    salesOrderPrefix: 'Sales Order',
    returnOrderPrefix: 'Return Order'
  };

  const list = document.createElement('div');
  list.className = 'prefix-list';

  for (const [key, label] of Object.entries(labels)) {
    const item = document.createElement('div');
    item.className = 'prefix-item';

    const span = document.createElement('span');
    span.className = 'prefix-label';
    span.textContent = label + ':';

    const code = document.createElement('code');
    code.textContent = prefixes[key] || '(not detected)';

    item.appendChild(span);
    item.appendChild(document.createTextNode(' '));
    item.appendChild(code);
    list.appendChild(item);
  }

  container.appendChild(list);
}
