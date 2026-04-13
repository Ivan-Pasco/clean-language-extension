# /health — Component Health Check

Run a full health check for a Clean Language component.

## Usage
- `/health` — check the current component (detected from PWD)
- `/health compiler` — check the compiler
- `/health server` — check the server
- `/health extension` — check the extension
- `/health manager` — check the manager
- `/health all` — check all components

## What It Does

For each component, run the appropriate build and test commands. Categorize failures by pipeline stage (parse, typecheck, codegen, execution). Compare against baseline if one exists.

## Instructions

1. **Detect the target component** from the argument or PWD:
   - `compiler` → `clean-language-compiler/`
   - `server` → `clean-server/`
   - `extension` → `clean-extension/`
   - `manager` → `clean-manager/`
   - `framework` → `clean-framework/`

2. **Run health checks** appropriate to the component:

   ### Compiler
   ```bash
   # Rust build
   cd clean-language-compiler && cargo check
   
   # Unit tests
   cargo test --lib 2>&1
   
   # Integration tests  
   cargo test --test integration 2>&1
   
   # Compile all .cln test files
   for f in tests/cln/**/*.cln; do
     cargo run --bin cln -- compile "$f" --output "/tmp/health_$(basename $f .cln).wasm" 2>&1
   done
   ```

   ### Server
   ```bash
   cd clean-server && cargo check && cargo test 2>&1
   ```

   ### Extension
   ```bash
   cd clean-extension && npm run compile && npm test 2>&1
   ```

   ### Manager
   ```bash
   cd clean-manager && cargo check && cargo test 2>&1
   ```

3. **Categorize results**:
   - Build: PASS/FAIL
   - Unit tests: X passed, Y failed
   - Integration tests: X passed, Y failed
   - .cln compilation: X passed, Y failed (compiler only)
   - .cln execution: X passed, Y failed (compiler only, if wasmtime available)

4. **Compare to baseline** if `tests/results/baseline_<component>.json` exists:
   - Report regressions (previously passing, now failing)
   - Report improvements (previously failing, now passing)
   - Report unchanged failures

5. **Save new baseline** to `tests/results/baseline_<component>.json` with format:
   ```json
   {
     "component": "compiler",
     "timestamp": "2026-04-12T...",
     "build": "PASS",
     "unit_tests": {"passed": N, "failed": N, "total": N},
     "integration_tests": {"passed": N, "failed": N, "total": N},
     "cln_compile": {"passed": N, "failed": N, "failures": ["file1.cln", ...]},
     "cln_execute": {"passed": N, "failed": N, "failures": ["file1.cln", ...]}
   }
   ```

6. **Report summary** in a clear table format.
