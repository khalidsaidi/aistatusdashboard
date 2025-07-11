#!/bin/bash

echo "🚀 Starting Local Development with Dev Backend Testing"
echo "======================================================"

# Check if Next.js dev server is already running
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Local dev server already running at http://localhost:3000"
else
    echo "🔄 Starting Next.js dev server..."
    npm run dev &
    DEV_PID=$!
    
    # Wait for dev server to start
    echo "⏳ Waiting for dev server to start..."
    for i in {1..30}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo "✅ Dev server started successfully!"
            break
        fi
        sleep 1
        echo -n "."
    done
fi

echo ""
echo "🧪 Running comprehensive tests with dev backend..."
echo "📡 API: https://us-central1-ai-status-dashboard-dev.cloudfunctions.net/api"
echo "🖥️  Local: http://localhost:3000"
echo ""

# Run the comprehensive test
node scripts/test-local-with-dev-backend.js

echo ""
echo "✨ Local development setup complete!"
echo "💡 Your local app now uses the dev backend for 100% real testing"
echo ""
echo "🔗 Available URLs:"
echo "   • Local App: http://localhost:3000"
echo "   • Dev Backend: https://us-central1-ai-status-dashboard-dev.cloudfunctions.net/api"
echo "   • Dev Dashboard: https://ai-status-dashboard-dev.web.app"
echo ""
echo "🧪 Test Commands:"
echo "   • npm run test:local-dev    # Test local with dev backend"
echo "   • npm run test:dev-backend  # Test dev backend only"
echo "   • npm run test:all          # Run all tests" 