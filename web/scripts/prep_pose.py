"""Pose for the sample rally -> public/data/pose.json.

Input: scripts/out/demo_pose.json (MediaPipe PoseLandmarker, 33 landmarks per person, at most one per half-court,
produced by the research checkout's pose experiment on public/media/sample_rally.mp4).
Output: 17 joints per player per frame (pixel coords, 1280x720) for the skeleton overlay, knee flexion per frame,
and one load event per hit: the deepest knee bend of the hitting player within +-0.4 s of contact.
Knee angles are measured in the image plane (one broadcast camera), so they are approximate.
"""
import json, math, os, sys

RES = os.environ.get("RESEARCH_DIR", "research")  # the lab's research checkout (not published)
sys.path.insert(0, os.path.join(RES, "src"))
import courtcam as cc  # research homography: image pixels -> court metres

HOM = cc.load_homographies(os.path.join(RES, "data/2025單打/Table/homography_matrix.csv"))
H = HOM["JEON_Hyeok_Jin_WANG_Po_Wei_THAILAND_MASTERS_2025_R32"]

HERE = os.path.dirname(__file__)
POSE = json.load(open(os.path.join(HERE, "out", "demo_pose.json")))
SAMPLE = json.load(open(os.path.join(HERE, "..", "public", "data", "sample.json"), encoding="utf8"))
KEEP = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]  # nose, arms, hips, legs, feet
EDGES = [[1, 2], [1, 3], [3, 5], [2, 4], [4, 6], [1, 7], [2, 8], [7, 8], [7, 9], [9, 11], [8, 10], [10, 12], [11, 13], [12, 14], [11, 15], [12, 16]]


def flexion(lm, hip, knee, ankle):
    a, b, c = lm[hip], lm[knee], lm[ankle]
    if min(a[2], b[2], c[2]) < 0.5:
        return None
    v1 = (a[0] - b[0], a[1] - b[1]); v2 = (c[0] - b[0], c[1] - b[1])
    n = math.hypot(*v1) * math.hypot(*v2)
    if n == 0:
        return None
    ang = math.degrees(math.acos(max(-1, min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / n))))
    return round(180 - ang, 1)  # 0 = straight leg


n = len(POSE)
frames, knees, feet = [], {"near": [], "far": []}, {"near": [], "far": []}
for f in range(n):
    people = POSE.get(str(f), [])
    slot = {"near": None, "far": None}
    for p in sorted(people, key=lambda p: -(p["foot"][1] if p["foot"] else 0)):  # larger v = nearer the camera
        side = "near" if slot["near"] is None and p["foot"] and p["foot"][1] > 360 else "far"
        if slot[side] is None:
            slot[side] = p["lm"]
    frames.append([None if slot[s] is None else [[round(slot[s][i][0]), round(slot[s][i][1]), round(slot[s][i][2], 2)] for i in KEEP] for s in ("near", "far")])
    for p in people:
        pass
    for s in ("near", "far"):
        person = next((p for p in people if p["lm"] is slot[s]), None)
        xy = cc.image_to_court(H, [person["foot"]])[0] if person and person["foot"] else None
        feet[s].append(None if xy is None else [round(float(xy[0]), 3), round(float(xy[1]), 3)])
        lm = slot[s]
        knees[s].append(None if lm is None else [flexion(lm, 23, 25, 27), flexion(lm, 24, 26, 28)])  # left, right

events = []
fps = 30
for st in SAMPLE["rally"]["strokes"]:
    side, f0 = st["hitter"], st["f0"]
    best = None
    for f in range(max(0, f0 - 12), min(n, f0 + 13)):
        k = knees[side][f]
        if not k:
            continue
        for leg, v in zip(("left", "right"), k):
            if v is not None and (best is None or v > best["flex"]):
                best = {"f": f, "leg": leg, "flex": v}
    if best:
        events.append({"stroke": st["i"], "type": st["type"], "side": side, "f0": f0, **best})

# movement: smoothed court position -> distance, speed now, top speed (per player)
move = {}
for s in ("near", "far"):
    pts = feet[s]
    sm = []
    for f in range(n):
        w = [pts[k] for k in range(max(0, f - 4), min(n, f + 5)) if pts[k]]
        sm.append([sum(p[0] for p in w) / len(w), sum(p[1] for p in w) / len(w)] if w else None)
    dist, speed, total, top = [], [], 0.0, 0.0
    for f in range(n):
        a, b = sm[f - 6] if f >= 6 else None, sm[f]
        v = math.hypot(b[0] - a[0], b[1] - a[1]) / (6 / fps) if a and b else None
        if f and sm[f - 1] and b:
            total += math.hypot(b[0] - sm[f - 1][0], b[1] - sm[f - 1][1])
        if v is not None:
            v = min(v, 8.0); top = max(top, v)
        dist.append(round(total, 2)); speed.append(None if v is None else round(v, 2))
    move[s] = {"court": [None if p is None else [round(p[0], 2), round(p[1], 2)] for p in sm], "dist": dist, "speed": speed, "top": round(top, 2)}

out = {"fps": fps, "move": move, "w": 1280, "h": 720, "edges": EDGES, "frames": frames, "knees": knees, "events": events}
json.dump(out, open(os.path.join(HERE, "..", "public", "data", "pose.json"), "w"), separators=(",", ":"))
found = sum(1 for fr in frames if fr[0]) / n
print(f"{n} frames, near player in {found:.0%}; {len(events)} hit events:")
for s in ("near", "far"):
    print(f"  {s}: {move[s]['dist'][-1]:.1f} m moved, top speed {move[s]['top']:.2f} m/s")
for e in events:
    print(f"  {e['side']:4} {e['type']:12} knee flex {e['flex']:5.1f} deg ({e['leg']}) at frame {e['f']}")
