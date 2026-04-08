## Contesto progetto

Stai lavorando su un monorepo chiamato CODEWHISPER con due app Tauri 2 desktop:

- **DevOracle** (`apps/savant/`) — AI coach invisibile per colloqui tecnici (coding, system design, behavioral). Accent color: indigo #6366f1.
- **RingWise** (`apps/cue/`) — AI coach invisibile per chiamate di vendita B2B. Accent color: emerald #10b981.

### Stack tecnico
- **Frontend**: React 19 + TypeScript + Vite + Zustand + React Router v7 + Lucide React + CSS custom properties
- **Backend desktop**: Tauri 2 + Rust (crates condivisi in `crates/`)
- **Backend API**: NestJS 10 in `services/backend/` — porta 3000
- **Database**: Supabase (Postgres + pgvector + Auth)
- **AI**: Claude claude-opus-4-5 (suggestions) + Gemini 1.5 Flash (trascrizione audio)
- **WebSocket**: `tokio-tungstenite` Rust → NestJS `@nestjs/platform-ws` (native ws, NON Socket.IO)
- **State**: Zustand stores in `src/stores/` — authStore, sessionStore, stealthStore
- **IPC**: `apps/savant/src/lib/tauri.ts` e `apps/cue/src/lib/tauri.ts` wrappano `invoke()`
- **API HTTP**: `apps/savant/src/lib/api.ts` e `apps/cue/src/lib/api.ts`

### Convenzioni
- Rust crates prefissati `cw-` (es. `cw-transcription`, `cw-session-engine`)
- Tauri commands in `apps/[app]/src-tauri/src/commands/`
- Nessuna chiave API nel frontend — tutto lato backend NestJS
- Segreti nel vault Stronghold, mai in JSON plain
- CSS via custom properties: `var(--accent)`, `var(--bg-app)`, `var(--text-1)` ecc.
- Minimizza `unsafe` Rust — isola nei moduli FFI

### File chiave
- `Cargo.toml` (root) — workspace con tutti i crates
- `services/backend/src/modules/` — ai-gateway, question-bank, auth, sessions
- `supabase/migrations/001_initial.sql` — schema DB esistente
- `crates/transcription/src/pipeline.rs` — pipeline WebSocket Rust→NestJS
- `crates/session-engine/` — gestione stato sessione
- `crates/stealth-coordinator/` — stealth mode

