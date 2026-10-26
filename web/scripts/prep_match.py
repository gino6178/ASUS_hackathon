"""Build public/data/matches.json (rally-level data for the match-analysis, live and scouting pages) and re-encode the
sample match's rally clips into public/media/rallies/. Run once:  python -I scripts/prep_match.py
Inputs: shot-level labels, rally segmentation and court homographies of the lab's 2025 singles set."""
import csv, json, os, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.environ.get("RESEARCH_DIR", "research")  # the lab's research checkout (not published)
DATA = os.path.join(RES, "data")
CLIPS = os.path.join(RES, "rvall")
FPS = 30.0
NET_Y, L, W = 6.7, 13.4, 6.1
MATCHES = [
    {"video": "JEON_Hyeok_Jin_WANG_Po_Wei_THAILAND_MASTERS_2025_R32", "names": {"A": "JEON Hyeok Jin", "B": "WANG Po Wei"},
     "event": "Thailand Masters 2025 · R32", "clips": True},
    {"video": "CHOU_Tien_Chen_WANG_Po_Wei_THAILAND_MASTERS_2024_R16", "names": {"A": "CHOU Tien Chen", "B": "WANG Po Wei"},
     "event": "Thailand Masters 2024 · R16", "clips": False},
]
TYPE_EN = {
    "放小球": "Net shot", "擋小球": "Block", "殺球": "Smash", "挑球": "Lift", "長球": "Clear", "平球": "Drive", "小平球": "Drive", "切球": "Drop",
    "推球": "Push", "撲球": "Rush", "防守回挑": "Defensive lift", "防守回抽": "Defensive drive", "後場抽平球": "Rear-court drive",
    "點扣": "Wrist smash", "勾球": "Cross-court net", "過渡切球": "Transition drop", "過度切球": "Transition drop",
    "發短球": "Short serve", "發長球": "Long serve",
}
REASON = {"出界": "out", "掛網": "net", "未過網": "short of the net", "對手落地致勝": "winner", "落點判斷失誤": "misjudged"}


def homography(video):
    for row in csv.DictReader(open(f"{DATA}/2025單打/Table/homography_matrix.csv", encoding="utf-8-sig")):
        if row["video"] == video:
            return json.loads(row["homography_matrix"])
    raise SystemExit("no homography for " + video)


def court(H, u, v):
    if u in ("", None) or v in ("", None):
        return None
    u, v = float(u), float(v)
    X = H[0][0] * u + H[0][1] * v + H[0][2]
    Y = H[1][0] * u + H[1][1] * v + H[1][2]
    Z = H[2][0] * u + H[2][1] * v + H[2][2]
    return [round((X / Z - 27.4) / (300.2 / W), 2), round((Y / Z - 150.0) / (660.0 / L), 2)]


def build(m):
    H = homography(m["video"])
    seg = list(csv.DictReader(open(f"{DATA}/rallyseg/2025單打/Data/{m['video']}.mp4/RallySeg.csv", encoding="utf-8-sig")))
    seg = [s for s in seg if ":" not in s["Score"]]  # drop duplicated rows such as "2:1_01_00"
    rallies, idx = [], 0
    for set_no in (1, 2, 3):
        path = f"{DATA}/labels/2025單打/Data/{m['video']}.mp4/label/set{set_no}.csv"
        if not os.path.exists(path):
            continue
        rows = list(csv.DictReader(open(path, encoding="utf-8-sig")))
        score = {"A": 0, "B": 0}
        by_rally = {}
        for r in rows:
            by_rally.setdefault(int(r["rally"]), []).append(r)
        for rid in sorted(by_rally):
            rs = by_rally[rid]
            dead = next((r for r in rs if r["type"] == "死球" and r["getpoint_player"]), None)
            shots = [r for r in rs if r["type"] != "死球"]
            if not dead or not shots:
                continue
            f0 = int(shots[0]["frame_num"])
            sg = next((s for s in seg if int(s["Start"]) <= f0 <= int(s["End"])), None)
            start = int(sg["Start"]) if sg else f0 - 30
            winner = dead["getpoint_player"]
            score[winner] += 1
            reason = REASON.get(dead["lose_reason"], dead["lose_reason"])
            last = shots[-1]
            out = []
            for r in shots:
                out.append({
                    "t": round((int(r["frame_num"]) - start) / FPS, 2), "p": r["player"], "type": TYPE_EN.get(r["type"], r["type"]),
                    "land": court(H, r["landing_x"], r["landing_y"]), "pos": court(H, r["player_location_x"], r["player_location_y"]),
                    "opp": court(H, r["opponent_location_x"], r["opponent_location_y"]),
                })
            rallies.append({
                "i": idx, "set": set_no, "rally": rid, "code": sg["Score"] if sg else None,
                "clip": f"{m['video']}__{sg['Score']}.mp4" if (sg and m["clips"]) else None,
                "dur": round((int(sg["End"]) - start) / FPS, 2) if sg else round(out[-1]["t"] + 1.5, 2),
                "end": round((int(dead["frame_num"]) - start) / FPS, 2),
                "winner": winner, "reason": reason, "lastBy": last["player"], "lastType": TYPE_EN.get(last["type"], last["type"]),
                "server": shots[0]["player"], "score": [score["A"], score["B"]],
                "up": sg["UpCourt"] if sg else None, "shots": out,
            })
            idx += 1
    return {"video": m["video"], "names": m["names"], "event": m["event"], "rallies": rallies}


def encode_clips(match):
    dst = os.path.join(ROOT, "public", "media", "rallies")
    os.makedirs(dst, exist_ok=True)
    for r in match["rallies"]:
        if not r["clip"]:
            continue
        src, out = os.path.join(CLIPS, r["clip"]), os.path.join(dst, r["clip"])
        if not os.path.exists(src):
            r["clip"] = None
            continue
        if os.path.exists(out):
            continue
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", "scale=854:-2", "-c:v", "libx264", "-crf", "28",
                        "-preset", "veryfast", "-an", "-movflags", "+faststart", out], check=True)


if __name__ == "__main__":
    matches = [build(m) for m in MATCHES]
    encode_clips(matches[0])
    os.makedirs(os.path.join(ROOT, "public", "data"), exist_ok=True)
    json.dump({"matches": matches}, open(os.path.join(ROOT, "public", "data", "matches.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))
    for mt in matches:
        rs = mt["rallies"]
        print(mt["video"], len(rs), "rallies", sum(1 for r in rs if r["clip"]), "clips",
              "final", [r["score"] for r in rs if r is rs[-1]], "sets", sorted({r["set"] for r in rs}))
