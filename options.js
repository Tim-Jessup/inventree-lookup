// Get the configured base URL
function getBaseUrl() {
  const url = document.getElementById('inventreeUrl').value.trim();
  if (!url) return null;
  return url.replace(/\/+$/, ''); // Remove trailing slashes
}

// Load saved settings
document.addEventListener('DOMContentLoaded', async () => {
  const { apiToken, inventreeUrl } = await chrome.storage.sync.get(['apiToken', 'inventreeUrl']);
  if (apiToken) {
    document.getElementById('apiToken').value = apiToken;
  }
  if (inventreeUrl) {
    document.getElementById('inventreeUrl').value = inventreeUrl;
  }
});

// Save settings
document.getElementById('save').addEventListener('click', async () => {
  const apiToken = document.getElementById('apiToken').value.trim();
  const inventreeUrl = getBaseUrl();
  
  await chrome.storage.sync.set({ apiToken, inventreeUrl });
  
  showStatus('Settings saved successfully!', 'success');
});

// Test connection
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
      showStatus('Connection successful! API token is valid.', 'success');
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
