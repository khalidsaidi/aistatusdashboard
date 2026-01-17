#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://aistatusdashboard.com}"

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

need curl
need jq

fetch() {
  local url="$1" headers="$2" body="$3"
  local code
  code=$(curl -sS -L -D "$headers" -o "$body" -w "%{http_code}" "$url" || true)
  echo "$code"
}

header_val() {
  local headers="$1" key="$2"
  grep -i "^${key}:" "$headers" | head -n1 | sed -E "s/^${key}:[[:space:]]*//I" | tr -d '\r'
}

assert_status() {
  local url="$1" code="$2"
  [ "$code" = "200" ] || fail "$url expected 200, got $code"
}

assert_ct_contains() {
  local url="$1" headers="$2" expected="$3"
  local ct
  ct=$(header_val "$headers" "Content-Type" | tr '[:upper:]' '[:lower:]')
  echo "$ct" | grep -q "${expected}" || fail "$url content-type mismatch. expected contains '${expected}', got '${ct}'"
}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

urls=(
  "/air.json"
  "/.well-known/air.json"
  "/.well-known/ai-plugin.json"
  "/openapi.json"
  "/.well-known/openapi.json"
  "/discovery/audit/latest.json"
  "/llms.txt"
)

for path in "${urls[@]}"; do
  url="${BASE_URL}${path}"
  h="$TMP/$(echo "$path" | sed 's#[^a-zA-Z0-9]#_#g').h"
  b="$TMP/$(echo "$path" | sed 's#[^a-zA-Z0-9]#_#g').b"
  code=$(fetch "$url" "$h" "$b")
  assert_status "$url" "$code"
  if [[ "$path" == */air.json || "$path" == "/.well-known/air.json" ]]; then
    assert_ct_contains "$url" "$h" "application/json"
  fi
  if [[ "$path" == "/.well-known/ai-plugin.json" ]]; then
    assert_ct_contains "$url" "$h" "application/json"
  fi
  if [[ "$path" == "/openapi.json" || "$path" == "/.well-known/openapi.json" ]]; then
    assert_ct_contains "$url" "$h" "application/json"
  fi
  if [[ "$path" == "/llms.txt" ]]; then
    assert_ct_contains "$url" "$h" "text/plain"
  fi
  if [[ "$path" == "/discovery/audit/latest.json" ]]; then
    assert_ct_contains "$url" "$h" "application/json"
  fi
  echo "$path OK"

done

plugin_json="$TMP/plugin.json"
fetch "${BASE_URL}/.well-known/ai-plugin.json" "$TMP/plugin.h" "$plugin_json" >/dev/null
legal_url=$(jq -r '.legal_info_url' "$plugin_json")
[[ "$legal_url" == *"/terms"* ]] || fail "ai-plugin.json legal_info_url must contain /terms"

air_json="$TMP/air.json"
fetch "${BASE_URL}/air.json" "$TMP/air.h" "$air_json" >/dev/null
jq -e '.verification.discovery_audit_json and .verification.discovery_audit_html' "$air_json" >/dev/null \
  || fail "air.json missing discovery audit URLs"
jq -e '.callable_surface.openapi and .callable_surface.openapi_well_known and .callable_surface.plugin_manifest and .callable_surface.mcp_endpoint' "$air_json" >/dev/null \
  || fail "air.json missing callable_surface URLs"
jq -e '.llm_entrypoints.llms_txt and .llm_entrypoints.llms_full_txt' "$air_json" >/dev/null \
  || fail "air.json missing llm entrypoints"

openapi_json="$TMP/openapi.json"
fetch "${BASE_URL}/openapi.json" "$TMP/openapi.h" "$openapi_json" >/dev/null
jq -e '.paths["/api/public/v1/status/summary"].get.responses["200"].content["application/json"].examples' "$openapi_json" >/dev/null \
  || fail "openapi.json missing examples for /api/public/v1/status/summary"
jq -e '.paths["/api/public/v1/incidents"].get.responses["200"].content["application/json"].examples' "$openapi_json" >/dev/null \
  || fail "openapi.json missing examples for /api/public/v1/incidents"
jq -e '.paths["/api/public/v1/providers"].get.responses["200"].content["application/json"].examples' "$openapi_json" >/dev/null \
  || fail "openapi.json missing examples for /api/public/v1/providers"
jq -e '.paths["/api/public/v1/casual/status"].get.responses["200"].content["application/json"].examples' "$openapi_json" >/dev/null \
  || fail "openapi.json missing examples for /api/public/v1/casual/status"

echo "Agentability readiness checks passed."
