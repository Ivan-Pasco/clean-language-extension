# Compiler Enhancement — Multi-line Strings

Component: clean-language-compiler
Issue Type: enhancement
Priority: medium
Description: Add multi-line string support so SQL queries and HTML blocks can be written readably across multiple lines.

---

## Problem

All strings must be single-line. SQL queries that are 200+ characters become unreadable:

```clean
string sql = "SELECT COALESCE(CONCAT('[', GROUP_CONCAT(JSON_OBJECT('fingerprint', fingerprint, 'error_code', error_code, 'fixed_in_version', COALESCE(fixed_in_version, ''), 'fix_description', COALESCE(fix_description, ''), 'occurrence_count', occurrence_count) SEPARATOR ','), ']'), '[]') as fixes FROM error_fingerprints WHERE status = 'resolved' AND fixed_in_version >= ?"
```

## Proposed Syntax

Triple-quote or backtick multi-line strings:

```clean
string sql = """
    SELECT COALESCE(
        CONCAT('[', GROUP_CONCAT(
            JSON_OBJECT(
                'fingerprint', fingerprint,
                'error_code', error_code,
                'fixed_in_version', COALESCE(fixed_in_version, '')
            ) SEPARATOR ','
        ), ']'), '[]'
    ) as fixes
    FROM error_fingerprints
    WHERE status = 'resolved'
    AND fixed_in_version >= ?
"""
```

## Impact

- SQL queries become readable and maintainable
- HTML templates can span multiple lines
- Debugging SQL errors becomes feasible (you can see the query structure)
- No functional change to compiled output — just developer experience

## Implementation Notes

- Strip leading whitespace based on closing delimiter indentation (like Kotlin `trimIndent()`)
- Newlines within the string become literal `\n` in the compiled output
- For SQL, newlines are equivalent to spaces so no behavior change
- Could combine with string interpolation for maximum impact
