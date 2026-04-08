# Savant — Specifiche delle Feature

> **Prodotto**: Savant — AI Coach per Colloqui Tecnici
> **Utenti target**: Sviluppatori software che si preparano a colloqui tecnici (FAANG, scale-up, startup)
> **Valore core**: Assistenza AI invisibile e in tempo reale durante colloqui di coding live e screening comportamentali

---

## 1. Feature Core (implementate o in corso)

### 1.1 Session Engine
- Avvio e stop di una sessione di coaching via Tauri IPC (`start_session`, `stop_session`)
- Modalità di sessione:
  - **Mock Interview** — simulazione completa di un colloquio con domande casuali estratte dal question bank
  - **Behavioral / Tech** — domande miste soft-skills e tecniche con supporto al framework STAR
  - **Coding Interview** — focalizzato su algoritmi e strutture dati con hint a livello di codice
  - **System Design** — problemi di architettura; prompt per capacity estimation, trade-off, teorema CAP
- Metadati di sessione salvati (id, modalità, started_at, durata)

### 1.2 Trascrizione Audio in Tempo Reale
- Microfono catturato via `cpal` (cross-platform: macOS e Windows)
- Audio inviato al backend NestJS come chunk WAV base64 tramite WebSocket
- Backend trascrive con **Gemini 1.5 Flash** (bassa latenza, alta accuratezza)
- Segmenti di trascrizione mostrati in un pannello scorrevole in tempo reale nella `SessionPage`

### 1.3 Suggerimenti AI di Coaching
- Ogni segmento di trascrizione viene analizzato lato server da **Claude claude-opus-4-5** con un system prompt specializzato per colloqui tecnici
- Pipeline cache-first: domande identiche o simili servite dal question bank pgvector (soglia 0.92) — zero token consumati
- Tipi di suggerimento:
  - `hint` — indicazione direzionale senza rivelare la soluzione
  - `clarification` — domanda suggerita da porre all'intervistatore
  - `approach` — strategia ad alto livello per affrontare il problema
  - `code_snippet` — pseudocodice o snippet concreto
  - `follow_up` — domanda di approfondimento anticipata con preparazione
- I suggerimenti appaiono nel pannello destro man mano che arrivano

### 1.4 Modalità Stealth
- Attivazione tramite hotkey globale (default `Cmd+H` / `Ctrl+H`)
- **Esclusione dalla registrazione schermo**: `NSWindowSharingNone` su macOS, `SetWindowDisplayAffinity` su Windows
- Si attiva automaticamente quando vengono rilevati processi `zoom`, `teams`, `meet`, `webex` (polling ogni 5 s)
- Canali di output: overlay trasparente, secondo schermo, tray di sistema, haptic (pianificato)
- Pill stealth visibile nella sidebar; stato persistito nel `StealthCoordinator`

### 1.5 Autenticazione
- Auth Supabase con email e password (accesso / registrazione / logout)
- JWT passato al backend su ogni richiesta API e nel messaggio `start_session` via WebSocket
- Guard `RequireAuth` in React Router — utenti non autenticati reindirizzati a `/auth`

### 1.6 Question Bank (cache semantica)
- Ogni domanda a cui Claude risponde viene salvata in Supabase Postgres con embedding `VECTOR(768)`
- Le domande successive simili (cosine similarity ≥ 0.92) vengono servite dal DB — risposta istantanea, 0 token API
- `asked_count` incrementato a ogni cache hit
- Le domande più frequenti mostrate nella `HistoryPage` con badge di frequenza

### 1.7 Storico
- Lista delle sessioni passate con modalità, data, durata e numero di suggerimenti ricevuti
- Pannello "Domande frequenti" con le domande più poste e la loro frequenza
- Filtro per modalità (in arrivo)

### 1.8 Impostazioni
- Selezione del dispositivo microfono
- Toggle stealth + checkbox auto-hide + esclusione da screen capture
- Selezione canale di output (overlay / secondo schermo / tray / haptic)
- Visualizzazione versione app

---

## 2. Feature Pianificate

### 2.1 Overlay per Editor di Codice
- Seconda finestra Tauri trasparente sempre in primo piano che si sovrappone all'IDE
- Mostra hint inline senza cambiare contesto
- Attivabile separatamente dalla finestra principale; esclusa da screen capture

### 2.2 Scorecard e Riepilogo
- Al termine della sessione, Claude genera una scorecard strutturata:
  - Approccio alla risoluzione del problema (1–10)
  - Qualità del codice (1–10)
  - Chiarezza comunicativa (1–10)
  - Gestione del tempo
  - Aree di miglioramento con azioni concrete
- Scorecard salvata per sessione; visibile nello Storico

### 2.3 Modalità Drill con Ripetizione Spaziata
- Risuperficia le domande a cui l'utente ha risposto male nelle sessioni precedenti
- Modalità "drill" giornaliera: 5–10 domande, valutate e tracciate nel tempo
- Scheduling con algoritmo SM-2 (backoff esponenziale)

### 2.4 Preparazione per Azienda Specifica
- Selezione dell'azienda target da una lista curata (Google, Meta, Amazon, Apple, Microsoft, ecc.)
- System prompt tarato sullo stile di colloquio e sui pattern di domande noti di quella azienda
- Question bank filtrato per azienda

### 2.5 Mock Interview con un Collega
- Due utenti si connettono per una sessione di mock interview in tempo reale
- Uno gioca il ruolo dell'intervistatore (vede i suggerimenti di risposta), l'altro il candidato (vede i cue di coaching)
- Streaming tramite stanza WebSocket lato backend

