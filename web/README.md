# ShuttleCoach

A private, on-device multi-agent badminton analyst. One camera in; 3D shuttle flight, shot speeds, heat zones,
coaching advice and a training plan out. Every step runs on the local machine.

ASUS UGen AI League 2026 · Battlefield Thunderstorm (ASUS UGen Intel Arc Pro B70 32GB) · Theme: Everyday AI

This folder holds the **web interface**; see the [repository README](../README.md) for the agent gateway and the LLM server.

## What the interface does

| Page | Content |
|---|---|
| Overview | Landing page with a live 3D replay of a reconstructed rally |
| Analyze | Drop in a match video; the browser opens it locally and nothing is uploaded |
| Processing | The on-device pipeline stages (2D tracking, camera calibration, 3D lifting, hit detection, player location, match database, agent briefing) |
| Coaches | Four personified coach agents. Tactics flashes the heat zones that cost points; Technique replays and grades every flight; Fitness pulses the muscles to train on a 3D model; Data profiles a player's habits, heat zones and attack types |
| Round table | All four coaches and a head coach debate the match. Conflicts follow a fixed rule (health limits from memory first, then points at stake, one owner per goal); the result is four measurable goals and a 7-day schedule, printable as PDF and saved to memory |
| Match | Score flow, points won and lost, shot sequences, rally list with frame annotation, an auto-picked top-5 highlight reel exported as a 9:16 video in the browser, footwork and anticipation reads, fatigue with a load and injury-risk watch, and comparison across matches |
| Live | Court-side mode: rallies stream in as they are played, with scoreboard, running stats, opponent landing map and coach alerts when a pattern appears |
| Scout | One-page opponent scouting report (targets, weak zones, shot mix, patterns, game plan), saved as PDF |
| Voice coach | Tap "Ask" and speak: Whisper tiny transcribes in the browser (ONNX, no audio leaves the device), the question is answered from the match database and the right view opens |
| Rally 3D | Broadcast video with shuttle trail, both players' skeletons (MediaPipe pose), live movement stats (speed, top speed, distance) and a court mini-map; exports an annotated video |
| Court calibration | On Analyze: the four court corners are detected automatically and can be dragged; the court model is projected back and a rectified top-down view checks the fit |
| Memory | Player memory (RAG): goals, injuries, routines and past sessions, stored on the device and retrieved by each coach before it answers |
| Report | Video and 3D court in sync; per-shot launch speed, apex, contact height and flight time; speed curve |
| | Match patterns: stroke mix and opponent smash landings |
| | Heat zones: where a player's attacks land and where they are beaten (rally outcomes from shot-level labels) |
| | Five agents (Head Coach, Stats Analyst, Positioning, Training Planner, Evidence Verifier); every claim cites the shots behind it |
| | Body focus: findings mapped to muscle groups on a 3D anatomy model, with drills |
| | Sparring simulator: replay thousands of rallies against an opponent style and test a base position |

## Prototype status

- Coach chat runs on a local 4B model through the agent gateway (`../agent`); every figure is verified against the computed match facts.
- An uploaded video is opened and previewed locally, but the report shows a precomputed sample match.
- Shuttle speeds are estimates from the reconstructed 3D track.
- The body focus view is a coaching heuristic, not a medical or physiotherapy assessment.

## Offline voice model

The voice coach loads Whisper tiny from `public/models/Xenova/whisper-tiny.en/` (not in this repository, about 40 MB):
`config.json`, `generation_config.json`, `preprocessor_config.json`, `tokenizer.json`, `tokenizer_config.json`, `special_tokens_map.json`
and `onnx/encoder_model_quantized.onnx`, `onnx/decoder_model_merged_quantized.onnx` from https://huggingface.co/Xenova/whisper-tiny.en.

## Run

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5190.

## Not included

The following are **not** published here, so the report pages stay on "Loading" until they are added locally:

| Path | Content |
|---|---|
| `public/data/sample.json` | Sample match data derived from the lab's research pipeline and shot-level annotations |
| `public/media/sample_rally.mp4`, `sample_poster.jpg` | Sample rally clip (broadcast footage) |
| `public/body/body.json`, `body.bin` | 3D muscles and skeleton extracted from BodyParts3D 4.0 |

## Built with

React, Three.js and Vite. 2D tracking backbone: [TrackNetV5](https://github.com/gino6178/TrackNetV5).

## Credits

- Coach portraits in `public/coaches/` are AI-generated images of fictional people; they are not real coaches.

- 3D anatomy (not included in this repository): BodyParts3D 4.0, © The Database Center for Life Science, licensed under
  CC BY 4.0, adapted via [Human Atlas](https://github.com/ashemag/human-atlas) (MIT).
- Fonts: Michroma, Manrope and IBM Plex Mono via Google Fonts.
