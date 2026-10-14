# Security Scan Allowlist

Tracks false positives excluded from the gitleaks scan (`.gitleaks.toml`).

## Rules

1. Confirm the finding is NOT a real secret. If it is real, rotate it first..
2. Add the narrowest possible exclusion (specific regex or path, not a wide wildcard)..
3. Record it in the table below in the same PR..

## Current allowlist

| Date | Rule / Pattern | Location | Why it's a false positive | Approved by |
|------|----------------|----------|---------------------------|-------------|
| _none yet_ | | | | |

## npm audit
Critical vulnerabilities fail the build. If a critical issue has no fix available,
document the package, advisory ID, and mitigation here before merging.
