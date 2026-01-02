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

    document.getElementById('export-text').addEventListener('click', () => {
      this.exportText();
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

      // Inject content script directly from sidebar (Firefox 131+ sidebar doesn't trigger action.onClicked)
      try {
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['/content.js']
        });
        console.log('[PageScope] Content script injected');
      } catch (e) {
        console.log('[PageScope] Content script injection note:', e.message);
        // Script might already be injected or page is restricted
      }

      // Small delay to ensure content script is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('[PageScope] Sending extract message...');
      this.data = await browser.tabs.sendMessage(tab.id, {
        action: 'extract'
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
      let errorMsg = 'Failed to extract page data.<br><br>';

      if (error.message && error.message.includes('Receiving end does not exist')) {
        errorMsg += 'The content script is not loaded in this page.<br><br>';
        errorMsg += '<strong>Solution:</strong> Refresh this page (F5 or Ctrl+R) and try again.';
      } else if (error.message) {
        errorMsg += '<strong>Error:</strong> ' + this.escape(error.message) + '<br><br>';
        errorMsg += 'Check the browser console (F12) for more details.';
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

    // Handle HTML in message (only for controlled strings)
    if (message.includes('<br>') || message.includes('<strong>')) {
      // Parse controlled HTML safely
      const temp = document.createElement('div');
      temp.innerHTML = message;
      while (temp.firstChild) {
        messageDiv.appendChild(temp.firstChild);
      }
    } else {
      messageDiv.textContent = message;
    }

    container.appendChild(icon);
    container.appendChild(messageDiv);
    return container;
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
    
    let html = '';
    
    if (this.data.structure.landmarks.length > 0) {
      html += '<div class="section-header">Landmarks</div>';
      this.data.structure.landmarks.forEach(landmark => {
        const icon = this.getLandmarkIcon(landmark.type);
        html += `
          <div class="item" title="${this.escape(landmark.path)}">
            <div class="item-header">
              <span class="item-icon">${icon}</span>
              <span class="item-label">${this.escape(landmark.type)}</span>
            </div>
            ${landmark.label ? `<div class="item-detail">${this.escape(landmark.label)}</div>` : ''}
          </div>
        `;
      });
    }
    
    if (this.data.structure.headings.length > 0) {
      html += '<div class="section-header">Headings</div>';
      this.data.structure.headings.forEach(heading => {
        html += `
          <div class="item heading-item" style="--level: ${heading.level - 1}" title="${this.escape(heading.path)}">
            <div class="item-header">
              <span class="item-icon">H${heading.level}</span>
              <span class="item-label">${this.escape(heading.text)}</span>
            </div>
          </div>
        `;
      });
    }
    
    if (this.data.structure.sections.length > 0) {
      html += '<div class="section-header">Sections & Articles</div>';
      this.data.structure.sections.forEach(section => {
        if (section.type === 'section') {
          // Section with potential nested articles
          html += `
            <div class="item" title="${this.escape(section.path || section.id)}">
              <div class="item-header">
                <span class="item-icon">📑</span>
                <span class="item-label">Section${section.heading ? ': ' + this.escape(section.heading) : ''}</span>
                <span class="item-badge">${section.wordCount} words</span>
              </div>
          `;

          // Show nested articles
          if (section.articles && section.articles.length > 0) {
            html += '<div class="item-detail">Articles: ';
            section.articles.forEach((article, idx) => {
              if (idx > 0) html += ', ';
              html += `${this.escape(article.heading || 'Untitled')} (${article.wordCount}w)`;
            });
            html += '</div>';
          }

          html += '</div>';
        } else {
          // Standalone article
          html += `
            <div class="item" title="${this.escape(section.path || section.id)}">
              <div class="item-header">
                <span class="item-icon">📄</span>
                <span class="item-label">Article${section.heading ? ': ' + this.escape(section.heading) : ''}</span>
                <span class="item-badge">${section.wordCount} words</span>
              </div>
            </div>
          `;
        }
      });
    }
    
    if (html === '') {
      html = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <div class="empty-state-message">No structure elements found</div>
        </div>
      `;
    }
    
    container.innerHTML = html;
  }
  
  renderInteractive() {
    const container = document.getElementById('interactive-tab');
    
    let elements = this.data.interactive;
    
    if (this.viewportOnly) {
      elements = elements.filter(el => el.bounds.inViewport);
    }
    
    let html = '';
    
    if (elements.length === 0) {
      html = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-message">
            ${this.viewportOnly ? 'No interactive elements in viewport' : 'No interactive elements found'}
          </div>
        </div>
      `;
    } else {
      elements.forEach(el => {
        const icon = this.getInteractiveIcon(el.role);
        const states = this.getStateHTML(el.state, el.bounds.inViewport);
        
        html += `
          <div class="item interactive-item" data-id="${el.id}" title="${this.escape(el.path)}">
            <div class="item-id">${el.id}</div>
            <div class="item-header">
              <span class="item-icon">${icon}</span>
              <span class="item-label">${this.escape(el.label || el.role)}</span>
            </div>
            ${el.type !== el.role ? `<div class="item-detail">${this.escape(el.type)}</div>` : ''}
            ${states ? `<div class="state-badges">${states}</div>` : ''}
          </div>
        `;
      });
    }
    
    container.querySelector('#interactive-list').innerHTML = html;
    
    container.querySelectorAll('.interactive-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = parseInt(item.dataset.id);
        await this.highlightElement(id);
      });
    });
  }
  
  renderAccessibility() {
    const container = document.getElementById('accessibility-tab');
    
    const { stats, issues } = this.data.accessibility;
    
    let statsHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.landmarks}</div>
          <div class="stat-label">Landmarks</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.headings}</div>
          <div class="stat-label">Headings</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.altText}/${stats.totalImages}</div>
          <div class="stat-label">Alt Text</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${issues.length}</div>
          <div class="stat-label">Issues</div>
        </div>
      </div>
    `;
    
    document.getElementById('a11y-stats').innerHTML = statsHTML;
    
    let issuesHTML = '';
    
    if (issues.length === 0) {
      issuesHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <div class="empty-state-message">No accessibility issues found</div>
        </div>
      `;
    } else {
      issuesHTML = '<div class="section-header">Issues Summary</div>';
      
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
        issuesHTML += `
          <div class="issue-item ${group.severity}">
            <div class="issue-header">
              <span class="issue-severity ${group.severity}">${group.severity}</span>
              <span>${group.element}</span>
              <span class="issue-count">×${group.count}</span>
            </div>
            <div class="issue-message">${group.message}</div>
            ${group.examples.length > 0 ? `
              <details class="issue-details">
                <summary>Show examples (${Math.min(3, group.count)})</summary>
                <div class="issue-examples">
                  ${group.examples.map(path => `<div class="issue-path">${this.escape(path)}</div>`).join('')}
                  ${group.count > 3 ? `<div class="issue-more">...and ${group.count - 3} more</div>` : ''}
                </div>
              </details>
            ` : ''}
          </div>
        `;
      });
    }
    
    document.getElementById('a11y-issues').innerHTML = issuesHTML;
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
          wordCount: s.wordCount
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
      }
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

    // For code blocks, just escape backticks and remove newlines
    return text.replace(/\r?\n/g, ' ').replace(/`/g, '\\`').trim();
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
          md += `- **Path:** \`${this.escapeCodeBlock(section.path)}\`\n`;

          // Nested articles
          if (section.articles && section.articles.length > 0) {
            md += `\n**Articles in this section:**\n\n`;
            section.articles.forEach(article => {
              md += `  - ${this.escapeMarkdown(article.heading || 'Untitled')} (${article.wordCount} words)\n`;
              if (article.id) md += `    - ID: \`${this.escapeCodeBlock(article.id)}\`\n`;
              md += `    - Path: \`${this.escapeCodeBlock(article.path)}\`\n`;
            });
          }
          md += '\n';
        } else {
          // Standalone article
          md += `### Article: ${this.escapeMarkdown(section.heading || 'Untitled')}\n\n`;
          md += `- **Word Count:** ${section.wordCount}\n`;
          if (section.id) md += `- **ID:** \`${this.escapeCodeBlock(section.id)}\`\n`;
          md += `- **Path:** \`${this.escapeCodeBlock(section.path)}\`\n\n`;
        }
      });
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
        md += `- **[${el.id}]** ${el.role}: ${label}${stateStr}\n`;
        if (el.path) {
          md += `  - Path: \`${this.escapeCodeBlock(el.path)}\`\n`;
        }
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

  exportText() {
    console.log('[PageScope] exportText called, data:', this.data ? 'present' : 'null');
    if (!this.data) {
      alert('No data to export. Please analyze a page first.');
      return;
    }

    let text = '';

    // Page title and URL
    const title = this.cleanText(this.data.meta.title);
    text += `${title}\n`;
    text += `${'='.repeat(title.length)}\n\n`;
    text += `URL: ${this.data.meta.url}\n\n`;

    // Landmarks and their text content
    const landmarks = this.data.structure.landmarks;

    landmarks.forEach(landmark => {
      if (landmark.type === 'header' || landmark.type === 'banner') {
        text += `[HEADER]\n`;
        text += `${'-'.repeat(80)}\n`;

        // Get header text from interactive elements (nav links, etc.)
        const headerElements = this.data.interactive.filter(el =>
          el.bounds.y < 150 && el.label
        );
        headerElements.slice(0, 10).forEach(el => {
          text += `${this.cleanText(el.label)}\n`;
        });
        text += `\n`;
      }
    });

    // Main content sections
    const main = landmarks.find(l => l.type === 'main');
    if (main) {
      text += `[MAIN CONTENT]\n`;
      text += `${'-'.repeat(80)}\n\n`;
    }

    // Headings with hierarchy
    if (this.data.structure.headings.length > 0) {
      this.data.structure.headings.forEach(heading => {
        const indent = '  '.repeat(heading.level - 1);
        text += `${indent}${this.cleanText(heading.text)}\n`;
      });
      text += `\n`;
    }

    // Sections and articles with their text content
    if (this.data.structure.sections.length > 0) {
      text += `\n[SECTIONS]\n`;
      text += `${'-'.repeat(80)}\n`;

      this.data.structure.sections.forEach((section, idx) => {
        if (section.type === 'section') {
          // Section with potential nested articles
          const heading = this.cleanText(section.heading || `Section ${idx + 1}`);
          text += `\nSection: ${heading}\n`;
          text += `  Word count: ${section.wordCount}\n`;

          if (section.articles && section.articles.length > 0) {
            text += `  Articles (${section.articles.length}):\n`;
            section.articles.forEach(article => {
              text += `    - ${this.cleanText(article.heading || 'Untitled')} (${article.wordCount} words)\n`;
            });
          }
          text += '\n';
        } else {
          // Standalone article
          const heading = this.cleanText(section.heading || `Article ${idx + 1}`);
          text += `\nArticle: ${heading} (${section.wordCount} words)\n\n`;
        }
      });
    }

    // Comments or interactive text (if detected)
    const commentElements = this.data.interactive.filter(el =>
      el.label && el.label.length > 50 // Likely comment or long text
    );

    if (commentElements.length > 0) {
      text += `[COMMENTS / INTERACTIVE TEXT]\n`;
      text += `${'-'.repeat(80)}\n\n`;

      commentElements.forEach((el, idx) => {
        text += `Comment ${idx + 1}:\n`;
        const cleanedLabel = this.cleanText(el.label);

        // Wrap long comments at 80 characters
        const words = cleanedLabel.split(' ');
        let line = '';
        words.forEach(word => {
          if (line.length + word.length + 1 > 80) {
            if (line) text += `${line}\n`;
            line = word;
          } else {
            line += (line ? ' ' : '') + word;
          }
        });
        if (line) text += `${line}\n`;
        text += `\n`;
      });
    }

    // Footer
    const footer = landmarks.find(l => l.type === 'footer' || l.type === 'contentinfo');
    if (footer) {
      text += `[FOOTER]\n`;
      text += `${'-'.repeat(80)}\n`;

      const footerLinks = this.data.interactive.filter(el =>
        el.role === 'link' && el.bounds.y > this.data.meta.viewport.height * 0.85
      );

      footerLinks.slice(0, 10).forEach(link => {
        if (link.label) text += `${this.cleanText(link.label)}\n`;
      });
    }

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `pagescope-text-${this.getFilename()}.txt`;
    a.click();

    URL.revokeObjectURL(url);
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
    // SECTION 4: ASCII BOUNDARY MAP (Visual Layout)
    // ═══════════════════════════════════════════════════════════════════════════════
    if (this.data.asciiMap) {
      text += '═'.repeat(80) + '\n';
      text += '                         SPATIAL MAP (ASCII)\n';
      text += '═'.repeat(80) + '\n\n';
      text += this.data.asciiMap.map + '\n\n';
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SECTION 5: BRAILLE TACTILE MAP (Ambient)
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
    // SECTION 6: SEMANTIC STRUCTURE (Accessibility Tree)
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
    // SECTION 7: MACHINE-READABLE (JSON)
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
  
  getStateHTML(state, inViewport) {
    const badges = [];
    
    if (state.disabled) badges.push('<span class="state-badge disabled">disabled</span>');
    if (state.checked) badges.push('<span class="state-badge checked">checked</span>');
    if (state.required) badges.push('<span class="state-badge required">required</span>');
    if (state.expanded) badges.push('<span class="state-badge expanded">expanded</span>');
    if (inViewport) badges.push('<span class="state-badge viewport">in view</span>');
    
    return badges.join('');
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
