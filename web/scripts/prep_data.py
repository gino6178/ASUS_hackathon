"""Build public/data/sample.json from the lab's precomputed outputs (run once):
  python -I scripts/prep_data.py
Inputs: the 3D reconstruction of the demo rally (per-frame 2D + 3D) and the full-match stroke table for the
same match, from the lab's research checkout (RESEARCH_DIR; not published)."""
import collections, csv, json, math, os, statistics as S

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.environ.get("RESEARCH_DIR", "research")  # the lab's research checkout (not published)
RALLY = os.path.join(RES, "out/demo_traj_phys.json")
STROKES = os.path.join(RES, "out/exp02_strokes.csv")
MATCH = "JEON_Hyeok_Jin_WANG_Po_Wei_THAILAND_MASTERS_2025_R32"
NET_Y = 6.7  # court is 6.1 m x 13.4 m, y = 0 at the far baseline

TYPE_EN = {
    "放小球": "Net shot", "擋小球": "Block", "殺球": "Smash", "挑球": "Lift", "長球": "Clear",
    "平球": "Drive", "切球": "Drop", "推球": "Push", "撲球": "Rush", "防守回挑": "Defensive lift",
    "防守回抽": "Defensive drive", "後場抽平球": "Rear-court drive", "點扣": "Wrist smash",
    "勾球": "Cross-court net", "過渡切球": "Transition drop", "過度切球": "Transition drop",
    "發短球": "Short serve", "發長球": "Long serve",
}
LABELS = os.path.join(RES, "data/labels/2025單打/Data/") + MATCH + ".mp4/label/set{}.csv"
HOMOG = os.path.join(RES, "data/2025單打/Table/homography_matrix.csv")
ATTACK = {"Smash", "Wrist smash", "Drop", "Transition drop", "Rush", "Push", "Drive", "Rear-court drive"}
REASON = {"出界": "out", "掛網": "net", "未過網": "short of the net", "對手落地致勝": "winner"}
UNITS_PER_M = 300.2 / COURT_W if (COURT_W := 6.1) else 1  # homography court model: 27.4..327.6 wide, 150..810 long


def r(v, n=2):
    return None if v is None else round(v, n)


def classify(p0, p1, peak, v0):
    """Rule-based stroke label from the 3D flight alone (contact point, landing point, apex, launch speed)."""
    h0, depth = p0[2], abs(p1[1] - NET_Y)
    if v0 > 150 and h0 > 2.3:
        return "Smash"
    if peak > 4.0 and depth > 4.5:
        return "Clear" if h0 > 1.8 else "Lift"
    if peak > 3.0 and depth > 3.5:
        return "Lift" if h0 < 1.5 else "Clear"
    if depth < 2.2 and peak < 2.6:
        return "Net shot" if h0 < 1.3 else ("Short serve" if v0 < 40 else "Drop")
    if peak > 3.0:
        return "Drop"
    return "Drive"


def rally_block():
    d = json.load(open(RALLY))
    fps, xyz, uv, st = d["fps"], d["xyz"], d["uv"], d["stroke"]
    segs = collections.defaultdict(list)
    for i, s in enumerate(st):
        if s is not None and xyz[i] is not None:
            segs[s].append(i)
    strokes = []
    for s, idx in sorted(segs.items()):
        p = [xyz[i] for i in idx]
        sp = [math.dist(p[k], p[k - 1]) * fps * 3.6 for k in range(1, len(p))]
        v0 = max(sp[:3]) if sp else 0.0
        peak = max(q[2] for q in p)
        side = "near" if p[-1][1] < p[0][1] else "far"  # travels toward the far baseline -> hit by the near player
        strokes.append({
            "i": s, "f0": idx[0], "f1": idx[-1], "t0": r(idx[0] / fps), "hitter": side,
            "contact": [r(c) for c in p[0]], "end": [r(c) for c in p[-1]], "apex": r(peak),
            "v0": r(v0, 0), "vmean": r(S.mean(sp), 0) if sp else 0, "flight": r((idx[-1] - idx[0]) / fps),
            "dist": r(math.dist(p[0][:2], p[-1][:2])), "type": classify(p[0], p[-1], peak, v0),
        })
    frames = [{"uv": uv[i], "xyz": [r(c, 3) for c in xyz[i]] if xyz[i] else None, "s": st[i]} for i in range(d["n"])]
    return {"clip": d["clip"], "fps": fps, "n": d["n"], "width": 1280, "height": 720, "frames": frames, "strokes": strokes}


def match_block():
    rows = [x for x in csv.DictReader(open(STROKES, encoding="utf-8-sig")) if x["video"] == MATCH]
    out = []
    for x in rows:
        hy = float(x["hit_Y"])
        out.append({
            "type": TYPE_EN.get(x["type"], x["type"]), "side": "far" if hy < NET_Y else "near",
            "hit": [r(float(x["hit_X"])), r(hy)], "land": [r(float(x["land_X"])), r(float(x["land_Y"]))],
            "flight": r(float(x["flight_s"])), "dist": r(float(x["dist_m"])), "vh": r(float(x["vhoriz"]) * 3.6, 1),
            "h": r(float(x["hit_height"])),
        })
    by = collections.defaultdict(list)
    for o in out:
        by[o["type"]].append(o["vh"])
    types = sorted(({"type": t, "n": len(v), "vh_med": r(S.median(v), 1), "vh_max": r(max(v), 1)} for t, v in by.items()),
                   key=lambda t: -t["n"])
    return {"match": MATCH, "n": len(out), "types": types, "strokes": out}


