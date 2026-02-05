const filelistDiv = document.getElementById('filelist');
const uploadForm = document.getElementById('uploadForm');
const errorDiv = document.getElementById('error');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

// Handle Upload
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const filesInput = document.getElementById('files');
    const folderInput = document.getElementById('folder');

    const formData = new FormData();
    let totalFiles = 0;

    // Process standard files
    for (const file of filesInput.files) {
        formData.append('files', file);
        totalFiles++;
    }

    // Process folder files
    for (const file of folderInput.files) {
        const relativePath = file.webkitRelativePath || file.name;
        formData.append('files', file, relativePath);
        console.log(relativePath, files, formData);
        totalFiles++;
    }

    console.log(formData);
    console.log('Total files to upload:', totalFiles);
    console.log('FormData entries:');
    for (const pair of formData.entries()) {
        console.log(pair[0]+ ': ' + pair[1].name);
    }

    if (totalFiles === 0) {
        alert('Please select files or a folder');
        return;
    }

    try {
        const btn = uploadForm.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Uploading...';

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Upload failed');

        filesInput.value = '';
        folderInput.value = '';
        errorDiv.style.display = 'none';
        loadFiles();
    } catch (err) {
        errorDiv.textContent = 'Error uploading files: ' + err.message;
        errorDiv.style.display = 'block';
    } finally {
        const btn = uploadForm.querySelector('button');
        btn.disabled = false;
        btn.textContent = 'Upload All';
    }
});

// Fetch and display files
async function loadFiles() {
    try {
        const response = await fetch('/files');
        if (!response.ok) throw new Error('Failed to load files');

        const files = await response.json();

        if (files.length === 0) {
            filelistDiv.innerHTML = '<div class="loading">No files uploaded yet</div>';
            filelistDiv.style.display = 'block';
            return;
        }

        filelistDiv.innerHTML = files.map(file => `
        <div class="fileitem">
            <input type="checkbox" name="selectedFiles" value="${file}" onchange="updateDeleteButton()">
            <div class="fileinfo">
                <a href="/uploads/${file}" download>${file}</a>
            </div>
        </div>
    `).join('');
        filelistDiv.style.display = 'block';
        updateDeleteButton();
    } catch (err) {
        errorDiv.textContent = 'Error loading files: ' + err.message;
        errorDiv.style.display = 'block';
        filelistDiv.innerHTML = '';
    }
}

function updateDeleteButton() {
    const checkboxes = document.querySelectorAll('input[name="selectedFiles"]:checked');
    deleteSelectedBtn.disabled = checkboxes.length === 0;
    deleteSelectedBtn.textContent = checkboxes.length > 0 ? `Delete Selected (${checkboxes.length})` : 'Delete Selected';
}

// Delete Selected
async function deleteSelected() {
    const checkboxes = document.querySelectorAll('input[name="selectedFiles"]:checked');
    const filenames = Array.from(checkboxes).map(cb => cb.value);

    if (filenames.length === 0) return;
    if (!confirm(`Delete ${filenames.length} files?`)) return;

    try {
        const response = await fetch('/upload/delete/batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filenames })
        });

        if (!response.ok) throw new Error('Batch delete failed');

        errorDiv.style.display = 'none';
        loadFiles();
    } catch (err) {
        errorDiv.textContent = 'Error deleting files: ' + err.message;
        errorDiv.style.display = 'block';
    }
}

// Load on start
// loadFiles(); 
