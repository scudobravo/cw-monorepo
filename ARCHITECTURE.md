# DevOracle & RingWise - Architettura Completa (Tauri 2 + Rust)

## Panoramica

Due prodotti verticali "invisibili" che assistono l'utente in tempo reale durante call/colloqui, costruiti su un core condiviso. Il desktop client usa **Tauri 2** con backend nativo in **Rust** e frontend **React + TypeScript** nel webview.

---

## 1) Strati Principali

### A. Desktop Client (Tauri 2)

- **Backend nativo Rust** (processo core Tauri) - sostituisce il main process Electron
- **Frontend React + TypeScript** nel webview di sistema (WKWebView su macOS, WebView2 su Windows)
- **Tauri Commands** per IPC type-safe tra frontend e backend Rust
- **Tauri Events** per comunicazione bidirezionale real-time (push dal backend al frontend)
- Moduli nativi Rust per cattura audio/schermo (nessun addon Node necessario)
- **tauri-plugin-stronghold** per secure storage crittografato (alternativa al keychain)
- **tauri-plugin-updater** per auto-update con canali (stable, beta, alpha)
- **Stealth Coordinator** integrato nel processo Rust principale

**Vantaggi rispetto a Electron:**
- Binary ~10-15MB vs ~150MB
- RAM ~30-50MB vs ~150-300MB
- Accesso nativo diretto tramite Rust (no FFI/N-API overhead)
- Sicurezza: nessun Node.js nel main process, sandbox webview nativo
- Performance: Rust per operazioni CPU-intensive (audio processing, context assembly)

### B. Session Engine (Rust crate)

- Orchestrazione sessioni live come state machine Rust (enum + match)
- Audio buffering con ring buffer lock-free
- Turn detection basato su VAD (Voice Activity Detection)
- Gestione reconnect con backoff esponenziale
- Integrazione con Stealth Coordinator tramite canali async (tokio mpsc)

### C. AI Gateway

- **Lato client (Rust)**: thin client che prepara le request e gestisce streaming
- **Lato backend (NestJS)**: routing modelli, prompt templates, retry/fallback, logging
- Astrazione provider: Gemini, Claude, modelli mini
- Le API key dei provider **mai nel client** - tutte le chiamate passano dal backend
- Flag `stealth_mode` per adattare formato risposte

### D. Backend SaaS (Node.js + NestJS)

- Auth (Clerk/Auth0/Supabase)
- Licensing (entitlement engine)
- Billing (Stripe)
- Catalogo piani/pacchetti
- Usage metering
- Config remota (inclusi parametri stealth)
- Analytics
- Supporto/admin

### E. Data Layer

- PostgreSQL (dati principali)
- Redis (cache, session state, rate limiting)
- Object storage S3/R2 (artefatti, registrazioni)
- Event bus per telemetry

---

## 2) Tech Stack

### Desktop (Tauri 2 + Rust)

| Componente | Tecnologia | Note |
|---|---|---|
| Framework | Tauri 2.x | Processo core in Rust |
| Frontend | React 19 + TypeScript | Vite come bundler |
| State management | Zustand | Leggero, adatto a webview |
| Audio capture | `cpal` crate | Cross-platform audio I/O |
| Screen capture | `xcap` o `screenshots` crate | Screenshot programmatici |
| Secure storage | `tauri-plugin-stronghold` | Vault crittografato locale |
| SQLite locale | `rusqlite` + `tauri-plugin-sql` | Cache/sessioni locali |
| Auto-updater | `tauri-plugin-updater` | Canali alpha/beta/stable |
| System tray | `tauri-plugin-system-tray` | Icona e menu tray |
| Global hotkeys | `tauri-plugin-global-shortcut` | Per overlay stealth |
| Notifiche | `tauri-plugin-notification` | Feedback discreto |
| Window stealth | API native via Rust | `SetWindowDisplayAffinity` (Win), `CGWindowLevel` (macOS) |
| HTTP client | `reqwest` | Chiamate al backend |
| Async runtime | `tokio` | Concurrency nel backend Rust |
| Serialization | `serde` + `serde_json` | IPC e persistenza |
| Crash reporting | `sentry` crate | Crash reporting nativo |
| Haptic feedback | `enigo` crate | Simulazione input per feedback |
| Logging | `tracing` crate | Structured logging |

### Backend SaaS

| Componente | Tecnologia |
|---|---|
| Runtime | Node.js 20+ |
| Framework | NestJS |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Billing | Stripe |
| Auth | Clerk / Supabase Auth |
| Object Storage | AWS S3 / Cloudflare R2 |
| Job Queue | BullMQ |
| Observability | OpenTelemetry + Grafana |
| Deployment | Docker + Fly.io / Railway / AWS |

### AI

