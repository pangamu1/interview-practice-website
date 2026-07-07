#!/usr/bin/env python3
"""
Build the practice question bank from the Obsidian DE-Interview-Prep vault.

Scans SQL / Python / PySpark question notes, pulls the verbatim question,
difficulty, plain-English hint, and reference solution, and writes them to
`data/questions.generated.js` as `window.QUESTION_BANK`.

The site reads that file directly (via <script>), so no server is needed.
Re-run this whenever the vault changes — questions are *replaced*, not stacked.

Usage:
    python3 build_questions.py
    python3 build_questions.py --vault "/path/to/Treasure/DE-Interview-Prep"
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import quote

# --- defaults ---------------------------------------------------------------
DEFAULT_VAULT = Path(
    "/Users/piruthviraj/Documents/Obsidian/Treasure/DE-Interview-Prep"
)
VAULT_NAME = "Treasure"          # Obsidian vault name for obsidian:// deep links
DOMAINS = {"SQL": "sql", "Python": "python", "PySpark": "pyspark"}
OUT = Path(__file__).parent / "data" / "questions.generated.js"

STARTER = {
    "sql": "-- Write your query here\n\n",
    "python": "# Write your solution here\n\ndef solve():\n    pass\n",
    "pyspark": (
        "from pyspark.sql import functions as F\n\n"
        "# Assume `df` is already loaded. Write your transformation here.\n"
    ),
}
CODE_FENCE = re.compile(r"```[a-zA-Z]*\n(.*?)```", re.DOTALL)
PLACEHOLDER_HINTS = ("what is this really asking", "filled in step 1")


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Return (frontmatter dict, body). Only the keys we need are parsed."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    raw, body = text[3:end], text[end + 4:]
    fm: dict = {}
    tags: list[str] = []
    in_tags = False
    for line in raw.splitlines():
        if in_tags:
            m = re.match(r"\s*-\s*(.+)$", line)
            if m:
                tags.append(m.group(1).strip())
                continue
            in_tags = False
        if re.match(r"\s*tags:\s*$", line):
            in_tags = True
            continue
        m = re.match(r"([A-Za-z_]+):\s*(.*)$", line)
        if m:
            fm[m.group(1)] = m.group(2).strip().strip('"')
    fm["tags"] = tags
    return fm, body


def section(body: str, heading: str) -> str:
    """Grab the text under a `## heading` up to the next `## `."""
    pat = re.compile(
        rf"^##\s+{re.escape(heading)}.*?$(.*?)(?=^##\s|\Z)",
        re.DOTALL | re.MULTILINE,
    )
    m = pat.search(body)
    return m.group(1).strip() if m else ""


def section_startswith(body: str, prefix: str) -> str:
    """Grab a section whose heading *starts with* prefix (e.g. 'My Attempt')."""
    pat = re.compile(
        rf"^##\s+{re.escape(prefix)}[^\n]*$(.*?)(?=^##\s|\Z)",
        re.DOTALL | re.MULTILINE,
    )
    m = pat.search(body)
    return m.group(1).strip() if m else ""


def clean_quote(text: str) -> str:
    """Strip Markdown blockquote markers, keep paragraph text."""
    lines = [re.sub(r"^>\s?", "", ln) for ln in text.splitlines()]
    # drop trailing parenthetical verification notes if isolated
    return "\n".join(lines).strip()


def is_real_code(code: str) -> bool:
    """True if the fenced block has non-comment, non-blank lines."""
    for ln in code.splitlines():
        s = ln.strip()
        if not s:
            continue
        if s.startswith(("--", "#")):
            continue
        return True
    return False


def first_real_code(text: str) -> str:
    for m in CODE_FENCE.finditer(text):
        code = m.group(1).rstrip("\n")
        if is_real_code(code):
            return code
    return ""


def extract_solution(body: str) -> str:
    for finder in (
        lambda: section(body, "Reference Solution"),
        lambda: section_startswith(body, "My Attempt"),
    ):
        code = first_real_code(finder())
        if code:
            return code
    return ""


def extract_hint(body: str) -> str:
    hint = section(body, "Plain-English Breakdown")
    low = hint.lower()
    if not hint or any(p in low for p in PLACEHOLDER_HINTS):
        return ""
    # keep prose + small tables but drop code fences to stay light
    return CODE_FENCE.sub("", hint).strip()


def extract_block(body: str, headings: list[str]) -> str:
    """First matching section's fenced code (preferred) or cleaned prose.

    Used for the optional `## Input Schema` / `## Expected Output` sections.
    Only reads sections that explicitly exist — never parsed from the prompt.
    """
    for h in headings:
        raw = section(body, h)
        if not raw:
            continue
        code = CODE_FENCE.search(raw)
        if code:
            return code.group(1).rstrip("\n")
        return clean_quote(raw)
    return ""


def obsidian_uri(rel_path: Path) -> str:
    file_arg = quote(f"DE-Interview-Prep/{rel_path.as_posix()}", safe="")
    return f"obsidian://open?vault={quote(VAULT_NAME)}&file={file_arg}"


def build(vault: Path) -> list[dict]:
    bank: list[dict] = []
    for folder, lang in DOMAINS.items():
        d = vault / folder
        if not d.is_dir():
            continue
        for md in sorted(d.glob("*.md")):
            fm, body = parse_frontmatter(md.read_text(encoding="utf-8"))
            if fm.get("type") != "question":
                continue
            question = clean_quote(section(body, "Question"))
            if not question:
                continue
            difficulty = (fm.get("difficulty") or "medium").lower()
            tags = fm.get("tags", [])
            bank.append(
                {
                    "id": md.stem,
                    "lang": lang,
                    "difficulty": difficulty,
                    "title": fm.get("title", md.stem).split(" - ")[-1],
                    "source": fm.get("source", ""),
                    "solved": "status/solid" in tags,
                    "prompt": question,
                    "input": extract_block(
                        body, ["Input Schema", "Input", "Setup"]
                    ),
                    "output": extract_block(
                        body, ["Expected Output", "Sample Output", "Output"]
                    ),
                    "hint": extract_hint(body),
                    "solution": extract_solution(body),
                    "note": obsidian_uri(md.relative_to(vault)),
                    "tags": [t for t in tags if "/" not in t][:5],
                }
            )
    return bank


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--vault", type=Path, default=DEFAULT_VAULT)
    args = ap.parse_args()

    if not args.vault.is_dir():
        print(f"Vault not found: {args.vault}", file=sys.stderr)
        return 1

    bank = build(args.vault)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(bank, indent=2, ensure_ascii=False)
    OUT.write_text(
        "// AUTO-GENERATED from the Obsidian vault by build_questions.py.\n"
        "// Do not edit by hand — re-run the generator to refresh.\n"
        f"window.QUESTION_BANK = {payload};\n",
        encoding="utf-8",
    )
    by_lang: dict[str, int] = {}
    for q in bank:
        by_lang[q["lang"]] = by_lang.get(q["lang"], 0) + 1
    print(f"Wrote {len(bank)} questions to {OUT.relative_to(OUT.parent.parent)}")
    for lang, n in sorted(by_lang.items()):
        print(f"  {lang:8} {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
