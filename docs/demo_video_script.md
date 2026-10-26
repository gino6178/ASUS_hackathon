# ShuttleCoach: Stage I demo video script (3:00)

ASUS UGen AI League 2026 · Battlefield Thunderstorm · Theme: Everyday AI
Upload to YouTube as **Unlisted** ("anyone with the link"). Narration in English, about 140 words per minute.

## Before recording

- Run the site: `npm --prefix D:/COmp2/shuttle-analyst/web run dev`, open `http://localhost:5190`, browser at 1920×1080, zoom 100%.
- Open the site once while online so the fonts are cached; the offline shot at 2:50 then looks the same.
- Have a short video file ready to drop in at 0:35 (ideally your own club footage).
- Hide the bookmarks bar and notifications. Record the screen at 30 fps; record narration separately and lay it under.
- **Footage rights:** the sample rally is broadcast footage. YouTube links are public; if you can, replace it with your own recording, or keep it to the few seconds below and say "sample broadcast rally".

## Shot list and narration

| Time | Screen (what to do) | Narration | On-screen caption |
|---|---|---|---|
| 0:00–0:12 | Landing page. Let the 3D rally play in the hero. Slowly move the mouse toward "Analyze a match". | Elite badminton players have analysts, multi-camera tracking and full-time coaches. Everyone else has a phone video and a guess. ShuttleCoach changes that, without your video ever leaving the device. | ShuttleCoach: a private, on-device badminton analyst |
| 0:12–0:30 | Scroll through "How it works" and "Measured, not guessed". Pause on the four numbers. | One ordinary camera goes in. Out come the shuttle's flight in metric 3D, every hit, both players' positions, and a coaching staff of AI agents. The perception comes from our lab's research: a 0.42 metre median 3D error against a ten-camera reference, from a single camera. | One camera → 3D flight → coaching |
| 0:30–0:50 | Click "Analyze a match". Drop the video file in. Point at "Stored: this device only". Click "Start on-device analysis". Let the stages run. | Drop in a match video. The browser opens it locally; nothing is uploaded. The pipeline tracks the shuttle, calibrates the camera from the court lines, lifts every flight into 3D, detects hits and locates the players. | Nothing is uploaded |
| 0:50–1:25 | Report opens. Note the yellow demo notice. Press play on the rally. Drag the 3D court to orbit. Click shot 5, the smash, in the stroke strip. Point at the telemetry and the speed chart. | In this prototype the report shows a precomputed sample rally. On the left, the tracker's detections on the video. On the right, the same rally reconstructed in 3D. Every shot is measured: launch speed, apex, contact height, flight time. This smash left the racket at about 200 kilometres an hour, estimated from the 3D track itself. | Speeds estimated from the 3D track |
| 1:25–1:45 | Scroll to "Match patterns". Point at the court map, then the stroke-mix bars. | Across all 949 shots of the match, patterns appear. Of the 55 smashes into this player's half, 33 landed in the mid forehand. | 949 shots · 55 smashes · 60% to one zone |
| 1:45–2:15 | Scroll to "Ask your agents". Click "Where is my opponent hurting me?". Let all five messages appear. Click an evidence chip such as "#4" to show it on the map, then "Watch shot 5". | Now the coaching staff. A Head Coach splits the question. A Stats Analyst queries the match database. A Positioning agent explains the pattern: short lifts invite the smash. And an Evidence Verifier re-runs every count. No citation, no claim. Every number links back to the shots that prove it. | Every claim cites the shots behind it |
| 2:15–2:35 | Scroll to "Body focus". Click the quadriceps, then the calves. Show the "Why" and "Drills" panels. | The findings also tell you what to train. Smash defence to the forehand loads the legs and the first step; short lifts point to the forearm and the lunge. Each body part shows the evidence behind it and the drills to fix it. | From match data to a training plan |
| 2:35–2:50 | Scroll to "Sparring simulator". Switch the style to "Net controller", click the court to move the base, then click "Move to the best base". | Before any advice is given, it is tested. The sparring simulator replays thousands of rallies against an elite style. Here it shows this player's base is already sound, so the advice is to react earlier, not to move. | Advice is simulated before it is given |
| 2:50–3:00 | Turn Wi-Fi off (show the system tray icon), reload the page, show it still works. End on the landing hero. | Everything runs on one Intel Arc Pro B70: perception, five agents and the simulator. No cloud, no upload. ShuttleCoach: a coaching staff in a box. | Runs fully offline · Intel Arc Pro B70 32GB |

Total narration: about 400 words, which leaves room for pauses at 140 words per minute.

## What the video must not claim

- The uploaded video is **not** analysed live in this prototype; the narration says "precomputed sample rally" at 0:50. Do not cut that line.
- The agents' answers are generated from the computed match facts; the local LLM is not connected yet. If asked, it is Stage II work.
- The speeds are **estimates** from the reconstructed 3D track; the narration says "about 200 kilometres an hour".
- The body map is a coaching heuristic, not a medical assessment.

## End card (3 s, optional)

ShuttleCoach · [Team name] · [GitHub repository URL]
