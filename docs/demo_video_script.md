# ShuttleCoach: Stage I demo video script (2:59)

ASUS UGen AI League 2026 · Battlefield Thunderstorm · Theme: Everyday AI
Upload to YouTube as **Unlisted** ("anyone with the link"). Narration in English.

Story: what the platform is, the architecture in one picture, the whole platform in four nodes, how it works, the coaches, then the two things that make
them feel like real coaches (the round table and self-evolution), the 24-hour coach on Telegram with the booking agent,
and the LLM agent behind it.

The video is built from the running app (`deck/video`): `record.mjs` records each scene, `tts.py` makes the narration
on the station (Kokoro, voice af_heart), `assemble2.mjs` cuts the scenes on the spoken words, adds subtitles and writes
`ShuttleCoach_demo.mp4` (and a version without narration). `storyboard.mjs` writes the storyboard PDF with a frame per shot.

The final film (v3) re-stages that narrated cut in Remotion (`deck/promo`, see `deck/promo/DESIGN.md`) with
video-shotcraft shot recipes: a text-as-mask title, the footage in framed panels with blur-slide chapter titles, the
overview as a 2×2 split, an evolution-loop card over the Lab scene, and a logo lockup. No zoom anywhere.

## Scenes

| # | Time | Screen | Narration |
|---|---|---|---|
| 1 | 0:00 | The 3D rally on the home page; title, "One camera in. A full coaching staff out. 100% offline.", "Built for Intel Arc Pro B70 · 32 GB". | This is ShuttleCoach: a self-evolving team of AI coaching agents that runs entirely on local hardware. |
| 2 | 0:07 | The on-device architecture animation: match video → perception (2D track, 3D lift) → analytics → four coach agents and the head coach at the round table, reading player memory (RAG) → sparring simulator → coach sessions; "No cloud", Intel Arc Pro B70 · 32 GB. | Here is how it is built, all on one Intel Arc card. The match video becomes 3D shots and match data. Coach agents read it with your memory, test advice in a simulator, and coach you. |
| 3 | 0:20 | Four nodes, each labelled: Perception & 3D replay · Round table · Voice coach and auto highlights · 24-hour coach on Telegram; then a 3×3 grid of all features (static). | Here is what it does. One camera becomes a 3D replay of every rally. Four specialist coaches debate your match at a round table. Ask them by voice, and get highlights ready to post. And between sessions, they stay with you on Telegram. |
| 4 | 0:38 | Drop a video in; the on-device stages; the Rally 3D view (the demo-mode notice is on screen). | Drop in match footage: zero bytes leave your machine. The pipeline calibrates the court, isolates the shuttle and lifts every trajectory into 3D. This demo opens a sample match the station has already analysed. |
| 5 | 0:53 | Lin, Kai, Ren, Ada, each with the key spot circled or boxed (no zoom) and a card quoting the page's own numbers (7 of 24 winners conceded; A/B/C grades; right knee sore; smash 38% after a lift or clear). | Four coaches read the same match. Coach Lin flashes the zone that cost the most points. Coach Kai grades every shot from its 3D flight. Coach Ren shows which muscles to train, and adapts to a sore knee. Coach Ada finds the opponent's habits under pressure. |
| 6 | 1:10 | Round table held live by the coach agents on the local model (every turn verified): the conflict card, the head coach's ruling, the plan; a question to Coach Kai answered by the local model (real timing, every figure verified). | Like real coaches, they disagree, and each one speaks live from the local model. Lin wants smash-defence blocks; Ren says the knee is sore. The head coach rules: health first, then the points at stake, and writes four measurable goals and a seven-day plan. Ask any coach a question: a local model answers in about a second, and a verifier checks every number before you see it. |
| 7 | 1:34 | Lab: knowledge base search, playbooks, the safety gate on a health proposal, declined by a person. | And they evolve on their own. Every night a research agent reads new sports-science papers, and each coach proposes a new version of its own playbook. But AI that learns must be AI you can trust. Every change must cite a study, pass a safety check and do no harm on its tests. Anything about health waits for a human coach. So this one is declined. |
| 8 | 1:56 | Telegram on a phone (meals, check-in, "I want to play doubles with Amy and Ben on Saturday evening"); the Find a court map replaying the search; back to the phone: invitations, "Book it", booked. | Off the court, the same staff lives in Telegram. Coach Mei plans meals from what is in your kitchen, and the bot checks in after the session to log it. Say you want a game. The agent opens the map, finds where everyone starts, checks every sports centre, and picks the court that is fairest for everyone's trip. It invites your friends, and books only when you confirm. |
| 9 | 2:19 | The booking agent's architecture animation (local LLM → calendars → map and 18 sports centres → fairness), the agent's own browser on the venue's booking site (log in, timetable, form, review, then Confirm booking after the player's yes), then the Agent trace page. | Here is the agent behind it. The local model reads the request. The agent checks each player's calendar and where they start, searches the sports centres for a free court, and ranks them by the longest trip anyone would make. Then it books the court on the venue's own website, the way a person would, and stops before the final confirm until you say yes. Every step is logged on the station. |
| 10 | 2:44 | End card: SHUTTLECOACH, three badges, team and GitHub. | No cloud and no upload, built for a single Intel Arc Pro B70 workstation. ShuttleCoach: a private staff of AI agents that evolves with you, and never leaves your court. |

## What the video must not claim

- The uploaded video is not analysed live in this prototype: keep "this demo opens a sample match the station has already analysed".
- Replies were timed on the test server's GPU; say "a local model" or "built for the Arc Pro B70", not "measured on the B70".
- The sports centres are real places (OpenStreetMap); their courts, hours and bookings are a sample schedule, and the booking website the agent operates is a demo site on the station, labelled as such.
- The Telegram screens are an animation of the bot's real end-to-end test output; record the real phone once the bot has a token.
- No paper names, no research claims, no review status.

## Before a final take

- Put the team name on the end card (`deck/video/scenes/endcard.html`).
- Create the Telegram bot and record the phone for scene 7.
- The narration is a neural voice; replace it with a human voice if preferred (`ShuttleCoach_demo_no_voice.mp4` plus the script above).
