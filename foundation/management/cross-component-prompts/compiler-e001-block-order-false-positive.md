Component: clean-language-compiler
Issue Type: bug
Priority: medium
Error Code: E001
Reported Instances: 5 (cbd0d4ff, 107fdaec, fb455512, 50ae5e00, d36338be — all 2026-04-17 00:50 UTC)
Compiler Version: 0.30.57

Description:
Parser rejects programs that declare `functions:` before `start:` with the error
"'start:' section is out of order — it must appear before 'functions:'". This
ordering constraint is not in the spec.

Spec Verification:
- spec/grammar.ebnf:544 defines `program = { empty_line } , { program_item , { empty_line } }`
  which is an unordered repetition.
- spec/grammar.ebnf:546-558 lists `program_item` alternatives including `start_block`
  and `functions_block` with no ordering relationship.
- spec/semantic-rules.md only constrains call-before-definition at the function
  level (line 171), not at the block level.

Conclusion:
The grammar permits top-level program items in any order. The compiler is
emitting a spurious ordering error. Per Principle 25, the spec is authoritative
and the implementation must be fixed to match.

Expected Behavior:
A program with `functions:` declared before `start:` must parse successfully.

Minimal Repro:
```clean
functions:
    integer add(integer a, integer b)
        return a + b

start:
    print(add(2, 3))
```
This should compile and print `5`. Currently it fails with E001.

Suggested Fix Location:
Search the parser for the ordering check that produces "must appear before
'functions:'". Likely in `src/parser/` — the rule should be removed entirely,
not relaxed, since the EBNF allows any order.

Files Likely Affected:
- src/parser/ (whichever file emits E001 with the "out of order" message)
- Possibly `src/error_codes.rs` or equivalent if the message text lives there

Acceptance:
- Repro above compiles and runs
- A regression test in `tests/cln/parser/` covers `functions:` before `start:`
- The 5 reported instances can be closed via /resolve-fix once a tagged release ships

Context:
Discovered while triaging cleanlanguage.dev error reports from clean-server. The
five reports arrived within 250ms of each other, indicating a single user hitting
the same false-positive repeatedly.
