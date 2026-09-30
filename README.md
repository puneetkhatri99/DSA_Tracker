# DSA Tracker

Two Java DSA roadmaps plus Java notes:

- **Learning Series**: Striver's A2Z sheet in his order, 415 questions. The star-pattern printing problems are left out, and problems the sheet repeats are merged into one (the extra copies' links become chips). Each question links to LeetCode and GFG where the problem exists there, plus Striver's TUF page, video and article.
- **Practice 50**: 20 easy, 20 medium and 10 hard well-known interview problems (NeetCode 150 / Blind 75 / LeetCode 150) that are **not** in A2Z. They test you on problems you haven't seen, and the topics are mixed within each difficulty.

## Run

```sh
node server.js      # → http://localhost:3000
```

No npm install needed. Your progress (solve dates, how you solved each one, times, flags, notes, code, review log and finish date) is saved to `progress.json` in this folder. Commit it to keep a backup.

## Today

The app opens on **Today**, your plan for the day:

- **Reviews due**: every solved question whose spaced-repetition review is due, from both roadmaps.
- **New today**: the next unsolved questions in the Learning Series. Set a **finish date** and the daily number is worked out for you (questions left ÷ days left, fixed at the start of the day). With no date it is 3 a day (`DAILY_NEW` in `app.js`).
- **Activity**: a 20-week heatmap of solves and reviews, and your current streak.

## Solving a question

- When you tick a question, the app asks **How did it go?** and saves *Solved alone* until you pick something else. Needing a hint or seeing the solution brings the first review forward to tomorrow, and seeing the solution also marks the question to revise.
- **Timer**: opening an unsolved question (its title or a link chip) starts a timer in the header, and ticking it records the minutes. You can also start or stop it with the timer button on the row. Only one timer runs at a time.
- **Your own LeetCode link**: questions the sheet has only on GFG or TUF get a **+ LC** chip. Paste a LeetCode URL or just the slug (`two-sum`). It is saved in `progress.json`, shown first, and used for the title link. The pencil chip edits it; leave it blank to remove it.
- **Notes and code**: the pencil button opens your notes and a Java code box. Tab indents inside the code box, and the code is shown highlighted once you click away; click it to edit again.

## How the roadmap works

- The Learning Series follows Striver's step order (basics → sorting → arrays → … → graphs → DP → tries), and each step's sub-steps are shown as groups. The **Topic map** shows which steps build on which.
- A topic counts as done once 70% of its questions are solved. To change that, edit `PREREQ_DONE` at the top of `app.js` (1.0 = every question).
- **Next up** jumps to the first unsolved question, following the sheet's order. It respects your filters.
- Every Learning Series question carries Striver's **pattern** tags (Two Pointer, Monotonic Stack / Queue, Search on Answer …). The pattern filter shows one pattern across all topics.
- Striver sorts his questions into three tiers: basic, core and pro. Pro questions are harder or asked less often, and show a **Pro** tag. Choose **Essentials only** in the filter to hide them, so you can finish basic and core first and come back for pro. The counts and Next up follow the filter.

## Spaced repetition

Reviews follow the steps 1, 3, 7, 15, 30 and 60 days (`REVIEW_DAYS` in `app.js`). Solving alone starts at the 3-day step; needing a hint or the solution starts at the 1-day step.

- When reviews are due, a bell badge appears in the header, the tab title shows the count, and a banner appears on the roadmap. Click either to see only the due questions.
- To review, re-solve the question without looking at your old code, then click **Remembered** to move to the next interval or **Forgot** to start again at 1 day.
- After the 60-day review the question counts as *mastered*.
- The revise button (circular arrow) is separate from all of this. It is your own "revise this" flag.

## Practice

- **Mock interview** (button on Practice 50): one random unsolved question with a 45-minute countdown and the topic hidden. **Show topic** reveals it; using it records the question as solved with a hint.
- **Quiz**: flashcards made from the "When to use / signals" section of every pattern note. Read the signal, name the technique, then reveal the answer. Missed cards come back later in the deck. You can limit it to one topic.

## Keyboard shortcuts

- `/` focuses the search box, `n` jumps to Next up, `Esc` leaves a text box.
- In the quiz, `Space` shows the answer.

## Add more content

Everything is registered in `content.json`.

- **A note**: drop a `.md` file under `notes/` and add `{ "id", "title", "file" }` to a section in `content.json`. Markdown supports ```` ```java ```` highlighting and ```` ```mermaid ```` diagrams.
- **A roadmap**: add `roadmaps/<id>.json` and list it under `roadmaps` in `content.json` (add `"mock": true` to give it a Mock interview button). The format is:

```json
{ "id": "sd", "title": "System Design", "topics": [
  { "id": "basics", "title": "Basics", "prereqs": [], "note": "notes/sd/basics.md", "questions": [
    { "id": "sd-url-shortener", "title": "Design a URL shortener", "diff": "M", "tier": "core", "group": "Classic",
      "patterns": ["Caching"], "needs": [], "url": "https://…", "video": "https://…", "article": "https://…" }
  ]}
]}
```

`id` is the progress key and must be unique across all roadmaps. `diff` is `E`/`M`/`H`. `needs` lists earlier topics a question depends on; they show as lock chips until those topics are done. `needs` and `prereqs` must name **earlier** topics. `tier` (`basic`/`core`/`pro`), `patterns`, `alt`, `video`, `article` and `premium` are optional. `alt` holds extra practice links shown as chips next to the main one, for example `{ "GFG": "https://…", "LC Premium": "https://…" }`.

After editing, run `node check.js`. It validates ids, difficulties, tiers, prerequisite order and that every file exists.
