# Management

Project governance, coordination, and historical records for the Clean Language ecosystem.

## Structure

```
management/
├── PROJECT_MANAGEMENT_PRINCIPLES.md   ← Start here. 20 principles governing the project.
├── CLAUDE_CODE_TOOLING_STRATEGY.md    ← How to enforce the principles with hooks, skills, and automation.
├── ARCHITECTURE_BOUNDARIES.md         ← What each component IS and IS NOT responsible for.
├── component-prompts/                 ← Work instructions for specific components
│   ├── PROMPT-CLEAN-FRAMEWORK.md      ← Framework restructuring instructions
│   └── PROMPT-CLEEN-MANAGER.md        ← Manager plugin feature instructions
├── cross-component-prompts/           ← Issues found in component A that affect component B (124 prompts)
│   └── *.md                           ← Each prompt targets one component with one specific issue
└── reports/                           ← Point-in-time snapshots (historical, not authoritative)
    ├── COMPREHENSIVE_PROJECT_REVIEW.md
    ├── DYNAMIC-OPTIONS-IMPLEMENTATION-GUIDE.md
    ├── DYNAMIC-OPTIONS-IMPLEMENTATION-SUMMARY.md
    ├── EXECUTION_LAYER_COMPLIANCE_REPORT.md
    ├── GEMINI.md
    └── PHP-MCP-SERVER-SUMMARY.md
```

## What belongs here

- **Governance documents** — Principles, boundaries, policies that govern how work is done
- **Component prompts** — Detailed work instructions to be executed by an AI instance in a specific component
- **Cross-component prompts** — Issues that cross component boundaries (see Principle 8 in PROJECT_MANAGEMENT_PRINCIPLES.md)
- **Reports** — Historical snapshots of audits, reviews, and implementation summaries. These are reference material, not authoritative specifications.

## What does NOT belong here

- **Specifications** — Language spec lives in `spec/`, platform architecture in `platform-architecture/`
- **Code** — Each component has its own folder
- **Task tracking** — Each component has its own TASKS.md
- **Tutorials or books** — Those live in `books and content/`
