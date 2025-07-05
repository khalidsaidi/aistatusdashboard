#!/usr/bin/env bash
# fetch-and-verify-ai-logos.sh
# Downloads 13 AI-provider logos with fall-backs and verifies each file is a
# valid PNG, JPEG, or SVG.  Exits 0 on success, 1 on any failure.

set -euo pipefail
IFS=$'\n\t'

LOGO_DIR="logos"
mkdir -p "$LOGO_DIR"
USER_AGENT="Mozilla/5.0 (compatible; AI-Logo-Fetcher/2.0; +https://your-project.example)"

# -----------------------------------------------------------------------------
# Simple format checker (no external deps; 'file' is optional but faster)
# -----------------------------------------------------------------------------
is_image () {
  local f="$1"

  # Prefer 'file' if present
  if command -v file >/dev/null 2>&1; then
    case "$(file --mime-type -b "$f")" in
      image/png|image/jpeg|image/svg+xml|text/xml) return 0 ;;
    esac
  fi

  # Fallback manual magic-byte / tag tests
  # PNG magic
  if head -c8 "$f" 2>/dev/null | grep -q $'\x89PNG\r\n\x1a\n'; then return 0; fi
  # JPEG magic
  if head -c3 "$f" 2>/dev/null | grep -q $'\xff\xd8\xff'; then return 0; fi
  # SVG tag
  if grep -q -m1 -i '<svg' "$f" 2>/dev/null; then return 0; fi

  return 1
}

# -----------------------------------------------------------------------------
# Fetch helper: tries URLs in order until one passes validation
# -----------------------------------------------------------------------------
fetch_logo () {
  local provider="$1" ; shift
  local try_urls=("$@")
  local ok=1

  for url in "${try_urls[@]}"; do
    [[ -z "$url" ]] && continue      # skip blank placeholders

    tmpfile="$LOGO_DIR/${provider}_tmp"
    echo "▶ ${provider}:  $url"

    if curl -sSLf --connect-timeout 10 --max-time 30 \
           -H "User-Agent: $USER_AGENT" \
           "$url" -o "$tmpfile"; then

      if [[ -s "$tmpfile" ]] && is_image "$tmpfile"; then
        ext="${url##*.}"
        mv "$tmpfile" "$LOGO_DIR/${provider}.${ext}"
        echo "✔ ${provider}: saved as ${provider}.${ext}"
        ok=0
        break
      else
        echo "✖ ${provider}: downloaded but not a valid image"
      fi
    else
      echo "✖ ${provider}: download failed"
    fi
  done

  return $ok
}

# -----------------------------------------------------------------------------
# Main loop
# -----------------------------------------------------------------------------
failures=()

# Process each provider with their URLs
while IFS="|" read -r provider url1 url2 url3; do
  [[ -z "$provider" ]] && continue
  urls=("$url1" "$url2" "$url3")
  if ! fetch_logo "$provider" "${urls[@]}"; then
    failures+=("$provider")
  fi
done << 'EOF'
OpenAI|https://openai-corp-prod.imgix.net/brand-assets/logomark.svg||
Anthropic|https://storage.googleapis.com/anthropic-static/brand/anthropic-logo-black.svg|https://raw.githubusercontent.com/anthropic/brand/main/anthropic-logo-black.svg|
DeepMind|https://storage.googleapis.com/deepmind-docs/brand/deepmind_logo.svg|https://upload.wikimedia.org/wikipedia/commons/6/6e/Google_DeepMind_Logo.svg|
Azure|https://learn.microsoft.com/media/learn/brand/azure.svg|https://upload.wikimedia.org/wikipedia/commons/a/a8/Microsoft_Azure_Logo.svg|
AWS|https://d1.awsstatic.com/webteam/architecture/icons/Arch_AWS-Cloud_alt.svg|https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg|
Meta|https://about.meta.com/meta-brand/_next/static/media/meta-logo.73ef615c.svg|https://upload.wikimedia.org/wikipedia/commons/7/7a/Meta_Platforms_Logo.svg|
Mistral|https://cms.mistral.ai/wp-content/uploads/2025/03/mistral-ai-mark.svg|https://upload.wikimedia.org/wikipedia/commons/3/35/Mistral_AI_logo_%282025%E2%80%93%29.svg|
Cohere|https://cohere.com/static/press/Cohere_logo_black.svg||
AI21|https://upload.wikimedia.org/wikipedia/commons/1/11/AI21-Labs-Logo.jpg||
xAI|https://x.ai/brand-assets/xai-logo-black.svg|https://upload.wikimedia.org/wikipedia/commons/8/86/Xai_logo.svg|
Perplexity|https://perplexity.ai/brand/perplexity-logo-dark.svg|https://upload.wikimedia.org/wikipedia/commons/3/32/Perplexity_AI_logo.svg|
StabilityAI|https://assets.stability.ai/brand/stabilityai-logo-black.svg|https://upload.wikimedia.org/wikipedia/commons/8/83/Stability_AI_logo.svg|
HuggingFace|https://huggingface.co/front/assets/huggingface_logo.svg||
EOF

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
if (( ${#failures[@]} )); then
  echo
  echo "❌  The following providers failed: ${failures[*]}"
  exit 1
fi

echo
echo "✅  All provider logos downloaded and verified."

echo "🗜  Creating ai-logos.zip …"
zip -qr ai-logos.zip "$LOGO_DIR"
echo "🎉  Done → ai-logos.zip" 