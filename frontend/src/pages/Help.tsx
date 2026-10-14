import {
  ArrowCounterClockwiseIcon, ArticleIcon, BellIcon, CheckIcon, LockSimpleIcon, NotePencilIcon, PlayCircleIcon, StarIcon, TimerIcon, XIcon,
} from '@phosphor-icons/react';
import { Link } from 'react-router';
import { DAILY_NEW, HOW, MOCK_MINUTES, PREREQ_DONE, REVIEW_DAYS } from '../lib';
import { useStore } from '../store';

const SECTIONS = [
  ['row', 'A question row'], ['solving', 'Solving a question'], ['reviews', 'Reviews and spaced repetition'],
  ['revise', 'Revise and star flags'], ['today', 'Today'], ['roadmap', 'The roadmap'], ['practice', 'Mock interview and quiz'],
  ['notes', 'Study notes and My Notes'], ['account', 'Your account'], ['keys', 'Keyboard shortcuts'],
] as const;

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

// How the app works, kept in step with the constants it describes.
export default function Help() {
  const { roadmaps, user } = useStore();
  const learn = roadmaps[0];
  const mock = roadmaps.find(r => r.mock);
  return <>
    <section className="head">
      <h1>Help</h1>
      <p className="lede">What every button does, how review dates are worked out, and how the rest of the app fits together.</p>
    </section>
    <article className="md help">
      <nav className="help-toc" aria-label="On this page">
        <ol>{SECTIONS.map(([id, title]) => <li key={id}><a href={`#${id}`}>{title}</a></li>)}</ol>
      </nav>

      <h2 id="row">A question row</h2>
      <p>Every question looks the same wherever it appears (roadmap, Today, reviews). From left to right:</p>
      <table><tbody>
        <tr><th>Checkbox</th><td>Marks the question solved, as <i>{HOW.alone}</i>. Unticking it clears the solve date, review schedule and time.</td></tr>
        <tr><th>Title</th><td>Opens the problem (your own LeetCode link if you added one). Opening an unsolved question starts its timer.</td></tr>
        <tr><th>Easy / Medium / Hard</th><td>Difficulty. <b>Pro</b> marks Striver's harder or less-asked tier; <b>Premium</b> needs LeetCode Premium.</td></tr>
        <tr><th>Link chips</th><td>LC, GFG, TUF and so on. <b>LC (similar)</b> is a free LeetCode problem that practises the same idea when the exact one isn't there. <b>+ LC</b> lets you add your own LeetCode link.</td></tr>
        <tr><th><LockSimpleIcon /> Topic chips</th><td>Earlier topics this question builds on. They turn into a tick once that topic is done; click one to jump to it.</td></tr>
        <tr><th>How did it go?</th><td>Appears once solved. Picking an answer sets the next review date (see below).</td></tr>
        <tr><th>Review due</th><td>Appears on the day a review is due, with <b><CheckIcon /> Remembered</b> and <b><XIcon /> Forgot</b>.</td></tr>
        <tr><th>Small grey text</th><td>Minutes taken and when the next review is, or <i>mastered</i>. Hover it for the exact dates.</td></tr>
        <tr><th><TimerIcon /></th><td>Starts or stops the timer for this question.</td></tr>
        <tr><th><PlayCircleIcon /> <ArticleIcon /></th><td>Striver's video and article, where they exist.</td></tr>
        <tr><th><ArrowCounterClockwiseIcon /></th><td><b>Mark to revise.</b> Your own bookmark; it does not change review dates (<a href="#revise">more</a>).</td></tr>
        <tr><th><StarIcon /></th><td>Star. A second bookmark, for whatever you like (favourites, interview classics…).</td></tr>
        <tr><th><NotePencilIcon /></th><td>Your notes and a Java code box for this question. The icon is blue when something is saved.</td></tr>
      </tbody></table>

      <h2 id="solving">Solving a question</h2>
      <ul>
        <li>Tick the checkbox. It's saved as <i>{HOW.alone}</i>, and the <b>How did it go?</b> dropdown appears. Change it to <i>{HOW.hint}</i> or <i>{HOW.solution}</i> if that's what happened, any time later too.</li>
        <li><i>{HOW.solution}</i> also turns on the <ArrowCounterClockwiseIcon /> revise flag for you.</li>
        <li><b>Timer:</b> opening an unsolved question starts a timer in the header, and ticking the question stops it and records the minutes. Only one timer runs at a time.</li>
        <li><b>Notes and code:</b> in the code box, Tab indents. Click away and the code is shown highlighted; click it to edit again.</li>
        <li>Everything saves on its own within half a second; the header says <i>Saved</i>. Each question saves separately, so two devices never overwrite each other.</li>
      </ul>

      <h2 id="reviews">Reviews and spaced repetition</h2>
      <p>Solved questions come back for review at growing gaps: <b>{REVIEW_DAYS.join(', ')} days</b>. Each question sits on one step of that ladder.</p>
      <h3>Where a question starts</h3>
      <table>
        <thead><tr><th>How did it go?</th><th>First review</th></tr></thead>
        <tbody>
          <tr><td>{HOW.alone}</td><td>in {days(REVIEW_DAYS[1])}</td></tr>
          <tr><td>{HOW.hint}</td><td>in {days(REVIEW_DAYS[0])} (tomorrow)</td></tr>
          <tr><td>{HOW.solution}</td><td>in {days(REVIEW_DAYS[0])} (tomorrow), and flagged to revise</td></tr>
        </tbody>
      </table>
      <h3>When a review is due</h3>
      <p>Re-solve the question <b>without looking at your old code</b>, then click:</p>
      <ul>
        <li><b><CheckIcon /> Remembered</b>: moves up one step, so the next gap is longer.</li>
        <li><b><XIcon /> Forgot</b>: back to the bottom step, so it's due again tomorrow.</li>
      </ul>
      <p>The next date is counted from the day you actually do the review, not the day it was due, so a late review doesn't make the next one come early.</p>
      <h3>An example</h3>
      <p>You solve a question alone and remember it every time:</p>
      <table>
        <thead><tr><th>Step</th><th>Next review</th></tr></thead>
        <tbody>
          <tr><td>Solved alone</td><td>{days(REVIEW_DAYS[1])} later</td></tr>
          {REVIEW_DAYS.slice(2).map((d, i) => <tr key={d}><td>Review {i + 1}: Remembered</td><td>{days(d)} later</td></tr>)}
          <tr><td>Review {REVIEW_DAYS.length - 1}: Remembered</td><td><b>Mastered</b>, no more reviews</td></tr>
        </tbody>
      </table>
      <h3>Reviewing it again</h3>
      <p>You don't need to do anything: every review books the next one, until the question is mastered. To see it sooner than scheduled:</p>
      <ul>
        <li>Click <b>Forgot</b> on a due review. It comes back tomorrow and climbs the ladder from the start.</li>
        <li>Or change <b>How did it go?</b> on the row. That reschedules from today ({HOW.alone.toLowerCase()}: {days(REVIEW_DAYS[1])}; otherwise tomorrow), and also brings a mastered question back into reviews.</li>
        <li>Or turn on the <ArrowCounterClockwiseIcon /> revise flag to keep it on your own list without touching the dates.</li>
      </ul>
      <h3>Seeing what's due</h3>
      <p>When anything is due, a <BellIcon /> bell badge appears in the header, the browser tab shows the count, and a banner appears on the roadmap. Each one leads to <Link to="/review">the review list</Link>, which holds every due question from every roadmap. They're also at the top of <Link to="/today">Today</Link>.</p>

      <h2 id="revise">Revise and star flags</h2>
      <p>The <ArrowCounterClockwiseIcon /> <b>revise</b> button is a manual bookmark, separate from the review schedule. Use it for questions you want to go over again on your own terms: a trick you want to memorise, or one you got right but felt shaky on.</p>
      <ul>
        <li>Click it to turn it on (blue) or off. <i>{HOW.solution}</i> turns it on automatically.</li>
        <li>The roadmap counts flagged questions under <b>To revise</b>, and the status filter's <b>Revise</b> option lists only them.</li>
        <li>The <StarIcon /> star works the same way, with its own <b>Starred</b> filter.</li>
      </ul>

      <h2 id="today">Today</h2>
      <ul>
        <li><b>Reviews due:</b> every solved question whose review is due.</li>
        <li><b>New today:</b> the next unsolved questions in {learn.title}, in roadmap order. Set a <b>finish date</b> and the daily number is worked out for you (questions left ÷ days left, counting today and the finish day). It's fixed at the start of the day, so it doesn't grow as you tick things off. With no date, it's {DAILY_NEW} a day.</li>
        <li><b>Activity:</b> the last 12 months, solved and reviewed counts per day (hover a day or month for its numbers), plus active days and your streaks. A streak counts any day you solved or reviewed something.</li>
      </ul>

      <h2 id="roadmap">The roadmap</h2>
      <ul>
        <li>Topics are in an order where each question only needs what came before it. Inside a topic, sub-sections fold open and closed and show their own solved count.</li>
        <li>A topic counts as <b>done</b> once {Math.round(PREREQ_DONE * 100)}% of its questions are solved. That's what unlocks the topic chips on later questions.</li>
        <li><b>Next up</b> jumps to the first unsolved question that matches your filters.</li>
        <li><b>Filters:</b> search by title, <i>Essentials only</i> (hides Pro questions), pattern (Two Pointer, Monotonic Stack…), difficulty, and status (to do, solved, revise, starred, due for review). Sub-sections stay open while a filter is on, so nothing that matches is hidden.</li>
        <li><b>Topic map</b> shows which topics build on which. The <b>Notes</b> link on a topic opens its pattern notes.</li>
      </ul>

      <h2 id="practice">Mock interview and quiz</h2>
      <ul>
        {mock && <li><b>Mock interview</b> (on <Link to={`/roadmap/${mock.id}`}>{mock.nav || mock.title}</Link>): one random unsolved question with a {MOCK_MINUTES}-minute countdown and the topic hidden. <b>Show topic</b> reveals it, but the question then counts as solved with a hint. <b>Skip</b> gives you another one.</li>}
        <li><b><Link to="/quiz">Quiz</Link>:</b> multiple-choice questions for every {learn.title} topic at easy, medium and hard, each with an explanation. Get 4 of 5 right to pass a level; your level in a topic is the hardest one you've passed. Options are shuffled every try, and your best scores are saved.</li>
      </ul>

      <h2 id="notes">Study notes and My Notes</h2>
      <ul>
        <li><b><Link to="/notes">Notes</Link></b> are the shared study notes: Java, the JVM and one page per DSA pattern. {user.is_admin ? 'As the admin you can edit them and add new ones.' : 'Only the admin can edit them.'}</li>
        <li><b><Link to="/my-notes">My Notes</Link></b> are your own, in folders. The editor has headings, lists, checklists, code blocks with a language picker, tables and equations. Drag notes and folders to move them; F2 renames.</li>
        <li><b>Sharing:</b> the <i>Share</i> option on a note or folder takes someone's account email. They can view and copy it (or save a copy into their own notes), but not edit it. Things shared with you are under <i>Shared with me</i>.</li>
        <li><b>Copy</b> on a note copies it as rich text, Markdown or plain text.</li>
      </ul>

      <h2 id="account">Your account</h2>
      <ul>
        <li>Your progress, notes, code and review schedule are yours alone; roadmaps and study notes are shared by everyone.</li>
        <li>You stay logged in for 30 days. Log out from this profile menu.</li>
        {user.is_admin && <li><b><Link to="/admin">Invite people</Link></b> makes a single-use link that creates one account and expires after 7 days. You can revoke it before it's used.</li>}
      </ul>

      <h2 id="keys">Keyboard shortcuts</h2>
      <table><tbody>
        <tr><th><kbd>/</kbd></th><td>Search questions on the roadmap</td></tr>
        <tr><th><kbd>n</kbd></th><td>Next up on the roadmap</td></tr>
        <tr><th><kbd>Esc</kbd></th><td>Leave a text box</td></tr>
        <tr><th><kbd>1</kbd>–<kbd>4</kbd></th><td>Pick a quiz option</td></tr>
        <tr><th><kbd>Enter</kbd></th><td>Next quiz question</td></tr>
        <tr><th><kbd>F2</kbd></th><td>Rename the focused note or folder in My Notes</td></tr>
      </tbody></table>
    </article>
  </>;
}
