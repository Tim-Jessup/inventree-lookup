# InvenTree Lookup

A Chrome extension for quickly looking up parts, orders, and other references in [InvenTree](https://inventree.org/).

## Features

- **Right-click lookup** - Select any reference number and right-click to open it directly in InvenTree
- **Keyboard shortcut** - Select text and press `Alt+I` to look it up (customisable in Chrome settings)
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

Any text that doesn't match these patterns will copy the text to your clipboard and open InvenTree's parts page for manual searching.

## Installation

### From source (Developer mode)

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked** and select the extension folder
5. Click the extension icon and go to **Settings** to configure

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
2. Press `Alt+I` (customisable at `chrome://extensions/shortcuts`)

### Omnibox
1. Type `inv` in Chrome's address bar
2. Press `Tab` to activate the extension
3. Type your reference and press `Enter`

### History popup
1. Click the extension icon
2. Use `↑`/`↓` arrow keys to select a previous lookup
3. Press `Enter` to open it, or click directly

## Customising the keyboard shortcut

1. Go to `chrome://extensions/shortcuts`
2. Find "InvenTree Lookup"
3. Click the pencil icon next to "Look up selected text in InvenTree"
4. Press your preferred key combination

## Permissions

This extension requires:
- **storage** - To save your settings and lookup history
- **contextMenus** - For the right-click menu
- **scripting** - To read selected text and copy to clipboard
- **activeTab** - To interact with the current page
- **host permissions** - To make API requests to your InvenTree server

## Privacy

- Your API token is stored locally in Chrome's sync storage
- Lookup history is stored locally and never transmitted
- The extension only communicates with the InvenTree server you configure

## License

MIT License - feel free to modify and distribute.

## Contributing

Issues and pull requests are welcome!
