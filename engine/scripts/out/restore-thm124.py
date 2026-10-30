"""Replace corrupted thm-124 proof with HEAD version."""
import subprocess
from pathlib import Path

tex_path = Path("src/data/theorems/Rules_of_Node_Connectivity.tex")
cur = tex_path.read_text(encoding="utf-8")
head = subprocess.check_output(
    ["git", "show", "HEAD:src/data/theorems/Rules_of_Node_Connectivity.tex"],
    text=True,
    encoding="utf-8",
    errors="replace",
)

marker = r"\[, i \Pc j, i \On, \Rq , i \On, i \Pc j,\]"
proof_hdr = ", i \\Pc j, i \\On,"


def span(tex: str) -> tuple[int, int]:
    idx = tex.find(marker)
    if idx < 0:
        raise SystemExit("marker missing")
    p = tex.find(proof_hdr, idx + len(marker))
    if p < 0:
        raise SystemExit("proof hdr missing")
    end = tex.find(r"\end{math}", p)
    if end < 0:
        raise SystemExit("end math missing")
    return p, end + len(r"\end{math}")


cs, ce = span(cur)
hs, he = span(head)
new = cur[:cs] + head[hs:he] + cur[ce:]
tex_path.write_text(new, encoding="utf-8")
print(f"restored thm124: removed {ce-cs} chars, inserted {he-hs} chars")
print(f"file size {tex_path.stat().st_size}")