| Prodotto | Task | Modello |
|---|---|---|
| DevOracle | Realtime assist | Gemini Live |
| DevOracle | Reasoning/analysis | Claude Sonnet |
| DevOracle | Summary/recap | Modello mini |
| RingWise | Transcription | Gemini Flash Live |
| RingWise | Objection handling | Modello mini |
| RingWise | Deep analysis | Premium su richiesta |

---

## 3) Struttura Monorepo

```
CODEWHISPER/
├── apps/
│   └── desktop/                    # Tauri 2 app
│       ├── src-tauri/              # Backend Rust (Tauri core)
│       │   ├── Cargo.toml
│       │   ├── tauri.conf.json     # Config Tauri
│       │   ├── capabilities/       # Permissions Tauri 2
│       │   ├── icons/
│       │   └── src/
│       │       ├── main.rs         # Entry point
│       │       ├── lib.rs          # Setup e plugin registration
│       │       ├── commands/       # Tauri commands (IPC handlers)
│       │       │   ├── mod.rs
│       │       │   ├── session.rs
│       │       │   ├── audio.rs
│       │       │   ├── stealth.rs
│       │       │   ├── settings.rs
│       │       │   └── auth.rs
│       │       ├── modules/        # Logica applicativa
│       │       ├── stealth/        # Stealth coordinator
│       │       ├── audio/          # Audio capture integration
│       │       ├── screen/         # Screen context integration
│       │       ├── session/        # Session engine integration
│       │       └── plugins/        # Plugin Tauri custom
│       ├── src/                    # Frontend React
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── common/
│       │   │   ├── session/
│       │   │   ├── stealth/
│       │   │   ├── settings/
│       │   │   └── onboarding/
│       │   ├── hooks/              # React hooks (useSession, useStealth, etc.)
│       │   ├── stores/             # Zustand stores
│       │   ├── pages/
│       │   │   ├── home/
│       │   │   ├── session/
│       │   │   ├── settings/
│       │   │   ├── history/
│       │   │   └── auth/
│       │   ├── lib/                # Utilities, Tauri invoke wrappers
│       │   ├── styles/
│       │   └── assets/
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
│
├── crates/                         # Rust crates condivisi
│   ├── core/                       # Tipi e trait comuni
│   ├── audio-capture/              # Audio capture manager (cpal)
│   ├── screen-context/             # Screen context manager
│   ├── transcription/              # Transcription pipeline
│   ├── context-assembler/          # Context assembly
│   ├── inference/                  # Inference orchestrator
│   ├── suggestion/                 # Suggestion renderer backend
│   ├── session-engine/             # Session state machine
│   ├── stealth-coordinator/        # Stealth mode logic
│   ├── policy-guard/               # Entitlement verification
│   ├── secure-cache/               # Encrypted local cache
│   └── telemetry/                  # Metrics & diagnostics
│
├── packages/                       # Pacchetti TypeScript condivisi
│   ├── shared-types/               # Tipi TypeScript condivisi
│   ├── ai-gateway/                 # Client-side AI gateway types
│   └── ui-kit/                     # Componenti UI condivisi
│
├── services/
│   └── backend/                    # Backend NestJS
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── common/             # Guards, interceptors, pipes
│       │   ├── config/             # Environment config
│       │   └── modules/
│       │       ├── auth/
│       │       ├── billing/
│       │       ├── licensing/
│       │       ├── session/
│       │       ├── ai-gateway/
│       │       ├── config/
│       │       ├── admin/
│       │       ├── users/
│       │       └── telemetry/
│       ├── package.json
│       └── tsconfig.json
│
├── .github/workflows/
│   ├── ci.yml
│   └── release.yml
│
├── docs/
├── Cargo.toml                      # Workspace root
├── package.json                    # Workspace root (pnpm)
├── pnpm-workspace.yaml
└── ARCHITECTURE.md
```

---

## 4) Core Condiviso (Rust Crates)

### Moduli Core

| # | Crate | Responsabilita |
|---|---|---|
| 1 | `cw-core` | Tipi base, trait, error types, domain objects |
| 2 | `cw-audio-capture` | Cattura audio locale con `cpal`, gestione permessi OS |
| 3 | `cw-screen-context` | Cattura screenshot/contesto schermo |
| 4 | `cw-transcription` | Streaming trascrizione via WebSocket al backend |
| 5 | `cw-context-assembler` | Unione trascrizione + stato sessione + profilo + knowledge |
| 6 | `cw-inference` | Decisione tipo di suggerimento basato su contesto |
| 7 | `cw-suggestion` | Preparazione suggerimenti per il renderer frontend |
| 8 | `cw-session-engine` | State machine sessione (`Idle -> Active -> Paused -> Ended`) |
| 9 | `cw-stealth` | Stealth Coordinator: stato invisibilita, rilevamento call, canali output |
| 10 | `cw-policy-guard` | Verifica entitlement, cache firmata, gating feature |
| 11 | `cw-secure-cache` | Cache cifrata locale (AES-256-GCM) |
| 12 | `cw-telemetry` | Metriche, eventi, diagnostica |

