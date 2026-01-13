#!/usr/bin/env bash
set -uo pipefail

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
  "/.well-known/mcp.json"
  "/mcp"
  "/docs"
  "/docs.md"
  "/docs/agent/mcp-quickstart"
  "/docs/agent/mcp-quickstart.md"
  "/docs/api"
  "/docs/api.md"
  "/status"
  "/status.md"
  "/status/site-health"
  "/providers"
  "/providers.md"
  "/provider/openai"
  "/provider/anthropic"
  "/provider/google-ai"
  "/incidents"
  "/datasets"
  "/datasets/incidents"
  "/datasets/metrics"
  "/datasets/incidents.ndjson"
  "/datasets/metrics.csv"
  "/rss.xml"
  "/reports/weekly-ai-reliability"
  "/reports/monthly-provider-scorecards"
)

REPORT="${OUT_DIR}/visibility_report.json"
echo "[]" > "${REPORT}"

append_json () {
  local entry="$1"
  printf '%s\n' "${entry}" > /tmp/visibility-entry.$$
  jq ". + [input]" "${REPORT}" /tmp/visibility-entry.$$ > "${REPORT}.tmp" && mv "${REPORT}.tmp" "${REPORT}"
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

# extra checks
openapi_main=$(curl -s "${BASE}/openapi.json")
openapi_well=$(curl -s "${BASE}/.well-known/openapi.json")
openapi_match="false"
if [ "${openapi_main}" = "${openapi_well}" ]; then openapi_match="true"; fi
append_json "$(jq -n --arg url "__check__/openapi_match" --arg status "200" --arg match "$openapi_match" '{url:$url,status:($status|tonumber),match:($match=="true")}' )"

llms_body=$(curl -s "${BASE}/llms.txt")
llms_ok="true"
for req in "Start here:" "MCP server:" "OpenAPI:" "Plugin manifest:" "Datasets:" "Docs (Markdown):" "Citing:"; do
  echo "$llms_body" | grep -q "$req" || llms_ok="false"
done
append_json "$(jq -n --arg url "__check__/llms_required" --arg status "200" --arg ok "$llms_ok" '{url:$url,status:($status|tonumber),ok:($ok=="true")}' )"

robots_body=$(curl -s "${BASE}/robots.txt")
robots_ok="true"
echo "$robots_body" | grep -q "Sitemap:" || robots_ok="false"
for allow in "/ai" "/docs/" "/providers" "/datasets" "/llms.txt" "/rss.xml"; do
  echo "$robots_body" | grep -q "Allow: ${allow}" || robots_ok="false"
done
append_json "$(jq -n --arg url "__check__/robots_rules" --arg status "200" --arg ok "$robots_ok" '{url:$url,status:($status|tonumber),ok:($ok=="true")}' )"

sitemap_body=$(curl -s "${BASE}/sitemap.xml")
sitemap_ok="true"
for key in "/ai" "/docs" "/providers" "/datasets" "/incidents" "/reports/weekly-ai-reliability"; do
  echo "$sitemap_body" | grep -q "$key" || sitemap_ok="false"
done
append_json "$(jq -n --arg url "__check__/sitemap_contains" --arg status "200" --arg ok "$sitemap_ok" '{url:$url,status:($status|tonumber),ok:($ok=="true")}' )"

llms_full=$(curl -s "${BASE}/llms-full.txt")
llms_full_ok="true"
if [ ${#llms_full} -gt 1500000 ]; then llms_full_ok="false"; fi
append_json "$(jq -n --arg url "__check__/llms_full_size" --arg status "200" --arg ok "$llms_full_ok" '{url:$url,status:($status|tonumber),ok:($ok=="true")}' )"

ai_body=$(curl -s "${BASE}/ai")
mcp_link_ok="true"
echo "$ai_body" | grep -q "modelcontextprotocol.io/registry/aistatusdashboard" || mcp_link_ok="false"
append_json "$(jq -n --arg url "__check__/mcp_registry_link" --arg status "200" --arg ok "$mcp_link_ok" '{url:$url,status:($status|tonumber),ok:($ok=="true")}' )"

plugin_body=$(curl -s "${BASE}/.well-known/ai-plugin.json")
plugin_ok="true"
echo "$plugin_body" | grep -q "\"api\"" || plugin_ok="false"
echo "$plugin_body" | grep -q "openapi.json" || plugin_ok="false"
append_json "$(jq -n --arg url "__check__/ai_plugin_ok" --arg status "200" --arg ok "$plugin_ok" '{url:$url,status:($status|tonumber),ok:($ok=="true")}' )"

tools_body=$(curl -s -X POST -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' "${BASE}/mcp")
mcp_tools_ok="true"
echo "$tools_body" | grep -q "tools" || mcp_tools_ok="false"
append_json "$(jq -n --arg url "__check__/mcp_tools" --arg status "200" --arg ok "$mcp_tools_ok" '{url:$url,status:($status|tonumber),ok:($ok=="true")}' )"

incident_id=$(curl -s "${BASE}/api/public/v1/incidents?limit=1" | jq -r '.data.incidents[0].incident_id // empty')
if [ -n "$incident_id" ]; then
  inc_url="${BASE}/incidents/${incident_id}"
  inc_status=$(curl -s -o /dev/null -w "%{http_code}" "$inc_url")
  append_json "$(jq -n --arg url "$inc_url" --arg status "$inc_status" '{url:$url,status:($status|tonumber)}' )"
  cite_url="${BASE}/incidents/${incident_id}/cite"
  cite_status=$(curl -s -o /dev/null -w "%{http_code}" "$cite_url")
  append_json "$(jq -n --arg url "$cite_url" --arg status "$cite_status" '{url:$url,status:($status|tonumber)}' )"
fi

echo "Audit complete -> ${REPORT}"