def homography():
    for row in csv.DictReader(open(HOMOG, encoding="utf-8-sig")):
        if row["video"] == MATCH:
            return json.loads(row["homography_matrix"])


def to_court(H, u, v):
    """Broadcast pixel -> court metres (x across, y from the far baseline)."""
    X = H[0][0] * u + H[0][1] * v + H[0][2]
    Y = H[1][0] * u + H[1][1] * v + H[1][2]
    Z = H[2][0] * u + H[2][1] * v + H[2][2]
    return [(X / Z - 27.4) / UNITS_PER_M, (Y / Z - 150.0) / (660.0 / 13.4)]


def outcomes_block():
    """Per player: landings of their attacking shots (with rally outcome), their winners, their errors, and the
    opponent's winners that beat them (defensive failures). Attack points are rotated onto the far half and
    defensive points onto the near half, so every map reads from the player's own side."""
    H = homography()
    rows = [r for s in (1, 2, 3) for r in csv.DictReader(open(LABELS.format(s), encoding="utf-8-sig"))]
    other = {"A": "B", "B": "A"}

    def land(r):
        if not r["landing_x"] or not r["landing_y"]:
            return None
        return to_court(H, float(r["landing_x"]), float(r["landing_y"]))

    def onto(p, half):  # rotate 180 degrees about the court centre when the point is on the wrong half
        far = p[1] < NET_Y
        if (half == "far") != far:
            p = [6.1 - p[0], 13.4 - p[1]]
        return [round(p[0], 2), round(p[1], 2)]

    out = {k: {"attacks": [], "winners": [], "errors": [], "beaten": []} for k in "AB"}
    rally_end = {}
    for i, r in enumerate(rows):
        if r["type"] == "死球" and r["getpoint_player"]:
            last = rows[i - 1] if i and rows[i - 1]["rally"] == r["rally"] and rows[i - 1]["type"] != "死球" else None
            if last is None:
                continue
            hitter = other[r["player"]]
            rally_end[(r["rally"], last["ball_round"], last["frame_num"])] = (hitter, REASON.get(r["lose_reason"], r["lose_reason"]))
            p = land(last) or land(r)
            if not p:
                continue
            t = TYPE_EN.get(last["type"], last["type"])
            reason = REASON.get(r["lose_reason"], r["lose_reason"])
            if reason == "winner":
                out[hitter]["winners"].append({"xy": onto(p, "far"), "type": t})
                out[other[hitter]]["beaten"].append({"xy": onto(p, "near"), "type": t})
            else:
                out[hitter]["errors"].append({"xy": onto(p, "far"), "type": t, "reason": reason})
    for r in rows:
        t = TYPE_EN.get(r["type"], r["type"])
        p = land(r)
        if t in ATTACK and p:
            end = rally_end.get((r["rally"], r["ball_round"], r["frame_num"]))
            res = "rally" if not end else ("winner" if end[1] == "winner" else "error")
            out[r["player"]]["attacks"].append({"xy": onto(p, "far"), "type": t, "res": res})

    # every shot per player, for habit analysis: where they stood, what they hit, where it landed, and what came
    # back next. Positions are rotated onto the near half (the hitter's own side), landings onto the far half.
    shots = [r for r in rows if r["type"] != "死球"]
    for i, r in enumerate(shots):
        t = TYPE_EN.get(r["type"], r["type"])
        p = land(r)
        pos = to_court(H, float(r["player_location_x"]), float(r["player_location_y"])) if r["player_location_x"] else None
        prev = shots[i - 1] if i and shots[i - 1]["rally"] == r["rally"] else None
        nxt = shots[i + 1] if i + 1 < len(shots) and shots[i + 1]["rally"] == r["rally"] else None
        end = rally_end.get((r["rally"], r["ball_round"], r["frame_num"]))
        out[r["player"]].setdefault("shots", []).append({
            "type": t, "round": int(r["ball_round"]), "rally": int(r["rally"]),
            "land": onto(p, "far") if p else None, "pos": onto(pos, "near") if pos else None,
            "prev": TYPE_EN.get(prev["type"], prev["type"]) if prev else None,
            "next": TYPE_EN.get(nxt["type"], nxt["type"]) if nxt else None,
            "end": end[1] if end else None,
            "backhand": r["backhand"] == "1", "around": r["aroundhead"] == "1",
        })
    return out


if __name__ == "__main__":
    data = {"rally": rally_block(), "match": match_block(), "outcomes": outcomes_block(),
            "names": {"A": "JEON Hyeok Jin", "B": "WANG Po Wei"},
            "players": {"near": "JEON Hyeok Jin", "far": "WANG Po Wei"},
            "event": "Thailand Masters 2025, R32", "rallyId": "Game 1, 1-0"}
    os.makedirs(os.path.join(ROOT, "public", "data"), exist_ok=True)
    with open(os.path.join(ROOT, "public", "data", "sample.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    for s in data["rally"]["strokes"]:
        print(s["i"], s["hitter"], s["type"], s["v0"], "km/h", s["apex"], "m")
    print("match strokes", data["match"]["n"], [(t["type"], t["n"], t["vh_med"]) for t in data["match"]["types"][:6]])
