/* ============================================================
   Interview Bench — app logic
   Timer (focus meter) · language/difficulty routing ·
   question loading from the vault-generated bank · Python run.
   ============================================================ */
(function () {
  "use strict";

  // Default minutes per difficulty (interview norms; adjustable with ±5).
  const DEFAULT_MINUTES = { easy: 15, medium: 25, hard: 35 };
  const CM_MODE = { sql: "text/x-sql", python: "python", pyspark: "python" };
  const FILE_EXT = { sql: "solution.sql", python: "solution.py", pyspark: "solution.py" };

  const BANK = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];

  const state = {
    lang: "sql",
    diff: "easy",
    totalSec: DEFAULT_MINUTES.easy * 60,
    leftSec: DEFAULT_MINUTES.easy * 60,
    running: false,
    ticker: null,
    current: null,
  };

  // ---- element refs ----
  const $ = (id) => document.getElementById(id);
  const el = {
    langSeg: $("lang-seg"),
    diffSeg: $("diff-seg"),
    timer: $("timer"),
    clock: $("clock"),
    fill: $("fill"),
    minus: $("minus"),
    plus: $("plus"),
    startpause: $("startpause"),
    reset: $("reset"),
    qDiff: $("q-diff"),
    qSource: $("q-source"),
    qTitle: $("q-title"),
    qPrompt: $("q-prompt"),
    qInput: $("q-input"),
    ioLabel: $("io-label"),
    inputBox: $("input-box"),
    qOutput: $("q-output"),
    outputBox: $("output-box"),
    qHint: $("q-hint"),
    hintBox: $("hint-box"),
    solBox: $("sol-box"),
    qSolution: $("q-solution"),
    qNote: $("q-note"),
    nextQ: $("next-q"),
    filename: $("ide-filename"),
    resetCode: $("reset-code"),
    run: $("run"),
    console: $("console"),
    consoleOut: $("console-out"),
    clearConsole: $("clear-console"),
  };

  // ---- CodeMirror editor ----
  const editor = CodeMirror.fromTextArea($("code"), {
    mode: CM_MODE.sql,
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    matchBrackets: true,
    autoCloseBrackets: true,
    styleActiveLine: true,
    lineWrapping: false,
  });

  // ============================================================
  //  TIMER
  // ============================================================
  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function paintTimer() {
    el.clock.textContent = fmt(Math.max(0, state.leftSec));
    const ratio = state.totalSec ? state.leftSec / state.totalSec : 0;
    el.fill.style.transform = "scaleX(" + Math.max(0, ratio) + ")";

    el.timer.classList.toggle("is-running", state.running);
    el.timer.classList.remove("is-warn", "is-crit");
    if (ratio <= 0.2) el.timer.classList.add("is-crit");
    else if (ratio <= 0.5) el.timer.classList.add("is-warn");

    const adjustable = !state.running;
    el.minus.disabled = !adjustable || state.totalSec <= 300;
    el.plus.disabled = !adjustable;
  }

  function setMinutes(min) {
    state.totalSec = min * 60;
    state.leftSec = min * 60;
    paintTimer();
  }

  function tick() {
    state.leftSec -= 1;
    if (state.leftSec <= 0) {
      state.leftSec = 0;
      stopTimer();
      paintTimer();
      el.clock.textContent = "TIME";
      flashConsole("⏱  Time's up. Wrap up your answer and review.", "err");
      return;
    }
    paintTimer();
  }

  function startTimer() {
    if (state.running || state.leftSec <= 0) return;
    state.running = true;
    el.startpause.textContent = "Pause";
    el.startpause.classList.add("is-paused");
    state.ticker = setInterval(tick, 1000);
    paintTimer();
  }

  function pauseTimer() {
    state.running = false;
    el.startpause.textContent = "Resume";
    el.startpause.classList.remove("is-paused");
    clearInterval(state.ticker);
    paintTimer();
  }

  function stopTimer() {
    state.running = false;
    el.startpause.textContent = "Start";
    el.startpause.classList.remove("is-paused");
    clearInterval(state.ticker);
  }

  function resetTimer() {
    stopTimer();
    state.leftSec = state.totalSec;
    paintTimer();
  }

  el.startpause.addEventListener("click", () => {
    if (state.leftSec <= 0) resetTimer();
    state.running ? pauseTimer() : startTimer();
  });
  el.reset.addEventListener("click", resetTimer);
  el.minus.addEventListener("click", () => {
    if (state.totalSec > 300) setMinutes(state.totalSec / 60 - 5);
  });
  el.plus.addEventListener("click", () => setMinutes(state.totalSec / 60 + 5));

  // ============================================================
  //  QUESTION LOADING
  // ============================================================
  const STARTER = {
    sql: "-- Write your query here\n\n",
    python: "# Write your solution here\n\n",
    pyspark:
      "from pyspark.sql import functions as F\n\n# Assume `df` is loaded.\n\n",
  };

  function pool() {
    return BANK.filter(
      (q) => q.lang === state.lang && q.difficulty === state.diff
    );
  }

  // light-touch inline markdown -> html for prompt/hint (`code`, **bold**, paragraphs)
  function md(text) {
    const esc = (s) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    return esc(text || "")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .split(/\n{2,}/)
      .map((p) => "<p>" + p.replace(/\n/g, "<br>") + "</p>")
      .join("");
  }

  function renderQuestion(q) {
    state.current = q;
    if (!q) {
      el.qTitle.textContent = "No question for this combo yet";
      el.qSource.textContent = "";
      el.qDiff.textContent = state.diff;
      el.qDiff.setAttribute("data-d", state.diff);
      el.qPrompt.innerHTML =
        "<p class='muted'>Nothing in the vault for <strong>" +
        state.lang +
        " · " +
        state.diff +
        "</strong> yet. Add a note in Obsidian and re-run <code>build_questions.py</code>, or try another combo.</p>";
      el.inputBox.hidden = true;
      el.outputBox.hidden = true;
      el.hintBox.hidden = true;
      el.solBox.hidden = true;
      el.qNote.hidden = true;
      editor.setValue(STARTER[state.lang]);
      return;
    }

    el.qTitle.textContent = q.title;
    el.qDiff.textContent = q.difficulty;
    el.qDiff.setAttribute("data-d", q.difficulty);
    el.qSource.textContent = q.source || "";
    el.qPrompt.innerHTML = md(q.prompt);

    if (q.input) {
      el.ioLabel.textContent = q.lang === "python" ? "Given" : "Input schema";
      el.qInput.textContent = q.input;
      el.inputBox.hidden = false;
    } else {
      el.inputBox.hidden = true;
    }

    if (q.output) {
      el.qOutput.textContent = q.output;
      el.outputBox.hidden = false;
      el.outputBox.open = false;
    } else {
      el.outputBox.hidden = true;
    }

    if (q.hint) {
      el.qHint.innerHTML = md(q.hint);
      el.hintBox.hidden = false;
      el.hintBox.open = false;
    } else {
      el.hintBox.hidden = true;
    }

    if (q.solution) {
      el.qSolution.textContent = q.solution;
      el.solBox.hidden = false;
      el.solBox.open = false;
    } else {
      el.solBox.hidden = true;
    }

    if (q.note) {
      el.qNote.href = q.note;
      el.qNote.hidden = false;
    } else {
      el.qNote.hidden = true;
    }

    editor.setValue(STARTER[state.lang]);
  }

  let lastId = null;
  function loadQuestion(shuffle) {
    const p = pool();
    if (!p.length) return renderQuestion(null);
    let pick;
    if (shuffle && p.length > 1) {
      do {
        pick = p[Math.floor(Math.random() * p.length)];
      } while (pick.id === lastId);
    } else {
      pick = p[0];
    }
    lastId = pick.id;
    renderQuestion(pick);
  }

  el.nextQ.addEventListener("click", () => loadQuestion(true));

  // ============================================================
  //  LANGUAGE / DIFFICULTY ROUTING
  // ============================================================
  function selectSeg(seg, btn) {
    seg.querySelectorAll(".seg__btn").forEach((b) =>
      b.classList.toggle("is-active", b === btn)
    );
  }

  el.langSeg.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg__btn");
    if (!btn) return;
    selectSeg(el.langSeg, btn);
    state.lang = btn.dataset.lang;
    editor.setOption("mode", CM_MODE[state.lang]);
    el.filename.textContent = FILE_EXT[state.lang];
    loadQuestion(false);
  });

  el.diffSeg.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg__btn");
    if (!btn) return;
    selectSeg(el.diffSeg, btn);
    state.diff = btn.dataset.diff;
    setMinutes(DEFAULT_MINUTES[state.diff]);
    stopTimer();
    loadQuestion(false);
  });

  el.resetCode.addEventListener("click", () => {
    editor.setValue(STARTER[state.lang]);
    editor.focus();
  });

  // ============================================================
  //  CONSOLE + RUN
  // ============================================================
  function writeConsole(html) {
    el.console.dataset.empty = "false";
    el.consoleOut.innerHTML = html;
  }
  function flashConsole(text, cls) {
    writeConsole('<span class="' + (cls || "") + '">' + text + "</span>");
  }
  el.clearConsole.addEventListener("click", () => {
    el.consoleOut.innerHTML = "";
    el.console.dataset.empty = "true";
  });

  // Python runs for real via Pyodide (lazy-loaded on first run).
  let pyodide = null;
  let pyodideLoading = null;

  function loadPyodide_() {
    if (pyodide) return Promise.resolve(pyodide);
    if (pyodideLoading) return pyodideLoading;
    flashConsole("Loading Python runtime (first run only)…", "muted");
    pyodideLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";
      s.onload = async () => {
        try {
          pyodide = await window.loadPyodide();
          resolve(pyodide);
        } catch (err) {
          reject(err);
        }
      };
      s.onerror = () => reject(new Error("Could not load Pyodide (offline?)"));
      document.head.appendChild(s);
    });
    return pyodideLoading;
  }

  async function runPython() {
    el.run.disabled = true;
    try {
      const py = await loadPyodide_();
      py.runPython(`
import sys, io
sys.stdout = sys.stderr = io.StringIO()
`);
      let errored = false;
      try {
        await py.runPythonAsync(editor.getValue());
      } catch (err) {
        errored = true;
        py.runPython(
          "import sys; sys.stdout.write(''.join(__import__('traceback').format_exc()))"
        );
        // fall through to read buffer, but also capture JS-side message
        var jsErr = String(err).split("\n").slice(-6).join("\n");
      }
      const out = py.runPython("sys.stdout.getvalue()");
      const esc = (t) =>
        t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      if (errored) {
        writeConsole('<span class="err">' + esc(jsErr || out) + "</span>");
      } else {
        writeConsole(
          out.trim()
            ? esc(out)
            : '<span class="muted">(ran with no output — add print() to see values)</span>'
        );
      }
    } catch (err) {
      flashConsole("⚠  " + err.message, "err");
    } finally {
      el.run.disabled = false;
    }
  }

  function runReferenceOnly() {
    const label = state.lang === "pyspark" ? "PySpark" : "SQL";
    let msg =
      '<span class="muted">No in-browser engine for ' +
      label +
      " — this is a dry-run bench. Talk through your approach, then check it against the reference.</span>";
    if (state.current && state.current.solution) {
      msg +=
        '\n\n<span class="ok">Tip:</span> use “Reveal reference solution” in the question panel to compare.';
    }
    writeConsole(msg);
  }

  el.run.addEventListener("click", () => {
    if (state.lang === "python") runPython();
    else runReferenceOnly();
  });

  // Cmd/Ctrl+Enter to run
  editor.setOption("extraKeys", {
    "Cmd-Enter": () => el.run.click(),
    "Ctrl-Enter": () => el.run.click(),
  });

  // ============================================================
  //  BOOT
  // ============================================================
  function boot() {
    if (!BANK.length) {
      el.qTitle.textContent = "No questions loaded";
      el.qPrompt.innerHTML =
        "<p class='muted'>Run <code>python3 build_questions.py</code> to pull questions from your vault.</p>";
    }
    setMinutes(DEFAULT_MINUTES[state.diff]);
    el.filename.textContent = FILE_EXT[state.lang];
    loadQuestion(false);
    paintTimer();
  }

  boot();
})();
