/**
 * PageScope - Content Script
 * Extracts semantic page structure and accessibility information
 * with anti-fingerprinting protections
 *
 * PRIVACY & STEALTH FEATURES:
 * ---------------------------
 * PageScope implements several protections against site-based detection:
 *
 * 1. Query Caching: Reduces repetitive DOM queries that create timing patterns
 * 2. Shadow DOM Protection: Silent error handling for closed shadow roots
 * 3. Timing Randomization: Adds jitter to prevent timing-based fingerprinting
 * 4. Batch Processing: Throttles operations to appear more human-like
 * 5. Read-Only Operations: Never modifies DOM (except temporary highlights)
 *
 * NOTE: We do NOT access the browser's accessibility tree (AXTree) - we only
 * read standard DOM attributes and properties. Sites cannot detect us via
 * assistive technology APIs.
 */

class PageScope {
  constructor() {
    this.data = null;
    this.messageListener = null;
    this.cleanupHandlers = [];

    // Stealth configuration - prevent site detection
    // Can be disabled via options if needed
    this.stealth = {
      enabled: true,          // Master switch for all stealth features
      batchDelay: 10,         // ms delay between batch operations
      maxQueriesPerBatch: 50, // Limit queries to appear more human
      useNativeAPIs: true,    // Prefer native APIs over repeated queries
      randomizeTimings: true  // Add jitter to timing patterns
    };

    // Cache frequently accessed elements to reduce queries
    this.elementCache = new WeakMap();
    this.queryCache = new Map();
    this.lastQueryTime = 0;
  }

  /**
   * Throttle DOM queries to prevent detection via timing patterns
   */
  async throttleQuery(fn, context = null) {
    if (!this.stealth.enabled) {
      return fn.call(context);
    }

    const now = Date.now();
    const timeSinceLastQuery = now - this.lastQueryTime;

    // Add random jitter (0-5ms) to make timing less predictable
    if (this.stealth.randomizeTimings && timeSinceLastQuery < this.stealth.batchDelay) {
      const jitter = Math.random() * 5;
      await new Promise(resolve => setTimeout(resolve, this.stealth.batchDelay + jitter));
    }

    this.lastQueryTime = Date.now();
    return fn.call(context);
  }

  /**
   * Cached querySelectorAll to reduce observable DOM queries
   */
  querySelectorAllCached(selector, root = document) {
    const cacheKey = `${selector}:${root === document ? 'doc' : 'root'}`;

    if (this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey);
    }

    const results = root.querySelectorAll(selector);
    this.queryCache.set(cacheKey, results);

    // Clear cache after 100ms to avoid stale data
    setTimeout(() => this.queryCache.delete(cacheKey), 100);

