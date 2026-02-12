const filelistDiv = document.getElementById('filelist');
const uploadForm = document.getElementById('uploadForm');
const errorDiv = document.getElementById('error');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
const searchInput = document.getElementById('searchInput');
const breadcrumbDiv = document.getElementById('breadcrumb');

let allItems = [];
let currentPath = ''; // Track current folder path
let currentSortBy = 'name';
let currentSortOrder = 'asc';

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('file');
    const folderInput = document.getElementById('folder');
    const files = fileInput.files;
    const folderFiles = folderInput.files;

    if (!files && !folderFiles) return;

    const formData = new FormData();
    for (const file of files) {
        formData.append('files', file);
    }

    for(const file of folderFiles)
    {
        formData.append('files', file, file.webkitRelativePath);
    }

    try {
        // Build URL with uploadPath as query parameter
        const uploadUrl = currentPath 
            ? `/upload?uploadPath=${encodeURIComponent(currentPath)}` 
            : '/upload';
        
        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Upload failed');

        fileInput.value = '';
        folderInput.value = '';
        errorDiv.style.display = 'none';
        loadFiles();
    } catch (err) {
        errorDiv.textContent = 'Error uploading file: ' + err.message;
        errorDiv.style.display = 'block';
    }
});

// Sort files by selected attribute
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

// Handle sort button click
function changeSortBy(sortBy) {
    if (currentSortBy === sortBy) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortBy = sortBy;
        currentSortOrder = 'asc';
    }
    loadFiles();
}

// Search and filter files
function filterItems(items, searchTerm) {
    if (!searchTerm) return items;
    
    const term = searchTerm.toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(term));
}

// Fetch and display files
async function loadFiles() {
    try {
        const url = currentPath ? `/files?path=${encodeURIComponent(currentPath)}` : '/files';
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load files');

        allItems = await response.json();

        if (allItems.length === 0) {
            filelistDiv.innerHTML = '<div class="loading">No files in this folder</div>';
            filelistDiv.style.display = 'block';
            deleteSelectedBtn.style.display = 'none';
            downloadSelectedBtn.style.display = 'none';
            renderBreadcrumb();
            return;
        }

        renderBreadcrumb();
        renderFileList();
    } catch (err) {
        errorDiv.textContent = 'Error loading files: ' + err.message;
        errorDiv.style.display = 'block';
        filelistDiv.innerHTML = '';
    }
}

// Render breadcrumb navigation
function renderBreadcrumb() {
    let breadcrumbHTML = '<div class="breadcrumb">';
    
    // Back button
    if (currentPath) {
        breadcrumbHTML += '<button class="breadcrumb-back" onclick="goBack()" title="Go back">← Back</button>';
    }
    
    // Root
    breadcrumbHTML += '<button class="breadcrumb-item" onclick="navigateToPath(\'\')">📂 Root</button>';
    
    if (currentPath) {
        const parts = currentPath.split('/');
        let cumulativePath = '';
        
        for (let i = 0; i < parts.length; i++) {
            cumulativePath += (cumulativePath ? '/' : '') + parts[i];
            breadcrumbHTML += ` <span class="breadcrumb-sep">/</span> <button class="breadcrumb-item" onclick="navigateToPath('${cumulativePath}')">${parts[i]}</button>`;
        }
    }
    
    breadcrumbHTML += '</div>';
    breadcrumbDiv.innerHTML = breadcrumbHTML;
}

// Go back to previous folder
function goBack() {
    const parts = currentPath.split('/');
    parts.pop();
    currentPath = parts.join('/');
    searchInput.value = ''; // Clear search
    loadFiles();
}

// Navigate to a specific folder path
function navigateToPath(newPath) {
    currentPath = newPath;
    searchInput.value = ''; // Clear search
    loadFiles();
}

// Enter folder - called on single click for folders
function enterFolder(path) {
    navigateToPath(path);
}

