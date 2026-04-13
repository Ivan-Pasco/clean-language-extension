# /upstream — Upstream-First Failure Analysis

Analyze failures and recommend which to fix first based on Principle 15 (upstream-first).

## Usage
- `/upstream` — analyze current component
- `/upstream compiler` — analyze compiler failures

## Instructions

1. **Get current health data** by running `/health` if no recent baseline exists.

2. **Categorize all failures by pipeline stage:**
   - **Stage 1 — Parse**: File fails to parse (syntax error)
   - **Stage 2 — Type Check**: Parses but fails semantic analysis
   - **Stage 3 — Codegen**: Type-checks but fails WASM generation
   - **Stage 4 — Validation**: WASM generated but fails wasm-validate
   - **Stage 5 — Execution**: Valid WASM but wrong output or runtime error

3. **Apply upstream-first ordering:**
   - Fix Stage 1 failures before Stage 2
   - A single Stage 1 fix may resolve multiple downstream failures
   - Within a stage, prioritize by:
     a. Number of downstream failures it would unblock
     b. Whether it affects core language features vs. plugin features
     c. Whether a test already exists for it

4. **Report as a prioritized list:**
   ```
   Priority 1 (Stage 1 — Parse): [description] — blocks N downstream
   Priority 2 (Stage 1 — Parse): [description] — blocks N downstream
   Priority 3 (Stage 2 — TypeCheck): [description]
   ...
   ```

5. **Recommend the single highest-impact fix** to work on first.
