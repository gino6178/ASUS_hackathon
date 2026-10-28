# ShuttleCoach demo film: video-shotcraft design spec

Mode: autonomous free creation (chosen by the user). Use: replaces the ASUS UGen AI League Stage I demo video, at most
3 minutes, English narration kept. Render: `npx remotion render src/index.ts Promo out/promo.mp4`; without music:
`--props=props-nobgm.json`.

## Product brief

ShuttleCoach is an on-device team of AI badminton coaches for one Intel Arc Pro B70. One camera in; 3D shots and match
data; four coach agents (tactics, technique, fitness, data) with player memory; a live round table; a Lab where the
coaches propose playbook changes behind a safety gate; a Telegram coach and a booking agent that books a court only
after the player says yes; an agent trace of every step. Audience: competition judges.

## Decisions

| Need | Decision |
|---|---|
| ≤ 3 min, narrated | Keep the narrated cut (Kokoro voice, 10 lines). Its footage per scene (`deck/video/build/v2sceneN_raw.mp4`) is already cut on the spoken words; the film re-stages it. Length unchanged: 176.9 s |
| No zoom (user feedback on the earlier cut) | No camera push or scale animation anywhere. Panels settle by tilt and rise; text-as-mask ends by the letters opening instead of the 46× rush |
| Look grows from the product | App tokens only: bg `#04070a`, surface `#0c1418`, ink `#eef1f2`, cream accent `#f2e6c9`, green `#5fd39a`; Manrope (UI), Michroma (wordmark), IBM Plex Mono (labels) |
| Motion voice | "Professional, trustworthy" preset: ~21 f entrances, `bezier(0.16,1,0.3,1)`, no overshoot except the lockup's brake |
| Data | Sample match footage and demo players (Hyeok, Amy, Ben) as in the app; the booking site is the labelled demo site |
| Captions | Narration captions at 44 px Manrope 600 in a dark pill (deliberately under the 56 px line: the sentences are long and must stay on one line) |

## Shot cards used

| Scene | Card (demo source) | Adaptation |
|---|---|---|
| 0 Title | opening/text-as-mask (`demos/opening/text-as-mask/TextAsMask.tsx`) | Word "SHUTTLE / COACH", the 3D rally drifting inside court-green letters; wipe 16 f + 1.04→1; breath at f150; letters open over the rally instead of the rush |
| 1–9 chapter titles | typography/blur-slide (`demos/typography/blur-slide/BlurSlide.tsx`) | Per-word y + blur + opacity on one progress, 4 f stagger; subtitle overlaps the title |
| 1–9 footage | lib/ClipCard idea (real footage as the subject) | Footage in a 1664×936 framed panel; enters by 9° tilt + 70 px rise (21 f), leaves by rise + blur (12 f) |
| 9 Outro | outro/logo-shrink-wordmark-lockup (`demos/outro/logo-shrink-wordmark-lockup/LogoShrinkWordmarkLockup.tsx`) | Ring 5.4→1 with 6 % brake, heals into the app mark, letters stagger in, tagline, badges, team and repo; lands on the spoken "ShuttleCoach" |

## Storyboard (from `src/timeline.json`)

| # | Time | Shot | Key motion |
|---|---|---|---|
| 0 | 0:00 | Title | text-as-mask, letters open onto the 3D rally, wordmark |
| 1 | 0:07 | How it is built | architecture animation in the panel |
| 2 | 0:20 | What it does | four nodes, then the grid of features |
| 3 | 0:38 | From one camera to 3D | upload, on-device stages, Rally 3D |
| 4 | 0:53 | Four specialist coaches | Lin, Kai, Ren, Ada with their marks and cards |
| 5 | 1:10 | The round table | conflict, ruling, a question to Kai answered and verified |
| 6 | 1:34 | Coaches that keep learning | knowledge base, playbooks, safety gate, declined |
| 7 | 1:56 | A coach in your pocket | Telegram, the map search, booking |
| 8 | 2:19 | The booking agent | agent animation, its own browser, agent trace |
| 9 | 2:44 | One workstation → lockup | hardware animation, then the logo lockup |

## Sound

Narration as recorded. BGM `house-vibez.mp3` (Mixkit) at 0.07 under the voice, `bgm` prop. SFX table in `src/Main.tsx`
(`SFX`), each entry relative to its shot: soft transition on the title wipe, slow swoosh per panel, riser → impact on
the lockup → shimmer.

## Credits

Shot recipes and `src/fx/Polish.tsx` (easing helpers) from video-shotcraft (Apache-2.0); BGM and SFX from Mixkit (free license); rendered with Remotion.
