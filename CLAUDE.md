# Monorepo — DevOracle + RingWise

## Overview
Monorepo for two desktop AI products:
- **DevOracle** (`apps/devoracle/`) — real-time AI coaching for technical interviews
- **RingWise** (`apps/ringwise/`) — real-time AI coaching for B2B sales calls

Both built with **Tauri 2 + Rust** backend and **React + TypeScript** frontend.

## Architecture
- **Tauri 2** desktop apps: Rust backend process + webview frontend
- **Rust crates** in `crates/` for shared core logic (audio, stealth, session, etc.)
- **React + TypeScript** frontends in `apps/devoracle/src/` and `apps/ringwise/src/`
- **NestJS** backend in `services/backend/`
- Full architecture documented in `ARCHITECTURE.md`

## Commands

### Development
```bash
pnpm dev              # DevOracle Tauri dev mode
pnpm dev:ringwise     # RingWise Tauri dev mode
cargo test --workspace
cargo clippy --workspace
cargo fmt --all
```

### Build
```bash
pnpm build            # Build DevOracle for release
pnpm build:ringwise   # Build RingWise for release
```

## Project Structure
- `apps/devoracle/src-tauri/` - DevOracle Tauri Rust backend
- `apps/devoracle/src/` - DevOracle React frontend
- `apps/ringwise/src-tauri/` - RingWise Tauri Rust backend
- `apps/ringwise/src/` - RingWise React frontend
- `crates/` - Shared Rust crates (cw-core, cw-audio-capture, cw-stealth, etc.)
- `services/backend/` - NestJS SaaS backend (shared by both apps)
- `packages/` - Shared TypeScript packages

## Conventions
- Rust crate names prefixed with `cw-` (e.g., `cw-core`, `cw-stealth`)
- Tauri commands in `src-tauri/src/commands/`
- Frontend IPC wrappers in `src/lib/tauri.ts`
- State management via Zustand stores in `src/stores/`
- Product discriminator values: `"DevOracle"` and `"RingWise"` (used in DB + API)
- All AI provider API keys stay on the backend, never in the desktop client
- Secrets stored via Stronghold vault, never in plain JSON
- Minimize `unsafe` Rust - isolate in FFI modules only
