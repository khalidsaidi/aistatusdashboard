#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE_URL:-https://aistatusdashboard.com}"
OUT_DIR="${OUT_DIR:-artifacts}"
mkdir -p "${OUT_DIR}"

ENDPOINTS=(
  "/"
  "/ai"
  "/robots.txt"
  "/sitemap.xml"
  "/llms.txt"
  "/llms-full.txt"
  "/openapi.json"
  "/.well-known/openapi.json"
  "/.well-known/ai-plugin.json"
  "/mcp"
  "/docs"
  "/docs.md"
  "/docs/agent/mcp-quickstart"
  "/docs/agent/mcp-quickstart.md"
  "/docs/api"
  "/docs/api.md"
  "/status"
  "/status.md"
  "/providers"
  "/providers.md"
  "/datasets"
  "/datasets/incidents.ndjson"
  "/datasets/metrics.parquet"
  "/rss.xml"
)

REPORT="${OUT_DIR}/visibility_report.json"
echo "[]" > "${REPORT}"

append_json () {
  local entry="$1"
  jq ". + [${entry}]" "${REPORT}" > "${REPORT}.tmp" && mv "${REPORT}.tmp" "${REPORT}"
}

for ep in "${ENDPOINTS[@]}"; do
  url="${BASE}${ep}"
  headers=$(curl -s -D - -o /tmp/body.$$ "$url")
  status=$(echo "$headers" | head -n1 | awk '{print $2}')
  ctype=$(echo "$headers" | awk '/^content-type:/I{print $2}' | tr -d '\r')
  cache=$(echo "$headers" | awk '/^cache-control:/I{$1="";print substr($0,2)}' | tr -d '\r')
  xrobots=$(echo "$headers" | awk '/^x-robots-tag:/I{$1="";print substr($0,2)}' | tr -d '\r')
  robots=$(echo "$headers" | awk '/^robots:/I{$1="";print substr($0,2)}' | tr -d '\r')
  canonical=$(grep -i '<link rel="canonical"' /tmp/body.$$ | head -n1)
  noscript=$(grep -i '<noscript' /tmp/body.$$ | head -n1)
  has_text=$(grep -iq "[a-zA-Z0-9]" /tmp/body.$$ && echo true || echo false)
  append_json "$(jq -n \
    --arg url "$url" \
    --arg status "$status" \
    --arg ctype "$ctype" \
    --arg cache "$cache" \
    --arg xrobots "$xrobots" \
    --arg robots "$robots" \
    --arg canonical "$canonical" \
    --arg noscript "$noscript" \
    --arg has_text "$has_text" \
    '{url:$url,status:($status|tonumber),content_type:$ctype,cache:$cache,x_robots:$xrobots,robots:$robots,canonical:$canonical,noscript:$noscript,has_text:($has_text=="true")}' )"
done

echo "Audit complete -> ${REPORT}"
