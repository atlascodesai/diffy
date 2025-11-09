import * as Diff from 'diff';

// DOM Elements
let textLeft: HTMLTextAreaElement;
let textRight: HTMLTextAreaElement;
let resultsContainer: HTMLElement;
let resultsLeftElement: HTMLElement;
let resultsRightElement: HTMLElement;
let leftCount: HTMLElement;
let rightCount: HTMLElement;
let diffCounter: HTMLElement;

let currentDiffIndex = 0;
let totalDiffs = 0;
let isLoadingFromHistory = false;

// Initialize app
window.addEventListener("DOMContentLoaded", () => {
  // Get all DOM elements
  textLeft = document.querySelector("#text-left")!;
  textRight = document.querySelector("#text-right")!;
  resultsContainer = document.querySelector("#results-container")!;
  resultsLeftElement = document.querySelector("#results-left")!;
  resultsRightElement = document.querySelector("#results-right")!;
  leftCount = document.querySelector("#left-count")!;
  rightCount = document.querySelector("#right-count")!;
  diffCounter = document.querySelector("#diff-counter")!;

  // Add event listeners
  document.querySelector("#compare-btn")?.addEventListener("click", compareTexts);
  document.querySelector("#load-test-data-btn")?.addEventListener("click", loadTestData);
  document.querySelector("#clear-btn")?.addEventListener("click", clearAll);
  document.querySelector("#switch-btn")?.addEventListener("click", switchTexts);

  // Copy buttons
  document.querySelector("#copy-left-btn")?.addEventListener("click", () => copyToClipboard(textLeft.value));
  document.querySelector("#copy-right-btn")?.addEventListener("click", () => copyToClipboard(textRight.value));
  document.querySelector("#to-lowercase")?.addEventListener("click", () => applyToLowercase());
  document.querySelector("#sort-lines")?.addEventListener("click", () => applySortLines());
  document.querySelector("#remove-whitespace")?.addEventListener("click", () => applyRemoveWhitespace());
  document.querySelector("#replace-linebreaks")?.addEventListener("click", () => applyReplaceLinebreaks());
  document.querySelector("#prev-diff")?.addEventListener("click", () => navigateDiff(-1));
  document.querySelector("#next-diff")?.addEventListener("click", () => navigateDiff(1));

  // Synchronized scrolling between result panels
  let isScrolling = false;
  resultsLeftElement.addEventListener('scroll', () => {
    if (!isScrolling) {
      isScrolling = true;
      resultsRightElement.scrollTop = resultsLeftElement.scrollTop;
      setTimeout(() => { isScrolling = false; }, 10);
    }
  });
  resultsRightElement.addEventListener('scroll', () => {
    if (!isScrolling) {
      isScrolling = true;
      resultsLeftElement.scrollTop = resultsRightElement.scrollTop;
      setTimeout(() => { isScrolling = false; }, 10);
    }
  });

  // Character count updates
  textLeft.addEventListener("input", updateCharCount);
  textRight.addEventListener("input", updateCharCount);

  // Drag and drop for left panel
  setupDragAndDrop(textLeft, document.querySelector('.text-panels .panel:first-child')!);

  // Drag and drop for right panel
  setupDragAndDrop(textRight, document.querySelector('.text-panels .panel:last-child')!);

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Cmd+Enter or Cmd+R - Compare
    if ((e.metaKey || e.ctrlKey) && (e.key === "Enter" || e.key === "r")) {
      e.preventDefault();
      compareTexts();
    }
    // Cmd+N - New Diff
    if ((e.metaKey || e.ctrlKey) && e.key === "n") {
      e.preventDefault();
      newDiff();
    }
    // Cmd+H - Toggle History
    if ((e.metaKey || e.ctrlKey) && e.key === "h") {
      e.preventDefault();
      const historySidebar = document.querySelector('#history-sidebar') as HTMLElement;
      if (historySidebar && settings.historyEnabled) {
        historySidebar.classList.toggle('open');
      }
    }
    // ESC - Close modals and sidebar
    if (e.key === "Escape") {
      const historySidebar = document.querySelector('#history-sidebar') as HTMLElement;
      const settingsModal = document.querySelector('#settings-modal') as HTMLElement;
      const shortcutsModal = document.querySelector('#shortcuts-modal') as HTMLElement;
      const acknowledgementsModal = document.querySelector('#acknowledgements-modal') as HTMLElement;

      if (historySidebar && historySidebar.classList.contains('open')) {
        historySidebar.classList.remove('open');
      } else if (acknowledgementsModal && acknowledgementsModal.style.display === 'flex') {
        acknowledgementsModal.style.display = 'none';
      } else if (shortcutsModal && shortcutsModal.style.display === 'flex') {
        shortcutsModal.style.display = 'none';
      } else if (settingsModal && settingsModal.style.display === 'flex') {
        settingsModal.style.display = 'none';
      }
    }
    // Alt+Ctrl+C - Compare
    if (e.altKey && e.ctrlKey && e.key === "c") {
      e.preventDefault();
      compareTexts();
    }
    // Alt+Ctrl+R - Clear
    if (e.altKey && e.ctrlKey && e.key === "r") {
      e.preventDefault();
      clearAll();
    }
    // Alt+Ctrl+S - Switch
    if (e.altKey && e.ctrlKey && e.key === "s") {
      e.preventDefault();
      switchTexts();
    }
  });

  updateCharCount();
  loadTestData();

  // Load settings and history
  loadSettings();
  loadHistory();

  // Check for first launch and show shortcuts modal
  checkFirstLaunch();

  // Settings modal handlers
  const settingsBtn = document.querySelector('#settings-btn');
  const settingsModal = document.querySelector('#settings-modal') as HTMLElement;
  const closeSettingsBtn = document.querySelector('#close-settings');
  const saveSettingsBtn = document.querySelector('#save-settings');
  const cancelSettingsBtn = document.querySelector('#cancel-settings');
  const enableHistoryCheckbox = document.querySelector('#enable-history') as HTMLInputElement;

  settingsBtn?.addEventListener('click', () => {
    settingsModal.style.display = 'flex';
    applySettings();
  });

  closeSettingsBtn?.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });

  cancelSettingsBtn?.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });

  saveSettingsBtn?.addEventListener('click', () => {
    const retentionPolicySelect = document.querySelector('#retention-policy') as HTMLSelectElement;

    settings.historyEnabled = enableHistoryCheckbox.checked;
    settings.retentionDays = parseInt(retentionPolicySelect.value);

    saveSettings();
    applyRetentionPolicy();
    settingsModal.style.display = 'none';
  });

  // Toggle retention policy visibility when history is toggled
  enableHistoryCheckbox?.addEventListener('change', () => {
    const retentionSetting = document.querySelector('#retention-setting') as HTMLElement;
    retentionSetting.style.display = enableHistoryCheckbox.checked ? 'flex' : 'none';
  });

  // Click outside modal to close
  settingsModal?.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
  });

  // History sidebar handlers
  const toggleHistoryBtn = document.querySelector('#toggle-history');
  const historySidebar = document.querySelector('#history-sidebar') as HTMLElement;
  const closeHistoryBtn = document.querySelector('#close-history');

  toggleHistoryBtn?.addEventListener('click', () => {
    historySidebar.classList.toggle('open');
  });

  closeHistoryBtn?.addEventListener('click', () => {
    historySidebar.classList.remove('open');
  });

  // New diff button
  const newDiffBtn = document.querySelector('#new-diff-btn');
  newDiffBtn?.addEventListener('click', newDiff);

  // Shortcuts modal handlers
  const shortcutsModal = document.querySelector('#shortcuts-modal') as HTMLElement;
  const showShortcutsLink = document.querySelector('#show-shortcuts');
  const closeShortcutsBtn = document.querySelector('#close-shortcuts');
  const closeShortcutsBtnFooter = document.querySelector('#close-shortcuts-btn');
  const dontShowShortcuts = document.querySelector('#dont-show-shortcuts') as HTMLInputElement;

  showShortcutsLink?.addEventListener('click', () => {
    settingsModal.style.display = 'none';
    shortcutsModal.style.display = 'flex';
  });

  closeShortcutsBtn?.addEventListener('click', () => {
    shortcutsModal.style.display = 'none';
  });

  closeShortcutsBtnFooter?.addEventListener('click', () => {
    if (dontShowShortcuts.checked) {
      localStorage.setItem('diffy-hide-shortcuts', 'true');
    }
    shortcutsModal.style.display = 'none';
  });

  // Click outside modal to close
  shortcutsModal?.addEventListener('click', (e) => {
    if (e.target === shortcutsModal) {
      shortcutsModal.style.display = 'none';
    }
  });

  // Acknowledgements modal handlers
  const acknowledgementsModal = document.querySelector('#acknowledgements-modal') as HTMLElement;
  const showAcknowledgementsLink = document.querySelector('#show-acknowledgements');
  const closeAcknowledgementsBtn = document.querySelector('#close-acknowledgements');
  const closeAcknowledgementsBtnFooter = document.querySelector('#close-acknowledgements-btn');

  showAcknowledgementsLink?.addEventListener('click', () => {
    settingsModal.style.display = 'none';
    acknowledgementsModal.style.display = 'flex';
  });

  closeAcknowledgementsBtn?.addEventListener('click', () => {
    acknowledgementsModal.style.display = 'none';
  });

  closeAcknowledgementsBtnFooter?.addEventListener('click', () => {
    acknowledgementsModal.style.display = 'none';
  });

  // Click outside modal to close
  acknowledgementsModal?.addEventListener('click', (e) => {
    if (e.target === acknowledgementsModal) {
      acknowledgementsModal.style.display = 'none';
    }
  });
});

