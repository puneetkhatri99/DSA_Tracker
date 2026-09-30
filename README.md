# DSA Tracker

Two Java DSA roadmaps plus Java notes, with accounts so you and the people you invite each keep your own progress.

- **Learning Series**: Striver's A2Z sheet in his order, 415 questions. The star-pattern printing problems are left out, and problems the sheet repeats are merged into one (the extra copies' links become chips). Each question links to LeetCode and GFG where the problem exists there, plus Striver's TUF page, video and article.
- **Practice 50**: 20 easy, 20 medium and 10 hard well-known interview problems (NeetCode 150 / Blind 75 / LeetCode 150) that are **not** in A2Z. They test you on problems you haven't seen, and the topics are mixed within each difficulty.

The backend is FastAPI + MongoDB (`backend/`), the frontend is React + TypeScript built with Vite (`frontend/`). In production FastAPI serves the built frontend, so it runs as one service.

## First-time setup

You need Python 3.12+, Node 20+ and a MongoDB database (for example a free Atlas cluster).

1. Create `.env` in the repo root (git ignores it) from `.env.example`:

   ```sh
   MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority
   DB_NAME=DSA_tracker
   COOKIE_SECURE=false   # local http only; leave it out when deployed on https
   ```

   In Atlas, **Network Access** must allow your IP (and later your host's).

2. Install, load the content and create your admin account:

   ```sh
   cd backend
   python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
   .venv/bin/python -m app.cli seed                                     # roadmaps + notes from content/
   .venv/bin/python -m app.cli create-admin --email you@example.com --name "Your Name"   # asks for a password
   .venv/bin/python -m app.cli import-progress --email you@example.com ../progress.json  # optional: progress from the old app
   ```

3. Build the frontend and start the server:

   ```sh
   cd frontend && npm install && npm run build && cd ..
   cd backend && .venv/bin/uvicorn app.main:app --port 8000     # → http://localhost:8000
   ```

For frontend work, run `npm run dev` in `frontend/` as well and open http://localhost:5173. Vite reloads on save and passes `/api` calls to uvicorn on :8000.

## Accounts

- **Login** puts a session cookie in your browser that lasts **30 days** (httpOnly, so page scripts can't read it). Log out from the account menu at the top right. Passwords are hashed with argon2, and 10 wrong passwords for one email lock it for 15 minutes.
- **Inviting someone**: account menu → **Invite people** → **New invite link**. The link is copied for you. It creates one account and expires after 7 days; you can revoke it before it is used. There is no public sign-up.
- Everyone has their own progress, notes, code and review schedule. Roadmaps and study notes are shared.
- **Study notes**: only the admin sees **Edit note** (markdown with a live preview) and **New note**. Edits are saved in MongoDB. Running `seed` again never overwrites an edited note (`seed --force-notes` resets them to the files in `content/`).

## Today

The app opens on **Today**, your plan for the day:

- **Reviews due**: every solved question whose spaced-repetition review is due, from both roadmaps.
- **New today**: the next unsolved questions in the Learning Series. Set a **finish date** and the daily number is worked out for you (questions left ÷ days left, fixed at the start of the day). With no date it is 3 a day (`DAILY_NEW` in `frontend/src/lib.ts`).
- **Activity**: a 20-week heatmap of solves and reviews, and your current streak.

## Solving a question

- When you tick a question, the app asks **How did it go?** and saves *Solved alone* until you pick something else. Needing a hint or seeing the solution brings the first review forward to tomorrow, and seeing the solution also marks the question to revise.
- **Timer**: opening an unsolved question (its title or a link chip) starts a timer in the header, and ticking it records the minutes. You can also start or stop it with the timer button on the row. Only one timer runs at a time.
- **Your own LeetCode link**: questions the sheet has only on GFG or TUF get a **+ LC** chip. Paste a LeetCode URL or just the slug (`two-sum`). It is shown first and used for the title link. The pencil chip edits it; leave it blank to remove it.
- **Notes and code**: the pencil button opens your notes and a Java code box. Tab indents inside the code box, and the code is shown highlighted once you click away; click it to edit again.
- Every change is saved to MongoDB within half a second (the header says *Saved*). Each question is saved on its own, so two devices never overwrite each other's work.

## How the roadmap works

- The Learning Series follows Striver's step order (basics → sorting → arrays → … → graphs → DP → tries), and each step's sub-steps are shown as groups. The **Topic map** shows which steps build on which.
- A topic counts as done once 70% of its questions are solved (`PREREQ_DONE` in `frontend/src/lib.ts`; 1.0 = every question).
- **Next up** jumps to the first unsolved question, following the sheet's order. It respects your filters.
- Every Learning Series question carries Striver's **pattern** tags (Two Pointer, Monotonic Stack / Queue, Search on Answer …). The pattern filter shows one pattern across all topics.
- Striver sorts his questions into three tiers: basic, core and pro. Pro questions are harder or asked less often, and show a **Pro** tag. Choose **Essentials only** in the filter to hide them. The counts and Next up follow the filter.

## Spaced repetition

Reviews follow the steps 1, 3, 7, 15, 30 and 60 days (`REVIEW_DAYS` in `frontend/src/lib.ts`). Solving alone starts at the 3-day step; needing a hint or the solution starts at the 1-day step.

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

## Deploy on Vercel

The repo is set up as one Vercel project: `pyproject.toml` tells Vercel where the FastAPI app is (`backend.app.main:app`) and to build the React app during the deploy, and `vercel.json` keeps the frontend's `node_modules` out of the Python bundle. Vercel serves the built site from its CDN and sends `/api/...` to FastAPI, all on one domain, so the login cookie just works.

1. **Atlas → Network Access → Add IP Address → Allow access from anywhere** (`0.0.0.0/0`). Vercel has no fixed IP addresses, so this is required; make sure your database user's password is strong.
2. **vercel.com → Add New → Project →** import this GitHub repo. Leave the framework as detected (FastAPI) and the root directory as the repo root.
3. **Environment Variables** (same screen, or Settings → Environment Variables later):
   - `MONGODB_URI`: the value from your `.env`
   - `DB_NAME`: `DSA_tracker`

   Do **not** add `COOKIE_SECURE`; Vercel is https, so the secure default is right.
4. **Deploy.** Vercel installs the Python packages, runs `npm ci && npm run build` in `frontend/`, and gives you a `https://<project>.vercel.app` address.
5. **Settings → Functions → Function Region**: pick the region closest to your Atlas cluster (Atlas shows it on the cluster card), then redeploy. Each request makes a few database calls, so this is the biggest speed win.

Vercel builds production from the repo's default branch (`main`); other branches get preview deployments behind Vercel login. The database already holds the content and your account, so you can log in right away. Against a new database, run `seed` and `create-admin` once from your machine with that `MONGODB_URI`.

Invite links use whatever address you open the app on, so create them from the Vercel URL (or your custom domain), not from localhost.

### Other hosts

The `Dockerfile` builds the frontend and runs everything in one container, for Render, Railway or Fly: create a web service from the repo, set `MONGODB_URI` and `DB_NAME`, and allow the host in Atlas Network Access.

## Add content

Roadmaps and notes are loaded into MongoDB from `content/` by `python -m app.cli seed`, which validates everything first (unique ids, earlier-topic prerequisites, links, difficulties, tiers). Roadmaps are replaced on every seed; your progress is kept because it is stored by question id.

- **A note**: drop a `.md` file under `content/notes/` and add `{ "id", "title", "file" }` to a section in `content/content.json`, then seed. Or, as the admin, click **New note** in the app. Markdown supports ```` ```java ```` highlighting and ```` ```mermaid ```` diagrams.
- **A roadmap**: add `content/roadmaps/<id>.json`, list it under `roadmaps` in `content/content.json` (the `title` there is the short nav label; add `"mock": true` for a Mock interview button), then seed. The format is:

```json
{ "id": "sd", "title": "System Design", "topics": [
  { "id": "basics", "title": "Basics", "prereqs": [], "note": "notes/sd/basics.md", "questions": [
    { "id": "sd-url-shortener", "title": "Design a URL shortener", "diff": "M", "tier": "core", "group": "Classic",
      "patterns": ["Caching"], "needs": [], "url": "https://…", "video": "https://…", "article": "https://…" }
  ]}
]}
```

`id` is the progress key and must be unique across all roadmaps. `diff` is `E`/`M`/`H`. `needs` lists earlier topics a question depends on; they show as lock chips until those topics are done. `needs` and `prereqs` must name **earlier** topics. `tier` (`basic`/`core`/`pro`), `patterns`, `alt`, `video`, `article` and `premium` are optional. `alt` holds extra practice links shown as chips next to the main one, for example `{ "GFG": "https://…", "LC Premium": "https://…" }`.

## Tests

```sh
cd backend && .venv/bin/pytest -q
```

They run against the `MONGODB_URI` in `.env`, in a throwaway `dsa_tracker_test_…` database that is dropped afterwards. They cover login and the 30-day cookie, rate limiting, invites (single use, expiry, revoke), admin-only note editing, progress validation and privacy between users.
