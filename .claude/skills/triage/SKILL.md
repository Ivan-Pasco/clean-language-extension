# /triage — Cross-Component Prompt Triage

Review and prioritize cross-component prompts.

## Usage
- `/triage` — list all pending cross-component prompts
- `/triage compiler` — show prompts targeting the compiler

## Instructions

1. **Read all prompt files** in `management/cross-component-prompts/`
2. **Categorize by target component** and priority (critical/high/medium/low)
3. **Check if any are stale** — has the issue been fixed already?
4. **Report as a prioritized list:**
   ```
   [CRITICAL] Component: compiler — Description (from: server, date)
   [HIGH] Component: extension — Description (from: compiler, date)
   ...
   ```
5. **Recommend** which prompts to address first based on:
   - Priority level
   - Whether the target component is currently being worked on
   - Whether the issue blocks other work
