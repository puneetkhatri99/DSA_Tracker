# DSA Tracker

A topic-wise Java DSA roadmap (Striver A2Z + NeetCode 150/250 + Blind 75 + LeetCode Top Interview 150 + LeetCode 75, deduped to 611 questions) plus Java notes.

## Run

```sh
node server.js      # → http://localhost:3000
```

No npm install needed. Your progress (solved date, revise flag, star, notes) is saved to `progress.json` in this folder. Commit it to keep a backup.

## How the roadmap works

- Topics are ordered as a build-up (basics → sorting → arrays → … → graphs → DP → tries). The **Topic map** shows the prerequisite graph.
- Each question lives in the latest topic it needs. Its 🔒 chips list the other earlier topics it depends on. Example: *Sort List* sits in Linked List and needs Sorting + Two Pointers.
- A topic counts as done once all of its questions are solved. To loosen that, change `PREREQ_DONE` at the top of `app.js`.
- **Next up** jumps to the first unsolved question whose prerequisites are met. It respects your filters, so with the filter on "Blind 75" it only walks Blind 75.

## Spaced repetition

Solving a question schedules reviews after 1, 3, 7, 15, 30 and 60 days (`REVIEW_DAYS` in `app.js`).

- When reviews are due, a 🔔 badge appears in the header, the tab title shows the count, and a banner appears on the roadmap. Click either to see only the due questions.
- To review, re-solve the question without looking at your old code, then click **Remembered** to move to the next interval or **Forgot** to start again at 1 day.
- After the 60-day review the question counts as *mastered*.
- The ↻ button is separate from all of this. It is your own "revise this" flag.

## Add more content

Everything is registered in `content.json`.

- **A note**: drop a `.md` file under `notes/` and add `{ "id", "title", "file" }` to a section in `content.json`. Markdown supports ```` ```java ```` highlighting and ```` ```mermaid ```` diagrams.
- **A roadmap**: add `roadmaps/<id>.json` and list it under `roadmaps` in `content.json`. The format is:

```json
{ "id": "sd", "title": "System Design", "topics": [
  { "id": "basics", "title": "Basics", "prereqs": [], "note": "notes/sd/basics.md", "questions": [
    { "id": "sd-url-shortener", "title": "Design a URL shortener", "diff": "M", "group": "Classic", "src": [],
      "needs": [], "url": "https://…", "video": "https://…", "article": "https://…" }
  ]}
]}
```

`id` is the progress key and must be unique across all roadmaps. `diff` is `E`/`M`/`H`. `needs` and `prereqs` must name **earlier** topics. `group`, `alt`, `video`, `article` and `premium` are optional. `alt` holds extra practice links shown as chips next to the main one, for example `{ "GFG": "https://…", "LC Premium": "https://…" }`.

After editing, run `node check.js`. It validates ids, difficulties, sources, prerequisite order and that every file exists.
