# Interview Bench

A quiet, light-mode workstation for simulating coding interviews in **SQL, PySpark, and Python**.

- **Left 30%** — the question: prompt, an optional hint, and a hideable reference solution.
- **Right 70%** — an IDE-like editor (CodeMirror: line numbers, syntax highlighting, bracket matching).
- **Top** — a high-visibility countdown "focus meter" that drains and shifts colour as time runs low. Defaults: Easy 15 / Medium 25 / Hard 35 min, adjustable ±5.

Python runs for real in the browser via [Pyodide](https://pyodide.org) (loaded on first Run). SQL and PySpark are a dry-run bench — talk through your answer, then reveal the reference.

## Run

No build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 4173   # then visit http://localhost:4173
```

## Questions

Questions ship in `data/questions.sample.js`. Personal questions are generated from a local Obsidian vault into `data/questions.generated.js` (gitignored):

```bash
python3 build_questions.py
```

Each generation **replaces** the bank — questions don't accumulate.
