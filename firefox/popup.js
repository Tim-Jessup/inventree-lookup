// Get the configured base URL
function getBaseUrl() {
  const url = document.getElementById('inventreeUrl').value.trim();
  if (!url) return null;
  return url.replace(/\/+$/, ''); // Remove trailing slashes
}

let selectedIndex = -1;
let historyItems = [];

// Format relative time
function formatTime(timestamp) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

// Get icon class based on type
function getIconClass(type) {
  const typeMap = {
    'Part': 'part',
    'Build Order': 'build',
    'Purchase Order': 'purchase',
    'Sales Order': 'sales',
    'Return Order': 'return',
    'Search': 'search'
  };
  return typeMap[type] || 'search';
}

// Get icon text based on type
function getIconText(type) {
  const typeMap = {
    'Part': 'CE',
    'Build Order': 'BO',
    'Purchase Order': 'PO',
    'Sales Order': 'SO',
    'Return Order': 'RMA',
    'Search': '?'
  };
  return typeMap[type] || '?';
}

// Update visual selection
function updateSelection() {
  const items = document.querySelectorAll('.history-item');
  items.forEach((item, index) => {
    item.classList.toggle('selected', index === selectedIndex);
  });

  // Scroll selected item into view
  if (selectedIndex >= 0 && items[selectedIndex]) {
    items[selectedIndex].scrollIntoView({ block: 'nearest' });
  }
}

// Open selected item
function openSelectedItem() {
  if (selectedIndex >= 0 && historyItems[selectedIndex]) {
    browser.tabs.create({ url: historyItems[selectedIndex].url });
    window.close();
  }
}

// Render history list
async function renderHistory() {
  const { lookupHistory = [] } = await browser.storage.local.get('lookupHistory');
  historyItems = lookupHistory;
  selectedIndex = -1;
  const container = document.getElementById('historyList');
  container.textContent = '';

  if (lookupHistory.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.textContent = '📋';
    const text = document.createElement('div');
    text.textContent = 'No recent lookups';
    emptyState.appendChild(icon);
    emptyState.appendChild(text);
    container.appendChild(emptyState);
    return;
  }

  lookupHistory.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'history-item' + (item.success ? '' : ' failed');
    row.dataset.index = index;
    row.dataset.url = item.url;

    const iconEl = document.createElement('div');
    iconEl.className = 'icon ' + getIconClass(item.type);
    iconEl.textContent = getIconText(item.type);

    const details = document.createElement('div');
    details.className = 'details';

    const reference = document.createElement('div');
    reference.className = 'reference';
    reference.textContent = item.reference;

    const type = document.createElement('div');
    type.className = 'type';
    type.textContent = item.type + (item.success ? '' : ' (not found)');

    const time = document.createElement('div');
    time.className = 'time';
    time.textContent = formatTime(item.timestamp);

    details.appendChild(reference);
    details.appendChild(type);
    row.appendChild(iconEl);
    row.appendChild(details);
    row.appendChild(time);

    row.addEventListener('click', () => {
      browser.tabs.create({ url: item.url });
      window.close();
    });

    container.appendChild(row);
  });
}

// Handle keyboard input
document.getElementById('searchInput').addEventListener('keydown', async (e) => {
  const items = document.querySelectorAll('.history-item');

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyItems.length > 0) {
      selectedIndex = Math.min(selectedIndex + 1, historyItems.length - 1);
      updateSelection();
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (historyItems.length > 0) {
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelection();
    }
  } else if (e.key === 'Enter') {
    if (selectedIndex >= 0) {
      // Open selected history item
      openSelectedItem();
    } else {
      // Perform new lookup
      const text = e.target.value.trim();
      if (text) {
        // Copy to clipboard from popup context (works reliably)
        try {
          await navigator.clipboard.writeText(text);
        } catch (err) {
          console.error('Failed to copy to clipboard:', err);
        }
        browser.runtime.sendMessage({ action: 'lookup', text });
        window.close();
      }
    }
  } else if (e.key === 'Escape') {
    if (selectedIndex >= 0) {
      selectedIndex = -1;
      updateSelection();
    } else {
      window.close();
    }
  }
});

// Reset selection when typing
document.getElementById('searchInput').addEventListener('input', () => {
  selectedIndex = -1;
  updateSelection();
});

// Clear history
document.getElementById('clearHistory').addEventListener('click', async () => {
  await browser.storage.local.set({ lookupHistory: [] });
  renderHistory();
});

// Open settings
document.getElementById('openSettings').addEventListener('click', () => {
  browser.runtime.openOptionsPage();
  window.close();
});

// Focus search input on open
document.getElementById('searchInput').focus();

// Initial render
renderHistory();
