Component: Web Site Clean
Issue Type: enhancement
Priority: critical
Description: The Clean Language website project has 16 structural violations against the Frame framework specification. The project must be restructured to follow the correct Frame project conventions. This is likely caused by the manager's embedded (non-spec-compliant) framework code having scaffolded/built the project incorrectly.

Context: Architecture audit of the entire Clean Language ecosystem revealed that the website doesn't follow the framework specification for folder structure, file extensions, separation of concerns, or auto-detection conventions.

## Current Structure (Wrong)

```
Web Site Clean/
├── config.cln                    # DUPLICATE — remove
├── package.json                  # Node.js dependency — remove
├── app/
│   ├── config.cln                # Has explicit plugins: blocks — remove them
│   ├── client/
│   │   └── main.cln              # Non-standard folder — move to components/
│   ├── server/                   # Non-standard folder — rename to api/
│   │   ├── main.cln
│   │   ├── api.cln
│   │   ├── pages.cln             # HTML string-building — replace with templates
│   │   ├── helpers.cln
│   │   ├── static.cln
│   │   ├── errors_api.cln
│   │   └── errors_pages.cln
│   ├── ui/
│   │   ├── components/           # Move to app/components/
│   │   │   ├── Navbar.cln
│   │   │   ├── Footer.cln
│   │   │   ├── Hero.cln
│   │   │   ├── FeatureCard.cln
│   │   │   ├── ModuleCard.cln
│   │   │   └── SyntaxItem.cln
│   │   ├── layouts/              # Non-standard — integrate into pages/
│   │   │   └── main.html
│   │   ├── pages/                # Wrong extensions, wrong location
│   │   │   ├── index.html.cln
│   │   │   ├── docs.html.cln
│   │   │   ├── get-started.html.cln
│   │   │   ├── modules.html.cln
│   │   │   ├── syntax.html.cln
│   │   │   └── test.html.cln
│   │   └── styles/               # Non-standard — move to public/css/
│   │       └── theme.cln
│   └── data/
│       ├── migrations/           # Raw SQL — needs ORM models
│       │   ├── 001_schema.sql
│       │   ├── 002_error_reports.sql
│       │   └── 003_error_phases_2_6.sql
│       └── seed/
│           └── seed.sql
└── public/
    ├── 50x.html                  # Has inline <style> — extract to CSS
    ├── css/
    │   └── ...
    └── js/
        ├── bridge.js             # Legitimate runtime — keep
        ├── loader.js             # Legitimate runtime — keep
        └── dashboard.js          # Has inline styles — fix
```

## Target Structure (Correct)

```
Web Site Clean/
├── app/
│   ├── config.cln                # NO plugins: block (auto-detected)
│   ├── pages/                    # .html files ONLY
│   │   ├── index.html            # Pure HTML + {{ }} + cl-* directives
│   │   ├── docs.html
│   │   ├── get-started.html
│   │   ├── modules.html
│   │   └── syntax.html
│   ├── components/               # .cln files
│   │   ├── Navbar.cln            # NO plugins: block
│   │   ├── Footer.cln
│   │   ├── Hero.cln
│   │   ├── FeatureCard.cln
│   │   ├── ModuleCard.cln
│   │   └── SyntaxItem.cln
│   ├── api/                      # .cln files with endpoints: blocks
│   │   ├── main.cln              # Server start, route registration
│   │   ├── content.cln           # Content API endpoints
│   │   ├── errors.cln            # Error reporting endpoints
│   │   ├── static.cln            # Sitemap, robots
│   │   └── helpers.cln           # Shared helper functions
│   └── data/                     # .cln ORM models + migrations
│       ├── Page.cln              # data Page: { ... }
│       ├── Language.cln          # data Language: { ... }
│       ├── ErrorReport.cln       # data ErrorReport: { ... }
│       └── migrations/           # Auto-generated from model diffs
│           ├── 001_schema.sql
│           ├── 002_error_reports.sql
│           └── 003_error_phases_2_6.sql
└── public/
    ├── 50x.html                  # NO inline <style>
    ├── css/
    │   ├── main.css              # All styles here
    │   ├── dashboard.css
    │   └── error.css             # Extracted from 50x.html
    └── js/
        ├── bridge.js             # Legitimate runtime — keep
        └── loader.js             # Legitimate runtime — keep
```

## Step-by-Step Migration

### Step 1: Fix folder structure
```bash
# Move pages (and fix extension)
mkdir -p app/pages
for f in app/ui/pages/*.html.cln; do
    name=$(basename "$f" .html.cln)
    # Will need content transformation — see Step 3
    cp "$f" "app/pages/${name}.html"
done

# Move components
mv app/ui/components/ app/components/

# Rename server → api
mv app/server/ app/api/

# Move client logic into components (or delete if redundant)
# Review app/client/main.cln — if it's event handlers, make it a component

# Remove non-standard folders
rm -rf app/ui/
rm -rf app/client/
```

