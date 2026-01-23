/**
 * PageScope - Sidebar UI
 */

console.log('[PageScope] Sidebar script loaded');

class SidebarUI {
  constructor() {
    console.log('[PageScope] Initializing sidebar...');
    this.data = null;
    this.currentTabId = null;
    this.currentTabUrl = null;
    this.isDataLoaded = false;
    this.currentTab = 'structure';
    this.viewportOnly = true;
    this.refreshTimer = null;
    this.init();
  }
  
  async init() {
    console.log('[PageScope] Setting up event listeners...');
    this.setupEventListeners();
    this.setupTabListeners();
    console.log('[PageScope] Showing empty state...');
    this.showEmptyState();
    this.updateRefreshButton();
  }
  
  setupEventListeners() {
    console.log('[PageScope] Setting up event listeners');
    const refreshBtn = document.getElementById('refresh');
    console.log('[PageScope] Refresh button:', refreshBtn);

    if (!refreshBtn) {
      console.error('[PageScope] Refresh button not found!');
      return;
    }

    refreshBtn.addEventListener('click', () => {
      console.log('[PageScope] Refresh button clicked!');
      this.refresh();
    });

    const clearBtn = document.getElementById('clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearData();
      });
    }

    const updateNowBtn = document.getElementById('update-now');
    if (updateNowBtn) {
      updateNowBtn.addEventListener('click', () => {
        this.refresh();
      });
    }

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });
    
    document.getElementById('viewport-only').addEventListener('change', (e) => {
      this.viewportOnly = e.target.checked;
      this.renderInteractive();
    });
    
    document.getElementById('highlight-all').addEventListener('click', () => {
      this.highlightAll();
    });
    
    document.getElementById('export-json').addEventListener('click', () => {
      this.exportJSON();
    });
    
    document.getElementById('export-md').addEventListener('click', () => {
      this.exportMarkdown();
    });

    document.getElementById('export-braille').addEventListener('click', () => {
      this.exportBraille();
    });
  }
  
  switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
    
    this.currentTab = tabName;
  }
  
  async refresh() {
    console.log('[PageScope] Refresh called');
    this.showLoading();

    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      console.log('[PageScope] Active tabs:', tabs);

      if (!tabs[0]) {
        this.showError('No active tab found');
        return;
      }

      const tab = tabs[0];
      console.log('[PageScope] Current tab:', tab.id, tab.url);

      // Check if content script already loaded via ping, inject if not
      let needsInjection = true;
      try {
        await browser.tabs.sendMessage(tab.id, { action: 'ping' });
        needsInjection = false;
      } catch (e) {
        // Ping failed - script not loaded
      }

      if (needsInjection) {
        try {
          await browser.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['/content.js']
          });
          // Small delay for script initialization
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (e) {
          console.log('[PageScope] Content script injection note:', e.message);
        }
      }

      // Load user settings for extraction options
      const settings = await browser.storage.local.get({
        brailleResolution: 'standard'
      });

      console.log('[PageScope] Sending extract message with options:', settings);
      this.data = await browser.tabs.sendMessage(tab.id, {
        action: 'extract',
        options: {
          brailleResolution: settings.brailleResolution
        }
      });
      
      if (!this.data) {
        throw new Error('No data returned from content script');
      }

      console.log('[PageScope] Data received successfully:', Object.keys(this.data));

      // Store tab info
      this.currentTabId = tab.id;
      this.currentTabUrl = tab.url;
      this.isDataLoaded = true;

      // Hide stale warning and update button
      this.hideStaleWarning();
      this.updateRefreshButton();

      this.render();
    } catch (error) {
      console.error('[PageScope] Error in refresh:', error);
      
      // Show helpful error message
      const errorMsg = document.createDocumentFragment();
      const appendBreaks = (count) => {
        for (let i = 0; i < count; i++) {
          errorMsg.appendChild(document.createElement('br'));
        }
      };

      errorMsg.appendChild(document.createTextNode('Failed to extract page data.'));
      appendBreaks(2);

      if (typeof error.message === 'string' && error.message.includes('Receiving end does not exist')) {
        errorMsg.appendChild(document.createTextNode('The content script is not loaded in this page.'));
        appendBreaks(2);
        const strong = document.createElement('strong');
        strong.textContent = 'Solution:';
        errorMsg.appendChild(strong);
        errorMsg.appendChild(document.createTextNode(' Refresh this page (F5 or Ctrl+R) and try again.'));
      } else if (typeof error.message === 'string' && error.message) {
        const strong = document.createElement('strong');
        strong.textContent = 'Error:';
        errorMsg.appendChild(strong);
        errorMsg.appendChild(document.createTextNode(` ${error.message}`));
        appendBreaks(2);
        errorMsg.appendChild(document.createTextNode('Check the browser console (F12) for more details.'));
      }

      this.showError(errorMsg);
    }
  }
  
  createLoadingElement() {
    const loading = document.createElement('div');
    loading.className = 'loading';
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    const text = document.createElement('div');
    text.textContent = 'Analyzing page...';
    loading.appendChild(spinner);
    loading.appendChild(text);
    return loading;
  }

  showLoading() {
    // Structure tab
    const structureTab = document.getElementById('structure-tab');
    if (structureTab) {
      structureTab.textContent = '';
      structureTab.appendChild(this.createLoadingElement());
    }

    // Interactive tab - only update the list div, keep filter controls intact
    const interactiveList = document.getElementById('interactive-list');
    if (interactiveList) {
      interactiveList.textContent = '';
      interactiveList.appendChild(this.createLoadingElement());
    }

    // Accessibility tab
    const a11yStats = document.getElementById('a11y-stats');
    if (a11yStats) {
      a11yStats.textContent = '';
      a11yStats.appendChild(this.createLoadingElement());
    }
    const a11yIssues = document.getElementById('a11y-issues');
    if (a11yIssues) {
      a11yIssues.textContent = '';
    }
  }

  createErrorElement(message) {
    const container = document.createElement('div');
    container.className = 'empty-state';

    const icon = document.createElement('div');
    icon.className = 'empty-state-icon';
    icon.textContent = '⚠️';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'empty-state-message';

    if (typeof message === 'string') {
      messageDiv.textContent = message;
    } else if (message instanceof Node) {
      messageDiv.appendChild(message);
    }

    container.appendChild(icon);
    container.appendChild(messageDiv);
    return container;
  }

  createEmptyStateElement(iconText, messageText) {
    const container = document.createElement('div');
    container.className = 'empty-state';

    const icon = document.createElement('div');
    icon.className = 'empty-state-icon';
    icon.textContent = iconText;

    const message = document.createElement('div');
    message.className = 'empty-state-message';
    message.textContent = messageText;

    container.appendChild(icon);
    container.appendChild(message);
    return container;
  }

  createSectionHeader(text) {
    const header = document.createElement('div');
    header.className = 'section-header';
    header.textContent = text;
    return header;
  }

  createStatCard(value, labelText) {
    const card = document.createElement('div');
    card.className = 'stat-card';

    const valueDiv = document.createElement('div');
    valueDiv.className = 'stat-value';
    valueDiv.textContent = String(value);

    const labelDiv = document.createElement('div');
    labelDiv.className = 'stat-label';
    labelDiv.textContent = labelText;

    card.appendChild(valueDiv);
    card.appendChild(labelDiv);
    return card;
  }

  getSeverityClass(severity) {
    return severity === 'warning' ? 'warning' : 'error';
  }

  showError(message) {
    const errorElement = this.createErrorElement(message);

    // Structure tab
    const structureTab = document.getElementById('structure-tab');
    if (structureTab) {
      structureTab.textContent = '';
      structureTab.appendChild(errorElement.cloneNode(true));
    }

    // Interactive tab - only update the list div, keep filter controls intact
    const interactiveList = document.getElementById('interactive-list');
    if (interactiveList) {
      interactiveList.textContent = '';
      interactiveList.appendChild(errorElement.cloneNode(true));
    }

    // Accessibility tab
    const a11yStats = document.getElementById('a11y-stats');
    if (a11yStats) {
      a11yStats.textContent = '';
      a11yStats.appendChild(errorElement.cloneNode(true));
    }
    const a11yIssues = document.getElementById('a11y-issues');
    if (a11yIssues) {
      a11yIssues.textContent = '';
    }
  }
  
  render() {
    if (!this.data) return;
    
    this.renderStructure();
    this.renderInteractive();
    this.renderAccessibility();
  }
  
  renderStructure() {
    const container = document.getElementById('structure-tab');
    
    if (!container) {
      console.error('Structure tab container not found');
      return;
    }

    container.textContent = '';
    const fragment = document.createDocumentFragment();
    const { landmarks, headings, sections } = this.data.structure;

    if (landmarks.length > 0) {
      fragment.appendChild(this.createSectionHeader('Landmarks'));
      landmarks.forEach(landmark => {
        const item = document.createElement('div');
        item.className = 'item';
        if (landmark.path) item.title = landmark.path;

        const header = document.createElement('div');
        header.className = 'item-header';

        const icon = document.createElement('span');
        icon.className = 'item-icon';
        icon.textContent = this.getLandmarkIcon(landmark.type);

        const label = document.createElement('span');
        label.className = 'item-label';
        label.textContent = landmark.type || '';

        header.appendChild(icon);
        header.appendChild(label);
        item.appendChild(header);

        if (landmark.label) {
          const detail = document.createElement('div');
          detail.className = 'item-detail';
          detail.textContent = landmark.label;
          item.appendChild(detail);
        }

        fragment.appendChild(item);
      });
    }

    if (headings.length > 0) {
      fragment.appendChild(this.createSectionHeader('Headings'));
      headings.forEach(heading => {
        const item = document.createElement('div');
        item.className = 'item heading-item';
        const level = Number(heading.level) || 1;
        item.style.setProperty('--level', String(level - 1));
        if (heading.path) item.title = heading.path;

        const header = document.createElement('div');
        header.className = 'item-header';

        const icon = document.createElement('span');
        icon.className = 'item-icon';
        icon.textContent = `H${level}`;

        const label = document.createElement('span');
        label.className = 'item-label';
        label.textContent = heading.text || '';

        header.appendChild(icon);
        header.appendChild(label);
        item.appendChild(header);

        fragment.appendChild(item);
      });
    }

    if (sections.length > 0) {
      fragment.appendChild(this.createSectionHeader('Sections & Articles'));
      sections.forEach(section => {
        const item = document.createElement('div');
        item.className = 'item';
        const path = section.path || section.id;
        if (path) item.title = path;

        const header = document.createElement('div');
        header.className = 'item-header';

        const icon = document.createElement('span');
        icon.className = 'item-icon';

        const label = document.createElement('span');
        label.className = 'item-label';

        const badge = document.createElement('span');
        badge.className = 'item-badge';
        const wordCount = Number(section.wordCount) || 0;
        badge.textContent = `${wordCount} words`;

        if (section.type === 'section') {
          icon.textContent = '📑';
          label.textContent = section.heading ? `Section: ${section.heading}` : 'Section';
        } else {
          icon.textContent = '📄';
          label.textContent = section.heading ? `Article: ${section.heading}` : 'Article';
        }

        header.appendChild(icon);
        header.appendChild(label);
        header.appendChild(badge);
        item.appendChild(header);

        if (section.type === 'section' && section.articles && section.articles.length > 0) {
          const detail = document.createElement('div');
          detail.className = 'item-detail';
          const articlesText = section.articles.map(article => {
            const articleHeading = article.heading || 'Untitled';
            const articleWords = Number(article.wordCount) || 0;
            return `${articleHeading} (${articleWords}w)`;
          }).join(', ');
          detail.textContent = `Articles: ${articlesText}`;
          item.appendChild(detail);
        }

        fragment.appendChild(item);
      });
    }

    if (!fragment.childNodes.length) {
      fragment.appendChild(this.createEmptyStateElement('📭', 'No structure elements found'));
    }

    container.appendChild(fragment);
  }
  
  renderInteractive() {
    const container = document.getElementById('interactive-tab');
    if (!container) return;

    let elements = this.data.interactive;

    if (this.viewportOnly) {
      elements = elements.filter(el => el.bounds.inViewport);
    }

    const list = container.querySelector('#interactive-list');
    if (!list) {
      console.error('Interactive list container not found');
      return;
    }

    list.textContent = '';

    if (elements.length === 0) {
      const message = this.viewportOnly ? 'No interactive elements in viewport' : 'No interactive elements found';
      list.appendChild(this.createEmptyStateElement('🔍', message));
      return;
    }

    const fragment = document.createDocumentFragment();
    elements.forEach(el => {
      const item = document.createElement('div');
      item.className = 'item interactive-item';
      item.dataset.id = String(el.id);
      if (el.path) item.title = el.path;

      const id = document.createElement('div');
      id.className = 'item-id';
      id.textContent = String(el.id);
      item.appendChild(id);

      const header = document.createElement('div');
      header.className = 'item-header';

      const icon = document.createElement('span');
      icon.className = 'item-icon';
      icon.textContent = this.getInteractiveIcon(el.role);

      const label = document.createElement('span');
      label.className = 'item-label';
      label.textContent = el.label || el.role || '';

      header.appendChild(icon);
      header.appendChild(label);
      item.appendChild(header);

      if (el.type !== el.role) {
        const detail = document.createElement('div');
        detail.className = 'item-detail';
        detail.textContent = el.type || '';
        item.appendChild(detail);
      }

      const badges = this.getStateBadges(el.state, el.bounds.inViewport);
      if (badges.childNodes.length > 0) {
        const stateContainer = document.createElement('div');
        stateContainer.className = 'state-badges';
        stateContainer.appendChild(badges);
        item.appendChild(stateContainer);
      }

      fragment.appendChild(item);
    });

    list.appendChild(fragment);

    list.querySelectorAll('.interactive-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = parseInt(item.dataset.id, 10);
        await this.highlightElement(id);
      });
    });
  }
  
  renderAccessibility() {
    const container = document.getElementById('accessibility-tab');
    if (!container) return;

    const { stats, issues } = this.data.accessibility;

    const statsContainer = document.getElementById('a11y-stats');
    if (statsContainer) {
      statsContainer.textContent = '';
      const grid = document.createElement('div');
      grid.className = 'stats-grid';
      grid.appendChild(this.createStatCard(stats.landmarks, 'Landmarks'));
      grid.appendChild(this.createStatCard(stats.headings, 'Headings'));
      grid.appendChild(this.createStatCard(`${stats.altText}/${stats.totalImages}`, 'Alt Text'));
      grid.appendChild(this.createStatCard(issues.length, 'Issues'));
      statsContainer.appendChild(grid);
    }

    const issuesContainer = document.getElementById('a11y-issues');
    if (!issuesContainer) return;

    issuesContainer.textContent = '';

    if (issues.length === 0) {
      issuesContainer.appendChild(this.createEmptyStateElement('✅', 'No accessibility issues found'));
      return;
    }

    issuesContainer.appendChild(this.createSectionHeader('Issues Summary'));

    // Group by type and severity
    const grouped = {};
    issues.forEach(issue => {
      const key = `${issue.severity}-${issue.type}-${issue.message}`;
      if (!grouped[key]) {
        grouped[key] = {
          severity: issue.severity,
          type: issue.type,
          message: issue.message,
          element: issue.element,
          count: 0,
          examples: []
        };
      }
      grouped[key].count++;
      if (grouped[key].examples.length < 3) {
        grouped[key].examples.push(issue.path);
      }
    });

    // Sort by severity (errors first)
    const sortedGroups = Object.values(grouped).sort((a, b) => {
      if (a.severity === 'error' && b.severity !== 'error') return -1;
      if (a.severity !== 'error' && b.severity === 'error') return 1;
      return b.count - a.count;
    });

    sortedGroups.forEach(group => {
      const issueItem = document.createElement('div');
      const severityClass = this.getSeverityClass(group.severity);
      issueItem.className = `issue-item ${severityClass}`;

      const issueHeader = document.createElement('div');
      issueHeader.className = 'issue-header';

      const severity = document.createElement('span');
      severity.className = `issue-severity ${severityClass}`;
      severity.textContent = group.severity || '';

      const element = document.createElement('span');
      element.textContent = group.element || '';

      const count = document.createElement('span');
      count.className = 'issue-count';
      count.textContent = `×${group.count}`;

      issueHeader.appendChild(severity);
      issueHeader.appendChild(element);
      issueHeader.appendChild(count);

      const issueMessage = document.createElement('div');
      issueMessage.className = 'issue-message';
      issueMessage.textContent = group.message || '';

      issueItem.appendChild(issueHeader);
      issueItem.appendChild(issueMessage);

      if (group.examples.length > 0) {
        const details = document.createElement('details');
        details.className = 'issue-details';

        const summary = document.createElement('summary');
        summary.textContent = `Show examples (${Math.min(3, group.count)})`;
        details.appendChild(summary);

        const examples = document.createElement('div');
        examples.className = 'issue-examples';
        group.examples.forEach(path => {
          const example = document.createElement('div');
          example.className = 'issue-path';
          example.textContent = path;
          examples.appendChild(example);
        });

        if (group.count > 3) {
          const more = document.createElement('div');
          more.className = 'issue-more';
          more.textContent = `...and ${group.count - 3} more`;
          examples.appendChild(more);
        }

        details.appendChild(examples);
        issueItem.appendChild(details);
      }

      issuesContainer.appendChild(issueItem);
    });
  }
  
  async highlightAll() {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) return;
    
    let elementIds = null;
    if (this.viewportOnly) {
      elementIds = this.data.interactive
        .filter(el => el.bounds.inViewport)
        .map(el => el.id);
    }
    
    await browser.tabs.sendMessage(tabs[0].id, {
      action: 'highlight',
      elements: elementIds
    });
  }
  
  async highlightElement(id) {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) return;
    
    await browser.tabs.sendMessage(tabs[0].id, {
      action: 'highlight',
      elements: [id]
    });
  }
  
  exportJSON() {
    console.log('[PageScope] exportJSON called, data:', this.data ? 'present' : 'null');
    if (!this.data) {
      alert('No data to export. Please analyze a page first.');
      return;
    }

    // Create organized, readable JSON structure
    const organized = {
      metadata: {
        title: this.data.meta.title,
        url: this.data.meta.url,
        description: this.data.meta.description,
        language: this.data.meta.lang,
        viewport: this.data.meta.viewport,
        exportedAt: new Date().toISOString()
      },

      structure: {
        landmarks: this.data.structure.landmarks.map(l => ({
          type: l.type,
          label: l.label,
          id: l.id,
          path: l.path
        })),

        headings: this.data.structure.headings.map(h => ({
          level: h.level,
          text: h.text,
          id: h.id,
          path: h.path
        })),

        sections: this.data.structure.sections.map(s => ({
          type: s.type,
          heading: s.heading,
          id: s.id,
          wordCount: s.wordCount,
          text: s.text,
          articles: s.articles?.map(a => ({
            heading: a.heading,
            id: a.id,
            wordCount: a.wordCount,
            text: a.text
          }))
        }))
      },

      interactive: {
        count: this.data.interactive.length,
        elements: this.data.interactive.map(el => ({
          id: el.id,
          role: el.role,
          type: el.type,
          label: el.label,
          value: el.value,
          href: el.href,
          state: el.state,
          bounds: el.bounds,
          path: el.path
        }))
      },

      accessibility: {
        statistics: {
          landmarks: this.data.accessibility.stats.landmarks,
          headings: this.data.accessibility.stats.headings,
          images: {
            total: this.data.accessibility.stats.totalImages,
            withAltText: this.data.accessibility.stats.altText,
            missingAltText: this.data.accessibility.stats.totalImages - this.data.accessibility.stats.altText
          }
        },

        issues: {
          total: this.data.accessibility.issues.length,
          byType: this.groupIssuesByType(this.data.accessibility.issues),
          details: this.data.accessibility.issues.map(issue => ({
            severity: issue.severity,
            type: issue.type,
            element: issue.element,
            message: issue.message,
            path: issue.path
          }))
        }
      },

      // New comprehensive data fields
      textBlocks: this.data.textBlocks || [],
      semanticStructure: this.data.semanticStructure || {},
      brailleMap: this.data.brailleMap || '',
      agentBrief: this.data.agentBrief || {},
      pageAnatomy: this.data.pageAnatomy || {},
      attributedContent: this.data.attributedContent || {}
    };

    const json = JSON.stringify(organized, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `pagescope-${this.getFilename()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }
  
  groupIssuesByType(issues) {
    const grouped = {};
    issues.forEach(issue => {
      const key = `${issue.severity}-${issue.type}`;
      if (!grouped[key]) {
        grouped[key] = {
          severity: issue.severity,
          type: issue.type,
          message: issue.message,
          count: 0,
          examples: []
        };
      }
      grouped[key].count++;
      if (grouped[key].examples.length < 5) {
        grouped[key].examples.push(issue.path);
      }
    });
    return grouped;
  }
  
  escapeMarkdown(text) {
    if (!text) return '';

    // Remove zero-width chars that show up as "<200b>" artifacts in some views.
    text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');

    // Remove newlines and extra whitespace
    text = text.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

    // Escape markdown special characters
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/`/g, '\\`')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  escapeCodeBlock(text) {
    if (!text) return '';

    // For inline code, escape backticks and remove newlines
    return text
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\r?\n/g, ' ')
      .replace(/`/g, '\\`')
      .trim();
  }

  renderFencedCodeBlock(code, language) {
    const clean = (code || '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\r\n/g, '\n').trim();
    if (!clean) return '';

    // Use standard fence unless code contains triple backticks
    const fence = clean.includes('```') ? '````' : '```';
    const lang = language ? String(language).trim() : '';
    return `${fence}${lang}\n${clean}\n${fence}\n`;
  }

  renderCodeBlocks(codeBlocks) {
    if (!Array.isArray(codeBlocks) || codeBlocks.length === 0) return '';

    const refs = codeBlocks.map((_, idx) => `[${idx + 1}]`).join(' ');
    let out = `**Code:** ${refs}\n\n`;

    codeBlocks.forEach((block, idx) => {
      out += `[${idx + 1}] Block ${idx + 1}\n`;
      out += this.renderFencedCodeBlock(block.code, block.language);
      out += '\n';
    });

    return out;
  }

  exportMarkdown() {
    console.log('[PageScope] exportMarkdown called, data:', this.data ? 'present' : 'null');
    if (!this.data) {
      alert('No data to export. Please analyze a page first.');
      return;
    }

    let md = `# ${this.escapeMarkdown(this.data.meta.title)}\n\n`;
    md += `**URL:** ${this.data.meta.url}\n\n`;
    
    if (this.data.structure.headings.length > 0) {
      md += `## Page Structure\n\n`;
      this.data.structure.headings.forEach(h => {
        const indent = '  '.repeat(h.level - 1);
        md += `${indent}- ${this.escapeMarkdown(h.text)}\n`;
      });
      md += '\n';
    }

    if (this.data.structure.sections && this.data.structure.sections.length > 0) {
      md += `## Sections & Articles\n\n`;

      this.data.structure.sections.forEach(section => {
        if (section.type === 'section') {
          md += `### Section${section.heading ? ': ' + this.escapeMarkdown(section.heading) : ''}\n\n`;
          md += `- **Word Count:** ${section.wordCount}\n`;
          if (section.id) md += `- **ID:** \`${this.escapeCodeBlock(section.id)}\`\n`;
          md += `- **Path:** \`${this.escapeCodeBlock(section.path)}\`\n\n`;

          // Section text content
          if (section.text && section.text.length > 0) {
            const wrappedText = this.escapeMarkdown(section.text);
            md += `${wrappedText}\n\n`;
          }

          // Section code blocks (rendered separately so code keeps formatting)
          if (section.codeBlocks && section.codeBlocks.length > 0) {
            md += this.renderCodeBlocks(section.codeBlocks);
          }

          // Nested articles
          if (section.articles && section.articles.length > 0) {
            // Skip redundant header when single article matches section heading
            const sectionKey = (section.heading || '').replace(/\s+/g, ' ').trim().toLowerCase();
            const skipHeaders = section.articles.length === 1 &&
              sectionKey && sectionKey === (section.articles[0].heading || '').replace(/\s+/g, ' ').trim().toLowerCase();

            if (!skipHeaders) {
              md += `**Articles in this section:**\n\n`;
            }

            for (const article of section.articles) {
              if (!skipHeaders) {
                md += `#### ${this.escapeMarkdown(article.heading || 'Untitled')} (${article.wordCount} words)\n\n`;
                if (article.id) md += `- **ID:** \`${this.escapeCodeBlock(article.id)}\`\n`;
                md += `- **Path:** \`${this.escapeCodeBlock(article.path)}\`\n\n`;
              }

              if (article.text) {
                md += `${this.escapeMarkdown(article.text)}\n\n`;
              }

              if (article.codeBlocks && article.codeBlocks.length > 0) {
                md += this.renderCodeBlocks(article.codeBlocks);
              }
            }
          }
        } else {
          // Standalone article
          md += `### Article: ${this.escapeMarkdown(section.heading || 'Untitled')}\n\n`;
          md += `- **Word Count:** ${section.wordCount}\n`;
          if (section.id) md += `- **ID:** \`${this.escapeCodeBlock(section.id)}\`\n`;
          md += `- **Path:** \`${this.escapeCodeBlock(section.path)}\`\n\n`;

          // Article text content
          if (section.text && section.text.length > 0) {
            const wrappedText = this.escapeMarkdown(section.text);
            md += `${wrappedText}\n\n`;
          }

          // Article code blocks
          if (section.codeBlocks && section.codeBlocks.length > 0) {
            md += this.renderCodeBlocks(section.codeBlocks);
          }
        }
      });
    }

    // Add text blocks that aren't already captured in sections/articles
    // Dedupe using hash of first 200 chars to reduce memory on large pages
    if (this.data.textBlocks && this.data.textBlocks.length > 0) {
      const hashKey = (text) => (text || '').trim().slice(0, 200);

      // Collect hashes of text already included from sections/articles
      const includedHashes = new Set();
      if (this.data.structure.sections) {
        for (const section of this.data.structure.sections) {
          if (section.text) includedHashes.add(hashKey(section.text));
          if (section.articles) {
            for (const article of section.articles) {
              if (article.text) includedHashes.add(hashKey(article.text));
            }
          }
        }
      }

      // Filter to additional text blocks not already included
      const seenHashes = new Set();
      const additionalBlocks = this.data.textBlocks.filter(block => {
        const key = hashKey(block.text);
        if (!key) return false;
        if (includedHashes.has(key) || seenHashes.has(key)) return false;
        seenHashes.add(key);
        return true;
      });

      if (additionalBlocks.length > 0) {
        md += `## Additional Text Blocks (${additionalBlocks.length})\n\n`;
        for (const block of additionalBlocks) {
          const cleanText = this.escapeMarkdown(block.text);
          if (cleanText) md += `${cleanText}\n\n`;
        }
      }
    }

    if (this.data.interactive.length > 0) {
      md += `## Interactive Elements (${this.data.interactive.length})\n\n`;
      this.data.interactive.forEach(el => {
        const state = [];
        if (el.state.disabled) state.push('disabled');
        if (el.state.checked) state.push('checked');
        if (el.state.required) state.push('required');
        const stateStr = state.length > 0 ? ` [${state.join(', ')}]` : '';
        const label = this.escapeMarkdown(el.label || '(unlabeled)');
        // Keep interactive elements on a single line (less verbose, easier to scan).
        const path = el.path ? ` \`${this.escapeCodeBlock(el.path)}\`` : '';
        md += `- **[${el.id}]** ${label} (${el.role}${stateStr})${path}\n`;
      });
      md += '\n';
    }
    
    if (this.data.accessibility.issues.length > 0) {
      md += `## Accessibility Issues\n\n`;
      
      // Group issues by type for aggregation
      const issueGroups = {};
      this.data.accessibility.issues.forEach(issue => {
        const key = `${issue.severity}-${issue.type}-${issue.message}`;
        if (!issueGroups[key]) {
          issueGroups[key] = {
            severity: issue.severity,
            type: issue.type,
            message: issue.message,
            element: issue.element,
            instances: []
          };
        }
        issueGroups[key].instances.push(issue.path);
      });
      
      // Output grouped issues
      Object.values(issueGroups).forEach(group => {
        const message = this.escapeMarkdown(group.message);
        md += `### ${group.severity.toUpperCase()}: ${message}\n\n`;
        md += `**Element:** ${this.escapeMarkdown(group.element)}  \n`;
        md += `**Count:** ${group.instances.length}\n\n`;

        if (group.instances.length <= 10) {
          md += `**Locations:**\n`;
          group.instances.forEach(path => {
            md += `- \`${this.escapeCodeBlock(path)}\`\n`;
          });
        } else {
          md += `**Sample Locations (showing first 10 of ${group.instances.length}):**\n`;
          group.instances.slice(0, 10).forEach(path => {
            md += `- \`${this.escapeCodeBlock(path)}\`\n`;
          });
        }
        md += '\n';
      });
    }

    // Add metadata section
    md += `## Page Metadata\n\n`;
    md += `- **Language:** ${this.escapeMarkdown(this.data.meta.lang || 'Not specified')}\n`;
    const description = this.data.meta.description || 'Not specified';
    md += `- **Description:** ${this.escapeMarkdown(description)}\n`;
    md += `- **Viewport:** ${this.data.meta.viewport.width}x${this.data.meta.viewport.height}\n`;
    md += `- **Scrollable:** ${this.data.meta.viewport.scrollable ? 'Yes' : 'No'}\n\n`;
    
    // Add statistics
    md += `## Statistics\n\n`;
    md += `- **Landmarks:** ${this.data.accessibility.stats.landmarks}\n`;
    md += `- **Headings:** ${this.data.accessibility.stats.headings}\n`;
    md += `- **Interactive Elements:** ${this.data.interactive.length}\n`;
    md += `- **Images:** ${this.data.accessibility.stats.totalImages}\n`;
    md += `- **Images with alt text:** ${this.data.accessibility.stats.altText}\n`;
    
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagescope-${this.getFilename()}.md`;
    a.click();
    
    URL.revokeObjectURL(url);
  }
  
  cleanText(str) {
    if (!str) return '';

    // Remove newlines and extra whitespace
    return str.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

  exportBraille() {
    console.log('[PageScope] exportBraille called, data:', this.data ? 'present' : 'null');
    if (!this.data) {
      alert('No data to export. Please analyze a page first.');
      return;
    }

    let text = '';

    // ═══════════════════════════════════════════════════════════════════════════════
    // SECTION 1: AGENT BRIEF (Quick Orientation)
    // ═══════════════════════════════════════════════════════════════════════════════
    text += '╔' + '═'.repeat(78) + '╗\n';
    text += '║' + '                         PAGESCOPE AGENT BRIEF'.padEnd(78) + '║\n';
    text += '╚' + '═'.repeat(78) + '╝\n\n';

    if (this.data.agentBrief) {
      const brief = this.data.agentBrief;

      // Page classification
      const typeStr = brief.pageSubType
        ? `${brief.pageType} (${brief.pageSubType})`
        : brief.pageType;
      text += `PAGE TYPE: ${typeStr} [confidence: ${Math.round(brief.confidence * 100)}%]\n`;
      text += `SITE: ${brief.site}\n`;
      text += `URL: ${brief.url}\n\n`;

      // Primary content
      if (brief.primaryContent) {
        text += 'PRIMARY CONTENT:\n';
        if (brief.primaryContent.title) {
          text += `  Title: "${this.cleanText(brief.primaryContent.title).slice(0, 60)}"\n`;
        }
        if (brief.primaryContent.author) {
          text += `  Author: ${brief.primaryContent.author}\n`;
        }
        if (brief.primaryContent.source) {
          text += `  Source: ${brief.primaryContent.source}\n`;
        }
        if (brief.primaryContent.timestamp) {
          text += `  Posted: ${brief.primaryContent.timestamp}\n`;
        }
        text += '\n';
      }

      // Engagement metrics
      if (brief.engagement) {
        const engParts = [];
        if (brief.engagement.votes) engParts.push(`${brief.engagement.votes} votes`);
        if (brief.engagement.comments) engParts.push(`${brief.engagement.comments} comments`);
        if (engParts.length > 0) {
          text += `ENGAGEMENT: ${engParts.join(' | ')}\n\n`;
        }
      }

      // Available actions
      if (brief.availableActions && brief.availableActions.length > 0) {
        text += 'AVAILABLE ACTIONS:\n';
        brief.availableActions.forEach(action => {
          let actionDesc = `  ✓ ${action.action}`;
          if (action.type) actionDesc += ` (${action.type})`;
          if (action.supports) actionDesc += ` [supports: ${action.supports.join(', ')}]`;
          if (action.authenticated) actionDesc += ' *requires auth*';
          if (action.destinations) actionDesc += ` → ${action.destinations} destinations`;
          text += actionDesc + '\n';
        });
        text += '\n';
      }

      // Key elements summary
      if (brief.keyElements) {
        const elements = [];
        if (brief.keyElements.hasComments) elements.push('comments');
        if (brief.keyElements.hasForm) elements.push('forms');
        if (brief.keyElements.hasMedia) elements.push('media');
        if (brief.keyElements.hasImages) elements.push(`${brief.keyElements.hasImages} images`);
        if (elements.length > 0) {
          text += `KEY ELEMENTS: ${elements.join(', ')}\n\n`;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SECTION 2: PAGE ANATOMY (Hierarchical Structure)
    // ═══════════════════════════════════════════════════════════════════════════════
    text += '═'.repeat(80) + '\n';
    text += '                         PAGE ANATOMY\n';
    text += '═'.repeat(80) + '\n\n';

    if (this.data.pageAnatomy) {
      const renderTree = (node, prefix = '', isLast = true) => {
        if (!node) return '';
        let result = '';

        const connector = isLast ? '└─' : '├─';
        const typeMarker = node.type.match(/^[A-Z]/) ? `[${node.type}]` : `[${node.type}]`;
        const spatialHint = node.spatial ? ` (${node.spatial})` : '';

        // Format label
        let labelStr = '';
        if (node.label) {
          labelStr = ` "${this.cleanText(node.label).slice(0, 40)}"`;
        }

        // Interactive info
        let interactiveStr = '';
        if (node.interactive) {
          if (node.interactive.type === 'button') {
            interactiveStr = ` → ${node.interactive.action || 'click'}`;
          } else if (node.interactive.type === 'link') {
            interactiveStr = ` → ${node.interactive.destination?.slice(0, 30) || 'navigate'}`;
          } else if (node.interactive.type === 'form') {
            interactiveStr = ` [${node.interactive.fieldCount} fields]`;
          }
        }

        result += `${prefix}${connector} ${typeMarker}${labelStr}${spatialHint}${interactiveStr}\n`;

        if (node.children && node.children.length > 0) {
          const childPrefix = prefix + (isLast ? '   ' : '│  ');
          node.children.forEach((child, idx) => {
            result += renderTree(child, childPrefix, idx === node.children.length - 1);
          });
        }

        return result;
      };

      // Render children of the page root
      if (this.data.pageAnatomy.children) {
        this.data.pageAnatomy.children.forEach((child, idx) => {
          text += renderTree(child, '', idx === this.data.pageAnatomy.children.length - 1);
        });
      }
      text += '\n';
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SECTION 3: ATTRIBUTED CONTENT (Comments/Posts with Context)
    // ═══════════════════════════════════════════════════════════════════════════════
    if (this.data.attributedContent && this.data.attributedContent.length > 0) {
      text += '═'.repeat(80) + '\n';
      text += '                         CONTENT EXTRACTION\n';
      text += '═'.repeat(80) + '\n\n';

      // Article first
      const articles = this.data.attributedContent.filter(c => c.type === 'article');
      const comments = this.data.attributedContent.filter(c => c.type === 'comment');

      articles.forEach(article => {
        text += `[ARTICLE]\n`;
        if (article.title) text += `  Title: ${this.cleanText(article.title)}\n`;
        if (article.source) text += `  Source: ${article.source}\n`;
        if (article.summary) {
          text += `  Summary: ${this.cleanText(article.summary).slice(0, 200)}...\n`;
        }
        text += '\n';
      });

      if (comments.length > 0) {
        text += `[COMMENTS] (${comments.length} total)\n\n`;

        comments.forEach((comment, idx) => {
          // Header line
          let header = `  ${idx + 1}. `;
          if (comment.author) header += `${comment.author}`;
          if (comment.timestamp) header += ` • ${comment.timestamp}`;
          if (comment.engagement?.votes) header += ` • ${comment.engagement.votes} votes`;
          text += header + '\n';

          // Content
          if (comment.text) {
            const wrapped = this.wrapText(this.cleanText(comment.text), 70, '     ');
            text += wrapped + '\n';
          }

          // Links
          if (comment.links && comment.links.length > 0) {
            comment.links.forEach(link => {
              text += `     [link] ${link.url.slice(0, 60)}\n`;
            });
          }

          // Actions
          if (comment.actions && comment.actions.length > 0) {
            text += `     → can: ${comment.actions.join(', ')}\n`;
          }

          text += '\n';
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SECTION 4: BRAILLE TACTILE MAP (Ambient)
    // ═══════════════════════════════════════════════════════════════════════════════
    if (this.data.brailleMap) {
      text += '═'.repeat(80) + '\n';
      text += '                         TACTILE MAP (Braille - Ambient)\n';
      text += '═'.repeat(80) + '\n\n';

      text += 'LEGEND:\n';
      text += '  ⣿ HEADER  ⣶ NAV  ⣤ MAIN  ⣴ ASIDE  ⣀ FOOTER\n';
      text += '  ⠿ button  ⠗ link  ⠶ input  ⠻ image  ⠛ heading\n\n';

      text += this.data.brailleMap.grid + '\n\n';
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SECTION 5: SEMANTIC STRUCTURE (Accessibility Tree)
    // ═══════════════════════════════════════════════════════════════════════════════
    if (this.data.semanticStructure) {
      const sem = this.data.semanticStructure;

      // Document outline
      if (sem.documentOutline && sem.documentOutline.length > 0) {
        text += '═'.repeat(80) + '\n';
        text += '                         DOCUMENT OUTLINE\n';
        text += '═'.repeat(80) + '\n\n';

        sem.documentOutline.forEach(h => {
          const indent = '  '.repeat(h.level - 1);
          text += `${indent}H${h.level}: ${this.cleanText(h.text).slice(0, 60)}\n`;
        });
        text += '\n';
      }

      // Landmarks
      if (sem.landmarks && sem.landmarks.length > 0) {
        text += '═'.repeat(80) + '\n';
        text += '                         LANDMARK REGIONS\n';
        text += '═'.repeat(80) + '\n\n';

        const byRole = {};
        sem.landmarks.forEach(l => {
          if (!byRole[l.role]) byRole[l.role] = [];
          byRole[l.role].push(l);
        });

        for (const [role, items] of Object.entries(byRole)) {
          text += `[${role.toUpperCase()}]\n`;
          items.forEach(l => {
            text += `  • ${l.name}${l.hasAriaLabel ? ' (labeled)' : ''}\n`;
          });
        }
        text += '\n';
      }

      // Forms
      if (sem.forms && sem.forms.length > 0) {
        text += '═'.repeat(80) + '\n';
        text += '                         FORM STRUCTURE\n';
        text += '═'.repeat(80) + '\n\n';

        sem.forms.forEach((form, idx) => {
          text += `Form ${idx + 1}: ${this.cleanText(form.name)}\n`;
          form.fields.forEach(f => {
            const states = [];
            if (f.required) states.push('required');
            if (f.disabled) states.push('disabled');
            text += `  • [${f.type}] ${f.label || '(unlabeled)'}${states.length ? ' [' + states.join(',') + ']' : ''}\n`;
          });
          text += '\n';
        });
      }

      // Interactive with states
      const withStates = sem.interactiveElements?.filter(e => Object.keys(e.states).length > 0) || [];
      if (withStates.length > 0) {
        text += '═'.repeat(80) + '\n';
        text += '                         INTERACTIVE STATES\n';
        text += '═'.repeat(80) + '\n\n';

        withStates.slice(0, 20).forEach(el => {
          const stateStr = Object.entries(el.states)
            .map(([k, v]) => v === true ? k : `${k}=${v}`)
            .join(', ');
          text += `• [${el.role}] ${this.cleanText(el.name).slice(0, 40)}\n`;
          text += `  States: ${stateStr}\n`;
        });
        text += '\n';
      }

      // ARIA relationships
      if (sem.relationships && sem.relationships.length > 0) {
        text += '═'.repeat(80) + '\n';
        text += '                         ARIA RELATIONSHIPS\n';
        text += '═'.repeat(80) + '\n\n';

        sem.relationships.slice(0, 15).forEach(rel => {
          text += `• [${rel.source.role}] ${rel.source.name || '?'}\n`;
          for (const [attr, targets] of Object.entries(rel.relationships)) {
            text += `  ${attr}: ${targets.map(t => t.id).join(', ')}\n`;
          }
        });
        text += '\n';
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SECTION 6: MACHINE-READABLE (JSON)
    // ═══════════════════════════════════════════════════════════════════════════════
    text += '═'.repeat(80) + '\n';
    text += '                         MACHINE-READABLE (JSON)\n';
    text += '═'.repeat(80) + '\n\n';

    const machineData = {
      pageType: this.data.agentBrief?.pageType,
      pageSubType: this.data.agentBrief?.pageSubType,
      url: this.data.meta?.url,
      title: this.data.meta?.title,
      actions: this.data.agentBrief?.availableActions?.map(a => a.action) || [],
      engagement: this.data.agentBrief?.engagement,
      landmarks: this.data.structure?.landmarks?.length || 0,
      headings: this.data.structure?.headings?.length || 0,
      interactive: this.data.interactive?.length || 0,
      comments: this.data.attributedContent?.filter(c => c.type === 'comment').length || 0,
      issues: this.data.accessibility?.issues?.length || 0
    };

    text += JSON.stringify(machineData, null, 2) + '\n\n';

    // ═══════════════════════════════════════════════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════════════════════════════════════════════
    text += '─'.repeat(80) + '\n';
    text += `Exported: ${new Date().toISOString()}\n`;
    text += `PageScope v0.2.0 | Agent-Focused Export\n`;

    const blob = new Blob([text], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `pagescope-agent-${this.getFilename()}.txt`;
    a.click();

    URL.revokeObjectURL(url);
  }

  wrapText(text, width, indent = '') {
    const words = text.split(/\s+/);
    let lines = [];
    let line = indent;

    words.forEach(word => {
      if (line.length + word.length + 1 > width) {
        lines.push(line);
        line = indent + word;
      } else {
        line += (line.length > indent.length ? ' ' : '') + word;
      }
    });
    if (line.length > indent.length) lines.push(line);

    return lines.join('\n');
  }

  escapeMermaid(text) {
    if (!text) return '';
    return text
      .replace(/"/g, "'")
      .replace(/\[/g, '(')
      .replace(/]/g, ')')
      .replace(/\n/g, ' ')
      .slice(0, 50);
  }
  
  getFilename() {
    const title = this.data.meta.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    
    const date = new Date().toISOString().split('T')[0];
    return `${title}-${date}`;
  }
  
  getLandmarkIcon(type) {
    const icons = {
      'navigation': '🧭',
      'main': '📄',
      'complementary': '📌',
      'contentinfo': 'ℹ️',
      'banner': '🏁',
      'nav': '🧭',
      'header': '🏁',
      'footer': 'ℹ️',
      'aside': '📌'
    };
    return icons[type] || '📍';
  }
  
  getInteractiveIcon(role) {
    const icons = {
      'button': '🔘',
      'link': '🔗',
      'textbox': '✏️',
      'combobox': '📋',
      'checkbox': '☑️',
      'radio': '🔘',
      'tab': '📑',
      'menuitem': '📍'
    };
    return icons[role] || '▪️';
  }
  
  createStateBadge(text, className) {
    const badge = document.createElement('span');
    badge.className = `state-badge ${className}`;
    badge.textContent = text;
    return badge;
  }

  getStateBadges(state, inViewport) {
    const fragment = document.createDocumentFragment();
    if (!state) return fragment;

    if (state.disabled) fragment.appendChild(this.createStateBadge('disabled', 'disabled'));
    if (state.checked) fragment.appendChild(this.createStateBadge('checked', 'checked'));
    if (state.required) fragment.appendChild(this.createStateBadge('required', 'required'));
    if (state.expanded) fragment.appendChild(this.createStateBadge('expanded', 'expanded'));
    if (inViewport) fragment.appendChild(this.createStateBadge('in view', 'viewport'));

    return fragment;
  }
  
  escape(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  clearData() {
    this.data = null;
    this.currentTabId = null;
    this.currentTabUrl = null;
    this.isDataLoaded = false;

    this.hideStaleWarning();
    this.updateRefreshButton();
    this.showEmptyState();
  }

  showEmptyState() {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';

    const icon = document.createElement('div');
    icon.className = 'empty-state-icon';
    icon.textContent = '📋';

    const message = document.createElement('div');
    message.className = 'empty-state-message';

    const text1 = document.createTextNode('No data loaded');
    const br = document.createElement('br');
    const text2 = document.createTextNode('Click ');
    const strong = document.createElement('strong');
    strong.textContent = 'Load';
    const text3 = document.createTextNode(' to analyze the current page');

    message.appendChild(text1);
    message.appendChild(br);
    message.appendChild(text2);
    message.appendChild(strong);
    message.appendChild(text3);

    emptyDiv.appendChild(icon);
    emptyDiv.appendChild(message);

    // Set empty state in all tabs
    const structureTab = document.getElementById('structure-tab');
    if (structureTab) {
      structureTab.textContent = '';
      structureTab.appendChild(emptyDiv.cloneNode(true));
    }

    const interactiveList = document.getElementById('interactive-list');
    if (interactiveList) {
      interactiveList.textContent = '';
      interactiveList.appendChild(emptyDiv.cloneNode(true));
    }

    const a11yStats = document.getElementById('a11y-stats');
    if (a11yStats) {
      a11yStats.textContent = '';
      a11yStats.appendChild(emptyDiv.cloneNode(true));
    }

    const a11yIssues = document.getElementById('a11y-issues');
    if (a11yIssues) {
      a11yIssues.textContent = '';
    }
  }

  async updateRefreshButton() {
    const btn = document.getElementById('refresh');
    if (!btn) return;

    if (!this.isDataLoaded) {
      btn.textContent = '⬇️ Load';
      btn.className = 'refresh-btn state-load';
      return;
    }

    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];

      if (activeTab && activeTab.id !== this.currentTabId) {
        btn.textContent = '⬆️ Update';
        btn.className = 'refresh-btn state-update';
      } else {
        btn.textContent = '↻ Refresh';
        btn.className = 'refresh-btn state-refresh';
      }
    } catch (error) {
      console.error('Error updating button state:', error);
    }
  }

  showStaleWarning(activeTab) {
    const warning = document.getElementById('stale-data-warning');
    if (!warning) return;

    const urlSpan = warning.querySelector('.stale-url');
    if (urlSpan && activeTab) {
      urlSpan.textContent = activeTab.title || activeTab.url;
    }

    warning.style.display = 'flex';
  }

  hideStaleWarning() {
    const warning = document.getElementById('stale-data-warning');
    if (warning) {
      warning.style.display = 'none';
    }
  }

  setupTabListeners() {
    browser.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabChange();
    });

    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.url && tabId === this.currentTabId) {
        this.handleTabChange();
      }
    });
  }

  async handleTabChange() {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];

      if (!activeTab || !this.isDataLoaded) return;

      // Check if URL is defined before comparing
      if (!activeTab.url) return;

      if (activeTab.id !== this.currentTabId || activeTab.url !== this.currentTabUrl) {
        this.showStaleWarning(activeTab);
        this.updateRefreshButton();

        // Auto-refresh after 300ms debounce
        clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => {
          this.refresh();
        }, 300);
      }
    } catch (error) {
      console.error('Error handling tab change:', error);
    }
  }
}

new SidebarUI();
