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
    chrome.tabs.create({ url: historyItems[selectedIndex].url });
    window.close();
  }
}

// Render history list
async function renderHistory() {
  const { lookupHistory = [] } = await chrome.storage.local.get('lookupHistory');
  historyItems = lookupHistory;
  selectedIndex = -1;
  const container = document.getElementById('historyList');
  
  if (lookupHistory.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📋</div>
        <div>No recent lookups</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = lookupHistory.map((item, index) => `
    <div class="history-item ${item.success ? '' : 'failed'}" data-index="${index}" data-url="${item.url}">
      <div class="icon ${getIconClass(item.type)}">${getIconText(item.type)}</div>
      <div class="details">
        <div class="reference">${item.reference}</div>
        <div class="type">${item.type}${item.success ? '' : ' (not found)'}</div>
      </div>
      <div class="time">${formatTime(item.timestamp)}</div>
    </div>
  `).join('');
  
  // Add click handlers
  container.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      chrome.tabs.create({ url: el.dataset.url });
      window.close();
    });
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
        chrome.runtime.sendMessage({ action: 'lookup', text });
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
  await chrome.storage.local.set({ lookupHistory: [] });
  renderHistory();
});

// Open settings
document.getElementById('openSettings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

// Focus search input on open
document.getElementById('searchInput').focus();

// Initial render
renderHistory();
