#!/usr/bin/env bash
# Fetch Google Search Console verification tokens (DNS TXT and META) for a domain and site URL
# using the authenticated gcloud user. Prints the ready-to-use records so you can paste them
# without any extra parsing.

set -euo pipefail

DOMAIN="${DOMAIN:-aistatusdashboard.com}"
SITE_URL="${SITE_URL:-https://aistatusdashboard.com/}"
QUOTA_PROJECT="${QUOTA_PROJECT:-ai-status-dashboard}"
# Include cloud-platform because gcloud requires it alongside siteverification.
SCOPES="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/siteverification"

fail() {
  echo "[error] $1" >&2
  exit 1
}

command -v gcloud >/dev/null || fail "gcloud not found; run 'gcloud auth login' first"
command -v curl >/dev/null || fail "curl not found"

# Prefer jq if available; otherwise fall back to python for JSON parsing.
parse_token() {
  if command -v jq >/dev/null; then
    jq -r '.token // empty'
  else
    python - "$@" <<'PY'
import sys, json
data = json.load(sys.stdin)
print(data.get("token",""))
PY
  fi
}

ACCESS_TOKEN="$(gcloud auth print-access-token --scopes="${SCOPES}" 2>/dev/null || true)"
if [ -z "$ACCESS_TOKEN" ]; then
  ACCESS_TOKEN="$(gcloud auth application-default print-access-token --scopes="${SCOPES}" 2>/dev/null || true)"
fi
[ -n "$ACCESS_TOKEN" ] || fail "could not obtain access token. Run: gcloud auth application-default login --scopes=${SCOPES}"

echo "[info] Requesting DNS TXT token for domain property: ${DOMAIN}"
DNS_RAW="$(curl -s -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: ${QUOTA_PROJECT}" \
  -d '{"site":{"identifier":"'"${DOMAIN}"'","type":"INET_DOMAIN"},"verificationMethod":"DNS_TXT"}' \
  https://www.googleapis.com/siteVerification/v1/token)"
DNS_TOKEN="$(printf '%s' "${DNS_RAW}" | parse_token)"

echo "[info] Requesting META tag token for URL property: ${SITE_URL}"
META_RAW="$(curl -s -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: ${QUOTA_PROJECT}" \
  -d '{"site":{"identifier":"'"${SITE_URL}"'","type":"SITE"},"verificationMethod":"META"}' \
  https://www.googleapis.com/siteVerification/v1/token)"
META_TOKEN="$(printf '%s' "${META_RAW}" | parse_token)"

echo
echo "================ DNS TXT RECORD ================"
echo "_google-site-verification.${DOMAIN}.  IN  TXT  \"${DNS_TOKEN}\""
echo
echo "================ META TAG ======================"
echo "<meta name=\"google-site-verification\" content=\"${META_TOKEN}\" />"
echo
echo "Use either the DNS TXT record or the META tag for verification, then share the token back."
if [ -z "${DNS_TOKEN}" ] || [ "${DNS_TOKEN}" = "null" ] || [ -z "${META_TOKEN}" ] || [ "${META_TOKEN}" = "null" ]; then
  echo "[warn] Token came back empty/null. Check the raw responses below for any permission errors."
  echo "--- DNS RAW ---"
  echo "${DNS_RAW}"
  echo "--- META RAW ---"
  echo "${META_RAW}"
  echo "If you see a permission error, make sure you're logged into the Google account that owns the domain and that the Site Verification API is enabled for the account."
fi