function loadTestData() {
  const leftText = `function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price * items[i].quantity;
  }
  return total;
}

const cart = [
  { name: "Laptop", price: 999, quantity: 1 },
  { name: "Mouse", price: 25, quantity: 2 },
  { name: "Keyboard", price: 75, quantity: 1 }
];

console.log("Total:", calculateTotal(cart));`;

  const rightText = `function calculateTotal(items, discount = 0) {
  let total = 0;
  for (const item of items) {
    total += item.price * item.quantity;
  }

  // Apply discount if provided
  if (discount > 0) {
    total = total * (1 - discount / 100);
  }

  return Math.round(total * 100) / 100;
}

const cart = [
  { name: "Laptop", price: 999, quantity: 1 },
  { name: "Mouse", price: 29.99, quantity: 2 },
  { name: "Keyboard", price: 75, quantity: 1 },
  { name: "USB Cable", price: 12.50, quantity: 3 }
];

const discount = 10; // 10% discount
console.log("Total with discount:", calculateTotal(cart, discount));`;

  textLeft.value = leftText;
  textRight.value = rightText;
  updateCharCount();
}

function updateCharCount() {
  leftCount.textContent = `${textLeft.value.length} characters`;
  rightCount.textContent = `${textRight.value.length} characters`;
}

function compareTexts() {
  const left = textLeft.value;
  const right = textRight.value;

  if (!left && !right) {
    resultsContainer.style.display = "none";
    return;
  }

  // Perform line-by-line diff
  const diffs = Diff.diffLines(left, right);

  // Group consecutive removed/added into modifications
  const processedDiffs: Array<{
    type: 'added' | 'removed' | 'modified' | 'unchanged';
    leftLines: string[];
    rightLines: string[];
  }> = [];

  for (let i = 0; i < diffs.length; i++) {
    const part = diffs[i];
    const lines = part.value.split('\n');
    if (lines[lines.length - 1] === '') {
      lines.pop();
    }

    if (part.removed && i + 1 < diffs.length && diffs[i + 1].added) {
      // This is a modification - removed followed by added
      const nextPart = diffs[i + 1];
      const nextLines = nextPart.value.split('\n');
      if (nextLines[nextLines.length - 1] === '') {
        nextLines.pop();
      }

      processedDiffs.push({
        type: 'modified',
        leftLines: lines,
        rightLines: nextLines
      });
      i++; // Skip the next part since we processed it
    } else if (part.added) {
      processedDiffs.push({
        type: 'added',
        leftLines: [],
        rightLines: lines
      });
    } else if (part.removed) {
      processedDiffs.push({
        type: 'removed',
        leftLines: lines,
        rightLines: []
      });
    } else {
      processedDiffs.push({
        type: 'unchanged',
        leftLines: lines,
        rightLines: lines
      });
    }
  }

  // Count total differences
  totalDiffs = processedDiffs.filter(d => d.type !== 'unchanged').length;
  currentDiffIndex = totalDiffs > 0 ? 1 : 0;

  updateDiffCounter();

  // Build HTML for both panels with line numbers
  let leftHtml = '';
  let rightHtml = '';
  let diffIndex = 0;
  let leftLineNum = 1;
  let rightLineNum = 1;

  processedDiffs.forEach((diff) => {
    if (diff.type === 'modified') {
      diffIndex++;
      const maxLines = Math.max(diff.leftLines.length, diff.rightLines.length);

      for (let i = 0; i < maxLines; i++) {
        const leftLine = diff.leftLines[i] || '';
        const rightLine = diff.rightLines[i] || '';

        if (leftLine && rightLine) {
          // Both lines exist - show word-level diff
          const wordDiff = Diff.diffWords(leftLine, rightLine);

          let leftContent = '';
          let rightContent = '';

          wordDiff.forEach((wordPart) => {
            const escaped = escapeHtml(wordPart.value);
            if (wordPart.removed) {
              leftContent += `<span class="word-removed">${escaped}</span>`;
            } else if (wordPart.added) {
              rightContent += `<span class="word-added">${escaped}</span>`;
            } else {
              leftContent += escaped;
              rightContent += escaped;
            }
          });

          leftHtml += `<div class="diff-line diff-modified" data-diff-index="${diffIndex}">
            <span class="line-number">${leftLineNum}</span>
            <span class="line-content">${leftContent || ' '}</span>
          </div>`;
          rightHtml += `<div class="diff-line diff-modified" data-diff-index="${diffIndex}">
            <span class="line-number">${rightLineNum}</span>
            <span class="line-content">${rightContent || ' '}</span>
          </div>`;
          leftLineNum++;
          rightLineNum++;
        } else if (leftLine) {
          // Only left line exists
          const escaped = escapeHtml(leftLine);
          leftHtml += `<div class="diff-line diff-removed" data-diff-index="${diffIndex}">
            <span class="line-number">${leftLineNum}</span>
            <span class="line-content">${escaped || ' '}</span>
          </div>`;
          rightHtml += `<div class="diff-line diff-spacer">
            <span class="line-number"></span>
            <span class="line-content"> </span>
          </div>`;
          leftLineNum++;
        } else if (rightLine) {
          // Only right line exists
          const escaped = escapeHtml(rightLine);
          leftHtml += `<div class="diff-line diff-spacer">
            <span class="line-number"></span>
            <span class="line-content"> </span>
          </div>`;
          rightHtml += `<div class="diff-line diff-added" data-diff-index="${diffIndex}">
            <span class="line-number">${rightLineNum}</span>
            <span class="line-content">${escaped || ' '}</span>
          </div>`;
          rightLineNum++;
        }
      }
    } else if (diff.type === 'added') {
      diffIndex++;
      diff.rightLines.forEach((line) => {
        const escaped = escapeHtml(line);
        leftHtml += `<div class="diff-line diff-spacer">
          <span class="line-number"></span>
          <span class="line-content"> </span>
        </div>`;
        rightHtml += `<div class="diff-line diff-added" data-diff-index="${diffIndex}">
          <span class="line-number">${rightLineNum}</span>
          <span class="line-content">${escaped || ' '}</span>
        </div>`;
        rightLineNum++;
      });
    } else if (diff.type === 'removed') {
      diffIndex++;
      diff.leftLines.forEach((line) => {
        const escaped = escapeHtml(line);
        leftHtml += `<div class="diff-line diff-removed" data-diff-index="${diffIndex}">
          <span class="line-number">${leftLineNum}</span>
          <span class="line-content">${escaped || ' '}</span>
        </div>`;
        rightHtml += `<div class="diff-line diff-spacer">
          <span class="line-number"></span>
          <span class="line-content"> </span>
        </div>`;
        leftLineNum++;
      });
    } else {
      // Unchanged
      diff.leftLines.forEach((line) => {
        const escaped = escapeHtml(line);
        leftHtml += `<div class="diff-line diff-unchanged">
          <span class="line-number">${leftLineNum}</span>
          <span class="line-content">${escaped || ' '}</span>
        </div>`;
        rightHtml += `<div class="diff-line diff-unchanged">
          <span class="line-number">${rightLineNum}</span>
          <span class="line-content">${escaped || ' '}</span>
        </div>`;
        leftLineNum++;
        rightLineNum++;
      });
    }
  });

  resultsLeftElement.innerHTML = leftHtml;
  resultsRightElement.innerHTML = rightHtml;
  resultsContainer.style.display = "flex";

  // Save to history if enabled and not loading from history
  if (!isLoadingFromHistory) {
    addToHistory(left, right);
  }

  // Scroll to first diff
  if (totalDiffs > 0) {
    scrollToDiff(1);
  }
}

