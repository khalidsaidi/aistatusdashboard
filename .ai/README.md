# .ai Notes (Codex/Agent)

This folder contains agent-created artifacts to help you understand the repo, current deployments, and known gaps.

## Files

- `REPO_OVERVIEW.md`: High-level architecture and code map (current working tree).
- `DEPLOYMENT_NOTES.md`: What’s actually deployed today (now Firebase App Hosting), plus mismatch notes.
- `GAPS_AND_ISSUES.md`: Gaps/issues found in the current working tree, with suggested fixes and priorities.
- `RECOMMENDED_PLAN.md`: Concrete options to get to a consistent deployable state (Firebase vs non-Firebase).

## Snapshots (generated)

- `git-status.txt`: `git status --porcelain` snapshot.
- `git-diffstat.txt`: `git diff --stat` snapshot.
- `deployment-curl.txt`: Curl-based deployment checks (dev/prod Hosting + Functions).

## Safety

This folder is Git-ignored and may include deployment-only artifacts (for example, `.ai/creds/firebase-adminsdk.json`) required for local CLI auth. Treat them as secrets and rotate if leaked.
