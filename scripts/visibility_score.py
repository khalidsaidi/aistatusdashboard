#!/usr/bin/env python3
import json, pathlib

report_path = pathlib.Path("artifacts/visibility_report.json")
data = json.loads(report_path.read_text()) if report_path.exists() else []

def entry(url_suffix):
    for e in data:
        if e.get("url","").endswith(url_suffix):
            return e
    return {}

def check(url_suffix):
    return entry(url_suffix).get("status") == 200

def check_flag(flag_name):
    e = entry(flag_name)
    return e.get("ok") is True or e.get("match") is True

score = 0
sub = {"agent":0,"ai":0,"crawl":0,"authority":0}
failures = []

# A) Agent/tool discoverability (40)
if check_flag("__check__/mcp_registry_link"): score += 10; sub["agent"] += 10
else: failures.append("MCP registry link missing from /ai")
if check("/mcp"): score += 10; sub["agent"] += 10
else: failures.append("MCP endpoint not reachable")
if check("/openapi.json") and check_flag("__check__/openapi_match"): score += 10; sub["agent"] += 10
else: failures.append("OpenAPI mismatch or missing")
if check("/.well-known/ai-plugin.json") and check_flag("__check__/ai_plugin_ok"): score += 10; sub["agent"] += 10
else: failures.append("AI plugin manifest missing or invalid")

# B) AI ingestion friendliness (30)
if check_flag("__check__/llms_required"): score += 10; sub["ai"] += 10
else: failures.append("llms.txt missing required entries")
if check_flag("__check__/llms_full_size"): score += 5; sub["ai"] += 5
else: failures.append("llms-full.txt too large")
md_ok = all(check(u) for u in ["/docs.md","/docs/api.md","/docs/agent/mcp-quickstart.md","/status.md","/providers.md"])
if md_ok: score += 10; sub["ai"] += 10
else: failures.append("Markdown mirrors missing")
if check("/rss.xml"): score += 5; sub["ai"] += 5
else: failures.append("RSS missing")

# C) Crawl/index readiness (20)
if check("/robots.txt") and check_flag("__check__/robots_rules"): score += 5; sub["crawl"] += 5
else: failures.append("robots.txt rules missing")
if check("/sitemap.xml") and check_flag("__check__/sitemap_contains"): score += 5; sub["crawl"] += 5
else: failures.append("sitemap missing key URLs")
text_ok = all(entry(u).get("has_text") for u in ["/","/ai","/docs","/providers","/status"])
if text_ok: score += 5; sub["crawl"] += 5
else: failures.append("SSR text missing on public pages")
canon_ok = all(entry(u).get("canonical") for u in ["/ai","/docs","/providers","/status"])
if canon_ok: score += 5; sub["crawl"] += 5
else: failures.append("Canonical tags missing")

# D) Authority footprint readiness (10)
if check("/incidents") and check("/datasets"): score += 5; sub["authority"] += 5
else: failures.append("Incidents or datasets pages missing")
cite_entry = entry("/cite")
if cite_entry and cite_entry.get("status") == 200: score += 5; sub["authority"] += 5
else: failures.append("Incident cite endpoint missing")

summary = {"total": score, "subscores": sub, "failures": failures}
pathlib.Path("artifacts").mkdir(exist_ok=True)
pathlib.Path("artifacts/visibility_score.txt").write_text(json.dumps(summary, indent=2))
print(json.dumps(summary, indent=2))