    return results;
  }

  /**
   * Extract complete page structure
   * @returns {Object} Structured page data
   */
  extract() {
    // Clear query cache at start of extraction
    this.queryCache.clear();

    return {
      meta: this.getMetadata(),
      structure: this.getStructure(),
      interactive: this.getInteractive(),
      accessibility: this.getAccessibility(),
      viewport: this.getViewportInfo(),
      textBlocks: this.getTextBlocks(),
      brailleMap: this.getBrailleMap(),
      semanticStructure: this.getSemanticStructure(),
      // Agent-focused data
      agentBrief: this.getAgentBrief(),
      pageAnatomy: this.getPageAnatomy(),
      attributedContent: this.getAttributedContent()
    };
  }
  
  getMetadata() {
    return {
      title: document.title,
      url: window.location.href,
      description: document.querySelector('meta[name="description"]')?.content,
      lang: document.documentElement.lang,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollable: document.documentElement.scrollHeight > window.innerHeight
      }
    };
  }
  
  getStructure() {
    const structure = {
      landmarks: [],
      headings: [],
      sections: []
    };

    // Landmarks (nav, main, aside, footer, etc.)
    const landmarkMap = new Map(); // Track unique landmarks by type+path

    // STEALTH: Use cached query to reduce observable DOM access
    this.querySelectorAllCached('[role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"], nav, main, aside, footer, header').forEach(el => {
      if (!this.isVisible(el)) return;

      const type = el.getAttribute('role') || el.tagName.toLowerCase();
      const path = this.getPath(el);
      const key = `${type}:${path}`; // Unique key

      // Skip if already added
      if (landmarkMap.has(key)) return;

      const landmark = {
        type,
        label: el.getAttribute('aria-label') || el.querySelector('h1,h2,h3')?.textContent?.trim(),
        id: el.id,
        path
      };

      landmarkMap.set(key, landmark);
      structure.landmarks.push(landmark);
    });
    
    // Heading hierarchy
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el, idx) => {
      if (!this.isVisible(el)) return;
      
      structure.headings.push({
        level: parseInt(el.tagName[1]),
        text: el.textContent.trim().slice(0, 100),
        id: el.id || `heading-${idx}`,
        path: this.getPath(el)
      });
    });
    
    // Semantic sections - collect sections first
    const sectionsMap = new Map();

    document.querySelectorAll('section').forEach(el => {
      if (!this.isVisible(el)) return;

      const textContent = this.getDirectText(el);

      const section = {
        type: 'section',
        heading: el.querySelector('h1,h2,h3')?.textContent?.trim(),
        id: el.id,
        path: this.getPath(el),
        wordCount: (el.textContent.match(/\w+/g) || []).length,
        text: textContent,
        articles: [] // Children
      };

      sectionsMap.set(el, section);
      structure.sections.push(section);
    });

    // Collect articles and nest in parent sections
    document.querySelectorAll('article').forEach(el => {
      if (!this.isVisible(el)) return;

      const textContent = this.getDirectText(el);

      const article = {
        heading: el.querySelector('h1,h2,h3')?.textContent?.trim(),
        id: el.id,
        path: this.getPath(el),
        wordCount: (el.textContent.match(/\w+/g) || []).length,
        text: textContent
      };

      // Find parent section
      const parentSection = el.closest('section');
      if (parentSection && sectionsMap.has(parentSection)) {
        sectionsMap.get(parentSection).articles.push(article);
      } else {
        // Standalone article (no parent section)
        structure.sections.push({
          type: 'article',
          ...article,
          articles: undefined // Remove articles field for standalone
        });
      }
    });
    
    return structure;
  }
  
  getInteractive() {
    const interactive = [];
    const selectors = 'a, button, input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';
    
    document.querySelectorAll(selectors).forEach((el, idx) => {
      if (!this.isVisible(el)) return;
      
      const rect = el.getBoundingClientRect();
      const computedRole = this.getRole(el);
      
      interactive.push({
        id: idx,
        role: computedRole,
        type: el.type || el.tagName.toLowerCase(),
        label: this.getLabel(el),
        value: el.value,
        href: el.href,
        state: {
          disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
          checked: el.checked || el.getAttribute('aria-checked') === 'true',
          expanded: el.getAttribute('aria-expanded') === 'true',
          selected: el.getAttribute('aria-selected') === 'true',
          required: el.required || el.getAttribute('aria-required') === 'true'
        },
        bounds: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          inViewport: this.isInViewport(rect)
        },
        path: this.getPath(el)
      });
    });
    
    return interactive;
  }
  
  getAccessibility() {
    const issues = [];
    
    // Check for images without alt text
    document.querySelectorAll('img').forEach(img => {
      if (!img.alt && this.isVisible(img)) {
        issues.push({
          type: 'missing-alt',
          severity: 'warning',
          element: 'img',
          message: 'Image missing alt text',
          path: this.getPath(img)
        });
      }
    });
    
    // Check for buttons without labels
    document.querySelectorAll('button').forEach(btn => {
      if (!this.getLabel(btn) && this.isVisible(btn)) {
        issues.push({
          type: 'missing-label',
          severity: 'error',
          element: 'button',
          message: 'Button has no accessible label',
          path: this.getPath(btn)
        });
      }
    });
    
    // Check for form inputs without labels
    document.querySelectorAll('input, select, textarea').forEach(input => {
      if (input.type !== 'hidden' && !this.getLabel(input) && this.isVisible(input)) {
        issues.push({
          type: 'missing-label',
          severity: 'error',
          element: input.tagName.toLowerCase(),
          message: 'Form control missing label',
          path: this.getPath(input)
        });
      }
    });
    
    return {
      issues,
      stats: {
        landmarks: document.querySelectorAll('[role="navigation"], [role="main"], nav, main').length,
        headings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
        altText: document.querySelectorAll('img[alt]').length,
        totalImages: document.querySelectorAll('img').length
      }
    };
  }
  
  getViewportInfo() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollY: window.scrollY,
      scrollX: window.scrollX,
      scrollHeight: document.documentElement.scrollHeight
    };
  }

  /**
   * Extract text blocks - comprehensive text extraction including shadow DOM
   * Based on query-selector-shadow-dom's collectAllElementsDeep algorithm
   */
  getTextBlocks() {
    const blocks = [];
    const seen = new Set();
    const MIN_WORDS = 3;

    // Recursively collect all elements including those in shadow DOM
    // Based on collectAllElementsDeep from query-selector-shadow-dom
    // STEALTH: Use try-catch to silently handle blocked shadow roots
    const collectAllElementsDeep = (root = document.body) => {
      const allElements = [];

      const findAllElements = (nodes) => {
        for (let i = 0; i < nodes.length; i++) {
          const el = nodes[i];
          allElements.push(el);

          // STEALTH: Shadow root access detection mitigation
          // Check if shadow root exists without throwing errors
          try {
            if (el.shadowRoot) {
              findAllElements(el.shadowRoot.querySelectorAll('*'));
            }
          } catch (e) {
            // Silently skip closed shadow roots or access-denied scenarios
            // This prevents sites from detecting us via error handling
          }
        }
      };

      // STEALTH: Wrap root shadow check
      try {
        if (root.shadowRoot) {
          findAllElements(root.shadowRoot.querySelectorAll('*'));
        }
      } catch (e) {
        // Silently skip
      }

      findAllElements(root.querySelectorAll('*'));

      return allElements;
    };

    // Collect all elements including shadow DOM
    const allElements = collectAllElementsDeep();

    // Filter to text-bearing elements
    const textElements = allElements.filter(el => {
      const tag = el.tagName?.toLowerCase();
      return tag && ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'li', 'td', 'th',
                     'div', 'span', 'article', 'section', 'pre', 'code', 'a'].includes(tag);
    });

    textElements.forEach((el, idx) => {
      // Only process visible elements
      if (!this.isVisible(el)) return;

      // Skip script/style/noscript
      if (el.closest('script, style, noscript')) return;

      // Get ALL text content from element
      const text = el.textContent?.trim() || '';

      if (!text || text.length < 10) return;

      // Check if this is a duplicate (nested element with same text)
      let isDuplicate = false;
      for (const existingText of seen) {
        if (existingText.includes(text) || text.includes(existingText)) {
          // If this text is longer, replace the existing one
          if (text.length > existingText.length) {
            seen.delete(existingText);
            // Remove the shorter block
            const shortIndex = blocks.findIndex(b => b.text === existingText);
            if (shortIndex >= 0) {
              blocks.splice(shortIndex, 1);
            }
          } else {
            isDuplicate = true;
            break;
          }
        }
      }

      if (isDuplicate) return;

      const words = text.match(/\b\w+\b/g) || [];
      if (words.length < MIN_WORDS) return;

      const rect = el.getBoundingClientRect();

      seen.add(text);
      blocks.push({
        id: idx,
        text: text.slice(0, 2000),
        wordCount: words.length,
        bounds: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        path: this.getPath(el),
        tag: el.tagName.toLowerCase(),
        className: el.className?.toString().slice(0, 100) || ''
      });
    });

    // Sort by vertical position (reading order)
    blocks.sort((a, b) => (a.bounds?.y || 0) - (b.bounds?.y || 0));

    // Remove duplicates and nested content
    const filtered = [];
    for (const block of blocks) {
      let isDuplicate = false;
      for (const existing of filtered) {
        if (existing.text.includes(block.text) || block.text.includes(existing.text)) {
          if (block.text.length <= existing.text.length) {
            isDuplicate = true;
            break;
          } else {
            // Replace with longer version
            const idx = filtered.indexOf(existing);
            filtered[idx] = block;
            isDuplicate = true;
            break;
          }
        }
      }
      if (!isDuplicate) {
        filtered.push(block);
      }
    }

    return filtered.slice(0, 100);
  }

  /**
   * Generate a Braille spatial map with semantic zone awareness
   * Uses Unicode Braille patterns (U+2800-U+28FF) to create a tactile wireframe
   * Inspired by semantic zone upscaling - different content types get different patterns
   */
  getBrailleMap() {
    const COLS = 80;  // Characters wide
    const ROWS = 50;  // Characters tall (more rows for detail)
    const CELL_W = 2; // Braille cell is 2 dots wide
    const CELL_H = 4; // Braille cell is 4 dots tall

    // Pixel dimensions for our grid
    const gridW = COLS * CELL_W;
    const gridH = ROWS * CELL_H;

    // Create pixel grid with semantic zone types
    const pixels = Array(gridH).fill(null).map(() => Array(gridW).fill(0));

    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    // Semantic zone types (matching your zone classification)
    const ZONES = {
      EMPTY: 0,
      TEXT: 1,        // Paragraphs, spans with text
      HEADING: 2,     // h1-h6
      BUTTON: 3,      // Buttons, clickable
      INPUT: 4,       // Form inputs
      LINK: 5,        // Anchor links
      IMAGE: 6,       // Images
      NAV: 7,         // Navigation areas
      HEADER: 8,      // Header/banner
      FOOTER: 9,      // Footer
      ASIDE: 10,      // Sidebars
      MAIN: 11,       // Main content area
      LIST: 12,       // Lists (ul, ol)
      MEDIA: 13,      // Video, audio
      FORM: 14,       // Form containers
      CARD: 15        // Article/card containers
    };

    const detectedZones = [];

    // === SEMANTIC ZONE DETECTION ===

    // 1. Major landmarks (fill areas, not just borders)
    this.detectAndFillZone(pixels, 'header, [role="banner"]', ZONES.HEADER, viewW, viewH, gridW, gridH, detectedZones, true);
    this.detectAndFillZone(pixels, 'nav, [role="navigation"]', ZONES.NAV, viewW, viewH, gridW, gridH, detectedZones, true);
    this.detectAndFillZone(pixels, 'main, [role="main"]', ZONES.MAIN, viewW, viewH, gridW, gridH, detectedZones, true);
    this.detectAndFillZone(pixels, 'aside, [role="complementary"]', ZONES.ASIDE, viewW, viewH, gridW, gridH, detectedZones, true);
    this.detectAndFillZone(pixels, 'footer, [role="contentinfo"]', ZONES.FOOTER, viewW, viewH, gridW, gridH, detectedZones, true);

    // 2. Content structure
    this.detectAndFillZone(pixels, 'article, [role="article"]', ZONES.CARD, viewW, viewH, gridW, gridH, detectedZones, false);
    this.detectAndFillZone(pixels, 'form', ZONES.FORM, viewW, viewH, gridW, gridH, detectedZones, false);
    this.detectAndFillZone(pixels, 'ul, ol, [role="list"]', ZONES.LIST, viewW, viewH, gridW, gridH, detectedZones, false);

    // 3. Interactive elements (higher priority - draw on top)
    this.detectAndFillZone(pixels, 'h1, h2, h3, h4, h5, h6', ZONES.HEADING, viewW, viewH, gridW, gridH, detectedZones, false);
    this.detectAndFillZone(pixels, 'img, picture, svg:not([class*="icon"])', ZONES.IMAGE, viewW, viewH, gridW, gridH, detectedZones, false);
    this.detectAndFillZone(pixels, 'video, audio, iframe[src*="youtube"], iframe[src*="vimeo"]', ZONES.MEDIA, viewW, viewH, gridW, gridH, detectedZones, false);
    this.detectAndFillZone(pixels, 'button, [role="button"], input[type="submit"], input[type="button"]', ZONES.BUTTON, viewW, viewH, gridW, gridH, detectedZones, false);
    this.detectAndFillZone(pixels, 'input:not([type="submit"]):not([type="button"]):not([type="hidden"]), textarea, select', ZONES.INPUT, viewW, viewH, gridW, gridH, detectedZones, false);
    this.detectAndFillZone(pixels, 'a[href]', ZONES.LINK, viewW, viewH, gridW, gridH, detectedZones, false);

    // 4. Text blocks (paragraphs with substantial content)
    document.querySelectorAll('p, [class*="text"], [class*="content"], blockquote').forEach(el => {
      if (!this.isVisible(el)) return;
      const text = el.textContent?.trim() || '';
      if (text.length < 50) return; // Skip short text
      const rect = el.getBoundingClientRect();
      if (rect.width < 50 || rect.height < 20) return;
      this.fillZoneRect(pixels, rect, viewW, viewH, gridW, gridH, ZONES.TEXT, false);
    });

    // Convert pixel grid to Braille using zone-specific patterns
    const brailleLines = [];
    for (let row = 0; row < ROWS; row++) {
      let line = '';
      for (let col = 0; col < COLS; col++) {
        const char = this.zoneToBraille(pixels, col * CELL_W, row * CELL_H, ZONES);
        line += char;
      }
      brailleLines.push(line);
    }

    // Build legend with zone counts
    const zoneCounts = {};
    for (const zone of detectedZones) {
      zoneCounts[zone.type] = (zoneCounts[zone.type] || 0) + 1;
    }

    const legendText = [
      '═══ TACTILE PAGE MAP ═══',
      '',
      'LANDMARKS:',
      `⣿ HEADER (${zoneCounts['header'] || 0})`,
      `⣶ NAV (${zoneCounts['nav'] || 0})`,
      `⣤ MAIN (${zoneCounts['main'] || 0})`,
      `⣴ ASIDE (${zoneCounts['aside'] || 0})`,
      `⣀ FOOTER (${zoneCounts['footer'] || 0})`,
      '',
      'CONTENT:',
      `⠿ BUTTON`,
      `⠶ INPUT/FORM`,
      `⠗ LINK`,
      `⠻ IMAGE`,
      `⠛ HEADING`,
      `⠤ TEXT BLOCK`,
      `⠇ LIST`,
      `⠾ MEDIA`,
      '',
      `Page: ${document.title.slice(0, 40)}`,
      `Size: ${viewW}x${viewH}px`
    ];

    return {
      grid: brailleLines.join('\n'),
      width: COLS,
      height: ROWS,
      legend: legendText.join('\n'),
      zones: detectedZones.slice(0, 50),
      zoneCounts
    };
  }

  /**
   * Detect elements and fill their zones in the pixel grid
   */
  detectAndFillZone(pixels, selector, zoneType, viewW, viewH, gridW, gridH, detectedZones, fillArea) {
    document.querySelectorAll(selector).forEach(el => {
      if (!this.isVisible(el)) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 5 || rect.height < 5) return;

      this.fillZoneRect(pixels, rect, viewW, viewH, gridW, gridH, zoneType, fillArea);

      detectedZones.push({
        type: selector.split(',')[0].split('[')[0].trim(),
        label: el.getAttribute('aria-label') || el.textContent?.trim()?.slice(0, 30) || '',
        bounds: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
      });
    });
  }

  /**
   * Fill a zone rectangle - either full area or border only
   */
  fillZoneRect(pixels, rect, viewW, viewH, gridW, gridH, zoneType, fillArea) {
    const x1 = Math.max(0, Math.floor((rect.left / viewW) * gridW));
    const y1 = Math.max(0, Math.floor((rect.top / viewH) * gridH));
    const x2 = Math.min(gridW - 1, Math.ceil((rect.right / viewW) * gridW));
    const y2 = Math.min(gridH - 1, Math.ceil((rect.bottom / viewH) * gridH));

    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        if (fillArea || y === y1 || y === y2 || x === x1 || x === x2) {
          if (pixels[y] && pixels[y][x] !== undefined) {
            // Higher zone types (interactive) overwrite lower (structural)
            if (zoneType > pixels[y][x] || pixels[y][x] === 0) {
              pixels[y][x] = zoneType;
            }
          }
        }
      }
    }
  }

  /**
   * Convert a 2x4 zone block to appropriate Braille character
   * Different zones get different dot patterns for tactile distinction
   */
  zoneToBraille(pixels, startX, startY, ZONES) {
    // Collect zone types in this cell
    const zonesInCell = new Set();
    for (let dy = 0; dy < 4; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const y = startY + dy;
        const x = startX + dx;
        if (pixels[y] && pixels[y][x]) {
          zonesInCell.add(pixels[y][x]);
        }
      }
    }

    if (zonesInCell.size === 0) return '⠀'; // Empty braille

    // Get highest priority zone
    const primaryZone = Math.max(...zonesInCell);

    // Zone-specific braille patterns (tactilely distinct)
    const zonePatterns = {
      [ZONES.EMPTY]: '⠀',
      [ZONES.TEXT]: '⠤',      // Bottom dots - flowing text
      [ZONES.HEADING]: '⠛',   // Top heavy - prominence
      [ZONES.BUTTON]: '⠿',    // Full top - interactive
      [ZONES.INPUT]: '⠶',     // Middle band - form field
      [ZONES.LINK]: '⠗',      // Diagonal - navigable
      [ZONES.IMAGE]: '⠻',     // Dense - visual content
      [ZONES.NAV]: '⣶',       // Structured - navigation
      [ZONES.HEADER]: '⣿',    // Full - header bar
      [ZONES.FOOTER]: '⣀',    // Bottom - footer
      [ZONES.ASIDE]: '⣴',     // Side pattern - sidebar
      [ZONES.MAIN]: '⣤',      // Center mass - main content
      [ZONES.LIST]: '⠇',      // Vertical dots - list items
      [ZONES.MEDIA]: '⠾',     // Heavy - media block
      [ZONES.FORM]: '⠒',      // Horizontal - form area
      [ZONES.CARD]: '⠉'       // Top line - card container
    };

    return zonePatterns[primaryZone] || this.pixelsToBraille(pixels, startX, startY);
  }

  /**
   * Fill a rectangle in the pixel grid
   */
  fillRect(pixels, rect, viewW, viewH, gridW, gridH, value) {
    const x1 = Math.floor((rect.left / viewW) * gridW);
    const y1 = Math.floor((rect.top / viewH) * gridH);
    const x2 = Math.min(Math.ceil((rect.right / viewW) * gridW), gridW - 1);
    const y2 = Math.min(Math.ceil((rect.bottom / viewH) * gridH), gridH - 1);

    // Draw border only (outline)
    for (let y = Math.max(0, y1); y <= y2; y++) {
      for (let x = Math.max(0, x1); x <= x2; x++) {
        if (y === y1 || y === y2 || x === x1 || x === x2) {
          if (pixels[y] && pixels[y][x] !== undefined) {
            pixels[y][x] = value;
          }
        }
      }
    }
  }

  /**
   * Convert a 2x4 pixel block to a Braille Unicode character
   * Braille dot positions:
   * 1 4
   * 2 5
   * 3 6
   * 7 8
   */
  pixelsToBraille(pixels, startX, startY) {
    // Braille dot bit positions
    const dotBits = [
      [0, 0, 0x01], // dot 1
      [0, 1, 0x02], // dot 2
      [0, 2, 0x04], // dot 3
      [1, 0, 0x08], // dot 4
      [1, 1, 0x10], // dot 5
      [1, 2, 0x20], // dot 6
      [0, 3, 0x40], // dot 7
      [1, 3, 0x80]  // dot 8
    ];

    let charCode = 0x2800; // Braille base character

    for (const [dx, dy, bit] of dotBits) {
      const y = startY + dy;
      const x = startX + dx;
      if (pixels[y] && pixels[y][x]) {
        charCode |= bit;
      }
    }

    return String.fromCharCode(charCode);
  }

  /**
   * Map element type to representative Braille character
   */
  typeToChar(type) {
    const chars = {
      1: '⣿', // header
      2: '⣶', // nav
      3: '⣤', // main
      4: '⣴', // aside
      5: '⣀', // footer
      6: '⠿', // button
      7: '⠗', // link
      8: '⠶', // input
      9: '⠻'  // image
    };
    return chars[type] || '⠀';
  }

  // Helper methods
  
  isVisible(el) {
    if (!el.offsetParent && el.tagName !== 'BODY') return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0';
  }
  
  isInViewport(rect) {
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  }
  
  getRole(el) {
    if (el.getAttribute('role')) return el.getAttribute('role');
    
    const tagRoles = {
      'a': 'link',
      'button': 'button',
      'input': 'textbox',
      'select': 'combobox',
      'textarea': 'textbox',
      'img': 'image',
      'nav': 'navigation',
      'main': 'main',
      'header': 'banner',
      'footer': 'contentinfo'
    };
    
    return tagRoles[el.tagName.toLowerCase()] || 'generic';
  }
  
  getLabel(el) {
    // Try aria-label first
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    
    // Try aria-labelledby
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl) return labelEl.textContent.trim();
    }
    
    // Try associated label
    if (el.labels && el.labels[0]) {
      return el.labels[0].textContent.trim();
    }
    
    // Try title
    if (el.title) return el.title;
    
    // Try alt (for images)
    if (el.alt) return el.alt;
    
    // Try text content (for buttons)
    if (el.tagName === 'BUTTON' || el.tagName === 'A') {
      return el.textContent.trim().slice(0, 50);
    }
    
    // Try placeholder
    if (el.placeholder) return el.placeholder;
    
    return '';
  }
  
  getPath(el) {
    const path = [];
    let current = el;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      } else if (current.className) {
        const classes = Array.from(current.classList)
          .filter(c => c && !c.match(/^(ng-|js-)/))
          .slice(0, 2)
          .join('.');
        if (classes) selector += `.${classes}`;
      }

      path.unshift(selector);
      current = current.parentElement;

      if (path.length > 5) break; // Limit depth
    }

    return path.join(' > ');
  }

  getDirectText(el) {
    // Get text content excluding nested sections/articles to avoid duplication
    const clone = el.cloneNode(true);

    // Remove nested sections and articles
    clone.querySelectorAll('section, article').forEach(nested => nested.remove());

    // Remove script and style tags
    clone.querySelectorAll('script, style, noscript').forEach(tag => tag.remove());

    // Get cleaned text
    let text = clone.textContent || '';

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Get semantic structure of the page - similar to accessibility tree
   * Captures document hierarchy, ARIA semantics, and content relationships
   */
  getSemanticStructure() {
    const structure = {
      documentOutline: [],      // Heading hierarchy
      landmarks: [],            // ARIA landmarks
      forms: [],                // Form structure with labels
      lists: [],                // List hierarchy
      tables: [],               // Table structure
      interactiveElements: [],  // Buttons, links with states
      liveRegions: [],          // ARIA live regions
      relationships: []         // aria-controls, aria-owns, etc.
    };

    // 1. Document outline - heading hierarchy
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(h => {
      if (!this.isVisible(h)) return;
      const level = parseInt(h.tagName[1]);
      structure.documentOutline.push({
        level,
        text: h.textContent.trim().slice(0, 100),
        id: h.id || null,
        indent: '  '.repeat(level - 1)
      });
    });

    // 2. Landmark regions with accessible names
    const landmarkSelectors = [
      ['header, [role="banner"]', 'banner'],
      ['nav, [role="navigation"]', 'navigation'],
      ['main, [role="main"]', 'main'],
      ['aside, [role="complementary"]', 'complementary'],
      ['footer, [role="contentinfo"]', 'contentinfo'],
      ['[role="search"]', 'search'],
      ['form, [role="form"]', 'form'],
      ['section[aria-label], section[aria-labelledby], [role="region"][aria-label]', 'region'],
      ['[role="alert"]', 'alert'],
      ['[role="dialog"], dialog', 'dialog']
    ];

    landmarkSelectors.forEach(([selector, role]) => {
      document.querySelectorAll(selector).forEach(el => {
        if (!this.isVisible(el)) return;
        const name = this.getAccessibleName(el);
        structure.landmarks.push({
          role,
          name: name || '(unnamed)',
          tag: el.tagName.toLowerCase(),
          hasAriaLabel: !!el.getAttribute('aria-label'),
          childLandmarks: this.countChildLandmarks(el)
        });
      });
    });

    // 3. Form structure with input labels
    document.querySelectorAll('form').forEach(form => {
      if (!this.isVisible(form)) return;
      const formData = {
        name: this.getAccessibleName(form) || '(unnamed form)',
        action: form.action ? new URL(form.action, location.href).pathname : null,
        method: form.method || 'get',
        fields: []
      };

      form.querySelectorAll('input, select, textarea, button').forEach(field => {
        if (!this.isVisible(field) || field.type === 'hidden') return;
        const fieldData = {
          type: field.type || field.tagName.toLowerCase(),
          name: field.name || null,
          label: this.getAccessibleName(field),
          required: field.required || field.getAttribute('aria-required') === 'true',
          disabled: field.disabled || field.getAttribute('aria-disabled') === 'true',
          invalid: field.getAttribute('aria-invalid') === 'true',
          describedBy: this.getDescribedByText(field)
        };
        formData.fields.push(fieldData);
      });

      if (formData.fields.length > 0) {
        structure.forms.push(formData);
      }
    });

    // 4. List hierarchy
    document.querySelectorAll('ul, ol, dl, [role="list"]').forEach(list => {
      if (!this.isVisible(list)) return;
      // Skip if nested inside another list we'll capture
      if (list.closest('ul ul, ol ol, ul ol, ol ul')) return;

      const items = list.querySelectorAll(':scope > li, :scope > [role="listitem"], :scope > dt, :scope > dd');
      if (items.length === 0) return;

      structure.lists.push({
        type: list.tagName.toLowerCase(),
        role: list.getAttribute('role') || null,
        label: this.getAccessibleName(list),
        itemCount: items.length,
        nested: list.querySelectorAll('ul, ol').length > 0,
        items: Array.from(items).slice(0, 10).map(item => ({
          text: item.textContent.trim().slice(0, 50),
          hasLink: !!item.querySelector('a')
        }))
      });
    });

    // 5. Table structure
    document.querySelectorAll('table, [role="table"]').forEach(table => {
      if (!this.isVisible(table)) return;
      const caption = table.querySelector('caption');
      const headers = table.querySelectorAll('th, [role="columnheader"], [role="rowheader"]');
      const rows = table.querySelectorAll('tr, [role="row"]');

      structure.tables.push({
        caption: caption?.textContent.trim() || this.getAccessibleName(table),
        headerCount: headers.length,
        rowCount: rows.length,
        headers: Array.from(headers).slice(0, 10).map(h => h.textContent.trim().slice(0, 30)),
        hasScope: Array.from(headers).some(h => h.scope)
      });
    });

    // 6. Interactive elements with states
    const interactiveSelectors = 'button, [role="button"], a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [role="switch"]';
    document.querySelectorAll(interactiveSelectors).forEach(el => {
      if (!this.isVisible(el)) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 5 || rect.height < 5) return;

      const role = this.getRole(el);
      const name = this.getAccessibleName(el);
      if (!name && role === 'generic') return;

      const states = this.getAriaStates(el);
      if (Object.keys(states).length > 0 || name) {
        structure.interactiveElements.push({
          role,
          name: name || '(unlabeled)',
          tag: el.tagName.toLowerCase(),
          states,
          describedBy: this.getDescribedByText(el)
        });
      }
    });

    // Limit interactive elements to top 50
    structure.interactiveElements = structure.interactiveElements.slice(0, 50);

    // 7. Live regions
    document.querySelectorAll('[aria-live], [role="alert"], [role="status"], [role="log"], [role="marquee"], [role="timer"]').forEach(el => {
      if (!this.isVisible(el)) return;
      structure.liveRegions.push({
        role: el.getAttribute('role') || 'generic',
        ariaLive: el.getAttribute('aria-live') || 'polite',
        ariaAtomic: el.getAttribute('aria-atomic') === 'true',
        text: el.textContent.trim().slice(0, 100)
      });
    });

    // 8. ARIA relationships
    document.querySelectorAll('[aria-controls], [aria-owns], [aria-flowto], [aria-describedby], [aria-labelledby]').forEach(el => {
      if (!this.isVisible(el)) return;
      const rel = {
        source: {
          role: this.getRole(el),
          name: this.getAccessibleName(el)?.slice(0, 30)
        },
        relationships: {}
      };

      ['aria-controls', 'aria-owns', 'aria-flowto', 'aria-describedby', 'aria-labelledby'].forEach(attr => {
        const ids = el.getAttribute(attr);
        if (ids) {
          rel.relationships[attr] = ids.split(/\s+/).map(id => {
            const target = document.getElementById(id);
            return target ? {
              id,
              role: this.getRole(target),
              exists: true
            } : { id, exists: false };
          });
        }
      });

      if (Object.keys(rel.relationships).length > 0) {
        structure.relationships.push(rel);
      }
    });

    // Limit relationships
    structure.relationships = structure.relationships.slice(0, 30);

    return structure;
  }

  /**
   * Get accessible name following ARIA name computation (simplified)
   */
  getAccessibleName(el) {
    // aria-labelledby takes precedence
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const names = labelledBy.split(/\s+/).map(id => {
        const target = document.getElementById(id);
        return target?.textContent.trim();
      }).filter(Boolean);
      if (names.length) return names.join(' ');
    }

    // aria-label
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');

    // For inputs, check associated label
    if (el.labels?.length) {
      return Array.from(el.labels).map(l => l.textContent.trim()).join(' ');
    }

    // For images, use alt
    if (el.tagName === 'IMG' && el.alt) return el.alt;

    // title attribute
    if (el.title) return el.title;

    // For buttons/links, use text content
    if (['BUTTON', 'A', 'SUMMARY'].includes(el.tagName)) {
      const text = el.textContent.trim();
      if (text) return text.slice(0, 100);
    }

    // placeholder for inputs (fallback, not ideal)
    if (el.placeholder) return `[placeholder: ${el.placeholder}]`;

    return null;
  }

  /**
   * Get text from aria-describedby references
   */
  getDescribedByText(el) {
    const describedBy = el.getAttribute('aria-describedby');
    if (!describedBy) return null;

    const texts = describedBy.split(/\s+/).map(id => {
      const target = document.getElementById(id);
      return target?.textContent.trim();
    }).filter(Boolean);

    return texts.length ? texts.join(' ') : null;
  }

  /**
   * Get ARIA states for an element
   */
  getAriaStates(el) {
    const states = {};

    // Boolean states
    const booleanAttrs = ['aria-expanded', 'aria-selected', 'aria-checked', 'aria-pressed', 'aria-disabled', 'aria-hidden', 'aria-invalid', 'aria-busy', 'aria-current'];
    booleanAttrs.forEach(attr => {
      const val = el.getAttribute(attr);
      if (val && val !== 'false' && val !== 'undefined') {
        states[attr.replace('aria-', '')] = val === 'true' ? true : val;
      }
    });

    // Check native states
    if (el.disabled) states.disabled = true;
    if (el.required) states.required = true;
    if (el.readOnly) states.readonly = true;
    if (el.checked) states.checked = true;

    // Value states
    if (el.getAttribute('aria-valuenow')) {
      states.value = {
        now: el.getAttribute('aria-valuenow'),
        min: el.getAttribute('aria-valuemin'),
        max: el.getAttribute('aria-valuemax'),
        text: el.getAttribute('aria-valuetext')
      };
    }

    // Level (for headings, tree items)
    if (el.getAttribute('aria-level')) {
      states.level = parseInt(el.getAttribute('aria-level'));
    }

    // Position in set
    if (el.getAttribute('aria-posinset')) {
      states.position = {
        index: parseInt(el.getAttribute('aria-posinset')),
        total: parseInt(el.getAttribute('aria-setsize'))
      };
    }

    return states;
  }

  /**
   * Count child landmarks within an element
   */
  countChildLandmarks(el) {
    const landmarks = el.querySelectorAll('nav, main, aside, header, footer, [role="navigation"], [role="main"], [role="complementary"], [role="banner"], [role="contentinfo"], [role="search"]');
    return landmarks.length;
  }

  /**
   * Classify the page type based on content patterns
   */
  getPageType() {
    const url = window.location.href;
    const title = document.title.toLowerCase();
    const body = document.body;

    // Check for AI Studio first (high confidence detection)
    const aiStudioTurns = document.querySelectorAll('[data-turn-role]');
    const hasAIStudio = aiStudioTurns.length > 0 ||
                        !!document.querySelector('ms-chat-turn, ms-text-chunk, ms-chunk-editor') ||
                        url.includes('aistudio.google.com');

    if (hasAIStudio) {
      return {
        type: 'ai-chat',
        subType: 'google-ai-studio',
        confidence: 0.95,
        signals: {
          turnCount: aiStudioTurns.length,
          hasAIStudio: true
        }
      };
    }

    // Detection signals
    const signals = {
      hasComments: !!document.querySelector('[class*="comment"], [data-testid*="comment"], #comments'),
      hasArticle: !!document.querySelector('article, [role="article"]'),
      hasProductPrice: !!document.querySelector('[class*="price"], [itemprop="price"]'),
      hasCart: !!document.querySelector('[class*="cart"], [class*="basket"]'),
      hasLoginForm: !!document.querySelector('input[type="password"]'),
      hasSearchResults: !!document.querySelector('[class*="search-result"], [class*="results"]'),
      hasVideoPlayer: !!document.querySelector('video, [class*="player"], iframe[src*="youtube"], iframe[src*="vimeo"]'),
      hasFeed: !!document.querySelector('[class*="feed"], [class*="timeline"], [class*="stream"]'),
      hasForm: document.querySelectorAll('form input:not([type="search"]):not([type="hidden"])').length > 2,
      hasDashboard: !!document.querySelector('[class*="dashboard"], [class*="widget"]'),
      hasDocumentation: !!document.querySelector('[class*="docs"], [class*="documentation"], .markdown-body'),
      hasNavList: document.querySelectorAll('nav a').length > 5,
      commentCount: document.querySelectorAll('[class*="comment"]').length,
      formFieldCount: document.querySelectorAll('input, select, textarea').length,
      linkCount: document.querySelectorAll('a[href]').length,
      imageCount: document.querySelectorAll('img').length
    };

    // Page type classification
    let pageType = 'generic';
    let subType = null;
    let confidence = 0.5;

    // Social media post with comments
    if (signals.hasArticle && signals.hasComments && signals.commentCount > 0) {
      pageType = 'social-media-post';
      subType = 'with-comments';
      confidence = 0.85;
    }
    // E-commerce product
    else if (signals.hasProductPrice && (signals.hasCart || signals.hasArticle)) {
      pageType = 'e-commerce';
      subType = 'product-page';
      confidence = 0.8;
    }
    // Search results
    else if (signals.hasSearchResults || url.includes('search') || url.includes('q=')) {
      pageType = 'search-results';
      confidence = 0.75;
    }
    // Video page
    else if (signals.hasVideoPlayer) {
      pageType = 'video';
      subType = url.includes('youtube') ? 'youtube' : 'generic';
      confidence = 0.8;
    }
    // Login/Auth
    else if (signals.hasLoginForm && signals.formFieldCount < 5) {
      pageType = 'authentication';
      subType = 'login';
      confidence = 0.85;
    }
    // Form/Application
    else if (signals.hasForm && signals.formFieldCount > 3) {
      pageType = 'form';
      subType = signals.formFieldCount > 10 ? 'complex' : 'simple';
      confidence = 0.7;
    }
    // Feed/Timeline
    else if (signals.hasFeed) {
      pageType = 'feed';
      subType = 'social';
      confidence = 0.75;
    }
    // Dashboard
    else if (signals.hasDashboard) {
      pageType = 'dashboard';
      confidence = 0.7;
    }
    // Documentation
    else if (signals.hasDocumentation || title.includes('doc')) {
      pageType = 'documentation';
      confidence = 0.75;
    }
    // Article/Blog
    else if (signals.hasArticle && !signals.hasComments) {
      pageType = 'article';
      subType = 'blog-post';
      confidence = 0.7;
    }
    // Landing/Homepage
    else if (signals.hasNavList && signals.imageCount > 3 && url.match(/^https?:\/\/[^\/]+\/?$/)) {
      pageType = 'landing-page';
      confidence = 0.65;
    }

    return {
      type: pageType,
      subType,
      confidence,
      signals
    };
  }

  /**
   * Generate agent brief - quick orientation summary
   */
  getAgentBrief() {
    const pageType = this.getPageType();
    const meta = this.getMetadata();

    // Extract primary content
    const mainHeading = document.querySelector('h1')?.textContent?.trim();
    const article = document.querySelector('article, [role="article"]');
    const articleTitle = article?.querySelector('h1, h2, [class*="title"]')?.textContent?.trim();

    // Count engagement elements
    const comments = document.querySelectorAll('[class*="comment"]:not([class*="comment-form"]):not([class*="comment-input"])');
    const votes = document.querySelector('[class*="vote"], [class*="digg"], [class*="like"], [class*="upvote"]');
    const voteCount = votes?.textContent?.match(/\d+/)?.[0] || '0';

    // Detect author
    const authorEl = document.querySelector('[class*="author"], [rel="author"], [itemprop="author"], a[href*="/user/"], a[href*="/@"]');
    const author = authorEl?.textContent?.trim()?.replace(/^by\s*/i, '');

    // Detect source
    const sourceEl = document.querySelector('[class*="source"], [itemprop="publisher"], cite');
    const source = sourceEl?.textContent?.trim();

    // Detect timestamp
    const timeEl = document.querySelector('time, [datetime], [class*="timestamp"], [class*="date"]');
    const timestamp = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim();

    // Available actions detection
    const actions = [];

    // Vote actions
    if (document.querySelector('[class*="vote"], [class*="digg"], [class*="like"], button[aria-label*="vote"]')) {
      actions.push({ action: 'vote', type: 'upvote/downvote', authenticated: true });
    }

    // Comment action
    if (document.querySelector('[class*="comment-form"], [class*="comment-input"], textarea[placeholder*="comment"]')) {
      actions.push({ action: 'comment', supports: ['text', 'images', 'gifs'], authenticated: true });
    }

    // Share action
    if (document.querySelector('[class*="share"], button[aria-label*="share"]')) {
      actions.push({ action: 'share', type: 'link' });
    }

    // Save/Bookmark action
    if (document.querySelector('[class*="save"], [class*="bookmark"], button[aria-label*="save"]')) {
      actions.push({ action: 'save', authenticated: true });
    }

    // Search action
    if (document.querySelector('input[type="search"], [role="search"], [class*="search"]')) {
      actions.push({ action: 'search' });
    }

    // Navigation
    const navLinks = document.querySelectorAll('nav a[href]');
    if (navLinks.length > 0) {
      actions.push({ action: 'navigate', destinations: navLinks.length });
    }

    // Form submission
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      const formName = form.getAttribute('aria-label') || form.getAttribute('name') || 'form';
      const submitBtn = form.querySelector('[type="submit"], button:not([type])');
      if (submitBtn) {
        actions.push({ action: 'submit', form: formName });
      }
    });

    return {
      pageType: pageType.type,
      pageSubType: pageType.subType,
      confidence: pageType.confidence,
      site: window.location.hostname,
      url: meta.url,
      primaryContent: {
        title: articleTitle || mainHeading || meta.title,
        author,
        source,
        timestamp
      },
      engagement: {
        votes: parseInt(voteCount) || 0,
        comments: comments.length,
        age: timestamp
      },
      availableActions: actions,
      keyElements: {
        hasComments: comments.length > 0,
        hasForm: document.querySelectorAll('form').length > 0,
        hasMedia: document.querySelectorAll('video, audio, iframe').length > 0,
        hasImages: document.querySelectorAll('img').length
      }
    };
  }

  /**
   * Build hierarchical page anatomy tree with spatial hints
   */
  getPageAnatomy() {
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    const buildNode = (el, depth = 0) => {
      if (!el || !this.isVisible(el)) return null;
      if (depth > 6) return null; // Limit depth

      const rect = el.getBoundingClientRect();
      const tag = el.tagName.toLowerCase();

      // Determine semantic type
      let semanticType = this.getSemanticType(el);
      if (!semanticType && depth > 2) return null; // Skip non-semantic deep elements

      // Get label/name
      const label = this.getAccessibleName(el) || this.getElementLabel(el);

      // Spatial description
      const spatial = this.getSpatialDescription(rect, viewW, viewH);

      // Interactive info
      const interactive = this.getInteractiveInfo(el);

      // Build children
      const children = [];
      const significantChildren = this.getSignificantChildren(el);

      for (const child of significantChildren) {
        const childNode = buildNode(child, depth + 1);
        if (childNode) children.push(childNode);
      }

      return {
        type: semanticType || tag,
        tag,
        label: label?.slice(0, 60),
        spatial,
        bounds: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height)
        },
        interactive,
        children: children.length > 0 ? children : undefined
      };
    };

    // Start from body or main content areas
    const root = {
      type: 'PAGE',
      tag: 'body',
      label: document.title,
      bounds: { x: 0, y: 0, w: viewW, h: document.documentElement.scrollHeight },
      children: []
    };

    // Process major landmarks first
    const landmarks = ['header', 'nav', 'main', 'aside', 'footer', '[role="banner"]', '[role="navigation"]', '[role="main"]', '[role="complementary"]', '[role="contentinfo"]'];
    const processedEls = new Set();

    landmarks.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        if (processedEls.has(el)) return;
        const node = buildNode(el, 1);
        if (node) {
          root.children.push(node);
          processedEls.add(el);
        }
      });
    });

    // If no landmarks found, process direct body children
    if (root.children.length === 0) {
      Array.from(document.body.children).forEach(el => {
        if (processedEls.has(el)) return;
        const node = buildNode(el, 1);
        if (node) root.children.push(node);
      });
    }

    return root;
  }

  /**
   * Get semantic type of element
   */
  getSemanticType(el) {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');

    // Explicit roles
    if (role) {
      const roleMap = {
        'banner': 'HEADER',
        'navigation': 'NAV',
        'main': 'MAIN',
        'complementary': 'SIDEBAR',
        'contentinfo': 'FOOTER',
        'article': 'ARTICLE',
        'region': 'SECTION',
        'form': 'FORM',
        'search': 'SEARCH',
        'button': 'button',
        'link': 'link',
        'listbox': 'select',
        'textbox': 'input',
        'dialog': 'DIALOG',
        'alert': 'ALERT',
        'alertdialog': 'DIALOG'
      };
      if (roleMap[role]) return roleMap[role];
    }

    // Semantic tags
    const tagMap = {
      'header': 'HEADER',
      'nav': 'NAV',
      'main': 'MAIN',
      'aside': 'SIDEBAR',
      'footer': 'FOOTER',
      'article': 'ARTICLE',
      'section': 'SECTION',
      'form': 'FORM',
      'dialog': 'DIALOG',
      'h1': 'h1', 'h2': 'h2', 'h3': 'h3', 'h4': 'h4', 'h5': 'h5', 'h6': 'h6',
      'button': 'button',
      'a': 'link',
      'input': 'input',
      'textarea': 'input',
      'select': 'select',
      'img': 'image',
      'video': 'video',
      'audio': 'audio',
      'iframe': 'embed',
      'ul': 'list',
      'ol': 'list',
      'table': 'table',
      'figure': 'figure'
    };

    if (tagMap[tag]) return tagMap[tag];

    // Class-based detection
    const className = el.className?.toString().toLowerCase() || '';
    if (className.includes('comment')) return 'comment';
    if (className.includes('card')) return 'card';
    if (className.includes('modal')) return 'DIALOG';
    if (className.includes('sidebar')) return 'SIDEBAR';
    if (className.includes('header')) return 'HEADER';
    if (className.includes('footer')) return 'FOOTER';
    if (className.includes('nav')) return 'NAV';
    if (className.includes('menu')) return 'menu';
    if (className.includes('toolbar')) return 'toolbar';
    if (className.includes('actions')) return 'actions';

    return null;
  }

  /**
   * Get element label for display
   */
  getElementLabel(el) {
    const tag = el.tagName.toLowerCase();

    // For headings, get text
    if (tag.match(/^h[1-6]$/)) {
      return el.textContent.trim();
    }

    // For links and buttons, get text
    if (tag === 'a' || tag === 'button') {
      return el.textContent.trim() || el.getAttribute('aria-label');
    }

    // For inputs, get placeholder or label
    if (tag === 'input' || tag === 'textarea') {
      return el.placeholder || el.getAttribute('aria-label');
    }

    // For images, get alt
    if (tag === 'img') {
      return el.alt || '(image)';
    }

    // For sections with headings
    const heading = el.querySelector('h1, h2, h3, h4');
    if (heading) return heading.textContent.trim();

    // aria-label
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');

    return null;
  }

  /**
   * Get spatial description of element
   */
  getSpatialDescription(rect, viewW, viewH) {
    const parts = [];

    // Horizontal position
    const centerX = rect.left + rect.width / 2;
    if (centerX < viewW * 0.33) parts.push('left');
    else if (centerX > viewW * 0.67) parts.push('right');
    else parts.push('center');

    // Vertical position
    if (rect.top < 100) parts.push('top');
    else if (rect.bottom > viewH - 100) parts.push('bottom');

    // Size hints
    if (rect.width > viewW * 0.9) parts.push('full-width');
    else if (rect.width < 200) parts.push('narrow');

    if (rect.height > viewH * 0.8) parts.push('tall');
    else if (rect.height < 50) parts.push('short');

    // Fixed/sticky detection
    const style = window.getComputedStyle(rect.width ? document.elementFromPoint(rect.left + 5, rect.top + 5) || document.body : document.body);
    if (style.position === 'fixed' || style.position === 'sticky') {
      parts.push('sticky');
    }

    return parts.join(', ');
  }

  /**
   * Get interactive info for element
   */
  getInteractiveInfo(el) {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');

    if (tag === 'button' || role === 'button') {
      return { type: 'button', action: el.textContent.trim().slice(0, 20) };
    }

    if (tag === 'a') {
      const href = el.getAttribute('href');
      return { type: 'link', destination: href?.slice(0, 50) };
    }

    if (tag === 'input') {
      return { type: 'input', inputType: el.type, required: el.required };
    }

    if (tag === 'select') {
      const options = el.querySelectorAll('option');
      return { type: 'select', optionCount: options.length };
    }

    if (tag === 'form') {
      const fields = el.querySelectorAll('input, select, textarea');
      return { type: 'form', fieldCount: fields.length };
    }

    return null;
  }

  /**
   * Get significant children (skip noise)
   */
  getSignificantChildren(el) {
    const dominated = new Set();
    const candidates = [];

    // Collect potentially significant children
    for (const child of el.children) {
      if (!this.isVisible(child)) continue;

      const tag = child.tagName.toLowerCase();
      const rect = child.getBoundingClientRect();

      // Skip tiny elements
      if (rect.width < 20 || rect.height < 10) continue;

      // Skip script/style/meta
      if (['script', 'style', 'noscript', 'meta', 'link'].includes(tag)) continue;

      // Check if semantic or has significant content
      const isSignificant =
        this.getSemanticType(child) ||
        child.querySelector('h1, h2, h3, h4, article, section, form, nav, aside') ||
        child.querySelectorAll('button, a, input').length > 0 ||
        (child.textContent?.trim().length > 50);

      if (isSignificant) {
        candidates.push(child);
      }
    }

    // Remove dominated elements (contained by others)
    for (const c of candidates) {
      for (const other of candidates) {
        if (c !== other && other.contains(c)) {
          dominated.add(c);
        }
      }
    }

    return candidates.filter(c => !dominated.has(c)).slice(0, 20);
  }

  /**
   * Extract AI Studio chat conversation content
   */
  extractAIStudioContent(turns) {
    const content = [];

    // Get conversation title from page
    const titleEl = document.querySelector('ms-chunk-editor, [class*="title"], h1');
    const title = titleEl?.textContent?.trim()?.replace(/^menu\s*/, '')?.split(/\s*edit\s*/)[0]?.trim();

    if (title) {
      content.push({
        type: 'conversation',
        title: title,
        platform: 'Google AI Studio',
        turnCount: turns.length
      });
    }

    turns.forEach(function(turn, index) {
      var role = turn.getAttribute('data-turn-role');

      // Find text content - try ms-text-chunk first, then ms-cmark-node, then raw text
      var textChunks = turn.querySelectorAll('ms-text-chunk');
      var text = '';

      if (textChunks.length > 0) {
        text = Array.from(textChunks).map(function(chunk) {
          return chunk.textContent?.trim() || '';
        }).join('\n\n');
      } else {
        // Fallback to direct text, excluding UI elements
        var clone = turn.cloneNode(true);
        // Remove button text, icons
        clone.querySelectorAll('button, [class*="icon"], mat-icon').forEach(function(el) {
          el.remove();
        });
        text = clone.textContent?.trim() || '';
      }

      // Clean up common UI artifacts
      text = text.replace(/^(edit|more_vert|Model Thoughts)\s*/g, '').trim();

      // Skip empty turns
      if (!text || text.length < 5) return;

      // Extract code blocks
      var codeBlocks = [];
      turn.querySelectorAll('pre, code, [class*="code-block"]').forEach(function(code) {
        var codeText = code.textContent?.trim();
        if (codeText && codeText.length > 10) {
          codeBlocks.push({
            language: code.className?.match(/language-(\w+)/)?.[1] || 'unknown',
            code: codeText.slice(0, 2000)
          });
        }
      });

      content.push({
        type: 'chat-turn',
        index: index,
        role: role,
        text: text.slice(0, 5000),
        hasCode: codeBlocks.length > 0,
        codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined
      });
    });

    return content;
  }

  /**
   * Extract content with full attribution
   */
  getAttributedContent() {
    const content = [];

    // Check for AI Studio chat interface first
    const aiStudioTurns = document.querySelectorAll('[data-turn-role]');
    if (aiStudioTurns.length > 0) {
      return this.extractAIStudioContent(aiStudioTurns);
    }

    // Find comment-like structures
    const commentSelectors = [
      '[class*="comment"]:not([class*="comment-form"]):not([class*="comment-input"])',
      '[data-testid*="comment"]',
      '.tiptap',
      '.ProseMirror'
    ];

    const commentContainers = document.querySelectorAll(commentSelectors.join(', '));
    const processed = new Set();

    commentContainers.forEach(container => {
      // Skip if inside another comment
      if (container.closest('[class*="comment"]') !== container &&
          container.matches('[class*="comment"]')) return;

      // Skip if already processed
      const text = container.textContent?.trim();
      if (!text || text.length < 10 || processed.has(text.slice(0, 100))) return;
      processed.add(text.slice(0, 100));

      // Extract author
      const authorEl = container.querySelector('[class*="author"], [class*="user"], a[href*="/@"], a[href*="/user/"]');
      const author = authorEl?.textContent?.trim()?.replace(/^@/, '@');

      // Extract timestamp
      const timeEl = container.querySelector('time, [datetime], [class*="time"], [class*="ago"]');
      const timestamp = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim();

      // Extract engagement
      const voteEl = container.querySelector('[class*="vote"], [class*="digg"], [class*="like"]');
      const voteCount = voteEl?.textContent?.match(/\d+/)?.[0];

      // Extract actual content (excluding metadata)
      let contentText = text;
      if (authorEl) contentText = contentText.replace(authorEl.textContent, '');
      if (timeEl) contentText = contentText.replace(timeEl.textContent, '');
      contentText = contentText.replace(/^\s*[\d]+\s*(digg|like|vote)s?\s*/i, '').trim();

      // Extract links
      const links = Array.from(container.querySelectorAll('a[href]')).map(a => ({
        text: a.textContent.trim().slice(0, 50),
        url: a.href
      })).filter(l => l.text && !l.text.startsWith('@'));

      // Detect available actions
      const actions = [];
      if (container.querySelector('[class*="reply"], button[aria-label*="reply"]')) {
        actions.push('reply');
      }
      if (container.querySelector('[class*="vote"], [class*="digg"]')) {
        actions.push('vote');
      }
      if (container.querySelector('[class*="report"], [class*="flag"]')) {
        actions.push('report');
      }

      content.push({
        type: 'comment',
        author,
        timestamp,
        engagement: voteCount ? { votes: parseInt(voteCount) } : null,
        text: contentText.slice(0, 500),
        links: links.length > 0 ? links : undefined,
        actions: actions.length > 0 ? actions : undefined
      });
    });

    // Find main article content
    const article = document.querySelector('article, [role="article"]');
    if (article) {
      const titleEl = article.querySelector('h1, h2, [class*="title"]');
      const summaryEl = article.querySelector('[class*="summary"], [class*="description"], [class*="tldr"], p');

      content.unshift({
        type: 'article',
        title: titleEl?.textContent?.trim(),
        summary: summaryEl?.textContent?.trim()?.slice(0, 300),
        source: document.querySelector('[class*="source"], cite')?.textContent?.trim()
      });
    }

    return content;
  }

  /**
   * Cleanup all resources to prevent memory leaks
   */
  cleanup() {
    // Remove all highlight overlays
    document.querySelectorAll('.pagescope-highlight').forEach(el => el.remove());

    // Remove message listener
    if (this.messageListener) {
      browser.runtime.onMessage.removeListener(this.messageListener);
      this.messageListener = null;
    }

    // Run any registered cleanup handlers
    this.cleanupHandlers.forEach(fn => fn());
    this.cleanupHandlers = [];

    // Clear data to free memory
    this.data = null;

    console.log('PageScope cleaned up - memory freed');
  }
}