// Render file list with current filters and sorting
function renderFileList() {
    const searchTerm = searchInput.value;
    let items = filterItems(allItems, searchTerm);
    items = sortFiles(items, currentSortBy, currentSortOrder);

    // Build table header with sort buttons
    let tableHTML = `
        <table class="filestable">
            <thead>
                <tr>
                    <th style="width: 30px;"></th>
                    <th><button class="sort-btn ${currentSortBy === 'name' ? 'active' : ''}" onclick="changeSortBy('name')">Name ${currentSortBy === 'name' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}</button></th>
                    <th><button class="sort-btn ${currentSortBy === 'type' ? 'active' : ''}" onclick="changeSortBy('type')">Type ${currentSortBy === 'type' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}</button></th>
                    <th><button class="sort-btn ${currentSortBy === 'size' ? 'active' : ''}" onclick="changeSortBy('size')">Size ${currentSortBy === 'size' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}</button></th>
                    <th><button class="sort-btn ${currentSortBy === 'date' ? 'active' : ''}" onclick="changeSortBy('date')">Modified ${currentSortBy === 'date' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}</button></th>
                </tr>
            </thead>
            <tbody>
    `;

    items.forEach((item) => {
        const isFolder = item.isFolder;
        const nameCell = isFolder 
            ? `<span class="filename" style="cursor: pointer; color: #0066cc; font-weight: 500;" onclick="enterFolder('${item.path}')">${item.name}</span>`
            : `<span class="filename">${item.name}</span>`;
        
        tableHTML += `
            <tr class="filerow ${isFolder ? 'folder-row' : ''}">
                <td><input type="checkbox" name="selectedFiles" value="${item.path || item.name}" onchange="updateActionButtons()"></td>
                <td class="filename-cell">
                    ${isFolder ? '📁' : '📄'}
                    ${nameCell}
                    <div class="action-icons">
                        ${!isFolder ? `<button class="icon-btn download-btn" onclick="downloadSingle('${item.path || item.name}')" title="Download">
                            ⬇️
                        </button>` : ''}
                        <button class="icon-btn delete-btn" onclick="deleteSingle('${item.path || item.name}')" title="Delete">
                            🗑️
                        </button>
                    </div>
                </td>
                <td>${item.type}</td>
                <td>${item.sizeFormatted}</td>
                <td>${item.modifiedFormatted}</td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    filelistDiv.innerHTML = tableHTML;
    filelistDiv.style.display = 'block';
    updateActionButtons();
}

// Update action buttons visibility and text
function updateActionButtons() {
    const checkboxes = document.querySelectorAll('input[name="selectedFiles"]:checked');
    
    if (checkboxes.length > 0) {
        deleteSelectedBtn.style.display = 'block';
        downloadSelectedBtn.style.display = 'block';
        deleteSelectedBtn.textContent = `Delete Selected (${checkboxes.length})`;
        downloadSelectedBtn.textContent = `Download Selected (${checkboxes.length})`;
    } else {
        deleteSelectedBtn.style.display = 'none';
        downloadSelectedBtn.style.display = 'none';
    }
}

// Delete selected files/folders
async function deleteSelected() {
    const checkboxes = document.querySelectorAll('input[name="selectedFiles"]:checked');
    const items = Array.from(checkboxes).map(cb => cb.value);

    if (items.length === 0) {
        alert('Please select files or folders to delete');
        return;
    }

    const confirmMsg = items.length === 1 
        ? `Delete "${items[0]}"?` 
        : `Delete ${items.length} items?`;

    if (!confirm(confirmMsg)) return;

    try {
        const response = await fetch('/delete-batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ items })
        });

        if (!response.ok) throw new Error('Delete failed');

        errorDiv.style.display = 'none';
        loadFiles();
    } catch (err) {
        errorDiv.textContent = 'Error deleting items: ' + err.message;
        errorDiv.style.display = 'block';
    }
}

// Download single file or folder
async function downloadSingle(filename) {
    try {
        const response = await fetch(`/uploads/${encodeURIComponent(filename)}`);
        
        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        errorDiv.style.display = 'none';
    } catch (err) {
        errorDiv.textContent = 'Error downloading file: ' + err.message;
        errorDiv.style.display = 'block';
    }
}

// Delete single file or folder
async function deleteSingle(filename) {
    const confirmMsg = `Delete "${filename}"?`;
    
    if (!confirm(confirmMsg)) return;

    try {
        const response = await fetch(`/uploads/delete/${encodeURIComponent(filename)}`);
        
        if (!response.ok) throw new Error('Delete failed');

        errorDiv.style.display = 'none';
        loadFiles();
    } catch (err) {
        errorDiv.textContent = 'Error deleting file: ' + err.message;
        errorDiv.style.display = 'block';
    }
}

// Download selected files/folders
async function downloadSelected() {
    const checkboxes = document.querySelectorAll('input[name="selectedFiles"]:checked');
    const items = Array.from(checkboxes).map(cb => cb.value);

    if (items.length === 0) {
        alert('Please select files or folders to download');
        return;
    }

    try {
        const response = await fetch('/download-batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ items })
        });

        if (!response.ok) throw new Error('Download failed');

        // The response is a zip file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'downloads.zip';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        errorDiv.style.display = 'none';
    } catch (err) {
        errorDiv.textContent = 'Error downloading items: ' + err.message;
        errorDiv.style.display = 'block';
    }
}

// Add search event listener
searchInput.addEventListener('input', () => {
    renderFileList();
});

// Load files when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadFiles();
});