# Cross-Component Prompt: Server Setup for errors.cleanlanguage.dev

**Component:** Web Site Clean
**Issue Type:** feature
**Priority:** high
**Source Component:** clean-language-compiler (telemetry module)

---

## Context

The `errors.cleanlanguage.dev` DNS record is live and points to `165.227.62.95` (same server as `cleanlanguage.dev`). Two server issues block the Error Reporting API:

1. **SSL**: No certificate covers the subdomain — browsers and `reqwest` reject it (curl exit code 60)
2. **Nginx**: The subdomain 301 redirects to `cleanlanguage.dev` instead of being served independently

---

## What to Do

### 1. SSL Certificate

Add the subdomain to the existing Let's Encrypt certificate:

```bash
sudo certbot --nginx -d errors.cleanlanguage.dev
```

Or expand the existing cert:

```bash
sudo certbot certonly --expand -d cleanlanguage.dev -d errors.cleanlanguage.dev
```

### 2. Nginx Virtual Host

Create a server block for `errors.cleanlanguage.dev` that proxies to the same Clean Language website backend (same upstream as `cleanlanguage.dev`). The error reporting API routes will be handled by the application.

```nginx
server {
    listen 443 ssl;
    server_name errors.cleanlanguage.dev;

    # SSL certs (managed by certbot)
    ssl_certificate     /etc/letsencrypt/live/errors.cleanlanguage.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/errors.cleanlanguage.dev/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:<APP_PORT>;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name errors.cleanlanguage.dev;
    return 301 https://$host$request_uri;
}
```

Replace `<APP_PORT>` with whatever port the Clean Language website backend listens on.

### 3. Verify

```bash
sudo nginx -t && sudo systemctl reload nginx
curl https://errors.cleanlanguage.dev/api/health
```

Expected: `{"ok": true, "service": "clean-language-website"}` (existing health endpoint).

---

## After This Is Done

Execute the API routes prompt at `system-documents/cross-component-prompts/website-error-reporting-api.md` to add the error reporting endpoints.
