#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://aistatusdashboard.com}"
OUT_FILE="${OUT_FILE:-}"

urls=(
  "${BASE_URL}/rss.xml"
  "${BASE_URL}/sitemap.xml"
  "${BASE_URL}/docs.md"
  "${BASE_URL}/docs/api.md"
  "${BASE_URL}/docs/citations.md"
  "${BASE_URL}/providers.md"
  "${BASE_URL}/status.md"
  "${BASE_URL}/datasets/incidents.ndjson"
  "${BASE_URL}/datasets/metrics.csv"
  "${BASE_URL}/api/health"
  "${BASE_URL}/api/status"
  "${BASE_URL}/mcp"
)

uas=(
  "curl/8.7.1"
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
  "OAI-SearchBot"
  "Mozilla/5.0 (compatible; FeedFetcher-Google; +http://www.google.com/feedfetcher.html)"
)

header="URL | UA | Status | Content-Type | Cache-Control | Bytes"
if [[ -n "${OUT_FILE}" ]]; then
  printf "%s\n" "${header}" > "${OUT_FILE}"
else
  printf "%s\n" "${header}"
fi

failures=0
for url in "${urls[@]}"; do
  for ua in "${uas[@]}"; do
    headers=$(curl -s -D - -o /dev/null -A "${ua}" "${url}")
    status=$(printf "%s" "${headers}" | head -n 1 | awk '{print $2}')
    ctype=$(printf "%s" "${headers}" | awk -F': ' 'tolower($1)=="content-type"{print $2; exit}')
    cache=$(printf "%s" "${headers}" | awk -F': ' 'tolower($1)=="cache-control"{print $2; exit}')
    bytes=$(printf "%s" "${headers}" | awk -F': ' 'tolower($1)=="content-length"{print $2; exit}')

    line="${url} | ${ua} | ${status:-"-"} | ${ctype:-"-"} | ${cache:-"-"} | ${bytes:-"-"}"
    if [[ -n "${OUT_FILE}" ]]; then
      printf "%s\n" "${line}" >> "${OUT_FILE}"
    else
      printf "%s\n" "${line}"
    fi

    if [[ "${status}" != "200" ]]; then
      failures=$((failures + 1))
    fi
  done
done

if [[ "${failures}" -gt 0 ]]; then
  echo "bot_sweep failed: ${failures} non-200 responses" >&2
  exit 1
fi