function navigateDiff(direction: number) {
  if (totalDiffs === 0) return;

  currentDiffIndex += direction;

  // Wrap around
  if (currentDiffIndex > totalDiffs) {
    currentDiffIndex = 1;
  } else if (currentDiffIndex < 1) {
    currentDiffIndex = totalDiffs;
  }

  updateDiffCounter();
  scrollToDiff(currentDiffIndex);
}

function scrollToDiff(index: number) {
  // Remove previous highlight from both panels
  resultsLeftElement.querySelectorAll('.diff-highlight').forEach(el => {
    el.classList.remove('diff-highlight');
  });
  resultsRightElement.querySelectorAll('.diff-highlight').forEach(el => {
    el.classList.remove('diff-highlight');
  });

  // Add highlight to current diff in both panels
  const leftDiff = resultsLeftElement.querySelector(`[data-diff-index="${index}"]`);
  const rightDiff = resultsRightElement.querySelector(`[data-diff-index="${index}"]`);

  if (leftDiff) {
    leftDiff.classList.add('diff-highlight');
    leftDiff.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (rightDiff) {
    rightDiff.classList.add('diff-highlight');
    rightDiff.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function updateDiffCounter() {
  diffCounter.textContent = totalDiffs > 0 ? `${currentDiffIndex} of ${totalDiffs}` : '0 of 0';
}

function clearAll() {
  textLeft.value = '';
  textRight.value = '';
  resultsLeftElement.innerHTML = '';
  resultsRightElement.innerHTML = '';
  resultsContainer.style.display = "none";
  updateCharCount();
  totalDiffs = 0;
  currentDiffIndex = 0;
  updateDiffCounter();
}

function switchTexts() {
  const temp = textLeft.value;
  textLeft.value = textRight.value;
  textRight.value = temp;
  updateCharCount();

  // Re-compare if there are results visible
  if (resultsContainer.style.display !== "none") {
    compareTexts();
  }
}

function applyToLowercase() {
  textLeft.value = textLeft.value.toLowerCase();
  textRight.value = textRight.value.toLowerCase();
  updateCharCount();
}

function applySortLines() {
  textLeft.value = sortLines(textLeft.value);
  textRight.value = sortLines(textRight.value);
  updateCharCount();
}

function sortLines(text: string): string {
  return text.split('\n').sort().join('\n');
}

function applyRemoveWhitespace() {
  textLeft.value = removeExcessWhitespace(textLeft.value);
  textRight.value = removeExcessWhitespace(textRight.value);
  updateCharCount();
}

function removeExcessWhitespace(text: string): string {
  // Replace tabs with spaces
  text = text.replace(/\t/g, ' ');
  // Replace multiple spaces with single space
  text = text.replace(/ +/g, ' ');
  // Remove spaces at start/end of lines
  text = text.split('\n').map(line => line.trim()).join('\n');
  // Remove multiple consecutive newlines
  text = text.replace(/\n\n+/g, '\n\n');
  return text.trim();
}

function applyReplaceLinebreaks() {
  textLeft.value = textLeft.value.replace(/\n/g, ' ');
  textRight.value = textRight.value.replace(/\n/g, ' ');
  updateCharCount();
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    // Could add a toast notification here later
    console.log('Copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

function setupDragAndDrop(textarea: HTMLTextAreaElement, panel: HTMLElement) {
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    panel.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop area when item is dragged over it
  ['dragenter', 'dragover'].forEach(eventName => {
    panel.addEventListener(eventName, () => {
      panel.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    panel.addEventListener(eventName, () => {
      panel.classList.remove('drag-over');
    }, false);
  });

  // Handle dropped files
  panel.addEventListener('drop', async (e: DragEvent) => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      const text = await file.text();
      textarea.value = text;
      updateCharCount();
    }
  }, false);
}

function preventDefaults(e: Event) {
  e.preventDefault();
  e.stopPropagation();
}

// Settings and History Management
interface Settings {
  historyEnabled: boolean;
  retentionDays: number;
}

interface HistoryItem {
  id: string;
  timestamp: number;
  leftText: string;
  rightText: string;
}

let settings: Settings = {
  historyEnabled: false,
  retentionDays: 30
};

let diffHistory: HistoryItem[] = [];

// Load settings from localStorage
function loadSettings() {
  const savedSettings = localStorage.getItem('diffy-settings');
  if (savedSettings) {
    settings = JSON.parse(savedSettings);
  }
  applySettings();
}

// Save settings to localStorage
function saveSettings() {
  localStorage.setItem('diffy-settings', JSON.stringify(settings));
  applySettings();
}

// Apply settings to UI
function applySettings() {
  const enableHistoryCheckbox = document.querySelector('#enable-history') as HTMLInputElement;
  const retentionPolicySelect = document.querySelector('#retention-policy') as HTMLSelectElement;
  const retentionSetting = document.querySelector('#retention-setting') as HTMLElement;
  const historyToggleBtn = document.querySelector('#toggle-history') as HTMLElement;

  if (enableHistoryCheckbox) {
    enableHistoryCheckbox.checked = settings.historyEnabled;
  }
  if (retentionPolicySelect) {
    retentionPolicySelect.value = settings.retentionDays.toString();
  }
  if (retentionSetting) {
    retentionSetting.style.display = settings.historyEnabled ? 'flex' : 'none';
  }
  if (historyToggleBtn) {
    historyToggleBtn.style.display = settings.historyEnabled ? 'flex' : 'none';
  }
}

// Load history from localStorage
function loadHistory() {
  const savedHistory = localStorage.getItem('diffy-history');
  if (savedHistory) {
    diffHistory = JSON.parse(savedHistory);
    applyRetentionPolicy();
  }
  renderHistory();
}

// Save history to localStorage
function saveHistory() {
  localStorage.setItem('diffy-history', JSON.stringify(diffHistory));
}

// Apply retention policy
function applyRetentionPolicy() {
  if (settings.retentionDays === 0) return; // Forever

  const now = Date.now();
  const maxAge = settings.retentionDays * 24 * 60 * 60 * 1000;

  diffHistory = diffHistory.filter(item => {
    return (now - item.timestamp) < maxAge;
  });

  saveHistory();
}

// Add item to history
function addToHistory(leftText: string, rightText: string) {
  if (!settings.historyEnabled) return;

  const historyItem: HistoryItem = {
    id: Date.now().toString(),
    timestamp: Date.now(),
    leftText,
    rightText
  };

  diffHistory.unshift(historyItem);
  saveHistory();
  renderHistory();
}

// Delete history item
function deleteHistoryItem(id: string) {
  diffHistory = diffHistory.filter(item => item.id !== id);
  saveHistory();
  renderHistory();
}

// Render history list
function renderHistory() {
  const historyList = document.querySelector('#history-list') as HTMLElement;

  if (diffHistory.length === 0) {
    historyList.innerHTML = '<p class="empty-state">No history yet. Run a comparison to save it to history.</p>';
    return;
  }

  const html = diffHistory.map(item => {
    const date = new Date(item.timestamp);
    const dateStr = date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const preview = item.leftText.substring(0, 50).replace(/\n/g, ' ');

    return `
      <div class="history-item" data-id="${item.id}">
        <div class="history-item-header">
          <span class="history-item-date">${dateStr}</span>
          <button class="history-item-delete" data-id="${item.id}">×</button>
        </div>
        <div class="history-item-preview">${escapeHtml(preview)}...</div>
      </div>
    `;
  }).join('');

  historyList.innerHTML = html;

  // Add click handlers
  historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('history-item-delete')) {
        e.stopPropagation();
        const id = target.getAttribute('data-id')!;
        deleteHistoryItem(id);
      } else {
        const id = (item as HTMLElement).getAttribute('data-id')!;
        loadHistoryItem(id);
      }
    });
  });
}

// Load history item into text areas
function loadHistoryItem(id: string) {
  const item = diffHistory.find(h => h.id === id);
  if (!item) return;

  isLoadingFromHistory = true;

  textLeft.value = item.leftText;
  textRight.value = item.rightText;
  updateCharCount();
  compareTexts();

  isLoadingFromHistory = false;

  // Close sidebar
  const sidebar = document.querySelector('#history-sidebar') as HTMLElement;
  sidebar.classList.remove('open');
}

// Start a new diff (clear everything)
function newDiff() {
  clearAll();
}

// Check if this is the first launch
function checkFirstLaunch() {
  const hideShortcuts = localStorage.getItem('diffy-hide-shortcuts');

  if (!hideShortcuts) {
    // First launch - show shortcuts modal
    const shortcutsModal = document.querySelector('#shortcuts-modal') as HTMLElement;
    if (shortcutsModal) {
      shortcutsModal.style.display = 'flex';
    }
  }
}

