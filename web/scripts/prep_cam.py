"""Adds a court->clip-pixel homography to each match in public/data/matches.json, for the highlight reel's
virtual camera. The research homography maps image pixels (1280x720) to the court template; this inverts it,
composes metres->template and scales to the 854x480 rally clips."""
import json, os, sys
import numpy as np
RES = os.environ.get("RESEARCH_DIR", "research")  # the lab's research checkout (not published)
sys.path.insert(0, os.path.join(RES, "src"))
import courtcam as cc

HERE = os.path.dirname(__file__)
P = os.path.join(HERE, "..", "public", "data", "matches.json")
D = json.load(open(P, encoding="utf8"))
HOM = cc.load_homographies(os.path.join(RES, "data/2025\u55ae\u6253/Table/homography_matrix.csv"))
T = np.array([[cc.TPL_W / cc.COURT_W, 0, cc.TPL_X0], [0, cc.TPL_H / cc.COURT_L, cc.TPL_Y0], [0, 0, 1]])
S = np.diag([854 / 1280, 480 / 720, 1])
for m in D["matches"]:
    if m["video"] not in HOM:
        print("no homography for", m["video"]); continue
    M = S @ np.linalg.inv(np.asarray(HOM[m["video"]], float)) @ T
    M = M / M[2, 2]
    m["cam"] = [round(float(v), 8) for v in M.ravel()]
    px = lambda X, Y: (lambda v: (round(v[0] / v[2]), round(v[1] / v[2])))(M @ [X, Y, 1])
    print(m["video"][:30], "corners far-L/far-R/near-R/near-L:", px(0, 0), px(6.1, 0), px(6.1, 13.4), px(0, 13.4))
json.dump(D, open(P, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
