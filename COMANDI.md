### 1. Installare le dipendenze Node (una volta, o dopo pull)

```bash
cd /Users/scudobravo/Websites/CODEWHISPER && pnpm install
```

**Serve a:** scaricare i pacchetti del monorepo (frontend Savant, backend NestJS, ecc.) così `pnpm dev` e `pnpm dev:backend` funzionano.

---

### 2. Applicare le migration SQL su Supabase

Nel progetto **non** c’è `supabase/config.toml` per la CLI: le migration sono file in `supabase/migrations/`.

**Opzione A (tipica):** Supabase Dashboard → **SQL Editor** → incolla ed esegui i file **in ordine numerico** (`001` → `002` → … fino all’ultimo presente, inclusi `006_drills.sql` e `007_companies.sql` se non li hai mai applicati).

**Serve a:** creare/aggiornare tabelle e dati (sessioni, drill, companies, …) senza cui API e funzioni che leggono il DB falliscono o restano vuote.

*(Se in futuro configuri Supabase CLI col progetto collegato, potrai usare qualcosa tipo `supabase db push`; oggi non è obbligatorio.)*

---

### 3. Variabili d’ambiente

Assicurati che:

- **`services/backend/.env`** (o `../../.env` come da `nest` config) abbia URL/chiavi Supabase, Anthropic, ecc.
- **`apps/savant/.env`** (o root) abbia **`VITE_BACKEND_URL`** puntato al backend (es. `http://localhost:3000` se il Nest gira lì).

**Serve a:** il client chiama l’API, il backend parla a Supabase e a Claude/Gemini; senza questo le richieste falliscono.

---

### 4. Avviare il backend NestJS (terminale 1)

```bash
cd /Users/scudobravo/Websites/CODEWHISPER && pnpm dev:backend
```

**Serve a:** API REST (`/api/companies`, `/api/drills`, sessioni, auth), WebSocket **`/transcription`** per audio e suggerimenti in tempo reale. L’app desktop **non** è autosufficiente senza questo processo in dev.

---

### 5. Avviare Savant (Tauri + frontend) (terminale 2)

```bash
cd /Users/scudobravo/Websites/CODEWHISPER && pnpm dev
```

**Serve a:** compilare Rust (prima volta più lenta), avviare Vite e aprire la finestra Savant collegata al backend e al WebSocket.

---

### Riepilogo ordine operativo

| # | Comando / azione | Scopo |
|---|------------------|--------|
| 1 | `pnpm install` | Dipendenze monorepo |
| 2 | Eseguire le SQL su Supabase (Dashboard) | Schema + seed coerenti col codice |
| 3 | Controllare `.env` backend + `VITE_BACKEND_URL` | Connessioni servizi |
| 4 | `pnpm dev:backend` | Backend + WebSocket |
| 5 | `pnpm dev` | App Savant |

---

**Non** ho incluso `cargo test`, `cargo clippy`, `nest build`, build di produzione: servono a qualità/CI/release, **non** all’avvio quotidiano in locale. Se un giorno vuoi solo verificare che il Rust compili senza avviare l’UI: `cargo build -p savant-app` dalla root del repo (opzionale).