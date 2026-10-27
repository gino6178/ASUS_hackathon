# ShuttleCoach

A private, on-device multi-agent badminton coach. One camera in; 3D shuttle flight, shot speeds, heat zones, a
coaching staff that debates the week at a round table, and a training plan out. Every model runs on the local
machine; match video never leaves it.

ASUS UGen AI League 2026 · Battlefield Thunderstorm (ASUS UGen Intel Arc Pro B70 32GB) · Theme: Everyday AI

## Repository

| Folder | What it is |
|---|---|
| [`web/`](web) | The interface: React + Three.js (Vite). Match analysis, coaches, round table, live mode, voice coach, highlights, Lab |
| [`agent/`](agent) | Agent gateway (Node): grounded coach chat on a local LLM with a number verifier, player memory, the research agent and knowledge base (RAG), self-evolving playbooks, and the 24-hour coach on Telegram |
| [`llm-server/`](llm-server) | Qwen3-4B INT4 on OpenVINO GenAI behind an OpenAI-compatible API, for the Arc Pro B70 |
| [`server/`](server) | `start.sh`: starts the LLM backend (Ollama or OpenVINO) and the gateway on the coaching station |
| [`deck/`](deck) | Stage I proposal deck (PDF, PPTX) and the scripts that build it and record its clips |
| [`docs/`](docs) | Demo video script, coach portrait prompts |

## Run it

On the coaching station (Linux, NVIDIA or Intel GPU):

```bash
cp agent/.env.example agent/.env          # set TELEGRAM_BOT_TOKEN to use the Telegram coach
BACKEND=ollama ./server/start.sh          # or BACKEND=openvino on the Arc Pro B70
```

On any machine with a browser:

```bash
cd web && npm install
echo VITE_AGENT_URL=http://<station-ip>:8787 > .env.local
npm run dev
```

End-to-end tests of the gateway and the Telegram bot (a fake Telegram API, the real local model): `cd agent && npm test` and `node test/booking.mjs`.

## The coaching staff

- **Grounded replies.** Deterministic code computes every match number; the model only explains them. A verifier
  checks each figure against the fact or study cited in the same sentence and rejects the reply otherwise.
- **Round table.** Held live by the coach agents on the local model: each argues for one priority from its own facts,
  the fitness coach checks every request against the player's memory and challenges one that clashes, the challenged
  coach answers, and the head coach rules by fixed priorities (health limits first, then points at stake). Every turn
  goes through the verifier; four measurable goals and a 7-day plan come out. Without the gateway a templated meeting
  is shown and labelled as such.
- **Self-evolving.** A research agent searches OpenAlex, arXiv and Semantic Scholar every night and keeps findings
  whose numbers appear in the abstract. Each coach then reflects on player feedback, rejected drafts and new findings,
  and proposes changes to its own playbook. A change is adopted only if it cites a study in the coach's area, passes
  the safety check and does not regress on the coach's test questions; anything about health waits for a human coach.
  Every version can be rolled back (web: Lab).
- **24-hour coach on Telegram.** Food at home and meals timed to training, the player's schedule with a reminder an
  hour before each session, the training log with an evening check-in. Only text passes through Telegram;
  `/forget` deletes everything stored about a player.
- **Booking agent.** "Doubles with Amy and Ben on Saturday evening": the local model reads the request and the fitness coach agent
  sets the length (a sore knee means 1 hour); the agent checks every player's calendar and rough area (shared on
  Telegram, rounded to about 1 km), searches 18 sports centres and ranks the free courts by the longest trip anyone
  would make, in estimated minutes by MRT and bus. Then it books on the venue's website itself, in a
  headless browser on the station: the local model reads each page and picks the next control, code types the member
  password (the model never sees it) and stops before the final confirm until the player taps "Book it"; then the agent
  confirms and reads back the booking reference (web: Find a court, Agent trace, with a screenshot per step). Venue
  names and locations are from OpenStreetMap; the booking site is a demo site on the station with sample schedules.
- **Agent trace.** Every run records its LLM calls, tool calls, checks, messages and the moments it waits for a person,
  on the station (web: Agent trace; `GET /api/trace`).

## Not in this repository

- The monocular 3D reconstruction and intent detection methods (closed blocks). The app ships their precomputed outputs for the sample match in `web/public/data/`.
- The broadcast footage of the sample match (not ours to redistribute) and model weights (downloaded; see
  `llm-server/README.md` and `web/README.md`).
- Runtime data on the station: players, conversations, feedback, playbooks and the knowledge base.

## Credits

TrackNetV3 (MIT) and TrackNetV5 ([github.com/gino6178/TrackNetV5](https://github.com/gino6178/TrackNetV5)) for 2D
shuttle tracking; ShuttleSet (KDD 2023) labels; BodyParts3D 4.0, © The Database Center for Life Science, CC BY 4.0,
adapted via Human Atlas (MIT); Whisper tiny.en (MIT) via Transformers.js (Apache-2.0); MediaPipe Pose Landmarker
(Apache-2.0); Qwen3 (Apache-2.0). Coach portraits are AI-generated, fictional people.
