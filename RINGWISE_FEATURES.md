# Cue — Specifiche delle Feature

> **Prodotto**: Cue — AI Coach per le Vendite
> **Utenti target**: Sales rep B2B, account executive, SDR, founder che gestiscono le proprie vendite
> **Valore core**: Coaching AI invisibile e in tempo reale durante le chiamate di vendita live — i rep sembrano sempre preparati, gestiscono le obiezioni con sicurezza e non perdono mai un segnale d'acquisto

---

## 1. Feature Core (implementate o in corso)

### 1.1 Session Engine
- Avvio e stop di una sessione di coaching via Tauri IPC (`start_session`, `stop_session`)
- Modalità di chiamata:
  - **Sales Call** — chiamata di outbound prospecting; focus su scoperta del pain, segnali di qualifica e cadenza del next step
  - **Discovery** — qualifica BANT/MEDDIC; mostra le domande giuste per scoprire budget, autorità e timeline
  - **Demo** — demo del prodotto strutturata; cue su quando sondare le reazioni e quando avanzare
  - **Negotiation** — difesa del prezzo, ancoraggio, strategia sulle concessioni, coaching sul silenzio
  - **Follow-up** — debrief post-call: impegni estratti, next step definiti, bozza email suggerita
- Metadati di sessione salvati (id, modalità, started_at, durata)

### 1.2 Trascrizione Audio in Tempo Reale
- Microfono catturato via `cpal` (cross-platform: macOS e Windows)
- Audio inviato al backend NestJS come chunk WAV base64 tramite WebSocket
- Backend trascrive con **Gemini 1.5 Flash** (bassa latenza)
- Segmenti di trascrizione mostrati in un pannello con scroll automatico e label degli speaker ("Tu" / "Prospect")

### 1.3 Cue AI in Tempo Reale
- Ogni segmento di trascrizione analizzato lato server da **Claude claude-opus-4-5** con system prompt specifico per le vendite
- Cache-first: i pattern di obiezione già visti vengono serviti dal question bank pgvector (soglia 0.92)
- Tipi di cue:
  - `objection_response` — risposta collaudata all'obiezione esatta appena sollevata
  - `question` — domanda di approfondimento suggerita per scoprire un segnale d'acquisto
  - `price_defence` — giustificazione del prezzo inquadrata su valore e ROI
  - `closing_move` — trial close o richiesta di impegno calibrata sui segnali d'acquisto rilevati
  - `next_step` — next step specifico e con scadenza da proporre al momento giusto
  - `silence` — nudge "aspetta" dopo una domanda chiave (lascia che sia il prospect a parlare)
  - `competitor` — scheda comparativa rapida quando viene menzionato un competitor
- I cue appaiono nel pannello destro man mano che arrivano, i più recenti in cima

### 1.4 Monitor del Talk Ratio
- Tracker in tempo reale: % di parole dette da "Tu" vs "Prospect"
- Obiettivo: mantenere il talk ratio < 50% durante la discovery; > 60% durante la demo
- Pill colorata nella `SessionPage` — verde quando è nella norma, ambra quando deriva
- Talk ratio storico salvato per sessione e mostrato nello Storico

### 1.5 Modalità Stealth
- Attivazione tramite hotkey globale (default `Cmd+H` / `Ctrl+H`)
- **Esclusione dalla registrazione schermo**: `NSWindowSharingNone` su macOS, `SetWindowDisplayAffinity` su Windows — Cue è invisibile alla condivisione schermo di Zoom, Teams e Meet
- Si attiva automaticamente quando vengono rilevati processi `zoom`, `teams`, `meet`, `webex` (polling ogni 5 s)
- Canali di output: overlay trasparente, secondo schermo, tray di sistema, haptic (pianificato)

### 1.6 Autenticazione
- Auth Supabase con email e password (accesso / registrazione / logout)
- JWT propagato al backend su ogni chiamata API e nell'handshake WebSocket
- Guard `RequireAuth` — utenti non autenticati reindirizzati a `/auth`

### 1.7 Objection Bank (cache semantica)
- Ogni obiezione gestita da Claude viene salvata con embedding `VECTOR(768)` in Supabase Postgres
- Le obiezioni future identiche o simili (cosine ≥ 0.92) vengono servite dal DB — risposta istantanea, 0 token API
- `asked_count` traccia quante volte ogni pattern di obiezione appare nelle chiamate
- Mostrato nella pagina Storico come "Obiezioni frequenti" — aiuta i rep a capire dove incontrano più resistenza

