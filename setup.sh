set -e

echo "===================================="
echo " Multi-User File Manager Setup"
echo "===================================="

# Check Node.js
if ! command -v node &> /dev/null
then
    echo "Node.js is not installed."
    exit 1
fi

echo "Node Version:"
node -v

echo ""
echo "Installing backend dependencies..."
cd backend
npm install

if [ ! -f ".env" ]; then
cat > .env << EOF
STORAGE_PROVIDER=local
UPLOADS_DIRECTORY=uploads
SESSION_SECRET=change-me-in-production
EOF
echo "Created backend/.env"
fi

cd ..

echo ""
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "Setup completed successfully!"
echo ""
echo "To start the application run:"
echo "./start.sh"