### Domain Objects (in `cw-core`)

```rust
// Principali struct e enum
User, Workspace, Device, License, Subscription, Entitlement,
Session, SessionEvent, SessionState, TranscriptSegment,
ContextFrame, Suggestion, SuggestionType,
UsageRecord, FeatureFlag,
StealthConfig, StealthOutputChannel, CallState
```

---

## 5) IPC: Tauri Commands

Il frontend React comunica con il backend Rust tramite **Tauri Commands** (type-safe, async):

```rust
// Esempio: commands/session.rs
#[tauri::command]
async fn start_session(
    state: State<'_, SessionManager>,
    mode: SessionMode,
) -> Result<SessionInfo, AppError> {
    state.start(mode).await
}

#[tauri::command]
async fn stop_session(state: State<'_, SessionManager>) -> Result<SessionSummary, AppError> {
    state.stop().await
}
```

```typescript
// Esempio: frontend invoke
import { invoke } from '@tauri-apps/api/core';

const session = await invoke<SessionInfo>('start_session', { mode: 'interview' });
```

Per eventi push (suggerimenti live, stato stealth):

```rust
// Backend Rust emette eventi
app_handle.emit("suggestion", &suggestion)?;
app_handle.emit("stealth_state_changed", &new_state)?;
```

```typescript
// Frontend ascolta
import { listen } from '@tauri-apps/api/event';

await listen<Suggestion>('suggestion', (event) => {
    setSuggestion(event.payload);
});
```

---

## 6) Stealth Coordinator (Dettaglio Tauri 2)

### Rilevamento Call

```rust
// cw-stealth/src/detector.rs
pub enum CallDetectionMethod {
    /// Monitoraggio audio device attivi tramite API OS
    AudioDeviceMonitor,
    /// Rilevamento finestre di app meeting (Zoom, Teams, Meet)
    MeetingWindowDetector,
    /// Euristica: microfono attivo + finestra meeting in foreground
    Heuristic,
}
```

### Window Stealth con API Tauri 2

```rust
// Esclusione dalla registrazione schermo
#[cfg(target_os = "windows")]
fn exclude_from_capture(window: &tauri::WebviewWindow) {
    // SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)
    use windows::Win32::UI::WindowsAndMessaging::*;
    let hwnd = window.hwnd().unwrap();
    unsafe { SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE); }
}

#[cfg(target_os = "macos")]
fn exclude_from_capture(window: &tauri::WebviewWindow) {
    // NSWindow.sharingType = .none
    use cocoa::appkit::NSWindow;
    let ns_window = window.ns_window().unwrap() as cocoa::base::id;
    unsafe { ns_window.setSharingType_(cocoa::appkit::NSSharingType::NSWindowSharingNone); }
}
```

### Canali Output Privati

| Canale | Implementazione Tauri 2 |
|---|---|
| Secondo schermo | `WebviewWindowBuilder::new()` su monitor secondario, escluso da capture |
| Overlay temporaneo | Finestra trasparente, `always_on_top`, attivata da global shortcut |
| Feedback aptico | `enigo` crate per simulare input discreto |
| System tray hint | `tauri-plugin-notification` per notifica silenziosa |

---

## 7) Pipeline AI Live (con Stealth)

```
1. cw-audio-capture  -->  cattura audio locale (cpal)
2. session-engine    -->  chunking + buffering (ring buffer)
3. reqwest/tungstenite --> streaming al backend via WebSocket
4. Backend AI Gateway --> provider (Gemini/Claude) --> trascrizione
5. cw-context-assembler --> contesto completo
6. cw-inference      -->  tipo suggerimento
7. cw-stealth        -->  decisione canale output:
   |
   ├── Se NON in call: suggerimento nella finestra principale
   ├── Se in call + secondo schermo: finestra dedicata
   ├── Se in call + overlay: finestra trasparente (hotkey)
   └── Se in call + aptico: vibrazione + notifica tray
8. Tauri Event       -->  push al frontend ("suggestion" event)
9. cw-telemetry      -->  tracking evento
```

---

## 8) Feature Day 1

### Desktop / UX
- Onboarding guidato con spiegazione stealth
- Test microfono/audio e permessi schermo
- Selezione input device
- Start/stop sessione (manuale e automatico)
- Suggerimenti live con visualizzazione privata
- Transcript live
- Session history e replay
- Impostazioni account e piano
- Auto-update (stable/beta/alpha)
- Diagnostica
- **Stealth settings:**
  - "Nascondi automaticamente durante le call" (on/off)
  - Canale output: secondo schermo / segnale aptico / overlay con hotkey
  - Hotkey personalizzabile (default: Ctrl+H / Cmd+H)
  - "Escludi finestra dalla registrazione schermo"

