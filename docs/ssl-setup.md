# SSL Certificate Setup

**Status:** Phase 8 — Go-Live Preparation
**Server:** metalduet (45.124.55.87)
**Domains:** `ringsidesports.com.au`, `api.ringsidesports.com.au`, `admin.ringsidesports.com.au`

---

## Architecture

```
Browser/Client
    │
    ▼
Cloudflare (TLS termination — proxied DNS)
    │
    ├── ringsidesports.com.au  → Cloudflare Pages (CF-managed cert)
    │
    └── api.ringsidesports.com.au  → Cloudflare → Caddy → Backend :9000
        admin.ringsidesports.com.au → Cloudflare → Caddy → Backend :9000
```

### Decision: Let's Encrypt via Caddy + Cloudflare Full (Strict)

**Option A — Let's Encrypt via Caddy (Chosen):**
- Caddy auto-provisions and auto-renews Let's Encrypt certs
- Works with Cloudflare proxying when using DNS-01 challenge
- Zero manual cert renewal — Caddy handles it silently
- Free, industry-standard CA

**Option B — Cloudflare Origin CA:**
- Requires Cloudflare-managed origin cert installed on Caddy
- 15-year validity (less renewal risk)
- But: cert only trusted by Cloudflare (not usable without CF proxying)
- **Not chosen** — Let's Encrypt is simpler and just as secure behind CF

**Option C — Cloudflare Full (not Strict):**
- Uses self-signed cert on origin, CF doesn't validate
- Less secure — **rejected**

---

## Setup Commands

### 1. Install Caddy with Cloudflare DNS Plugin

Caddy needs the Cloudflare DNS plugin for DNS-01 challenge (required because Cloudflare proxies the traffic and HTTP-01 challenge won't work through the proxy).

```bash
# SSH to server
ssh root@45.124.55.87

# Install Caddy (if not already installed)
# Option A: Install via official script
curl -1sLf 'https://dl.cloudflare.com/caddy/release/latest?os=linux&arch=amd64' | tar -xz -C /usr/local/bin caddy

# Option B: Install with Cloudflare DNS module (preferred)
# Download xcaddy to build custom Caddy
go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest

# Build Caddy with Cloudflare DNS plugin
~/go/bin/xcaddy build \
  --with github.com/caddy-dns/cloudflare

# Move binary to system path
mv caddy /usr/local/bin/caddy
sudo setcap 'cap_net_bind_service=+ep' /usr/local/bin/caddy
```

### 2. Create Cloudflare API Token for DNS Challenge

1. Go to Cloudflare Dashboard → Profile → API Tokens
2. Create token with permissions:
   - Zone → DNS → Edit
   - Zone → Zone → Read
3. Restrict to `ringsidesports.com.au` zone
4. Save the token

### 3. Configure Caddyfile

Create/update `/etc/caddy/Caddyfile`:

```caddy
# Ringside Sports — Caddy Configuration
# Caddy auto-provisions Let's Encrypt certs via DNS-01 challenge
# TLS termination happens at Caddy, then proxies to Medusa backend

{
    # Cloudflare API token for DNS-01 challenge
    # Store in /etc/caddy/.env or pass via environment
    acme_dns cloudflare {env.CF_API_TOKEN}
}

api.ringsidesports.com.au {
    reverse_proxy 127.0.0.1:9000
    encode gzip

    header {
        # Security headers
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    log {
        output file /var/log/caddy/api-access.log
    }
}

admin.ringsidesports.com.au {
    reverse_proxy 127.0.0.1:9000

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Frame-Options "DENY"
    }

    log {
        output file /var/log/caddy/admin-access.log
    }
}
```

### 4. Create Environment File

```bash
# /etc/caddy/.env
CF_API_TOKEN=<cloudflare-dns-edit-token>
```

### 5. Create Systemd Service

```bash
cat > /etc/systemd/system/caddy.service << 'EOF'
[Unit]
Description=Caddy Web Server
Documentation=https://caddyserver.com/docs/
After=network.target network-online.target
Requires=network-online.target

[Service]
Type=notify
User=caddy
Group=caddy
EnvironmentFile=/etc/caddy/.env
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
TimeoutStopSec=5s
LimitNOFILE=1048576
LimitNPROC=512
PrivateTmp=true
ProtectSystem=full
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

# Create caddy user
useradd --system --home-dir /etc/caddy --shell /bin/false caddy

# Create log directory
mkdir -p /var/log/caddy
chown caddy:caddy /var/log/caddy

# Enable and start
systemctl daemon-reload
systemctl enable caddy
systemctl start caddy
```

### 6. Verify Certificates

```bash
# Check Caddy is serving HTTPS
curl -sI https://api.ringsidesports.com.au/health
curl -sI https://admin.ringsidesports.com.au/health

# Verify certificate details
echo | openssl s_client -servername api.ringsidesports.com.au -connect api.ringsidesports.com.au:443 2>/dev/null | openssl x509 -noout -dates -issuer -subject
# Expected: issuer = Let's Encrypt, subject = api.ringsidesports.com.au

echo | openssl s_client -servername admin.ringsidesports.com.au -connect admin.ringsidesports.com.au:443 2>/dev/null | openssl x509 -noout -dates -issuer -subject
# Expected: issuer = Let's Encrypt, subject = admin.ringsidesports.com.au

# Check certificate expiry
echo | openssl s_client -servername api.ringsidesports.com.au -connect api.ringsidesports.com.au:443 2>/dev/null | openssl x509 -noout -enddate
```

---

## Cloudflare SSL/TLS Settings

In Cloudflare Dashboard → ringsidesports.com.au → SSL/TLS:

| Setting | Value | Reason |
|---------|-------|--------|
| **SSL/TLS encryption mode** | **Full (strict)** | Requires valid origin cert (Caddy provides Let's Encrypt). Most secure option. |
| **Always Use HTTPS** | On | Redirect all HTTP to HTTPS |
| **Minimum TLS Version** | TLS 1.2 | PCI compliance |
| **Opportunistic Encryption** | On | |
| **TLS 1.3** | On | Modern browsers support it |
| **Automatic HTTPS Rewrites** | On | Fix mixed content |

---

## Renewal

- **Let's Encrypt certs auto-renew** via Caddy (attempts renewal at ⅔ of cert lifetime)
- Cert lifetime is 90 days → renewal at ~60 days
- Caddy retries every 12 hours if renewal fails
- No manual intervention needed unless:
  - Cloudflare API token expires
  - DNS configuration changes break DNS-01 challenge
  - Caddy service is stopped for >30 days

### Manual Renewal Check

```bash
ssh root@45.124.55.87
systemctl status caddy | grep "certificate"
# Or check cert expiry directly
echo | openssl s_client -servername api.ringsidesports.com.au -connect 127.0.0.1:443 2>/dev/null | openssl x509 -noout -enddate
```

### Renewal Failure Alert

If Caddy cannot renew:
1. Check Cloudflare API token is still valid
2. Verify DNS records for `_acme-challenge.api.ringsidesports.com.au` TXT records are being created
3. Check Caddy logs: `journalctl -u caddy -n 100`

---

## ringsidesports.com.au (Root Domain)

The root domain is served by **Cloudflare Pages** — TLS is handled automatically by Cloudflare. No origin cert needed.

- Cloudflare provisions and renews the edge certificate automatically
- The certificate covers `ringsidesports.com.au` and `*.ringsidesports.com.au`
- No manual setup required beyond pointing DNS to Cloudflare Pages

---

**Related docs:**
- Cutover: `docs/runbooks/cutover.md`
- Incident Response: `docs/runbooks/incident-response.md`
