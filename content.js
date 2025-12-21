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
      viewport: this.getViewportInfo()
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