### SaaS / Business
- Registrazione/login
- Checkout Stripe
- Gestione subscription e pacchetti
- Portale fatture
- Trial, coupon, referral
- Feature flags per piano
- Admin dashboard

### Sicurezza
- Segreti in Stronghold vault, mai in JSON
- Cifratura locale per cache (AES-256-GCM via Rust)
- TLS ovunque
- API key provider mai nel client
- Tauri 2 Capabilities (permissions granulari per plugin)
- Signed auto-updates con verifica firma
- Rate limiting

---

## 9) DevOracle - Feature Specifiche

**MVP:** Mock interview, behavioral/tech/coding/system design modes, transcript live, hint mode, explanation mode, recap + scorecard.

**Avanzato:** Riconoscimento tipo problema, lettura contesto editor, rubriche personalizzate, banca domande, feedback speaking clarity, time management, weak areas tracker, practice packs.

**Stealth:** Durante colloquio reale, interfaccia nascosta. Suggerimenti via canale privato. Overlay attivabile con hotkey.

## 10) RingWise - Feature Specifiche

**MVP:** Note automatiche, objection detection, next best response, recap post-call, next steps, summary email draft, call goals.

**Avanzato:** Battlecards, product snippets, competitor handling, CRM sync, deal coaching, team analytics, manager review, scorecard, template follow-up.

**Stealth:** Durante call, nessun pop-up. Suggerimenti su secondo schermo o via haptic. Consultazione su dispositivo secondario via WebSocket locale.

---

## 11) Licensing e Verifica

- Entitlement Service centrale
- All'avvio: `GET /entitlements/resolve` -> snapshot firmato con TTL
- Offline: cache firmata valida 24-72h, poi modalità limitata
- Gating stealth features controllato dal backend
- Piani: DevOracle (Free, Interview Pass, Monthly, Pro) / RingWise (Starter, Pro, Team, Enterprise)

---

## 12) Telemetry

**Metriche stealth aggiuntive:**
- % sessioni con stealth attivo
- Tempo medio in stealth
- Utilizzo canali privati
- Feedback utente post-sessione

**Eventi:**
- `stealth_mode_activated` / `deactivated`
- `suggestion_delivered_privately` (con canale)
- `hotkey_peek_triggered`

---

## 13) Build e Rilascio

### Tauri 2 Build Pipeline

```yaml
# CI: test e build
- cargo test --workspace          # Test tutti i crate Rust
- cargo clippy --workspace        # Lint Rust
- pnpm test                       # Test frontend
- pnpm build                      # Build frontend (Vite)
- cargo tauri build               # Build app nativa

# Release: per piattaforma
- macOS: .dmg + .app (firmato + notarizzato con Apple)
- Windows: .msi + .exe (firmato con certificato EV)
```

### Auto-Update (Tauri Updater)

```json
// tauri.conf.json
{
  "plugins": {
    "updater": {
      "endpoints": ["https://releases.codewhisper.ai/{{target}}/{{arch}}/{{current_version}}"],
      "pubkey": "...",
      "windows": { "installMode": "passive" }
    }
  }
}
```

Canali: `stable`, `beta`, `alpha` gestiti dal backend releases.

---

## 14) Roadmap Tecnica

### Fase 1 - Foundation
Monorepo, auth, billing, licensing, Tauri shell, Stronghold, CI/CD.

### Fase 2 - Core Live Session
Audio capture (cpal), transcript streaming, session state machine, AI gateway, primo loop suggerimenti.

### Fase 3 - Productization
Session history, summaries, package consumption, subscription gating, telemetry, updater.

### Fase 4 - Stealth Features
Rilevatore call OS, modalità headless, secondo schermo, canale aptico, overlay con esclusione registrazione.

### Fase 5 - Verticalization
DevOracle interview modes, RingWise objection & recap, pricing, admin.

### Fase 6 - Hardening
Crash fixes, observability, cost controls, rollout channels, enterprise privacy.

---

## 15) Anti-Pattern (da evitare)

- API key provider nel client
- File JSON in chiaro per licenze/segreti
- UX legata a un solo provider AI
- Logica prodotto mischiata con cattura hardware
- Billing solo nel client
- Flag locali non firmati
- Singola UX per entrambe le verticali
- App companion mobile (fuori scope)
- `unsafe` Rust non necessario (minimizzare, isolare in moduli FFI)
- Bloccare il main thread Tauri con operazioni sync pesanti
