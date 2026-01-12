#!/usr/bin/env python3
import json, sys, requests

url = sys.argv[1] if len(sys.argv)>1 else "https://aistatusdashboard.com/openapi.json"
r = requests.get(url, timeout=15)
r.raise_for_status()
spec = r.json()
print("title:", spec.get("info", {}).get("title"))
print("version:", spec.get("info", {}).get("version"))
print("paths:", len(spec.get("paths", {})))
