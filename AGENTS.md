# Agent notes

This repo is a one-day tool for Suresh Kumar, a teacher at MS Yug, Udhampur. Read `research.md` and `PLAN.md` before changing scope.

## Hard limits

- Do not invent student rows, marks, quotes, photos, surprises, or sources. If a fact is missing, leave a blank and ask.
- `data.csv` is an anonymized copy of a file the author placed in `local/`. Keep every mark, blank, and odd value. Do not randomise, smooth, or fill scores. Do not commit `local/`.
- Do not write `reflection.md`. That file is the author's, without AI.
- Do not add a to-do app, chatbot, weather widget, or anything fed by a downloaded or generated dataset.
- The tool reads `data.csv` and produces the one output named in `PLAN.md`. Do not start the exam scheduler, SQLite, or a layout designer unless that output already runs and the author asks.
- Student data stays local. No network calls, accounts, or telemetry in the app.
- Raw school `.xlsx` files stay untracked. Committed rows use `Student_01` style labels. Photos must not show student names or marks.
- Do not commit unless the author asks. The first commit they ask for is `research.md` alone.
- Commit messages in the author's words. Never add a Co-authored-by trailer.

## Stack

TypeScript and Vite. Add a library only when the current output needs it. Prefer a small local page so a screen recording can show the real file going in and the list coming out.

## When something is ambiguous

Ask. Do not guess the pass mark, the component weights, the grade bands, or which of the four pains is today's output.
