const filelistDiv = document.getElementById('filelist');
const errorDiv = document.getElementById('error');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
const searchInput = document.getElementById('searchInput');
const breadcrumbDiv = document.getElementById('breadcrumb');
const viewToggleBtn = document.getElementById('viewToggle');
const contextMenu = document.getElementById('contextMenu');

// Drop zone elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');
const stagedQueue = document.getElementById('stagedQueue');
const stagedList = document.getElementById('stagedList');
const stagedCount = document.getElementById('stagedCount');

let allItems = [];
let currentPath = '';
let currentSortBy = 'name';
let currentSortOrder = 'asc';
let viewMode = 'grid';
let contextItemPath = '';

// Staged files for upload
let stagedFiles = [];

// File icons based on extension
const fileIcons = {
    'pdf': '📄', 'doc': '📄', 'docx': '📄', 'txt': '📝', 'md': '📝',
    'xls': '📊', 'xlsx': '📊', 'csv': '📊',
    'ppt': '🎯', 'pptx': '🎯',
    'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️', 'svg': '🖼️',
    'mp4': '🎬', 'avi': '🎬', 'mov': '🎬', 'mkv': '🎬', 'flv': '🎬',
    'mp3': '🎵', 'wav': '🎵', 'flac': '🎵', 'aac': '🎵',
    'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦',
    'exe': '⚙️', 'msi': '⚙️', 'dmg': '⚙️',
    'html': '🌐', 'css': '🌐', 'js': '⚡', 'json': '⚡'
};

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return fileIcons[ext] || '📄';
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

// Drag & drop
['dragenter', 'dragover'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drop-zone--active');
    });
});

['dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drop-zone--active');
    });
});

dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt.items) {
        // Use DataTransferItemList to handle folders
        const entries = [];
        for (let i = 0; i < dt.items.length; i++) {
            const entry = dt.items[i].webkitGetAsEntry ? dt.items[i].webkitGetAsEntry() : null;
            if (entry) entries.push(entry);
        }
        if (entries.length > 0) {
            processEntries(entries);
            return;
        }
    }
    // Fallback: just use files
    addFilesToQueue(Array.from(dt.files));
});

// Recursively read directory entries from drag-drop
async function processEntries(entries) {
    const files = [];

    async function readEntry(entry, path) {
        if (entry.isFile) {
            const file = await new Promise((resolve) => entry.file(resolve));
            // Attach the relative path for folder structure
            Object.defineProperty(file, 'relativePath', { value: path + file.name });
            files.push(file);
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            const subEntries = await new Promise((resolve) => reader.readEntries(resolve));
            for (const sub of subEntries) {
                await readEntry(sub, path + entry.name + '/');
            }
        }
    }

    for (const entry of entries) {
        await readEntry(entry, '');
    }
    addFilesToQueue(files);
}

// Click browse buttons
fileInput.addEventListener('change', () => {
    addFilesToQueue(Array.from(fileInput.files));
    fileInput.value = '';
});

folderInput.addEventListener('change', () => {
    const files = Array.from(folderInput.files).map(f => {
        Object.defineProperty(f, 'relativePath', { value: f.webkitRelativePath });
        return f;
    });
    addFilesToQueue(files);
    folderInput.value = '';
});

// Manage staged queue
function addFilesToQueue(files) {
    for (const f of files) {
        stagedFiles.push(f);
    }
    renderStagedQueue();
}

function removeFromQueue(index) {
    stagedFiles.splice(index, 1);
    renderStagedQueue();
}

function clearQueue() {
    stagedFiles = [];
    renderStagedQueue();
}

function renderStagedQueue() {
    if (stagedFiles.length === 0) {
        stagedQueue.style.display = 'none';
        return;
    }
    stagedQueue.style.display = 'block';
    stagedCount.textContent = `${stagedFiles.length} file${stagedFiles.length !== 1 ? 's' : ''} ready to upload`;

    let html = '';
    stagedFiles.forEach((f, i) => {
        const displayName = f.relativePath || f.name;
        const icon = getFileIcon(displayName);
        const size = formatSize(f.size);
        html += `
            <li class="staged-item">
                <span class="staged-item-icon">${icon}</span>
                <span class="staged-item-name" title="${displayName}">${displayName}</span>
                <span class="staged-item-size">${size}</span>
                <button class="staged-item-remove" onclick="removeFromQueue(${i})" title="Remove">✕</button>
            </li>
        `;
    });
    stagedList.innerHTML = html;
}

