#!/bin/bash

# AI Provider Logo Fetcher
# Downloads logos from LobeHub's comprehensive AI/LLM icon collection
# Fallback to simple-icons for redundancy

set -e  # Exit on any error

LOGO_DIR="public/logos"
TEMP_DIR="/tmp/ai-logos"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create directories
mkdir -p "$LOGO_DIR"
mkdir -p "$TEMP_DIR"

log_info "Starting AI provider logo download..."
log_info "Target directory: $LOGO_DIR"
log_info "Temporary directory: $TEMP_DIR"

# AI provider configurations - use simple arrays
FILENAMES=(
    "openai"
    "anthropic"
    "google-ai"
    "huggingface"
    "cohere"
    "replicate"
    "groq"
    "deepseek"
    "meta"
    "xai"
    "perplexity"
    "claude"
    "mistral"
    "aws"
    "azure"
)

PROVIDERS=(
    "openai"
    "anthropic"
    "google"
    "huggingface"
    "cohere"
    "replicate"
    "groq"
    "deepseek"
    "meta"
    "x"
    "perplexity"
    "anthropic"
    "mistral"
    "amazonaws"
    "microsoftazure"
)

# Download function with multiple fallbacks
download_logo() {
    local filename="$1"
    local provider="$2"
    local target_file="$LOGO_DIR/$filename.svg"
    
    log_info "Downloading $filename.svg..."
    
    # Remove existing file to force fresh download
    rm -f "$target_file"
    
    # Primary source: LobeHub
    local lobehub_url="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/$provider.svg"
    
    if curl -f -s -L "$lobehub_url" -o "$target_file" 2>/dev/null; then
        if [ -s "$target_file" ]; then
            log_info "✓ Successfully downloaded $filename.svg from LobeHub"
            return 0
        else
            log_warn "Downloaded file is empty, trying fallback..."
            rm -f "$target_file"
        fi
    else
        log_warn "LobeHub download failed for $filename, trying fallback..."
    fi
    
    # Fallback source: Simple Icons
    local simpleicons_url="https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/$provider.svg"
    
    if curl -f -s -L "$simpleicons_url" -o "$target_file" 2>/dev/null; then
        if [ -s "$target_file" ]; then
            log_info "✓ Successfully downloaded $filename.svg from Simple Icons"
            return 0
        else
            log_warn "Simple Icons file is empty"
            rm -f "$target_file"
        fi
    else
        log_warn "Simple Icons download also failed for $filename"
    fi
    
    # Create placeholder if all else fails
    log_error "All download attempts failed for $filename, creating placeholder"
    cat > "$target_file" << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
  <text x="12" y="16" text-anchor="middle" font-size="6" fill="currentColor">AI</text>
</svg>
EOF
    return 1
}

# Download all logos
success_count=0
total_count=${#FILENAMES[@]}

log_info "Total providers to download: $total_count"

for i in "${!PROVIDERS[@]}"; do
    filename="${FILENAMES[$i]}"
    provider="${PROVIDERS[$i]}"
    log_info "Processing: $filename -> $provider"
    if download_logo "$filename" "$provider"; then
        success_count=$((success_count + 1))
    fi
done

# Verify all files exist and are not empty
log_info "Verifying downloaded files..."
for filename in "${FILENAMES[@]}"; do
    target_file="$LOGO_DIR/$filename.svg"
    if [ ! -f "$target_file" ]; then
        log_error "Missing file: $filename.svg"
    elif [ ! -s "$target_file" ]; then
        log_error "Empty file: $filename.svg"
    else
        file_size=$(stat -c%s "$target_file" 2>/dev/null || stat -f%z "$target_file" 2>/dev/null || echo "0")
        log_info "✓ $filename.svg ($file_size bytes)"
    fi
done

# Cleanup
rm -rf "$TEMP_DIR"

# Final report
log_info "Download complete: $success_count/$total_count logos downloaded successfully"

if [ $success_count -eq $total_count ]; then
    log_info "🎉 All logos downloaded successfully!"
    exit 0
else
    log_warn "⚠️  Some logos failed to download but placeholders were created"
    exit 0  # Don't fail the build
fi 