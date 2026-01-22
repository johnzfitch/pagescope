# PageScope - Page Structure & Accessibility Inspector

**Privacy-First Firefox Extension for Web Analysis**

A developer and accessibility tool that visualizes page structure, semantic elements, and interactive components. All analysis happens locally in your browser with zero external data transmission.

## Features

- **Page Structure Visualization**: View landmarks, headings hierarchy, and semantic sections
- **Interactive Elements Map**: See all buttons, links, and form controls with their states
- **Accessibility Inspector**: Check for common accessibility issues and ARIA attributes
- **Braille Spatial Maps**: Generate tactile page wireframes using Unicode Braille patterns
- **Viewport Filtering**: Focus on elements currently visible to users
- **Export Capabilities**: Export data as JSON, Markdown, or Braille format
- **Privacy First**: All processing happens locally - no external servers or tracking

## Installation

### From XPI (Recommended)

1. Download `dist/pagescope.xpi` from this repository
2. Open Firefox and navigate to `about:addons`
3. Click the gear icon and select "Install Add-on From File..."
4. Select the downloaded `pagescope.xpi` file
5. Click "Add" when prompted

### From Source (Development)

```bash
git clone git@github.com:johnzfitch/pagescope.git
cd pagescope
```

Then load in Firefox:
1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select `manifest.json` from the cloned directory

## Usage

1. **Activate**: Click the PageScope icon in your toolbar
2. **Analyze**: The sidebar opens showing the current page structure
3. **Explore**: Switch between Structure, Interactive, and Accessibility tabs
4. **Highlight**: Click "Highlight All" to visually mark interactive elements
5. **Export**: Save analysis as JSON or Markdown

## Privacy & Security

- **Zero telemetry** - No analytics or tracking
- **No external connections** - All processing is local
- **Minimal permissions** - Only necessary browser APIs
- **Open source** - Fully auditable code
- **On-demand only** - Analyzes pages when you activate it

## Permissions Explained

### Required Permissions
- **activeTab**: Only accesses the page you're currently viewing, and only when you click the extension icon
- **storage**: Saves your preferences locally in your browser (no cloud sync)
- **scripting**: Allows the extension to inject the analysis script into the active tab when you activate it

### What We Don't Ask For
- No "access all websites" permission - We only access pages when you explicitly click the icon
- No background access - Extension is completely inactive until you use it
- No browsing history - We never track or access your browsing activity

**Privacy-First Design:** The content script is injected on-demand only when you activate the extension, not automatically on every page you visit.

## Use Cases

- **Web Development**: Understand page structure and debug layout
- **Accessibility Auditing**: Identify missing labels, alt text, ARIA attributes
- **Testing Automation**: Export element maps for test scripts
- **Documentation**: Generate automated page structure docs
- **Learning**: Understand semantic HTML implementation

## Building from Source

### Development
```bash
git clone git@github.com:johnzfitch/pagescope.git
cd pagescope
# Load as temporary extension in about:debugging
```

### Distribution Package
```bash
npm install -g web-ext
web-ext build
```

Creates a `.xpi` package in `web-ext-artifacts/` (approx. 24KB).

## Project Structure

```
pagescope/
├── manifest.json          # Extension manifest (v2)
├── background.js          # Background service worker
├── content.js             # Content script for DOM analysis
├── icons/                 # Extension icons (48x48, 96x96)
├── popup/                 # Toolbar popup
├── sidebar/               # Main sidebar interface
│   ├── sidebar.html
│   ├── sidebar.css
│   └── sidebar.js
└── options/               # Settings page
    ├── options.html
    ├── options.css
    └── options.js
```

## Technical Details

### Architecture
- **Manifest Version**: 2 (Firefox WebExtensions)
- **Content Script**: Injected on-demand
- **Data Flow**: Content script → Background → Sidebar (all local)
- **Storage**: browser.storage.local for preferences

### Browser Compatibility
- **Minimum Firefox Version**: 91.0
- **Tested on**: Firefox 120+, Floorp
- **Platform**: Linux, Windows, macOS

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/improvement`
3. Make changes with clear commit messages
4. Test thoroughly in Firefox
5. Submit a pull request

### Development Guidelines
- Follow existing code style
- Test all features before submitting
- Update docs for new features
- No external dependencies or network calls

## License

MIT License - See [LICENSE](LICENSE)

Copyright (c) 2024 Zack Fitch

## Author & Contact

**Developer**: Zack Fitch  
**Email**: zackfitch1@gmail.com  
**GitHub**: [@johnzfitch](https://github.com/johnzfitch)  
**Project**: [github.com/johnzfitch/pagescope](https://github.com/johnzfitch/pagescope)

### For Mozilla Reviewers

This extension is:
- **100% open source** - All code available for review
- **Privacy-focused** - Zero external connections or data collection
- **Self-contained** - No external libraries or CDNs
- **Well-documented** - Clear code comments and documentation

**Contact during review**: zackfitch1@gmail.com

## Support & Bug Reports

- **Issues**: [github.com/johnzfitch/pagescope/issues](https://github.com/johnzfitch/pagescope/issues)
- **Discussions**: [github.com/johnzfitch/pagescope/discussions](https://github.com/johnzfitch/pagescope/discussions)
- **Email**: zackfitch1@gmail.com

## Changelog

### Version 1.0.0 (Initial Release)
- Page structure analysis (landmarks, headings, sections)
- Interactive elements mapping with states
- Basic accessibility checking
- JSON and Markdown export
- Viewport filtering
- Visual element highlighting

## Roadmap

- [ ] Enhanced accessibility checks (WCAG 2.1)
- [ ] Color contrast analyzer
- [ ] Keyboard navigation testing
- [ ] Screenshot with annotations
- [ ] CSV export format
- [ ] Custom extraction rules
- [ ] Testing framework integration

## Acknowledgments

Built with Firefox WebExtensions API and standard web technologies (HTML, CSS, JavaScript).

Inspired by browser DevTools, axe DevTools, and the need for a simple, privacy-focused page structure analyzer.

---

**Note**: This extension is provided as-is for development and accessibility purposes. It does not modify pages or collect user data. All analysis is performed locally.
