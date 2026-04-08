# InvenTree Lookup

A browser extension for quickly looking up parts, orders, and other references in [InvenTree](https://inventree.org/).

Available for **Chrome** (and Chromium-based browsers) and **Firefox**.

## Features

- **Right-click lookup** - Select any reference number and right-click to open it directly in InvenTree
- **Keyboard shortcut** - Select text and press `Alt+I` to look it up
- **Omnibox search** - Type `inv` in the address bar, press Tab, then enter your reference
- **Recent history** - Click the extension icon to see and revisit your recent lookups
- **Smart pattern matching** - Automatically detects reference types and opens the correct page

## Supported Reference Types

| Pattern | Example | Opens |
|---------|---------|-------|
| Part IPN | CE1234, CE1234B, CE1234-01 | Part details page |
| Build Order | BO1234 | Build order details |
| Purchase Order | PO1234 | Purchase order details |
| Sales Order | CSO1234 | Sales order details |
| Return Order | RMA1234 | Return order details |

If a reference matches a known prefix but the item isn't found, the extension opens the relevant order index page. Any text that doesn't match a known pattern will copy to clipboard and open InvenTree's parts page.

## Installation

### Chrome

#### From source (Developer mode)

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked** and select the `chrome/` folder
5. Click the extension icon and go to **Settings** to configure

### Firefox

#### From addons.mozilla.org

Install directly from the [Firefox Add-ons site](https://addons.mozilla.org/).

#### From source (temporary install)

1. Download or clone this repository
2. Open Firefox and go to `about:debugging`
3. Click **This Firefox** → **Load Temporary Add-on**
4. Select `firefox/manifest.json`

Note: Temporary installs are removed when Firefox restarts. For a permanent install, use the signed `.xpi` from the Add-ons site.

### Configuration

Before using the extension, you need to configure:

1. **InvenTree URL** - The base URL of your InvenTree server (e.g., `https://inventree.example.com`)
2. **API Token** - Your personal API token from InvenTree

To get your API token:
1. Log into InvenTree
2. Go to Settings → Account Settings → Access Tokens
3. Create a new token and copy it

## Usage

### Right-click menu
1. Select a reference number (e.g., `PO1234`) on any webpage
2. Right-click and choose **Search InvenTree for "PO1234"**
3. The extension will look up the reference and open the correct page

### Keyboard shortcut
1. Select a reference number
2. Press `Alt+I`
   - Chrome: customisable at `chrome://extensions/shortcuts`
   - Firefox: customisable at `about:addons` → gear icon → Manage Extension Shortcuts

### Omnibox
1. Type `inv` in the address bar
2. Press `Tab` to activate the extension
3. Type your reference and press `Enter`

### History popup
1. Click the extension icon
2. Use `↑`/`↓` arrow keys to select a previous lookup
3. Press `Enter` to open it, or click directly

## Permissions

| Permission | Purpose |
|------------|---------|
| storage | Save settings and lookup history |
| contextMenus | Right-click menu |
| activeTab | Interact with the current page |
| host permissions | Make API requests to your InvenTree server |
| scripting *(Chrome only)* | Copy to clipboard from background context |
| tabs *(Firefox only)* | Copy to clipboard from background context |

## Privacy

- Your API token is stored locally in the browser's sync storage
- Lookup history is stored locally and never transmitted
- The extension only communicates with the InvenTree server you configure
- No data is collected

## License

MIT License - feel free to modify and distribute.

## Contributing

Issues and pull requests are welcome!
