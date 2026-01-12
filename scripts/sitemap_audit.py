#!/usr/bin/env python3
import requests, sys, xml.etree.ElementTree as ET

url = sys.argv[1] if len(sys.argv)>1 else "https://aistatusdashboard.com/sitemap.xml"
r = requests.get(url, timeout=15)
r.raise_for_status()
root = ET.fromstring(r.text)
locs = [loc.text for loc in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
print(f"urls:{len(locs)}")
for key in ["/ai","/llms.txt","/llms-full.txt","/openapi.json","/docs","/providers","/datasets"]:
    present = any(key in l for l in locs)
    print(f"{key}: {present}")
