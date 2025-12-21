# PageScope - Page Structure & Accessibility Inspector

![shield-security-protection-16x16](.github/assets/icons/shield-security-protection-16x16.png) **Privacy-First Firefox Extension for Web Analysis**

A developer and accessibility tool that visualizes page structure, semantic elements, and interactive components. All analysis happens locally in your browser with zero external data transmission.

## ![tick](.github/assets/icons/tick.png) Features

- **Page Structure Visualization**: View landmarks, headings hierarchy, and semantic sections
- **Interactive Elements Map**: See all buttons, links, and form controls with their states
- **Accessibility Inspector**: Check for common accessibility issues and ARIA attributes
- **Viewport Filtering**: Focus on elements currently visible to users
- **Export Capabilities**: Export data as JSON or Markdown for documentation
- **Privacy First**: All processing happens locally - no external servers or tracking

## Installation

### From Firefox Add-ons (Recommended)
[Available on addons.mozilla.org](https://addons.mozilla.org/) - *Pending Review*

### From Source (Development)
```bash
git clone git@github.com:johnzfitch/pagescope.git
cd pagescope
# Load in Firefox: about:debugging#/runtime/this-firefox → Load Temporary Add-on → manifest.json
```

## Usage

1. **Activate**: Click the PageScope icon in your toolbar
2. **Analyze**: The sidebar opens showing the current page structure
3. **Explore**: Switch between Structure, Interactive, and Accessibility tabs
4. **Highlight**: Click "Highlight All" to visually mark interactive elements
5. **Export**: Save analysis as JSON or Markdown

## ![shield-security-protection-16x16](.github/assets/icons/shield-security-protection-16x16.png) Privacy & Security

![tick](.github/assets/icons/tick.png) **Zero telemetry** - No analytics or tracking  
![tick](.github/assets/icons/tick.png) **No external connections** - All processing is local  
![tick](.github/assets/icons/tick.png) **Minimal permissions** - Only necessary browser APIs  
![tick](.github/assets/icons/tick.png) **Open source** - Fully auditable code  
![tick](.github/assets/icons/tick.png) **On-demand only** - Analyzes pages when you activate it

## ![lock](.github/assets/icons/lock.png) Permissions Explained

### Required Permissions
- **activeTab**: Reads page content when you click the extension icon
- **tabs**: Access tab information to analyze the correct page
- **storage**: Saves your preferences locally (no cloud sync)

All permissions are used exclusively for local page analysis. No data leaves your browser.

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
web-ext build --ignore-files "*.har" --ignore-files "*.log" --ignore-files "*.txt" --ignore-files "*.png"
```

Creates a clean `.xpi` package in `web-ext-artifacts/` (approx. 23KB).

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
- ![tick](.github/assets/icons/tick.png) **100% open source** - All code available for review
- ![tick](.github/assets/icons/tick.png) **Privacy-focused** - Zero external connections or data collection
- ![tick](.github/assets/icons/tick.png) **Self-contained** - No external libraries or CDNs
- ![tick](.github/assets/icons/tick.png) **Well-documented** - Clear code comments and documentation

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