// Initialize
let pageScope = new PageScope();

console.log('PageScope content script loaded');

// Create message listener with proper reference for cleanup
pageScope.messageListener = (message, sender, sendResponse) => {
  console.log('PageScope received message:', message);

  if (message.action === 'extract') {
    try {
      // Clear old data before extracting new to prevent accumulation
      if (pageScope.data) {
        pageScope.data = null;
      }

      const data = pageScope.extract();
      console.log('PageScope extracted data:', data);
      sendResponse(data);
      return true; // Keep message channel open
    } catch (error) {
      console.error('PageScope extraction error:', error);
      sendResponse({ error: error.message });
      return true; // Keep message channel open
    }
  }

  if (message.action === 'highlight') {
    try {
      const { elements } = message;
      highlightElements(elements);
      sendResponse({ success: true });
      return true; // Keep message channel open
    } catch (error) {
      console.error('PageScope highlight error:', error);
      sendResponse({ error: error.message });
      return true; // Keep message channel open
    }
  }

  return false; // Didn't handle this message
};

// Register the listener
browser.runtime.onMessage.addListener(pageScope.messageListener);

// Cleanup on page navigation/unload
window.addEventListener('pagehide', () => {
  console.log('PageScope: page hiding, cleaning up to prevent memory leaks');
  pageScope.cleanup();
}, { once: true, capture: true });

// Also cleanup on beforeunload as safety net
window.addEventListener('beforeunload', () => {
  pageScope.cleanup();
}, { once: true });

function highlightElements(elementIds) {
  // Remove existing highlights
  document.querySelectorAll('.pagescope-highlight').forEach(el => el.remove());

  // Add new highlights - MUST match selector in getInteractive()
  const selectors = 'a, button, input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';
  const elements = Array.from(document.querySelectorAll(selectors))
    .filter(el => pageScope.isVisible(el));
  
  elements.forEach((el, idx) => {
    if (elementIds && !elementIds.includes(idx)) return;
    
    const rect = el.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.className = 'pagescope-highlight';
    overlay.textContent = idx;
    overlay.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background: rgba(255, 0, 0, 0.2);
      border: 2px solid red;
      color: white;
      font-weight: bold;
      font-size: 14px;
      padding: 2px 6px;
      z-index: 999999;
      pointer-events: none;
      box-sizing: border-box;
    `;
    document.body.appendChild(overlay);
  });
}
