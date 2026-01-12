#!/usr/bin/env python3
import json, sys, pathlib

report_path = pathlib.Path("artifacts/visibility_report.json")
if not report_path.exists():
    print("0")
    sys.exit(1)

with report_path.open() as f:
    data = json.load(f)

def ok(url):
    for e in data:
        if e["url"].endswith(url):
            return e["status"] == 200
    return False

score = 0
sub = {"agent":0,"ai":0,"crawl":0,"authority":0}

# Agent/tool discoverability
for url in ["/mcp","/openapi.json","/.well-known/ai-plugin.json","/ai"]:
    if ok(url): score += 10; sub["agent"] += 10

# AI ingestion friendliness
for url in ["/llms.txt","/llms-full.txt","/docs.md","/rss.xml"]:
    if ok(url): score += 5; sub["ai"] += 5

# Crawl readiness
for url in ["/robots.txt","/sitemap.xml","/","/providers"]:
    if ok(url): score += 5; sub["crawl"] += 5

# Authority footprint
if ok("/datasets"): score +=5; sub["authority"] +=5
if ok("/incidents"): score +=5; sub["authority"] +=5

summary = {
    "total": score,
    "subscores": sub,
}
out_path = pathlib.Path("artifacts/visibility_score.txt")
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(str(summary))
print(json.dumps(summary, indent=2))
