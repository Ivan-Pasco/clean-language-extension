Component: all
Issue Type: enhancement
Priority: high
Description: Each Clean Language component should have a `/bugs` slash command that pulls reported bugs from the error reporting system and guides the AI instance to fix them.

## Setup

Copy the template below to `.claude/commands/bugs.md` in each component's repo. Change the `COMPONENT_NAME` to the component's name.

## Components that need this

| Component | Folder | Component Name |
|-----------|--------|----------------|
| Compiler | clean-language-compiler | compiler |
| Framework | clean-framework | framework |
| Server | clean-server | server |
| Node Server | clean-node-server | node-server |
| Extension | clean-extension | extension |
| Manager | clean-manager | manager |
| UI | clean-ui | ui |
| Canvas | clean-canvas | canvas |

## Already done
- Compiler: `/bugs` command created in `.claude/commands/bugs.md`

## Template

The compiler's `.claude/commands/bugs.md` is the reference implementation. Each component should adapt it by:
1. Changing the component name from "compiler" to their component
2. Adjusting the subsystem list (e.g., framework has "routing, data, auth" instead of "parser, semantic, codegen")
3. Adjusting the test directory paths
