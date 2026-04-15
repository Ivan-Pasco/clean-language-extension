# /triage — Error Report Triage

Review and prioritize open error reports from the error dashboard.

## Usage
- `/triage` — review all open error reports
- `/triage compiler` — show reports targeting the compiler

## Instructions

1. **Query the error dashboard** for open/unresolved reports. If the website API is available, use it. Otherwise, check the error database directly.

2. **Categorize by target component** and severity (critical/high/medium/low)

3. **Check if any are stale** — has the issue been fixed already in the latest compiler version? If so, mark as resolved.

4. **Report as a prioritized list:**
   ```
   [CRITICAL] Component: compiler — Description (fingerprint: ABC, reports: N)
   [HIGH] Component: server — Description (fingerprint: DEF, reports: N)
   ...
   ```

5. **Recommend** which reports to address first based on:
   - Severity and frequency (how many reports with the same fingerprint)
   - Whether the target component is currently being worked on
   - Whether the issue blocks other work