### 1.8 Storico
- Lista delle chiamate passate: tipo di chiamata, data, durata, cue ricevuti, talk ratio
- Pannello "Obiezioni frequenti" — i blocchi più comuni con contatore di frequenza
- Filtro per tipo di chiamata (in arrivo)

### 1.9 Impostazioni
- Selezione del dispositivo microfono
- Toggle stealth + checkbox auto-hide + esclusione da screen capture
- Selezione canale di output (overlay / secondo schermo / tray / haptic)
- Visualizzazione versione app

---

## 2. Feature Pianificate

### 2.1 Schede Competitor
- Quando un competitor viene nominato nella conversazione, appare una scheda con:
  - Frame vinci/perdi ("dove li battiamo", "dove ci battono")
  - Frase di posizionamento sintetica
  - 3 domande trappola per spostare la narrativa
- Libreria competitor gestita in Supabase; aggiornabile dagli amministratori del team

### 2.2 Rilevatore di Segnali d'Acquisto
- Rilevamento lato modello di frasi che indicano interesse:
  - "Quanto dura l'onboarding?"
  - "Come funziona il pricing?"
  - "Potremmo avere una trial?"
- Questi triggherano immediatamente un cue `closing_move`
- I segnali d'acquisto vengono registrati per sessione a uso dell'intelligenza di pipeline

### 2.3 Scorecard della Chiamata
- Al termine della sessione: scorecard strutturata generata da Claude:
  - Score talk ratio
  - Obiezioni gestite (% di recupero)
  - Profondità della discovery (campi BANT/MEDDIC scoperti)
  - Next step stabilito (sì/no)
  - Qualità complessiva della chiamata (1–10)
- Salvata per sessione; esportabile come note CRM (pianificato)

### 2.4 Integrazione CRM
- Post-call: invio del riepilogo sessione, talk ratio e next step direttamente a Salesforce / HubSpot
- Connessione OAuth nelle Impostazioni
- Popolamento automatico del log attività Contatto con note di chiamata generate dall'AI

### 2.5 Playbook di Team
- Gli amministratori caricano risposte alle obiezioni e linee guida di messaging
- Cue mostra il messaging approvato dal team prima di ricorrere alla generazione AI
- Garantisce coerenza del brand voice in tutto il team di vendita

### 2.6 Registrazione e Debrief della Chiamata
- Registrazione locale opzionale (richiede consenso esplicito)
- Pagina di debrief post-call: trascrizione annotata con cue sovrapposti ai timestamp
- Il manager può rivedere le registrazioni e aggiungere commenti di coaching (pianificato)

### 2.7 Generatore di Email di Follow-up
- Dopo una sessione Follow-up: Claude redige un'email di follow-up
  - Fa riferimento agli impegni presi durante la chiamata
  - Include la data/ora del next step se acquisita
  - Un click per copiare o aprire nel client email predefinito

### 2.8 Coaching sulla Pipeline (async)
- Non legato a una chiamata live — coaching asincrono su un'opportunità
- Il rep descrive il deal; Claude fa domande di discovery, evidenzia i gap, raccomanda l'azione successiva
- Framing "Deal Doctor" per le opportunità bloccate

### 2.9 Schede Persona
- Prima della chiamata, inserisci l'URL LinkedIn del prospect o il nome dell'azienda
- Cue genera un brief sulla persona: pain probabili, figure che comprano in questa categoria, obiezioni tipiche del settore
- Mostrato nella schermata pre-sessione

### 2.10 Supporto Multilingua
- Attualmente solo inglese
- Pianificato: italiano, spagnolo, francese, tedesco, portoghese (Gemini supporta tutte)

### 2.11 Companion Mobile (iOS / Android)
- Cue vibratorie quando la modalità stealth è attiva — pattern di vibrazione discreti al posto degli alert visivi
- Notifica push con promemoria del next step dopo la fine della chiamata
- Visualizzazione storico e objection bank in mobilità

### 2.12 Wizard di Onboarding
- Flusso in 3 step al primo avvio: verifica microfono → spiegazione stealth → walkthrough di una chiamata demo
- Configura la lista competitor iniziale e le modalità di chiamata più rilevanti per il ruolo del rep

---

## 3. Infrastruttura e Non-Functional