function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return size.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

async function uploadStaged() {
    if (stagedFiles.length === 0) return;

    const formData = new FormData();
    for (const file of stagedFiles) {
        const name = file.relativePath || file.name;
        formData.append('files', file, name);
    }

    const uploadUrl = currentPath
        ? `/upload?uploadPath=${encodeURIComponent(currentPath)}`
        : '/upload';

    try {
        const uploadBtn = document.getElementById('uploadBtn');
        uploadBtn.disabled = true;
        uploadBtn.textContent = '⏳ Uploading…';

        const response = await apiFetch(uploadUrl, { method: 'POST', body: formData });
        if (!response) return;
        if (!response.ok) throw new Error('Upload failed');

        stagedFiles = [];
        renderStagedQueue();
        loadFiles();
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
    } finally {
        const uploadBtn = document.getElementById('uploadBtn');
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.textContent = '⬆ Upload';
        }
    }
}

// ─── View toggle ──────────────────────────────────────────────────────────────

viewToggleBtn.addEventListener('click', () => {
    viewMode = viewMode === 'grid' ? 'list' : 'grid';
    updateViewToggleButton();
    renderFileList();
});

function updateViewToggleButton() {
    if (viewMode === 'grid') {
        viewToggleBtn.textContent = '☰ List';
        viewToggleBtn.title = 'Switch to List View';
    } else {
        viewToggleBtn.textContent = '⊞ Grid';
        viewToggleBtn.title = 'Switch to Grid View';
    }
}

// ─── Sorting & Filtering ──────────────────────────────────────────────────────

function sortFiles(items, sortBy, sortOrder) {
    const sorted = [...items];

    sorted.sort((a, b) => {
        let aVal, bVal;

        switch (sortBy) {
            case 'name':
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
                break;
            case 'size':
                aVal = a.size;
                bVal = b.size;
                break;
            case 'type':
                aVal = a.type.toLowerCase();
                bVal = b.type.toLowerCase();
                break;
            case 'date':
                aVal = new Date(a.modified);
                bVal = new Date(b.modified);
                break;
            default:
                aVal = a.name;
                bVal = b.name;
        }

        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    return sorted;
}

function changeSortBy(sortBy) {
    if (currentSortBy === sortBy) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortBy = sortBy;
        currentSortOrder = 'asc';
    }
    renderFileList();
}

function filterItems(items, searchTerm) {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(term));
}

// ─── Auth-aware fetch wrapper ─────────────────────────────────────────────────

async function apiFetch(url, options = {}) {
    const res = await fetch(url, options);
    if (res.status === 401) {
        window.location.href = '/login';
        return null;
    }
    return res;
}

// ─── Load files ───────────────────────────────────────────────────────────────

