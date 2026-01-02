/**
 * PageScope - Content Script
 * Extracts semantic page structure and accessibility information
 */

class PageScope {
  constructor() {
    this.data = null;
  }
  
  /**
   * Extract complete page structure
   * @returns {Object} Structured page data
   */
  extract() {
    return {
      meta: this.getMetadata(),
      structure: this.getStructure(),
      interactive: this.getInteractive(),
      accessibility: this.getAccessibility(),
      viewport: this.getViewportInfo(),
      textBlocks: this.getTextBlocks(),
      brailleMap: this.getBrailleMap(),
      semanticStructure: this.getSemanticStructure()
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

    document.querySelectorAll('[role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"], nav, main, aside, footer, header').forEach(el => {
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
   * Extract text blocks - captures comments, posts, and other text content
   * that may not use semantic HTML tags
   */
  getTextBlocks() {
    const blocks = [];
    const MIN_WORDS = 3; // Lowered to catch short comments
    const seen = new Set();

    // Find elements with substantial text content
    // Added Digg-specific selectors and common comment patterns
    const candidates = document.querySelectorAll(`
      p, blockquote, li, td,
      [class*="comment"], [class*="post"], [class*="content"], [class*="text"], [class*="body"],
      [data-testid*="comment"], [data-testid*="post"],
      .tiptap, .ProseMirror,
      [class*="rt-Text"], [class*="rt-Flex"],
      div[id^="radix-"] > div,
      section[class*="flex"] > div[class*="flex"] > div
    `);

    candidates.forEach((el, idx) => {
      if (!this.isVisible(el)) return;

      // Skip if parent already captured (avoid duplicates)
      const text = el.textContent?.trim() || '';
      if (seen.has(text) || text.length < 10) return; // Lowered min length

      // Count words
      const words = text.match(/\b\w+\b/g) || [];
      if (words.length < MIN_WORDS) return;

      // Skip if mostly code/script content
      if (el.closest('script, style, code, pre, noscript')) return;

      // Skip navigation/UI elements
      if (el.closest('nav, header, footer') && words.length < 20) return;

      const rect = el.getBoundingClientRect();

      // Check if this text is contained in an already-added block
      let isNested = false;
      for (const block of blocks) {
        if (text.includes(block.text) || block.text.includes(text)) {
          if (text.length <= block.text.length) {
            isNested = true;
            break;
          }
        }
      }
      if (isNested) return;

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
    blocks.sort((a, b) => a.bounds.y - b.bounds.y);

    return blocks.slice(0, 100); // Limit to prevent huge exports
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
}

// Initialize and listen for messages
const pageScope = new PageScope();

console.log('PageScope content script loaded');

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('PageScope received message:', message);

  if (message.action === 'extract') {
    try {
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
});

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
