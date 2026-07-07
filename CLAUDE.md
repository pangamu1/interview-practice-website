# Interview Bench

A single-page, light-mode web app to simulate coding interviews for **SQL, PySpark, and Python**. Left 30% = question (prompt, hint, reference solution); right 70% = an IDE-like editor with a prominent countdown timer.

## Run it

Just open `index.html` in a browser — no build step, no server. (Or `python3 -m http.server` for a clean origin.)

## Questions come from the Obsidian vault

The question bank is generated from the `DE-Interview-Prep` Obsidian vault, which is the single source of truth. To refresh after editing notes:

```bash
python3 build_questions.py
```

This writes `data/questions.generated.js` (gitignored). Questions are **replaced, not stacked**.

## Layout

- `index.html` / `styles.css` / `app.js` — the app (vanilla JS + CodeMirror via CDN)
- `build_questions.py` — vault → `data/questions.generated.js`
- `data/questions.sample.js` — committed fallback bank (used when the generated file is absent)

## Notes

- Python runs for real in-browser via Pyodide (lazy-loaded on first Run). SQL/PySpark have no engine — they're a dry-run bench with a reveal-the-reference flow.
- Timer defaults: Easy 15 / Medium 25 / Hard 35 min, adjustable ±5.

See `CLAUDE.local.md` for progress, decisions, and vault details.