| Aspetto | Approccio |
|---|---|
| Sicurezza | Segreti nel vault Stronghold; JWT solo in memoria |
| Privacy | Audio mai salvato — streaming, trascrizione, scarto immediato |
| Offline | Risposte alle obiezioni in cache disponibili offline |
| Aggiornamenti | Plugin tauri-updater; binario firmato via GitHub Actions |
| Telemetria | Nessuna (privacy-first) |
| Piattaforme | macOS 12+, Windows 10+ |

---

## 4. Linguaggio Visivo

- **Colore accent**: Emerald (`#10b981`) — crescita, risultato, azione
- **Tema**: Dark-first, sidebar pulita, schede cue ad alto contrasto
- **Sidebar**: Larghezza fissa; pill "Call active" quando la sessione è in corso
- **Pill talk ratio**: Colorata e sempre visibile durante le sessioni
- **Tipografia**: System font stack, spaziatura stretta, gerarchia chiara

---

## 5. Prezzi

> Posizionamento: l'unico AI coach per le vendite con pricing onesto.
> Cluely ($75/mese con stealth) è il competitor più vicino ma ha avuto
> una violazione dati da 83.000 utenti e reputazione compromessa.
> RingWise entra nel mercato con un'alternativa pulita e credibile.

### Confronto con la concorrenza

| Tool | Prezzo stealth incluso | Note |
|---|---|---|
| Cluely | $75/mese | Violazione dati 83K utenti, 5–90s di lag documentati |
| Gong | ~$100–200/mese/utente | Enterprise, no stealth, analytics post-call |
| Chorus (ZoomInfo) | ~$100+/mese/utente | Enterprise, no stealth |
| **RingWise** | **€49/mese** | **Stealth nativo, audio live, objection bank** |

> Nota: Gong e Chorus sono strumenti di *analisi post-call* per i manager.
> RingWise è l'unico pensato per il *rep* durante la chiamata.

---

### Piani RingWise

#### Trial gratuito — 14 giorni completi
- Tutte le 5 modalità di chiamata sbloccate
- Sessioni illimitate nel periodo di prova
- Stealth mode inclusa
- Nessuna carta di credito richiesta

#### Pay-per-use — €19 / sessione
- 1 sessione = durata illimitata (non scade durante la chiamata)
- Ideale per freelance e founder con poche chiamate al mese
- Pacchetti disponibili: 3 sessioni €45 · 6 sessioni €78 · 12 sessioni €138
- I crediti non scadono mai
- Scorecard AI e bozza email follow-up incluse

#### Piano Mensile — €49 / mese
- Chiamate illimitate
- Tutte le 5 modalità (Sales Call, Discovery, Demo, Negotiation, Follow-up)
- Talk ratio monitor in tempo reale
- Competitor intelligence cards
- Buying signal detector
- Scorecard AI post-chiamata
- Bozza email follow-up automatica
- Objection bank illimitato
- Stealth mode completa
- Cancellabile in qualsiasi momento

#### Piano Annuale — €39 / mese *(fatturato €468/anno)*
- Tutto del piano mensile
- Risparmio del 20% rispetto al mensile
- Priorità nel supporto

#### Piano Team — €149 / mese *(fino a 5 utenti)*
- Tutto del piano mensile per ogni membro del team
- Playbook condiviso (objection responses approvate dal manager)
- Dashboard team con stats aggregate
- Amministratore può gestire utenti e playbook
- Ideale per team di vendita da 2–5 persone

#### Piano Team Annuale — €119 / mese *(€1.428/anno, fino a 5 utenti)*
- Tutto del piano team mensile
- Risparmio del 20%
- Onboarding dedicato

---

### Politica rimborsi
- **Trial gratuito**: 14 giorni completi, nessuna carta — nessun rischio
- **Pay-per-use**: rimborso entro 7 giorni se la sessione ha avuto problemi tecnici
- **Mensile/Annuale**: rimborso completo entro 30 giorni dall'acquisto, senza domande
- **Team**: rimborso pro-rata entro 30 giorni

---

### ROI per il cliente

Un sales rep che chiude mediamente €5.000 di ARR per deal ha bisogno di **chiudere un solo deal in più ogni 8 mesi** per ripagare l'abbonamento annuale (€468). Considerando che RingWise:
- Riduce il tempo speso a pensare alle risposte alle obiezioni
- Mantiene il talk ratio nel range ottimale
- Non lascia mai perdere un buying signal

Il payback period è tipicamente **la prima settimana di utilizzo**.
