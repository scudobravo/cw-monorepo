# Credenziali richieste — DevOracle

Questo file elenca tutte le chiavi API e credenziali che mi servono per completare lo sviluppo.
Forniscile nel formato indicato, su file `.env` o incollando direttamente in chat.

---

## Fase 3 — Backend + Auth (NestJS + Supabase)

### Supabase
Vai su [supabase.com](https://supabase.com) → crea progetto → **Settings → API**

```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # solo backend, mai nel client
```

### Upstash Redis
Vai su [upstash.com](https://upstash.com) → crea database Redis → **Details → REST API**

```
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...
```

---

## Fase 4 — Integrazione AI

### Google Gemini (trascrizione live)
Vai su [aistudio.google.com](https://aistudio.google.com) → **Get API Key**

```
GEMINI_API_KEY=AIza...
```

### Anthropic Claude (suggerimenti AI)
Vai su [console.anthropic.com](https://console.anthropic.com) → **API Keys**

```
ANTHROPIC_API_KEY=sk-ant-...
```

> ⚠️ Queste due chiavi vanno **solo sul backend NestJS**, mai nel client desktop.

---

## Fase 6 — Release & Signing (non urgente)

### macOS (Apple Developer)
Necessario per distribuire fuori dall'App Store e per il notarize.

```
APPLE_CERTIFICATE=          # contenuto del .p12 in base64
APPLE_CERTIFICATE_PASSWORD= # password del .p12
APPLE_SIGNING_IDENTITY=     # es. "Developer ID Application: Nome Cognome (TEAMID)"
APPLE_ID=                   # tua email Apple Developer
APPLE_PASSWORD=              # App-specific password (appleid.apple.com)
APPLE_TEAM_ID=               # 10 caratteri, es. "ABC123DEFG"
```

### Windows (Code Signing)
Necessario per evitare il warning SmartScreen.

```
WINDOWS_CERTIFICATE=         # .pfx in base64
WINDOWS_CERTIFICATE_PASSWORD=
```

---

## Note sul Question Bank (Fase 3b)

Il question bank usa **pgvector**, un'estensione già inclusa in Supabase — nessuna credenziale aggiuntiva. Basta abilitarla con:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
Gli embedding vengono generati con **Gemini `text-embedding-004`** (già coperto dalla chiave Gemini in Fase 4). Non servono altre chiavi.

---

## Riepilogo priorità

| Priorità | Servizio | Quando serve |
|----------|----------|-------------|
| 🔴 Alta | Supabase (URL + anon + service role) | Prima del backend (Fase 3) |
| 🔴 Alta | Upstash Redis (URL + token) | Prima del backend (Fase 3) |
| 🟡 Media | Gemini API key | Prima della trascrizione (Fase 4) |
| 🟡 Media | Anthropic API key | Prima dei suggerimenti AI (Fase 4) |
| 🟢 Bassa | Apple Developer creds | Solo per release firmato (Fase 6) |
| 🟢 Bassa | Windows certificate | Solo per release firmato (Fase 6) |
