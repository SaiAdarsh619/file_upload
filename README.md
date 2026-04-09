# Multi-User File Manager

A robust, multi-user file management system built with Express.js, featuring user authentication, session management, and per-user isolated file storage. Supports both local storage and Azure Blob Storage.

## Features

- **User Authentication**: Secure registration and login using bcrypt.
- **Session Management**: Session cookies backed by SQLite, keeping users logged in securely.
- **Data Isolation**: Files uploaded by a user are strictly isolated and not visible to other users.
- **File & Folder Support**: Upload multiple files or entire folder directories at once.
- **Batch Operations**: Select multiple files/folders to download as a `.zip` or delete them in batch.
- **Multiple Storage Providers**: Out-of-the-box support for both Local file system storage and Azure Blob Storage.

## Prerequisites

- [Node.js](https://nodejs.org/en/) (v16+ recommended)
- [npm](https://www.npmjs.com/)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/SaiAdarsh619/file_upload.git
cd file_upload
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Variables Setup

Create a `.env` file in the root directory. You can use the `.env.example` format (ensure you do not commit your real `.env`).

```ini
# --- Storage Configuration ---
# Set to 'local' or 'azure'
STORAGE_PROVIDER='local'

# Local Storage settings
UPLOADS_DIRECTORY='uploads'

# Azure Storage settings (required only if STORAGE_PROVIDER='azure')
STORAGE_ACCOUNT_NAME='your_storage_account_name'
CONTAINER_NAME='uploads'
CONNECTION_STRING='your_connection_string'
ACCESS_KEY='your_access_key'
SAS_TOKEN='your_sas_token'

# --- Application Security ---
SESSION_SECRET='your-super-secret-session-key-change-in-production'
```

### 4. Run the application

Start the server using:

```bash
npm start
```
*Note: This runs `node --watch app.js`, which will automatically restart the server if you modify your code.*

Alternatively, run without watch mode:
```bash
node app.js
```

### 5. Access the app

Open your browser and navigate to:
`http://localhost:5000`

You will be redirected to the login page. From there, you can click "Register" to create a new account and begin uploading files.

## Project Structure Highlights

- `app.js` — Main entry point setting up express, sessions, and routes.
- `services/db.js` — Setup for SQLite database used for user credentials.
- `routes/auth.js` — Routes for handling `/login`, `/register`, and `/logout`.
- `middleware/authMiddleware.js` — Route protection and session validation.
- `services/StorageFactory.js` — Dynamically injects either Local or Azure storage for a specific logged-in user.
