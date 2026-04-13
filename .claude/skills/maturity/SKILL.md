# /maturity — Component Maturity Assessment

Assess the maturity level of a component.

## Usage
- `/maturity` — assess current component
- `/maturity compiler` — assess a specific component

## Instructions

1. **Check component against maturity levels** (Principle 20):

   ### Foundation (Level 1)
   - Build succeeds
   - Basic tests pass
   - Core functionality works
   - Known fragile areas documented

   ### Stable (Level 2)
   - All unit tests pass
   - Integration tests pass
   - No critical workarounds
   - KNOWLEDGE.md up to date
   - Baseline health check exists

   ### Reliable (Level 3)
   - CI passes consistently
   - Regression tests in place
   - Cross-component contracts tested
   - No CRITICAL FIX markers in active paths

   ### Production (Level 4)
   - Full spec coverage tested
   - Performance benchmarked
   - Error handling complete
   - Documentation current

2. **Report current level** and what's needed for next level:
   ```
   Component: compiler
   Current Level: Foundation (1)
   
   To reach Stable (2):
   - [ ] All unit tests passing (currently 68/68)
   - [ ] Integration tests passing (currently 10/10)
   - [x] KNOWLEDGE.md exists
   - [ ] Remove 5 critical workarounds in active codegen path
   - [ ] Create baseline health check
   ```

3. **Recommend specific actions** to advance to the next level.
