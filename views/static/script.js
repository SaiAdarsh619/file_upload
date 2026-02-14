const filelistDiv = document.getElementById('filelist');
const uploadForm = document.getElementById('uploadForm');
const errorDiv = document.getElementById('error');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
const searchInput = document.getElementById('searchInput');
const breadcrumbDiv = document.getElementById('breadcrumb');
const viewToggleBtn = document.getElementById('viewToggle');
const contextMenu = document.getElementById('contextMenu');

let allItems = [];
let currentPath = '';
let currentSortBy = 'name';
let currentSortOrder = 'asc';
let viewMode = 'grid';
let contextItemPath = '';

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

// View toggle
viewToggleBtn.addEventListener('click', () => {
    viewMode = viewMode === 'grid' ? 'list' : 'grid';
    updateViewToggleButton();
    renderFileList();
});

// Update view toggle button text/icon
function updateViewToggleButton() {
    if (viewMode === 'grid') {
        viewToggleBtn.textContent = '☰ List';
        viewToggleBtn.title = 'Switch to List View';
    } else {
        viewToggleBtn.textContent = '⊞ Grid';
        viewToggleBtn.title = 'Switch to Grid View';
    }
}

// Upload form
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('file');
    const folderInput = document.getElementById('folder');

    if (!fileInput.files.length && !folderInput.files.length) {
        errorDiv.textContent = 'Please select files or a folder to upload';
        errorDiv.style.display = 'block';
        return;
    }

    const formData = new FormData();
    for (const file of fileInput.files) {
        formData.append('files', file);
    }
    for (const file of folderInput.files) {
        formData.append('files', file, file.webkitRelativePath);
    }

    try {
        const uploadUrl = currentPath 
            ? `/upload?uploadPath=${encodeURIComponent(currentPath)}` 
            : '/upload';
        
        const response = await fetch(uploadUrl, { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Upload failed');

        fileInput.value = '';
        folderInput.value = '';
        errorDiv.style.display = 'none';
        loadFiles();
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
    }
});

// Sorting
function sortFiles(items, sortBy, sortOrder) {
    const sorted = [...items];
    
    sorted.sort((a, b) => {
        let aVal, bVal;
        
        switch(sortBy) {
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

// Filter
function filterItems(items, searchTerm) {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(term));
}

// Load files
async function loadFiles() {
    try {
        const url = currentPath ? `/files?path=${encodeURIComponent(currentPath)}` : '/files';
        const response = await fetch(url);
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

// Breadcrumb
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

// Render file list
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
    
    // Add handlers (only once - they check for existing handlers)
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

// Click handlers
function handleGridItemBoxClick(event, path, isFolder) {
    // If clicking on checkbox, let it handle normally
    if (event.target.closest('input[class="grid-item"]')) return;
    
    // If clicking on the name/icon and it's a folder, open it
    if (event.target.closest('.grid-item-icon') || event.target.closest('.grid-item-name')) {
        if (isFolder) {
            navigateToPath(path);
            return;
        }
    }
    
    // Otherwise, select the item
    const checkbox = event.currentTarget.querySelector('input[type="checkbox"]');
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        updateActionButtons();
    }
}

function handleListRowClick(event, path, isFolder) {
    // If clicking on checkbox, let it handle normally
    if (event.target.closest('input[type="checkbox"]')) return;
    
    // If clicking on the name cell and it's a folder, open it
    if (event.target.closest('.name-cell')) {
        if (isFolder) {
            navigateToPath(path);
            return;
        }
    }
    
    // Otherwise, select the item
    const checkbox = event.currentTarget.querySelector('input[type="checkbox"]');
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        updateActionButtons();
    }
}

// Drag selection - rewritten to handle scrollable containers
function addDragSelection() {
    const filesView = document.querySelector('.files-view');
    const container = filelistDiv;
    
    if (!filesView || !container || filesView.dataset.dragHandlerAdded) return;
    
    let startX = 0, startY = 0;
    let isSelectingNow = false;
    const MIN_DRAG_DISTANCE = 5; // Minimum pixels to drag before starting selection
    
    const selectionBox = document.querySelector('.selection-box') || (() => {
        const box = document.createElement('div');
        box.className = 'selection-box';
        document.body.appendChild(box);
        return box;
    })();
    
    container.addEventListener('mousedown', (e) => {
        // Don't start selection on checkbox or toolbar
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
        
        // Only start showing selection box after minimum drag distance
        const dragDistance = Math.sqrt(
            Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2)
        );
        
        if (dragDistance < MIN_DRAG_DISTANCE) return;
        
        // Calculate selection box dimensions
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        
        // Update selection box display
        selectionBox.style.left = x + 'px';
        selectionBox.style.top = y + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
        selectionBox.style.display = 'block';
        
        // Selection box boundaries (in viewport coordinates)
        const selectionBounds = {
            left: x,
            right: x + width,
            top: y,
            bottom: y + height
        };
        
        // Check which items are in the selection area
        const items = container.querySelectorAll('[data-path]');
        items.forEach(item => {
            // Get item position in viewport coordinates
            const itemRect = item.getBoundingClientRect();
            
            // Check if item intersects with selection box
            // An item is selected if ANY part of it overlaps with the selection box
            const isIntersecting = !(
                itemRect.right < selectionBounds.left ||
                itemRect.left > selectionBounds.right ||
                itemRect.bottom < selectionBounds.top ||
                itemRect.top > selectionBounds.bottom
            );
            
            // Check the item's checkbox
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

// Deselect all items on empty area click
function addEmptyClickHandler() {
    const filesView = document.querySelector('.files-view');
    if (!filesView || filesView.dataset.clickHandlerAdded) return;
    
    filesView.addEventListener('click', (e) => {
        // Don't deselect if clicking on:
        // - A grid item or its children
        // - A table row or its cells
        // - A checkbox
        // - Sort options
        // - Table headers
        // - View toolbar
        if (e.target.closest('.grid-item') || 
            e.target.closest('.file-row') ||
            e.target.closest('input[type="checkbox"]') ||
            e.target.closest('.view-toolbar') ||
            e.target.closest('th')) {
            return;
        }
        
        // If we get here, it's an empty space click - deselect all
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

// Context menu
function showContextMenu(event, path) {
    event.preventDefault();
    
    const item = allItems.find(i => (i.path || i.name) === path);
    if (!item) return;

    contextItemPath = path;
    
    const ctxDownload = document.getElementById('ctxDownload');
    const ctxDelete = document.getElementById('ctxDelete');
    
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

// Action functions
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
        const response = await fetch('/delete-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });

        if (!response.ok) throw new Error('Delete failed');
        loadFiles();
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
    }
}

async function downloadSingle(filename) {
    try {
        const response = await fetch(`/uploads/${encodeURIComponent(filename)}`);
        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.split('/').pop();
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
        const response = await fetch(`/uploads/delete/${encodeURIComponent(filename)}`);
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

    try {
        const response = await fetch('/download-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });

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

// Search
searchInput.addEventListener('input', () => {
    renderFileList();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateViewToggleButton();
    loadFiles();
});