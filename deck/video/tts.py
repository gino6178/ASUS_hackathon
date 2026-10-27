"""Narration with Kokoro (kokoro-onnx), one sentence at a time so each subtitle line knows its exact time.
  python tts.py narration.json out_dir [voice]
Writes out_dir/k<scene>.wav (sentences joined with short pauses) and out_dir/timings.json:
  [[{"text": sentence, "start": s, "end": s}, ...] per scene]."""
import json, os, re, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
src, out = sys.argv[1], sys.argv[2]
voice = sys.argv[3] if len(sys.argv) > 3 else "af_heart"
os.makedirs(out, exist_ok=True)
k = Kokoro(os.path.join(HERE, "models", "kokoro-v1.0.onnx"), os.path.join(HERE, "models", "voices-v1.0.bin"))

# how words are said; the subtitles keep the written form
SAY = [("ShuttleCoach", "Shuttle Coach"), ("3D", "three D"), ("B70", "B seventy"), ("24-hour", "twenty-four hour"), ("smash-defence", "smash defence")]
GAP = {".": 0.32, "!": 0.32, "?": 0.32, ":": 0.22, ";": 0.22}

scenes = json.load(open(src, encoding="utf8"))
timings = []
for i, line in enumerate(scenes, 1):
    parts = [p.strip() for p in re.findall(r"[^.!?:;]+[.!?:;]?", line) if p.strip()]
    audio, t, rows, sr = [], 0.0, [], 24000
    for p in parts:
        spoken = p
        for a, b in SAY:
            spoken = spoken.replace(a, b)
        samples, sr = k.create(spoken, voice=voice, speed=1.0, lang="en-us")
        # trim the model's leading and trailing silence so the subtitle lines up with the words
        nz = np.nonzero(np.abs(samples) > 0.01)[0]
        if len(nz):
            samples = samples[max(0, nz[0] - int(.03 * sr)): nz[-1] + int(.06 * sr)]
        d = len(samples) / sr
        rows.append({"text": p, "start": round(t, 3), "end": round(t + d, 3)})
        gap = GAP.get(p[-1], 0.18)
        audio += [samples, np.zeros(int(gap * sr), dtype=samples.dtype)]
        t += d + gap
    sf.write(os.path.join(out, f"k{i}.wav"), np.concatenate(audio), sr)
    timings.append(rows)
    print(f"scene {i}: {t:.1f} s, {len(parts)} sentences")
json.dump(timings, open(os.path.join(out, "timings.json"), "w"), indent=1)