### 2.6 Parser del Curriculum
- Carica il CV → estrae progetti, skill, esperienze
- Domande comportamentali generate automaticamente dal contenuto del CV
- Bozze di risposta STAR pre-scritte per ogni progetto

### 2.7 Integrazione NeetCode / LeetCode
- Rileva l'URL del problema corrente nel browser tramite un'estensione leggera
- Importa automaticamente il testo del problema nel contesto della sessione
- I suggerimenti tengono conto dei vincoli specifici del problema

### 2.8 Coaching Vocale (non verbale)
- Contatore di filler word ("um", "uh", "tipo") mostrato in tempo reale
- Indicatore di ritmo del parlato (parole al minuto)
- Rilevatore di silenzio: nudge quando il candidato tace per più di 15 s

### 2.9 Supporto Multilingua
- Attualmente solo inglese
- Pianificato: italiano, spagnolo, mandarino, hindi (Gemini supporta tutte)

### 2.10 Wizard di Onboarding
- Flusso in 3 step al primo avvio: verifica microfono → spiegazione stealth → prima domanda di prova
- Saltabile; rilanciabile dalle Impostazioni

---

## 3. Infrastruttura e Non-Functional

| Aspetto | Approccio |
|---|---|
| Sicurezza | Segreti nel vault Stronghold; nessuna chiave nel webview o nei config |
| Privacy | Audio mai salvato — streaming, trascrizione, scarto immediato |
| Offline | Le risposte del question bank disponibili offline una volta in cache |
| Aggiornamenti | Plugin tauri-updater; binario firmato via GitHub Actions |
| Telemetria | Nessuna (privacy-first) |
| Piattaforme | macOS 12+, Windows 10+ |

---

## 4. Linguaggio Visivo

- **Colore accent**: Indigo (`#6366f1`) — concentrazione, precisione, intelletto
- **Tema**: Dark-first, layout denso e informativo
- **Sidebar**: Larghezza fissa, sempre visibile; pill di stato sessione
- **Tipografia**: System font stack, spaziatura stretta, gerarchia chiara

---

## 5. Prezzi

> Posizionamento: molto più economico di Interview Coder ($299/mese) e Parakeet ($99.90/mese),
> comparabile a ShadeCoder ($19–29/mese) ma con più feature. Nessuna sorpresa in fattura.

### Confronto con la concorrenza

| Tool | Prezzo più basso | Note |
|---|---|---|
| Interview Coder | $299/mese | Truffe billing documentate, detection confermata |
| Parakeet AI | $29.50 (3 sessioni) / $99.90/mese | Forte su behavioral, debole su coding |
| Final Round AI | $25/mese (annuale) | Buono ma generico, stealth solo nei piani alti |
| ShadeCoder | $19/mese (semestrale) | Solo coding algoritmico, no behavioral |
| Ghost Coder | $40 una tantum | BYOK ma no audio nativo, no preparation mode |
| **DevOracle** | **€0 (3 sessioni gratis)** | **Audio nativo, drill SM-2, overlay IDE, company prep** |

---

### Piani DevOracle

#### Prova gratuita
- **3 sessioni complete** senza limite di tempo
- Tutte le modalità di colloquio sbloccate
- Nessuna carta di credito richiesta
- Stealth mode inclusa

#### Pay-per-use — €9 / sessione
- Acquisto singolo, nessun abbonamento
- 1 sessione = durata illimitata (non c'è un timer)
- Ideale per chi ha pochi colloqui al mese
- Pacchetti disponibili: 3 sessioni €24 · 6 sessioni €42 · 12 sessioni €72
- I crediti non scadono mai

#### Piano Mensile — €29 / mese
- Sessioni illimitate
- Tutte le modalità (Coding, Mock, Behavioral, System Design)
- Modalità Drill con ripetizione spaziata
- Prep per azienda specifica (Google, Meta, Amazon, ecc.)
- Overlay IDE
- Coaching vocale (filler words, WPM, silenzio)
- Stealth mode completa
- Cancellabile in qualsiasi momento

#### Piano Annuale — €19 / mese *(fatturato €228/anno)*
- Tutto del piano mensile
- Risparmio del 34% rispetto al mensile
- Priorità nel supporto

#### Lifetime — €149 una tantum
- Accesso permanente a tutte le feature attuali e future
- Ideale per chi cerca lavoro attivamente o cambia lavoro ogni 1–2 anni
- Paghi una volta, non ci pensi più

---

### Politica rimborsi
- **Prova gratuita**: 3 sessioni, nessuna carta richiesta — nessun rischio
- **Pay-per-use**: rimborso entro 7 giorni se la sessione ha avuto problemi tecnici
- **Mensile/Annuale**: rimborso completo entro 30 giorni dall'acquisto, senza domande
- **Lifetime**: rimborso entro 30 giorni

---

### Perché DevOracle vale il prezzo

A differenza di Parakeet ($99.90/mese) che è solo live-assist, DevOracle include:
- **Modalità Drill** (ripetizione spaziata SM-2) — prepararsi tra un colloquio e l'altro
- **Overlay IDE** — hints direttamente sopra il tuo editor, nessun cambio contesto
- **Rilevamento automatico LeetCode/NeetCode** — nessuno screenshot manuale
- **Hotkey `Cmd+Shift+O`** — nessun movimento visibile del mouse
- **Coaching vocale** — filler words, ritmo, silenzio
- **Prep per azienda** — system prompt tarato su Google, Meta, Amazon ecc.
- **Audio nativo** — nessuno screenshot, Gemini trascrive in tempo reale
- **Privacy totale** — nessun dato salvato, nessun server intermedio che vede il tuo audio
