#!/bin/bash
set -e

echo "🚀 Setting up CI/CD environment for AI Status Dashboard"

# Check if running in CI
if [ "$CI" = "true" ]; then
    echo "✅ Running in CI environment"
else
    echo "⚠️  Running in local environment"
fi

# Update system packages
echo "📦 Updating system packages..."
if command -v apt-get &> /dev/null; then
    sudo apt-get update
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm ci

# Install Playwright browsers and dependencies
echo "🎭 Installing Playwright browsers..."
npx playwright install --with-deps

# Install Microsoft Edge specifically
echo "🌐 Installing Microsoft Edge..."
npx playwright install msedge

# Install additional WebKit dependencies
echo "🦎 Installing WebKit dependencies..."
if command -v apt-get &> /dev/null; then
    sudo apt-get install -y \
        libgtk-4-1 \
        libevent-2.1-7 \
        libgstcodecparsers-1.0-0 \
        libflite1 \
        libflite-usenglish1 \
        libflite-cmu-grapheme-lang1 \
        libflite-cmu-grapheme-lex1 \
        libflite-cmu-indic-lang1 \
        libflite-cmu-indic-lex1 \
        libflite-cmulex1 \
        libflite-cmu-time-awb1 \
        libflite-cmu-us-awb1 \
        libflite-cmu-us-kal161 \
        libflite-cmu-us-kal1 \
        libflite-cmu-us-rms1 \
        libflite-cmu-us-slt1 \
        libavif13 \
        libx264-163 \
        2>/dev/null || echo "⚠️  Some WebKit dependencies may not be available"
fi

# Verify browser installations
echo "🔍 Verifying browser installations..."
npx playwright --version

# Check if browsers are installed
echo "🌐 Checking browser availability..."
if npx playwright show-browsers | grep -q "chromium"; then
    echo "✅ Chromium installed"
else
    echo "❌ Chromium not found"
fi

if npx playwright show-browsers | grep -q "firefox"; then
    echo "✅ Firefox installed"
else
    echo "❌ Firefox not found"
fi

if npx playwright show-browsers | grep -q "webkit"; then
    echo "✅ WebKit installed"
else
    echo "❌ WebKit not found"
fi

if npx playwright show-browsers | grep -q "msedge"; then
    echo "✅ Microsoft Edge installed"
else
    echo "❌ Microsoft Edge not found"
fi

# Build the application
echo "🏗️  Building application..."
npm run build

# Run a quick health check
echo "🏥 Running health check..."
if npm run ci:health-check 2>/dev/null; then
    echo "✅ Application health check passed"
else
    echo "⚠️  Health check skipped (server not running)"
fi

echo "🎉 CI/CD environment setup complete!"
echo ""
echo "Available test commands:"
echo "  npm run ci:test-critical      # Fast critical tests (~45s)"
echo "  npm run ci:test-comprehensive # Comprehensive tests (~25m)"
echo "  npm run ci:test-production    # Full production tests (~50m)"
echo ""
echo "Available test categories:"
echo "  npm run test:e2e:critical     # Core user journeys"
echo "  npm run test:e2e:smoke        # Basic functionality"
echo "  npm run test:e2e:ui           # User interface tests"
echo "  npm run test:e2e:integration  # API integration tests"
echo "  npm run test:e2e:accessibility # A11y compliance"
echo "  npm run test:e2e:performance  # Performance benchmarks"
echo "  npm run test:e2e:mobile       # Mobile device tests"
echo "  npm run test:e2e:cross-browser # Cross-browser compatibility" 