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

Since the project is separated into a React frontend and a Node.js backend, you must install dependencies for both:

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd ../frontend
npm install
```

### 3. Environment Variables Setup

Create a `.env` file in the `backend/` directory. You can use the `backend/.env.example` format (ensure you do not commit your real `.env`).

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

You will need to start both the backend API and the frontend UI concurrently in separate terminals.

**Terminal 1 (Backend Server):**
```bash
cd backend
npm start
```
*Note: This runs the server on http://localhost:5000 and watches for changes.*

**Terminal 2 (Frontend Server):**
```bash
cd frontend
npm run dev
```
*Note: This runs the Vite development server and proxies API requests to the backend.*

### 5. Access the app

Open your browser and navigate to the Vite frontend URL:
`http://localhost:5173`

You will see the Landing page. From there, you can click "Register" to create a new account and begin uploading files.

## Project Structure Highlights

### `backend/`
- `app.js` — Main entry point setting up express, JSON api, sessions, and routes.
- `services/db.js` — Setup for SQLite database used for user credentials.
- `routes/auth.js` — JSON API Routes for handling `/login`, `/register`, and `/logout`.
- `middleware/authMiddleware.js` — API route protection and session validation.
- `services/StorageFactory.js` — Dynamically injects either Local or Azure storage for a specific logged-in user.

### `frontend/`
- Contains a standalone React SPA bootstrapped with Vite.
- `src/components/` — React UI components including `Files.jsx` (File Dashboard), `Login.jsx`, `Register.jsx`, etc.
- `src/AuthContext.jsx` — Global Session State manager for React.
