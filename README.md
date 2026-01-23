# PageScope

Privacy-first Firefox extension for inspecting page structure, landmarks, and interactive elements. All analysis is performed locally in the browser. No telemetry. No external network requests.

Version: v0.0.5

## What it does

- Shows a sidebar with Structure, Interactive, and Accessibility views
- Highlights elements on the page (temporary overlays)
- Exports reports as JSON, Markdown, or Braille text

## Install

### Install the XPI

1. Open `about:addons`
2. Click the gear icon
3. Choose "Install Add-on From File..."
4. Select `dist/pagescope-v0.0.5.xpi` (or the newest file in `dist/`)

### Load from source (development)

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select `manifest.json` from this repo

## Use

1. Open the PageScope sidebar (toolbar icon or sidebar)
2. Click Load or Refresh to analyze the active tab
3. Click items to highlight them
4. Export to Markdown or JSON when needed

## Privacy and security

- No tracking, analytics, or telemetry
- No external network requests
- Data stays in memory unless you export it
- Settings are stored via `browser.storage.local`

## Permissions (why they exist)

- `activeTab`: access the active tab when you interact with the extension
- `tabs`: read active tab metadata needed for UI and messaging
- `storage`: store local preferences
- `scripting`: inject scripts on demand on supported pages
- `host_permissions: ["<all_urls>"]`: required to support inspecting arbitrary sites

## Build and lint

Prerequisites: `zip`, and optionally `web-ext`.

```bash
web-ext lint
./build.sh
```

Build output: `dist/pagescope-v0.0.5.xpi`

## Repository layout

```
.
├── manifest.json
├── background.js
├── content.js
├── vendor/
├── sidebar/
├── popup/
├── options/
└── icons/
```

## License

MIT. See `LICENSE`.

## Contact

- Email: zackfitch1@gmail.com
- GitHub: https://github.com/johnzfitch
- Repo: https://github.com/johnzfitch/pagescope
