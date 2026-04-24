Component: clean-language-compiler (codegen)
Issue Type: bug — codegen invariant violation
Priority: high
Error Code: E007
Component in dashboard: compiler
Reported: 2026-04-18 21:29:06–21:29:12 UTC (7 distinct fingerprints in ~6 seconds)
Dashboard: https://errors.cleanlanguage.dev (compiler/open)

## Description
Codegen is producing WASM that fails `wasm-tools validate`. Seven distinct fingerprints were reported in a 6-second window, all variants of `E007 generated WebAssembly is invalid`:

| Fingerprint | Occ | Direction |
|---|---|---|
| 69ab616f | 2 | expected f64, found i32 |
| a32c82d6 | 2 | expected f64, found i32 |
| 4a2692eb | 2 | expected f64, found i32 |
| b142c4c6 | 1 | expected i32, found f64 |
| 96304614 | 1 | expected i32, found f64 |
| cbfd06f8 | 1 | expected i32, found f64 |
| a094fffc | 1 | expected i32, found f64 |

The burst pattern (7 uploads in 6 seconds from the same user) suggests a single user ran a test suite or multi-file compile and every file tripped a different codegen path.

## Suspected Cause
An `f64`/`i32` type is being emitted or consumed at the wrong place in the codegen pipeline. The mirrored "expected i32 found f64" and "expected f64 found i32" entries suggest this isn't a one-directional missing conversion — it is a path where type-tagging is lost somewhere after MIR lowering.

Likely suspects:
- Numeric literal coercion when the destination type is inferred late
- Binary operator codegen where operand types don't match the result type's lane
- Variable type mixed with generic/`any` context
- Missing `f64.convert_i32_s` / `i32.trunc_f64_s` emission on promotion/demotion boundaries

## Asks
1. Pull full payloads for the 7 fingerprints (`show_server_diagnostic` if available, or query `GET /api/v1/bugs/{fingerprint}`) to get each `minimal_repro`.
2. Cluster the reproductions — they likely fall into 2 or 3 distinct root causes (not 7).
3. Add MIR-level validation to catch type mismatches *before* WASM encoding, so the failure is reported against Clean source rather than a cryptic `type mismatch: expected X, found Y; offset N`.
4. Fix each cluster and add a regression test in `tests/cln/` per cluster.

## Framework-Side Status
No framework code changes are appropriate. The framework itself compiled cleanly against 0.30.72 during release v2.10.16 (CI run #77 succeeded). These reports came from end-user compile runs, not from framework CI.

## Verification
After fix:
- Re-run the clustered reproductions; each should compile and `wasm-tools validate` should pass.
- `cleen install` a new compiler patch.
- Users whose reports match these fingerprints will be notified via `check_reported_fixes` after `/resolve-fix E007 <version> "..."`.
