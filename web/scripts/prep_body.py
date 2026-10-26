"""Pack a muscles + skeleton subset of the Human Atlas model (BodyParts3D 4.0, CC BY 4.0) for the body-focus view.
  python -I scripts/prep_body.py <path to a human-atlas checkout>
Writes public/body/body.bin and public/body/body.json. Each muscle is tagged with the coaching region it belongs to."""
import json, os, struct, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# region -> name fragments (lower case); first match wins, so more specific fragments come first
RULES = [
    ("forearm", ["flexor carpi", "extensor carpi", "palmaris", "pronator", "brachioradialis", "supinator",
                 "flexor digitorum superficialis", "flexor digitorum profundus", "flexor pollicis longus"]),
    ("shin", ["tibialis anterior", "fibularis", "peroneus", "extensor digitorum longus", "extensor hallucis longus"]),
    ("biceps", ["biceps brachii", "brachialis"]),
    ("hams", ["biceps femoris", "semitendinosus", "semimembranosus"]),
    ("deltoid", ["deltoid"]),
    ("pecs", ["pectoralis major", "pectoralis minor"]),
    ("obliques", ["external oblique", "internal oblique", "rectus abdominis", "transversus abdominis"]),
    ("hipflex", ["psoas", "iliacus", "adductor longus", "adductor brevis", "adductor magnus", "pectineus", "gracilis", "sartorius"]),
    ("quads", ["rectus femoris", "vastus"]),
    ("traps", ["trapezius", "rhomboid", "levator scapulae"]),
    ("cuff", ["infraspinatus", "supraspinatus", "teres minor", "subscapularis"]),
    ("lats", ["latissimus", "teres major", "serratus posterior inferior"]),
    ("triceps", ["triceps"]),
    ("lowback", ["iliocostalis lumborum", "iliocostalis thoracis", "longissimus thoracis", "spinalis thoracis", "quadratus lumborum", "multifidus"]),
    ("glutes", ["gluteus"]),
    ("calves", ["gastrocnemius", "soleus", "plantaris"]),
]
FORCE_MUSCLE = ("tibialis anterior", "subscapularis")  # filed under "skeletal" in the source


def region_of(name):
    n = name.lower()
    if "hallucis" in n and "extensor hallucis longus" not in n:
        return None
    for reg, keys in RULES:
        if any(k in n for k in keys):
            return reg
    return None


def main(src):
    atlas = json.load(open(os.path.join(src, "public/models/atlas.json"), encoding="utf-8"))
    chunks = [open(os.path.join(src, "public", c["url"].lstrip("/")), "rb").read() for c in atlas["chunks"]]
    out, parts = bytearray(), []
    for p in atlas["parts"]:
        name, system = p["name"], p["system"]
        forced = any(k in name.lower() for k in FORCE_MUSCLE)
        if system not in ("muscular", "skeletal") or (system == "skeletal" and p["indexCount"] < 300 and not forced):
            continue
        kind = "muscle" if system == "muscular" or forced else "bone"
        buf, n, m = chunks[p["chunk"]], p["vertexCount"], p["indexCount"]
        pos = buf[p["positions"]:p["positions"] + n * 12]
        nor = buf[p["normals"]:p["normals"] + n * 6]
        idx = struct.unpack_from(f"<{m}I", buf, p["indices"])
        wide = n > 65535
        rec = {"name": name, "kind": kind, "region": region_of(name) if kind == "muscle" else None, "n": n, "m": m, "wide": wide}
        rec["pos"] = len(out); out += pos
        while len(out) % 4: out += b"\0"
        rec["nor"] = len(out); out += nor
        while len(out) % 4: out += b"\0"
        rec["idx"] = len(out); out += struct.pack(f"<{m}{'I' if wide else 'H'}", *idx)
        while len(out) % 4: out += b"\0"
        parts.append(rec)
    dst = os.path.join(ROOT, "public", "body")
    os.makedirs(dst, exist_ok=True)
    open(os.path.join(dst, "body.bin"), "wb").write(out)
    json.dump({"source": "BodyParts3D 4.0, The Database Center for Life Science, CC BY 4.0, via Human Atlas (MIT)",
               "parts": parts}, open(os.path.join(dst, "body.json"), "w", encoding="utf-8"), separators=(",", ":"))
    tagged = sum(1 for p in parts if p["region"])
    print(f"{len(parts)} parts, {tagged} tagged muscles, {len(out) / 1e6:.1f} MB")


if __name__ == "__main__":
    main(sys.argv[1])
