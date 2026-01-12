#!/usr/bin/env bash
# Submit Search Console sitemaps for aistatusdashboard.com.
# Requires an OAuth access token with https://www.googleapis.com/auth/webmasters scope.

set -euo pipefail

SITE_ENC="${SITE_ENC:-https%3A%2F%2Faistatusdashboard.com%2F}"
SITEMAPS=(
  "https%3A%2F%2Faistatusdashboard.com%2Fsitemap.xml"
  "https%3A%2F%2Faistatusdashboard.com%2Fstatus.xml"
  "https%3A%2F%2Faistatusdashboard.com%2Fdocs.xml"
  "https%3A%2F%2Faistatusdashboard.com%2Fdatasets.xml"
  "https%3A%2F%2Faistatusdashboard.com%2Fproviders.xml"
)

fail() { echo "[error] $1" >&2; exit 1; }

# Allow caller to pass ACCESS_TOKEN (preferred); otherwise try ADC via gcloud.
ACCESS_TOKEN="${ACCESS_TOKEN:-}"
if [ -z "$ACCESS_TOKEN" ]; then
  if command -v gcloud >/dev/null 2>&1; then
    ACCESS_TOKEN="$(gcloud auth application-default print-access-token 2>/dev/null || true)"
  fi
fi
[ -n "$ACCESS_TOKEN" ] || fail "ACCESS_TOKEN not set and gcloud ADC unavailable"

for MAP in "${SITEMAPS[@]}"; do
  URL="https://www.googleapis.com/webmasters/v3/sites/${SITE_ENC}/sitemaps/${MAP}"
  echo "[info] Submitting ${MAP}"
  HTTP_CODE="$(curl -s -o /tmp/sitemap-submit.json -w '%{http_code}' \
    -X PUT -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ai-status-dashboard" \
    "${URL}")"
  echo "[info] status=${HTTP_CODE} body=$(cat /tmp/sitemap-submit.json)"
done
