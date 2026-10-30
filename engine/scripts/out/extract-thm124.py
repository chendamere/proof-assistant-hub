import subprocess
from pathlib import Path

head = subprocess.check_output(
    ["git", "show", "HEAD:src/data/theorems/Rules_of_Node_Connectivity.tex"],
    text=True,
    encoding="utf-8",
    errors="replace",
)
cur = Path("src/data/theorems/Rules_of_Node_Connectivity.tex").read_text(encoding="utf-8")


def extract(tex: str) -> str:
    # Display statement for thm 124
    marker = r"\[, i \Pc j, i \On, \Rq , i \On, i \Pc j,\]"
    idx = tex.find(marker)
    if idx < 0:
        raise SystemExit("marker not found")
    # proof starts after "proof:\\" following the display
    proof_hdr = ", i \\Pc j, i \\On,"
    p = tex.find(proof_hdr, idx + len(marker))
    if p < 0:
        raise SystemExit("proof hdr not found")
    end = tex.find(r"\end{math}", p)
    if end < 0:
        raise SystemExit("end math not found")
    return tex[p : end + len(r"\end{math}")]


h = extract(head)
c = extract(cur)
print("HEAD lines", h.count("\n") + 1, "chars", len(h))
print("CUR lines", c.count("\n") + 1, "chars", len(c))
Path("engine/scripts/out/thm124-head.tex").write_text(h, encoding="utf-8")
Path("engine/scripts/out/thm124-cur.tex").write_text(c, encoding="utf-8")
print("HEAD tail:\n", h[-400:])
print("---")
print("CUR around corruption (chars 8000-9000):\n", c[8000:9200] if len(c) > 9000 else c[-800:])
