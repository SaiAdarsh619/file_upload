source ./setup.sh

echo "Starting backend..."
cd backend
npm start &
BACKEND_PID=$!

echo "Starting frontend..."
cd ../frontend
npm run dev -- --host &
FRONTEND_PID=$!

echo ""
echo "Application started"
echo "Frontend: http://localhost:${PORT:-5173}"
echo "Backend : http://localhost:${BACKEND_PORT:-5000}"
echo ""
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT

wait
