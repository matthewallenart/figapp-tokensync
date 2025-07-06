class DesignTokenUI {
  constructor() {
    this.tokens = {};
    this.hasGitHubToken = false;
    this.stats = {
      totalTokens: 0,
      tokensByType: {},
      collections: 0,
      lastUpdated: new Date().toISOString()
    };
    
    this.initializeUI();
    this.setupEventListeners();
    
    // Request initial token data
    this.refreshTokens();
  }

  initializeUI() {
    // Show loading state initially
    this.showLoading();
    
    // Initialize tabs
    this.initializeTabs();
  }

  initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.tab-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetPanel = tab.dataset.tab;
        
        // Update tab states
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(targetPanel).classList.add('active');
        
        // Load history data when History tab is accessed
        if (targetPanel === 'history-panel') {
          this.loadHistory();
        }
      });
    });
  }

  setupEventListeners() {
    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.refreshTokens();
    });

    // Download JSON button
    document.getElementById('downloadBtn').addEventListener('click', () => {
      this.downloadJSON();
    });

    // Save GitHub token button
    document.getElementById('saveTokenBtn').addEventListener('click', () => {
      this.saveGitHubToken();
    });

    // Push to GitHub button
    document.getElementById('pushBtn').addEventListener('click', () => {
      this.pushToGitHub();
    });

    // Advanced options toggle
    document.getElementById('showAdvanced').addEventListener('change', (e) => {
      this.toggleAdvancedOptions(e.target.checked);
    });

    // Create PR checkbox
    document.getElementById('createPR').addEventListener('change', (e) => {
      this.togglePROptions(e.target.checked);
    });

    // Refresh history button
    document.getElementById('refreshHistoryBtn').addEventListener('click', () => {
      this.loadHistory();
    });

    // Listen for messages from plugin
    window.addEventListener('message', (event) => {
      if (event.data && event.data.pluginMessage) {
        this.handlePluginMessage(event.data.pluginMessage);
      }
    });
  }

  handlePluginMessage(msg) {
    if (!msg || !msg.type) {
      console.warn('Invalid plugin message received:', msg);
      return;
    }

    this.hideError();
    this.hideSuccess();

    switch (msg.type) {
      case 'tokens-extracted':
        this.tokens = msg.tokens || {};
        this.hasGitHubToken = msg.hasGitHubToken;
        this.stats = msg.stats || this.stats;
        this.updateUI();
        break;

      case 'download-ready':
        this.triggerDownload(msg.data, msg.filename);
        break;

      case 'github-token-saved':
        this.hasGitHubToken = msg.hasToken;
        this.updateGitHubStatus();
        this.showSuccess('GitHub token saved successfully!');
        break;

      case 'github-push-success':
        this.showSuccess('Design tokens pushed to GitHub successfully!');
        break;

      case 'error':
        this.showError(msg.message);
        break;
    }
  }

  refreshTokens() {
    this.showLoading();
    parent.postMessage({
      pluginMessage: { type: 'refresh-tokens' }
    }, '*');
  }

  downloadJSON() {
    parent.postMessage({
      pluginMessage: { type: 'download-json' }
    }, '*');
  }

  saveGitHubToken() {
    const token = document.getElementById('githubToken').value.trim();
    
    if (!token) {
      this.showError('Please enter a GitHub token');
      return;
    }

    parent.postMessage({
      pluginMessage: { 
        type: 'save-github-token',
        token: token
      }
    }, '*');

    // Clear the input for security
    document.getElementById('githubToken').value = '';
  }

  pushToGitHub() {
    const owner = document.getElementById('repoOwner').value.trim();
    const repo = document.getElementById('repoName').value.trim();
    const branch = document.getElementById('branch').value.trim() || 'main';
    const filePath = document.getElementById('filePath').value.trim() || 'design-tokens.json';
    const commitMessage = document.getElementById('commitMessage').value.trim();
    const createPR = document.getElementById('createPR').checked;
    const prTitle = document.getElementById('prTitle').value.trim();
    const prDescription = document.getElementById('prDescription').value.trim();

    if (!owner || !repo) {
      this.showError('Please enter repository owner and name');
      return;
    }

    if (!this.hasGitHubToken) {
      this.showError('Please save a GitHub token first');
      return;
    }

    const config = { 
      owner, 
      repo, 
      branch, 
      filePath,
      commitMessage,
      createPullRequest: createPR,
      prTitle,
      prDescription
    };

    parent.postMessage({
      pluginMessage: {
        type: 'push-to-github',
        config: config
      }
    }, '*');
  }

  toggleAdvancedOptions(show) {
    const content = document.getElementById('advancedContent');
    if (show) {
      content.classList.add('show');
    } else {
      content.classList.remove('show');
    }
  }

  togglePROptions(show) {
    const prOptions = document.getElementById('prOptions');
    prOptions.style.display = show ? 'block' : 'none';
  }

  async loadHistory() {
    try {
      // Load collections
      const collectionsResponse = await fetch('/api/collections');
      const collections = await collectionsResponse.json();
      this.updateCollectionsList(collections);

      // Load export history
      const exportsResponse = await fetch('/api/exports');
      const exports = await exportsResponse.json();
      this.updateHistoryList(exports);
    } catch (error) {
      console.error('Failed to load history:', error);
      // Fallback to empty state
      this.updateCollectionsList([]);
      this.updateHistoryList([]);
    }
  }

  updateCollectionsList(collections) {
    const container = document.getElementById('collectionsList');
    
    if (collections.length === 0) {
      container.innerHTML = this.getEmptyStateHTML();
      return;
    }

    const itemsHTML = collections.map(collection => `
      <div class="collection-item" data-id="${collection.id}">
        <div class="item-header">
          <div class="item-title">${collection.name}</div>
          <div class="item-date">${new Date(collection.updatedAt).toLocaleDateString()}</div>
        </div>
        <div class="item-meta">
          <div class="item-tokens">${collection.tokenCount} tokens</div>
          <div>${collection.figmaFileName || 'Unknown file'}</div>
        </div>
      </div>
    `).join('');

    container.innerHTML = itemsHTML;
  }

  updateHistoryList(history) {
    const container = document.getElementById('historyList');
    
    if (history.length === 0) {
      container.innerHTML = this.getEmptyStateHTML();
      return;
    }

    const itemsHTML = history.map(item => `
      <div class="history-item" data-id="${item.id}">
        <div class="item-header">
          <div class="item-title">${item.exportType === 'github' ? 'GitHub Push' : 'JSON Download'}</div>
          <div class="item-date">${new Date(item.createdAt).toLocaleDateString()}</div>
        </div>
        <div class="item-meta">
          <div class="item-tokens">${item.tokenCount} tokens</div>
          <div class="item-status status-${item.status}">${item.status}</div>
        </div>
        ${item.commitUrl ? `<div style="font-size: 9px; margin-top: 4px; color: var(--figma-color-text-tertiary);">
          <a href="${item.commitUrl}" target="_blank" style="color: inherit;">View commit</a>
        </div>` : ''}
      </div>
    `).join('');

    container.innerHTML = itemsHTML;
  }

  updateUI() {
    this.hideLoading();
    this.updateStats();
    this.updatePreview();
    this.updateGitHubStatus();
    this.updateButtons();
  }

  updateStats() {
    document.getElementById('totalTokens').textContent = this.stats.totalTokens;
    document.getElementById('collections').textContent = this.stats.collections;
    
    // Update token types count
    const tokenTypesCount = Object.keys(this.stats.tokensByType).length;
    document.getElementById('tokenTypes').textContent = tokenTypesCount;
    
    // Create token type breakdown
    this.updateTokenTypeBreakdown();
  }

  updateTokenTypeBreakdown() {
    const tokenTypesContainer = document.querySelector('.token-types');
    if (!tokenTypesContainer) return;
    
    const tokensByType = this.stats.tokensByType;
    if (Object.keys(tokensByType).length === 0) {
      tokenTypesContainer.innerHTML = '';
      return;
    }
    
    const typeItems = Object.entries(tokensByType)
      .map(([type, count]) => `
        <div class="token-type-item">
          <span class="token-type-name">${type}</span>
          <span class="token-type-count">${count}</span>
        </div>
      `).join('');
    
    tokenTypesContainer.innerHTML = `
      <div class="token-types-header">Token Types Breakdown</div>
      <div class="token-types-list">${typeItems}</div>
    `;
  }

  updatePreview() {
    const previewElement = document.getElementById('jsonPreview');
    
    if (this.totalTokens === 0) {
      previewElement.innerHTML = this.getEmptyStateHTML();
    } else {
      const formattedJSON = this.formatJSON(this.tokens);
      previewElement.textContent = formattedJSON;
    }
  }

  updateGitHubStatus() {
    const statusElement = document.getElementById('githubStatus');
    const indicatorElement = document.getElementById('statusIndicator');
    const statusTextElement = document.getElementById('statusText');

    if (this.hasGitHubToken) {
      indicatorElement.className = 'status-indicator status-connected';
      statusTextElement.textContent = 'GitHub token configured';
    } else {
      indicatorElement.className = 'status-indicator status-disconnected';
      statusTextElement.textContent = 'No GitHub token configured';
    }
  }

  updateButtons() {
    const downloadBtn = document.getElementById('downloadBtn');
    const pushBtn = document.getElementById('pushBtn');

    downloadBtn.disabled = this.stats.totalTokens === 0;
    pushBtn.disabled = this.stats.totalTokens === 0 || !this.hasGitHubToken;
  }

  formatJSON(obj) {
    return JSON.stringify(obj, null, 2);
  }

  getEmptyStateHTML() {
    return `
      <div class="empty-state">
        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <div>No design tokens found</div>
        <div style="margin-top: 4px; opacity: 0.7;">Create some variables, styles, or effects in Figma</div>
      </div>
    `;
  }

  triggerDownload(content, filename) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    this.showSuccess('Design tokens downloaded successfully!');
  }

  showLoading() {
    const previewElement = document.getElementById('jsonPreview');
    previewElement.innerHTML = `
      <div class="loading">
        <div>Loading design tokens...</div>
      </div>
    `;
  }

  hideLoading() {
    // Loading state is replaced by updatePreview()
  }

  showError(message) {
    this.hideError();
    const errorElement = document.createElement('div');
    errorElement.className = 'error';
    errorElement.textContent = message;
    errorElement.id = 'errorMessage';
    
    const container = document.querySelector('.container');
    container.insertBefore(errorElement, container.firstChild.nextSibling);
  }

  hideError() {
    const existingError = document.getElementById('errorMessage');
    if (existingError) {
      existingError.remove();
    }
  }

  showSuccess(message) {
    this.hideSuccess();
    const successElement = document.createElement('div');
    successElement.className = 'success';
    successElement.textContent = message;
    successElement.id = 'successMessage';
    
    const container = document.querySelector('.container');
    container.insertBefore(successElement, container.firstChild.nextSibling);

    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.hideSuccess();
    }, 3000);
  }

  hideSuccess() {
    const existingSuccess = document.getElementById('successMessage');
    if (existingSuccess) {
      existingSuccess.remove();
    }
  }
}

// Initialize the UI when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new DesignTokenUI();
});