async function loadFiles() {
    try {
        const url = currentPath ? `/api/files?path=${encodeURIComponent(currentPath)}` : '/api/files';
        const response = await apiFetch(url);
        if (!response) return;
        if (!response.ok) throw new Error('Failed to load files');

        allItems = await response.json();
        renderBreadcrumb();
        renderFileList();
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
        filelistDiv.innerHTML = '';
    }
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

function renderBreadcrumb() {
    let html = '<div class="breadcrumb">';

    html += '<button class="breadcrumb-item" onclick="navigateToPath(\'\')">Home</button>';

    if (currentPath) {
        const parts = currentPath.split('/');
        let cumulativePath = '';

        for (let i = 0; i < parts.length; i++) {
            cumulativePath += (cumulativePath ? '/' : '') + parts[i];
            html += ` <span class="breadcrumb-sep">/</span> <button class="breadcrumb-item" onclick="navigateToPath('${cumulativePath}')">${parts[i]}</button>`;
        }
    }

    html += '</div>';
    breadcrumbDiv.innerHTML = html;
}

function navigateToPath(newPath) {
    currentPath = newPath;
    searchInput.value = '';
    loadFiles();
}

function goBack() {
    const parts = currentPath.split('/');
    parts.pop();
    currentPath = parts.join('/');
    navigateToPath(currentPath);
}

// ─── Render file list ─────────────────────────────────────────────────────────

function renderFileList() {
    const searchTerm = searchInput.value;
    let items = filterItems(allItems, searchTerm);
    items = sortFiles(items, currentSortBy, currentSortOrder);

    updateViewToggleButton();

    if (items.length === 0) {
        filelistDiv.innerHTML = '<div class="empty-state">No files</div>';
        updateActionButtons();
        addEmptyClickHandler();
        return;
    }

    if (viewMode === 'grid') {
        renderGridView(items);
    } else {
        renderListView(items);
    }

    addEmptyClickHandler();
    addDragSelection();
}

function renderGridView(items) {
    let html = '<div class="view-toolbar">';
    html += '<div class="sort-options">';
    html += '<label>Sort by:</label>';
    html += `<button class="sort-option ${currentSortBy === 'name' ? 'active' : ''}" onclick="changeSortBy('name')">Name ${currentSortBy === 'name' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}</button>`;
    html += `<button class="sort-option ${currentSortBy === 'date' ? 'active' : ''}" onclick="changeSortBy('date')">Date ${currentSortBy === 'date' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}</button>`;
    html += `<button class="sort-option ${currentSortBy === 'size' ? 'active' : ''}" onclick="changeSortBy('size')">Size ${currentSortBy === 'size' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}</button>`;
    html += '</div>';
    html += '<button class="view-toggle-toolbar" id="viewToggleToolbar" onclick="viewToggleBtn.click()" title="Toggle view">☰ List</button>';
    html += '</div>';
    html += '<div class="grid-container">';

    items.forEach((item) => {
        const icon = item.isFolder ? '📁' : getFileIcon(item.name);
        const path = item.path || item.name;

        html += `
            <div class="grid-item" data-path="${path}" data-is-folder="${item.isFolder}" onclick="handleGridItemBoxClick(event, '${path}', ${item.isFolder})">
                <div class="grid-item-checkbox">
                    <input type="checkbox" name="selectedFiles" value="${path}" onchange="updateActionButtons()" onclick="event.stopPropagation();">
                </div>
                <div class="grid-item-icon">
                    ${icon}
                </div>
                <div class="grid-item-name">
                    ${item.name}
                </div>
            </div>
        `;
    });

    html += '</div>';
    filelistDiv.innerHTML = html;
    updateActionButtons();
}

function renderListView(items) {
    let html = '<div class="view-toolbar">';
    html += '<div class="sort-options">';
    html += '<label>Sort by:</label>';
    html += `<button class="sort-option ${currentSortBy === 'name' ? 'active' : ''}" onclick="changeSortBy('name')">Name ${currentSortBy === 'name' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}</button>`;
    html += `<button class="sort-option ${currentSortBy === 'date' ? 'active' : ''}" onclick="changeSortBy('date')">Date ${currentSortBy === 'date' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}</button>`;
    html += `<button class="sort-option ${currentSortBy === 'size' ? 'active' : ''}" onclick="changeSortBy('size')">Size ${currentSortBy === 'size' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}</button>`;
    html += '</div>';
    html += '<button class="view-toggle-toolbar" id="viewToggleToolbar" onclick="viewToggleBtn.click()" title="Toggle view">⊞ Grid</button>';
    html += '</div>';

    html += `
        <table class="file-table">
            <thead>
                <tr>
                    <th style="width: 30px;"></th>
                    <th onclick="changeSortBy('name')" class="sortable ${currentSortBy === 'name' ? 'active' : ''}">
                        Name ${currentSortBy === 'name' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th onclick="changeSortBy('type')" class="sortable ${currentSortBy === 'type' ? 'active' : ''}">
                        Type ${currentSortBy === 'type' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th onclick="changeSortBy('size')" class="sortable ${currentSortBy === 'size' ? 'active' : ''}">
                        Size ${currentSortBy === 'size' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th onclick="changeSortBy('date')" class="sortable ${currentSortBy === 'date' ? 'active' : ''}">
                        Modified ${currentSortBy === 'date' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                </tr>
            </thead>
            <tbody>
    `;

    items.forEach((item) => {
        const icon = item.isFolder ? '📁' : getFileIcon(item.name);
        const path = item.path || item.name;

        html += `
            <tr class="file-row" data-path="${path}" data-is-folder="${item.isFolder}" onclick="handleListRowClick(event, '${path}', ${item.isFolder})" oncontextmenu="showContextMenu(event, '${path}')">
                <td onclick="event.stopPropagation();"><input type="checkbox" name="selectedFiles" value="${path}" onchange="updateActionButtons()" onclick="event.stopPropagation();"></td>
                <td class="name-cell">
                    <span class="file-icon">${icon}</span>
                    <span class="file-name">${item.name}</span>
                </td>
                <td>${item.type}</td>
                <td>${item.sizeFormatted}</td>
                <td>${item.modifiedFormatted}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    filelistDiv.innerHTML = html;
    updateActionButtons();
}

// ─── Click handlers ───────────────────────────────────────────────────────────

function handleGridItemBoxClick(event, path, isFolder) {
    if (event.target.closest('input[class="grid-item"]')) return;

    if (event.target.closest('.grid-item-name')) {
        if (isFolder) {
            navigateToPath(path);
            return;
        }
    }

    const checkbox = event.currentTarget.querySelector('input[type="checkbox"]');
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        updateActionButtons();
    }
}

function handleListRowClick(event, path, isFolder) {
    if (event.target.closest('input[type="checkbox"]')) return;

    if (event.target.closest('.file-name')) {
        if (isFolder) {
            navigateToPath(path);
            return;
        }
    }

    const checkbox = event.currentTarget.querySelector('input[type="checkbox"]');
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        updateActionButtons();
    }
}

// ─── Drag selection ───────────────────────────────────────────────────────────

function addDragSelection() {
    const filesView = document.querySelector('.files-view');
    const container = filelistDiv;

    if (!filesView || !container || filesView.dataset.dragHandlerAdded) return;

    let startX = 0, startY = 0;
    let isSelectingNow = false;
    const MIN_DRAG_DISTANCE = 5;

    const selectionBox = document.querySelector('.selection-box') || (() => {
        const box = document.createElement('div');
        box.className = 'selection-box';
        document.body.appendChild(box);
        return box;
    })();

    container.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('input[type="checkbox"], .view-toolbar, th')) return;

        isSelectingNow = true;
        startX = e.clientX;
        startY = e.clientY;
    }, false);

    document.addEventListener('mousemove', (e) => {
        if (!isSelectingNow) return;

        const currentX = e.clientX;
        const currentY = e.clientY;

        const dragDistance = Math.sqrt(
            Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2)
        );

        if (dragDistance < MIN_DRAG_DISTANCE) return;

        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        selectionBox.style.left = x + 'px';
        selectionBox.style.top = y + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
        selectionBox.style.display = 'block';

        const selectionBounds = {
            left: x,
            right: x + width,
            top: y,
            bottom: y + height
        };

        const items = container.querySelectorAll('[data-path]');
        items.forEach(item => {
            const itemRect = item.getBoundingClientRect();

            const isIntersecting = !(
                itemRect.right < selectionBounds.left ||
                itemRect.left > selectionBounds.right ||
                itemRect.bottom < selectionBounds.top ||
                itemRect.top > selectionBounds.bottom
            );

            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.checked = isIntersecting;
            }
        });

        updateActionButtons();
    }, false);

    document.addEventListener('mouseup', () => {
        if (isSelectingNow) {
            isSelectingNow = false;
            selectionBox.style.display = 'none';
        }
    }, false);

    filesView.dataset.dragHandlerAdded = 'true';
}

// ─── Deselect on empty click ──────────────────────────────────────────────────

function addEmptyClickHandler() {
    const filesView = document.querySelector('.files-view');
    if (!filesView || filesView.dataset.clickHandlerAdded) return;

    filesView.addEventListener('click', (e) => {
        if (e.target.closest('.grid-item') ||
            e.target.closest('.file-row') ||
            e.target.closest('input[type="checkbox"]') ||
            e.target.closest('.view-toolbar') ||
            e.target.closest('th')) {
            return;
        }

        const filelistDiv = document.getElementById('filelist');
        if (filelistDiv) {
            const checkboxes = filelistDiv.querySelectorAll('input[name="selectedFiles"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            updateActionButtons();
        }
    }, false);

    filesView.dataset.clickHandlerAdded = 'true';
}

// ─── Context menu ─────────────────────────────────────────────────────────────

function showContextMenu(event, path) {
    event.preventDefault();

    const item = allItems.find(i => (i.path || i.name) === path);
    if (!item) return;

    contextItemPath = path;

    const ctxDownload = document.getElementById('ctxDownload');
    ctxDownload.style.display = 'block';

    contextMenu.style.left = event.clientX + 'px';
    contextMenu.style.top = event.clientY + 'px';
    contextMenu.style.display = 'block';
}

document.addEventListener('click', () => {
    contextMenu.style.display = 'none';
});

document.getElementById('ctxDownload').addEventListener('click', () => {
    downloadSingle(contextItemPath);
    contextMenu.style.display = 'none';
});

document.getElementById('ctxDelete').addEventListener('click', () => {
    deleteSingle(contextItemPath);
    contextMenu.style.display = 'none';
});

// ─── Action functions ─────────────────────────────────────────────────────────

function updateActionButtons() {
    const checkboxes = document.querySelectorAll('input[name="selectedFiles"]:checked');

    if (checkboxes.length > 0) {
        deleteSelectedBtn.style.display = 'block';
        downloadSelectedBtn.style.display = 'block';
        deleteSelectedBtn.textContent = `Delete (${checkboxes.length})`;
        downloadSelectedBtn.textContent = `Download (${checkboxes.length})`;
    } else {
        deleteSelectedBtn.style.display = 'none';
        downloadSelectedBtn.style.display = 'none';
    }
}

async function deleteSelected() {
    const checkboxes = document.querySelectorAll('input[name="selectedFiles"]:checked');
    const items = Array.from(checkboxes).map(cb => cb.value);

    if (items.length === 0) return;

    const confirmMsg = items.length === 1
        ? `Delete "${items[0]}"?`
        : `Delete ${items.length} items?`;

    if (!confirm(confirmMsg)) return;

    try {
        const response = await apiFetch('/delete-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });
        if (!response) return;
        if (!response.ok) throw new Error('Delete failed');
        loadFiles();
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
    }
}

async function downloadSingle(filename) {
    try {
        const actualFilename = filename.includes('/') ? filename.split('/').pop() : filename;
        const response = await apiFetch(`/uploads/${encodeURIComponent(filename)}`);
        if (!response) return;
        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = actualFilename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
    }
}

async function deleteSingle(filename) {
    if (!confirm(`Delete "${filename}"?`)) return;

    try {
        const response = await apiFetch(`/uploads/delete/${encodeURIComponent(filename)}`);
        if (!response) return;
        if (!response.ok) throw new Error('Delete failed');
        loadFiles();
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
    }
}

async function downloadSelected() {
    const checkboxes = document.querySelectorAll('input[name="selectedFiles"]:checked');
    const items = Array.from(checkboxes).map(cb => cb.value);

    if (items.length === 0) return;

    if (items.length === 1) {
        downloadSingle(items[0]);
        return;
    }

    try {
        const response = await apiFetch('/download-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });
        if (!response) return;
        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'downloads.zip';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
    }
}

// ─── Search ───────────────────────────────────────────────────────────────────

searchInput.addEventListener('input', () => {
    renderFileList();
});

// ─── Initialize ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    updateViewToggleButton();
    loadFiles();
});