### Step 2: Remove explicit `plugins:` blocks from all files
Every `.cln` file in a recognized folder gets its plugins auto-detected. Remove:
```
plugins:
    frame.ui
```
from all component files, and:
```
plugins:
    frame.httpserver
    frame.data
```
from config files.

### Step 3: Fix page files — CRITICAL
Each page currently has `<script type="text/clean">` blocks containing database queries and business logic. This logic must be **moved to API endpoint files** in `app/api/`.

**Before (WRONG — index.html.cln):**
```html
<script type="text/clean">
    string lang = _req_query("lang")
    string sql = "SELECT pc.title, ..."
    string result = _db_query(sql, params)
</script>
<h1>{{ title }}</h1>
```

**After (CORRECT):**

`app/api/content.cln`:
```
endpoints:
    GET /api/page-data:
        handle:
            string lang = _req_query("lang")
            string sql = "SELECT pc.title, ..."
            string result = _db_query(sql, params)
            json(result)
```

`app/pages/index.html`:
```html
<h1>{{ title }}</h1>
<p>{{ description }}</p>
<ul cl-iterate="feature in features">
    <li>{{ feature.title }}</li>
</ul>
```

The server-side rendering pipeline should call the data-fetching logic and inject variables into the template automatically — pages should never contain data-fetching code.

### Step 4: Eliminate duplicated page logic in `app/server/pages.cln`
The file `app/server/pages.cln` (now at `app/api/pages.cln`) builds entire HTML pages via string concatenation (`__route_handler_6()` through `__route_handler_12()`). This duplicates what the template system should handle. Either:
- **Option A:** Keep the string-building approach in `app/api/` as route handlers (interim until SSR pipeline works) but remove the template files to avoid duplication
- **Option B:** Use the templates in `app/pages/` and delete the string-building handlers

**Recommended: Option A for now** (string-building handlers in `app/api/` are working), but rename functions from `__route_handler_N` to descriptive names like `renderHomePage()`, `renderDocsPage()`, etc. Then migrate to templates when the SSR pipeline is ready.

### Step 5: Create ORM model files
Add proper `data` model definitions in `app/data/`:

`app/data/Page.cln`:
```
data Page:
    integer id
    string slug
    string title
    string meta_description
    string content
    string language_code
    boolean is_published
    string created_at
    string updated_at
```

`app/data/Language.cln`:
```
data Language:
    integer id
    string code
    string name
    boolean is_default
```

`app/data/ErrorReport.cln`:
```
data ErrorReport:
    integer id
    string report_id
    string phase
    string error_type
    string message
    string created_at
```

Keep the existing SQL migrations as reference, but the ORM should eventually auto-generate migrations from these model definitions.

### Step 6: Extract inline styles
- Move the `<style>` block from `public/50x.html` into `public/css/error.css` and link it via `<link rel="stylesheet" href="/css/error.css">`
- Remove inline `style=` attributes from `app/api/errors_pages.cln` — use CSS classes instead
- Fix `public/js/dashboard.js` inline styles — use CSS classes

### Step 7: Clean up root files
- Delete root-level `config.cln` (keep only `app/config.cln`)
- Delete `package.json` (no Node.js dependencies needed — DB goes through Host Bridge)

### Step 8: Convert theme.cln to CSS
Convert `app/ui/styles/theme.cln` into a proper `public/css/theme.css` file. The Clean DSL for styles should compile to CSS — but since the file won't be in a recognized folder anymore, extract the actual CSS values and create a standard CSS file.

## Verification Checklist

After restructuring:
- [ ] No `.html.cln` files exist — all pages are `.html`
- [ ] No `app/ui/` folder exists
- [ ] No `app/server/` folder exists — API is in `app/api/`
- [ ] No `app/client/` folder exists
- [ ] No `plugins:` blocks in any file
- [ ] No `<script type="text/clean">` blocks in any page
- [ ] No inline `<style>` tags anywhere
- [ ] No inline `style=` attributes in `.cln` files
- [ ] No `package.json` at root
- [ ] No duplicate `config.cln` at root
- [ ] All components in `app/components/`
- [ ] All API endpoints in `app/api/`
- [ ] ORM model `.cln` files exist in `app/data/`
- [ ] All styles in `public/css/`

Files Affected:
- All files in app/ui/ (move to app/pages/, app/components/)
- All files in app/server/ (move to app/api/)
- app/client/main.cln (move or delete)
- app/config.cln (remove plugins: blocks)
- config.cln (delete root-level duplicate)
- package.json (delete)
- public/50x.html (extract inline styles)
- public/js/dashboard.js (fix inline styles)
- app/data/ (add ORM model .cln files)
