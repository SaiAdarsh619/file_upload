import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';

const fileIcons = {
    pdf: '📄', doc: '📄', docx: '📄', txt: '📝', md: '📝',
    xls: '📊', xlsx: '📊', csv: '📊',
    ppt: '🎯', pptx: '🎯',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️',
    mp4: '🎬', avi: '🎬', mov: '🎬', mkv: '🎬', flv: '🎬',
    mp3: '🎵', wav: '🎵', flac: '🎵', aac: '🎵',
    zip: '📦', rar: '📦', '7z': '📦', tar: '📦',
    exe: '⚙️', msi: '⚙️', dmg: '⚙️',
    html: '🌐', css: '🌐', js: '⚡', json: '⚡'
};

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return fileIcons[ext] || '📄';
}

function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return size.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

export default function Files() {
    const { user, logout } = useAuth();

    const [allItems, setAllItems] = useState([]);
    const [currentPath, setCurrentPath] = useState('');
    const [currentSortBy, setCurrentSortBy] = useState('name');
    const [currentSortOrder, setCurrentSortOrder] = useState('asc');
    const [viewMode, setViewMode] = useState('grid');

    const [searchTerm, setSearchTerm] = useState('');
    const [stagedQueue, setStagedQueue] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    const [selectedItems, setSelectedItems] = useState(new Set());
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState(null);

    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, path: '' });

    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);
    const dropZoneRef = useRef(null);

    // Load files when path changes
    useEffect(() => {
        loadFiles();
    }, [currentPath]);

    // Handle context menu closing
    useEffect(() => {
        const closeCtx = () => setContextMenu(prev => ({ ...prev, visible: false }));
        document.addEventListener('click', closeCtx);
        return () => document.removeEventListener('click', closeCtx);
    }, []);

    const loadFiles = async () => {
        try {
            const url = currentPath ? `/api/files?path=${encodeURIComponent(currentPath)}` : '/api/files';
            const res = await fetch(url);
            if (!res.ok) {
                if (res.status === 401) {
                    // Handled by AuthContext / ProtectedRoute typically, but just in case
                    return window.location.href = '/login';
                }
                throw new Error('Failed to load files');
            }
            const data = await res.json();
            setAllItems(data);
            setSelectedItems(new Set());
            setError(null);
        } catch (err) {
            setError(err.message);
            setAllItems([]);
        }
    };

    // ----- Selection -----
    const toggleSelection = (path, isFolder) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    };

    const handleItemClick = (e, item) => {
        if (e.target.closest('input[type="checkbox"]')) return;
        const path = item.path || item.name;
        if (item.isFolder) {
            setCurrentPath(path);
            setSearchTerm('');
        } else {
            toggleSelection(path);
        }
    };

    const handleEmptyClick = (e) => {
        if (e.target.closest('.grid-item') || e.target.closest('.file-row') || e.target.closest('.view-toolbar')) return;
        setSelectedItems(new Set());
    };

    // ----- Sorting & Filtering -----
    let items = allItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    items.sort((a, b) => {
        let aVal, bVal;
        switch (currentSortBy) {
            case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
            case 'size': aVal = a.size || 0; bVal = b.size || 0; break;
            case 'type': aVal = (a.type || '').toLowerCase(); bVal = (b.type || '').toLowerCase(); break;
            case 'date': aVal = new Date(a.modified).getTime(); bVal = new Date(b.modified).getTime(); break;
            default: aVal = a.name; bVal = b.name;
        }
        if (aVal < bVal) return currentSortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    const changeSortBy = (sortBy) => {
        if (currentSortBy === sortBy) {
            setCurrentSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setCurrentSortBy(sortBy);
            setCurrentSortOrder('asc');
        }
    };

    // ----- Uploading -----
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
        else if (e.type === 'dragleave' || e.type === 'drop') setDragActive(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            // In a real sophisticated drop we might use webkitGetAsEntry
            // For simplicity in React without huge polyfill, we fall back to flat list or the items api
            addFilesToQueue(Array.from(e.dataTransfer.files));
        }
    };

    const addFilesToQueue = (files) => {
        setStagedQueue(prev => [...prev, ...files]);
    };

    const uploadStaged = async () => {
        if (stagedQueue.length === 0) return;
        setIsUploading(true);
        setError(null);

        const formData = new FormData();
        stagedQueue.forEach(file => {
            // using relativePath if it exists from webkitdirectory
            const name = file.webkitRelativePath || file.name;
            formData.append('files', file, name);
        });

        try {
            const uploadUrl = currentPath ? `/upload?uploadPath=${encodeURIComponent(currentPath)}` : '/upload';
            const res = await fetch(uploadUrl, { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Upload failed');
            setStagedQueue([]);
            loadFiles();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsUploading(false);
        }
    };

    // ----- Actions -----
    const handleBatchDelete = async () => {
        const itemsToDelete = Array.from(selectedItems);
        if (itemsToDelete.length === 0) return;
        if (!window.confirm(`Delete ${itemsToDelete.length} item(s)?`)) return;

        try {
            const res = await fetch('/delete-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: itemsToDelete })
            });
            if (!res.ok) throw new Error('Delete failed');
            loadFiles();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleBatchDownload = async () => {
        const itemsToDownload = Array.from(selectedItems);
        if (itemsToDownload.length === 0) return;

        if (itemsToDownload.length === 1) {
            const filename = itemsToDownload[0];
            downloadSingle(filename);
            return;
        }

        try {
            const res = await fetch('/download-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: itemsToDownload })
            });
            if (!res.ok) throw new Error('Batch download failed');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'downloads.zip';
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError(err.message);
        }
    };

    const downloadSingle = async (path) => {
        try {
            const actualFilename = path.includes('/') ? path.split('/').pop() : path;
            const res = await fetch(`/uploads/${encodeURIComponent(path)}`);
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = actualFilename;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError(err.message);
        }
    };

    const deleteSingle = async (path) => {
        if (!window.confirm(`Delete "${path}"?`)) return;
        try {
            const res = await fetch(`/uploads/delete/${encodeURIComponent(path)}`);
            if (!res.ok) throw new Error('Delete failed');
            loadFiles();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleContextMenu = (e, path) => {
        e.preventDefault();
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, path });
    };

    // ----- Render Helpers -----
    const breadcrumbParts = currentPath ? currentPath.split('/') : [];

    return (
        <div className="app-container">
            {/* Header */}
            <header className="app-header">
                <h1>Files</h1>
                <div className="header-actions">
                    <input
                        type="text"
                        placeholder="Search..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    <div className="user-info">
                        <span className="user-avatar">{user?.username.charAt(0).toUpperCase()}</span>
                        <span className="user-name">{user?.username}</span>
                        <button className="logout-btn" onClick={logout} title="Sign out">⎋ Logout</button>
                    </div>
                </div>
            </header>

            <div className="app-content">
                {/* Drop Zone */}
                <div className="upload-section">
                    <div
                        className={`drop-zone ${dragActive ? 'drop-zone--active' : ''}`}
                        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                    >
                        <div className="drop-zone-icon">☁️</div>
                        <p className="drop-zone-text">Drag &amp; drop files or folders here</p>
                        <p className="drop-zone-hint">or choose what to upload</p>
                        <div className="drop-zone-btns">
                            <label className="dz-browse-btn" onClick={() => fileInputRef.current?.click()}>📄 Browse Files</label>
                            <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={e => {
                                if (e.target.files) addFilesToQueue(Array.from(e.target.files));
                                e.target.value = null;
                            }} />

                            <label className="dz-browse-btn" onClick={() => folderInputRef.current?.click()}>📁 Browse Folder</label>
                            <input type="file" multiple webkitdirectory="true" ref={folderInputRef} style={{ display: 'none' }} onChange={e => {
                                if (e.target.files) addFilesToQueue(Array.from(e.target.files));
                                e.target.value = null;
                            }} />
                        </div>
                    </div>

                    {/* Staged Queue */}
                    {stagedQueue.length > 0 && (
                        <div className="staged-queue">
                            <div className="staged-queue-header">
                                <span className="staged-count">{stagedQueue.length} file{stagedQueue.length !== 1 ? 's' : ''} ready to upload</span>
                                <div className="staged-queue-actions">
                                    <button className="sq-clear-btn" onClick={() => setStagedQueue([])} disabled={isUploading}>✕ Clear all</button>
                                    <button className="sq-upload-btn" onClick={uploadStaged} disabled={isUploading}>
                                        {isUploading ? '⏳ Uploading…' : '⬆ Upload'}
                                    </button>
                                </div>
                            </div>
                            <ul className="staged-list">
                                {stagedQueue.map((f, i) => (
                                    <li key={i} className="staged-item">
                                        <span className="staged-item-icon">{getFileIcon(f.webkitRelativePath || f.name)}</span>
                                        <span className="staged-item-name">{f.webkitRelativePath || f.name}</span>
                                        <span className="staged-item-size">{formatSize(f.size)}</span>
                                        <button className="staged-item-remove" onClick={() => setStagedQueue(q => q.filter((_, idx) => idx !== i))} disabled={isUploading}>✕</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {error && <div className="error-message">{error}</div>}
                </div>

                {/* Toolbar */}
                <div className="toolbar">
                    <div className="breadcrumb">
                        <button className="breadcrumb-item" onClick={() => setCurrentPath('')}>Home</button>
                        {breadcrumbParts.map((part, idx) => {
                            const cp = breadcrumbParts.slice(0, idx + 1).join('/');
                            return (
                                <span key={cp}>
                                    <span className="breadcrumb-sep">/</span>
                                    <button className="breadcrumb-item" onClick={() => setCurrentPath(cp)}>{part}</button>
                                </span>
                            );
                        })}
                    </div>
                    <div className="toolbar-actions">
                        {selectedItems.size > 0 && (
                            <>
                                <button className="toolbar-btn" onClick={handleBatchDownload}>Download ({selectedItems.size})</button>
                                <button className="toolbar-btn delete" onClick={handleBatchDelete}>Delete ({selectedItems.size})</button>
                            </>
                        )}
                    </div>
                </div>

                {/* Files View */}
                <div className="files-view" onClick={handleEmptyClick}>
                    <div className="file-list">

                        <div className="view-toolbar">
                            <div className="sort-options">
                                <label>Sort by:</label>
                                <button className={`sort-option ${currentSortBy === 'name' ? 'active' : ''}`} onClick={() => changeSortBy('name')}>
                                    Name {currentSortBy === 'name' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}
                                </button>
                                <button className={`sort-option ${currentSortBy === 'date' ? 'active' : ''}`} onClick={() => changeSortBy('date')}>
                                    Date {currentSortBy === 'date' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}
                                </button>
                                <button className={`sort-option ${currentSortBy === 'size' ? 'active' : ''}`} onClick={() => changeSortBy('size')}>
                                    Size {currentSortBy === 'size' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}
                                </button>
                            </div>
                            <button
                                className="view-toggle-toolbar"
                                title="Toggle view"
                                onClick={() => setViewMode(m => m === 'grid' ? 'list' : 'grid')}
                            >
                                {viewMode === 'grid' ? '☰ List' : '⊞ Grid'}
                            </button>
                        </div>

                        {items.length === 0 ? (
                            <div className="empty-state">No files</div>
                        ) : (
                            viewMode === 'grid' ? (
                                <div className="grid-container">
                                    {items.map(item => {
                                        const path = item.path || item.name;
                                        const icon = item.isFolder ? '📁' : getFileIcon(item.name);
                                        const selected = selectedItems.has(path);
                                        return (
                                            <div
                                                key={path}
                                                className="grid-item"
                                                onClick={(e) => handleItemClick(e, item)}
                                                onContextMenu={(e) => handleContextMenu(e, path)}
                                            >
                                                <div className="grid-item-checkbox">
                                                    <input type="checkbox" checked={selected} onChange={() => toggleSelection(path)} onClick={e => e.stopPropagation()} />
                                                </div>
                                                <div className="grid-item-icon">{icon}</div>
                                                <div className="grid-item-name">{item.name}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <table className="file-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '30px' }}></th>
                                            <th onClick={() => changeSortBy('name')} className={`sortable ${currentSortBy === 'name' ? 'active' : ''}`}>Name {currentSortBy === 'name' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}</th>
                                            <th onClick={() => changeSortBy('type')} className={`sortable ${currentSortBy === 'type' ? 'active' : ''}`}>Type {currentSortBy === 'type' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}</th>
                                            <th onClick={() => changeSortBy('size')} className={`sortable ${currentSortBy === 'size' ? 'active' : ''}`}>Size {currentSortBy === 'size' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}</th>
                                            <th onClick={() => changeSortBy('date')} className={`sortable ${currentSortBy === 'date' ? 'active' : ''}`}>Modified {currentSortBy === 'date' ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map(item => {
                                            const path = item.path || item.name;
                                            const icon = item.isFolder ? '📁' : getFileIcon(item.name);
                                            const selected = selectedItems.has(path);
                                            return (
                                                <tr
                                                    key={path}
                                                    className="file-row"
                                                    onClick={(e) => handleItemClick(e, item)}
                                                    onContextMenu={(e) => handleContextMenu(e, path)}
                                                >
                                                    <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected} onChange={() => toggleSelection(path)} onClick={e => e.stopPropagation()} /></td>
                                                    <td className="name-cell"><span className="file-icon">{icon}</span><span className="file-name">{item.name}</span></td>
                                                    <td>{item.type}</td>
                                                    <td>{item.sizeFormatted}</td>
                                                    <td>{item.modifiedFormatted}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu.visible && (
                <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y, display: 'block' }}>
                    <button className="context-item" onClick={() => { downloadSingle(contextMenu.path); setContextMenu({ visible: false }); }}>Download</button>
                    <button className="context-item" onClick={() => { deleteSingle(contextMenu.path); setContextMenu({ visible: false }); }}>Delete</button>
                </div>
            )}
        </div>
    );
}
