import {
  ArrowUUpLeftIcon, ArrowUUpRightIcon, CheckIcon, CodeBlockIcon, CodeIcon, ColumnsIcon, CopyIcon, CopySimpleIcon, DotsThreeIcon, EyeIcon,
  LinkSimpleIcon, ListBulletsIcon, ListChecksIcon, ListNumbersIcon, MarkdownLogoIcon, MinusIcon, QuotesIcon, RowsIcon, ShareNetworkIcon,
  SigmaIcon, TableIcon, TextBIcon, TextHOneIcon, TextHThreeIcon, TextHTwoIcon, TextItalicIcon, TextStrikethroughIcon, TextUnderlineIcon,
  TrashIcon, XIcon,
} from '@phosphor-icons/react';
import { type ChainedCommands, type Editor, EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import { ago, type NbFile, type NbFileMeta } from '../../lib';
import { useStore } from '../../store';
import { copyText, noteExtensions } from './extensions';
import { Menu } from './Menu';

type Saving = 'saved' | 'edited' | 'saving' | 'failed';
const SAVE_AFTER = 800;   // ms of quiet typing before an autosave
// Plain text of a note (for previews, search and "Copy as plain text"); equations come out as their LaTeX.
const plain = (e: Editor, blockSeparator: string) => e.getText({ blockSeparator, textSerializers: { inlineMath: ({ node }) => node.attrs.latex, blockMath: ({ node }) => node.attrs.latex } });

function Tool({ on, label, icon, run, disabled }: { on?: boolean; label: string; icon: ReactNode; run: () => void; disabled?: boolean }) {
  return <button type="button" className={`icon ${on ? 'on' : ''}`} title={label} aria-label={label} aria-pressed={on} disabled={disabled}
    onMouseDown={e => e.preventDefault()} onClick={run}>{icon}</button>;
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h1: e.isActive('heading', { level: 1 }), h2: e.isActive('heading', { level: 2 }), h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), strike: e.isActive('strike'),
      code: e.isActive('code'), bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), task: e.isActive('taskList'),
      quote: e.isActive('blockquote'), codeBlock: e.isActive('codeBlock'), link: e.isActive('link'), table: e.isActive('table'),
      undo: e.can().undo(), redo: e.can().redo(),
    }),
  });
  const run = (f: (c: ChainedCommands) => ChainedCommands) => () => f(editor.chain().focus()).run();
  const link = () => {
    const url = prompt('Link address (leave empty to remove the link)', editor.getAttributes('link').href || 'https://');
    if (url === null) return;
    const c = editor.chain().focus().extendMarkRange('link');
    (url.trim() ? c.setLink({ href: url.trim() }) : c.unsetLink()).run();
  };
  const math = (block: boolean) => () => {
    const latex = prompt(block ? 'Equation (LaTeX), shown on its own line' : 'Equation (LaTeX), e.g. O(n \\log n)');
    if (!latex?.trim()) return;
    const c = editor.chain().focus();
    (block ? c.insertBlockMath({ latex }) : c.insertInlineMath({ latex })).run();
  };
  return (
    <div className="nb-toolbar" role="toolbar" aria-label="Formatting">
      <Tool label="Heading 1" icon={<TextHOneIcon />} on={s.h1} run={run(c => c.toggleHeading({ level: 1 }))} />
      <Tool label="Heading 2" icon={<TextHTwoIcon />} on={s.h2} run={run(c => c.toggleHeading({ level: 2 }))} />
      <Tool label="Heading 3" icon={<TextHThreeIcon />} on={s.h3} run={run(c => c.toggleHeading({ level: 3 }))} />
      <i />
      <Tool label="Bold (Ctrl+B)" icon={<TextBIcon />} on={s.bold} run={run(c => c.toggleBold())} />
      <Tool label="Italic (Ctrl+I)" icon={<TextItalicIcon />} on={s.italic} run={run(c => c.toggleItalic())} />
      <Tool label="Underline (Ctrl+U)" icon={<TextUnderlineIcon />} on={s.underline} run={run(c => c.toggleUnderline())} />
      <Tool label="Strikethrough" icon={<TextStrikethroughIcon />} on={s.strike} run={run(c => c.toggleStrike())} />
      <Tool label="Inline code (Ctrl+E)" icon={<CodeIcon />} on={s.code} run={run(c => c.toggleCode())} />
      <Tool label="Link" icon={<LinkSimpleIcon />} on={s.link} run={link} />
      <i />
      <Tool label="Bulleted list" icon={<ListBulletsIcon />} on={s.bullet} run={run(c => c.toggleBulletList())} />
      <Tool label="Numbered list" icon={<ListNumbersIcon />} on={s.ordered} run={run(c => c.toggleOrderedList())} />
      <Tool label="Checklist" icon={<ListChecksIcon />} on={s.task} run={run(c => c.toggleTaskList())} />
      <Tool label="Quote" icon={<QuotesIcon />} on={s.quote} run={run(c => c.toggleBlockquote())} />
      <Tool label="Code block (```)" icon={<CodeBlockIcon />} on={s.codeBlock} run={run(c => c.toggleCodeBlock())} />
      <Tool label="Divider" icon={<MinusIcon />} run={run(c => c.setHorizontalRule())} />
      <i />
      <Tool label="Equation in the line" icon={<SigmaIcon />} run={math(false)} />
      <Tool label="Equation block" icon={<span className="tool-text">∑∎</span>} run={math(true)} />
      {s.table ? <>
        <Tool label="Add row below" icon={<RowsIcon />} run={run(c => c.addRowAfter())} />
        <Tool label="Add column right" icon={<ColumnsIcon />} run={run(c => c.addColumnAfter())} />
        <Tool label="Delete row" icon={<span className="tool-text">−R</span>} run={run(c => c.deleteRow())} />
        <Tool label="Delete column" icon={<span className="tool-text">−C</span>} run={run(c => c.deleteColumn())} />
        <Tool label="Delete table" icon={<XIcon />} run={run(c => c.deleteTable())} />
      </> : <Tool label="Table" icon={<TableIcon />} run={run(c => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))} />}
      <span className="grow" />
      <Tool label="Undo (Ctrl+Z)" icon={<ArrowUUpLeftIcon />} disabled={!s.undo} run={run(c => c.undo())} />
      <Tool label="Redo (Ctrl+Shift+Z)" icon={<ArrowUUpRightIcon />} disabled={!s.redo} run={run(c => c.redo())} />
    </div>
  );
}

export function NoteEditor({ file, crumbs, fresh, onSaved, onShare, onCopy, onDelete }: {
  file: NbFile; crumbs: ReactNode; fresh?: boolean;
  onSaved: (m: NbFileMeta) => void; onShare: () => void; onCopy: () => void; onDelete: () => void;
}) {
  const { showStatus } = useStore();
  const [saving, setSaving] = useState<Saving>('saved');
  const [name, setName] = useState(file.name);
  const [updated, setUpdated] = useState(file.updated_at);
  const [copied, setCopied] = useState('');
  const dirty = useRef(false);
  const timer = useRef<number>(undefined);
  const queue = useRef(Promise.resolve());   // saves go out one at a time, in order
  const saved = useRef(onSaved);
  saved.current = onSaved;
  const ref = useRef<Editor | null>(null);

  const save = (keepalive = false) => {
    clearTimeout(timer.current);
    const ed = ref.current;
    if (!dirty.current || !ed || ed.isDestroyed) return;
    dirty.current = false;
    const body = { doc: ed.getJSON(), text: plain(ed, '\n').slice(0, 500_000) };
    setSaving('saving');
    queue.current = queue.current
      .then(() => api<NbFileMeta>(`/my-notes/files/${file.id}`, { method: 'PATCH', body, keepalive }))
      .then(m => { saved.current(m); setUpdated(m.updated_at); if (!dirty.current) setSaving('saved'); },
        e => { dirty.current = true; setSaving('failed'); showStatus(`Note not saved: ${e.message}`, true); });
  };

  const extensions = useMemo(() => noteExtensions(() => ref.current), []);
  const editor = useEditor({
    extensions,
    content: file.doc ?? '',
    editable: file.can_edit,
    editorProps: { attributes: { class: 'md nb-doc', 'aria-label': file.name } },
    onUpdate: () => {
      dirty.current = true;
      setSaving('edited');
      clearTimeout(timer.current);
      timer.current = window.setTimeout(save, SAVE_AFTER);
    },
  });
  ref.current = editor;
  useEffect(() => { if (!document.activeElement?.classList.contains('nb-title')) setName(file.name); }, [file.name]);   // renamed in the sidebar

  useEffect(() => {
    const flush = () => save(true);
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault(); };
    addEventListener('pagehide', flush);
    addEventListener('beforeunload', warn);
    return () => { removeEventListener('pagehide', flush); removeEventListener('beforeunload', warn); save(); };   // leaving the note saves it
  }, []);

  const rename = async () => {
    const next = name.trim();
    if (!next) return setName(file.name);
    if (next === file.name) return;
    try {
      saved.current(await api<NbFileMeta>(`/my-notes/files/${file.id}`, { method: 'PATCH', body: { name: next } }));
    } catch (e) {
      showStatus((e as Error).message, true);
      setName(file.name);
    }
  };

  const copy = async (how: 'markdown' | 'rich' | 'text') => {
    let ok = false;
    const md = editor.getMarkdown();
    if (how === 'rich') {
      try {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([editor.getHTML()], { type: 'text/html' }),
          'text/plain': new Blob([md], { type: 'text/plain' }),
        })]);
        ok = true;
      } catch { ok = await copyText(md); }
    } else ok = await copyText(how === 'markdown' ? md : plain(editor, '\n\n'));
    setCopied(ok ? how : '');
    setTimeout(() => setCopied(''), 2000);
    showStatus(ok ? { markdown: 'Copied as Markdown', rich: 'Copied as rich text', text: 'Copied as plain text' }[how] : 'Copy failed', !ok);
  };

  const status = { saved: `Saved · edited ${ago(updated)}`, edited: 'Edited', saving: 'Saving…', failed: 'Not saved' }[saving];
  return (
    <div className="nb-note">
      <div className="nb-head">
        <div className="nb-crumbs">{crumbs}</div>
        <div className="nb-title-row">
          {file.can_edit
            ? <input className="nb-title" value={name} aria-label="Note name" placeholder="Untitled" autoFocus={fresh} maxLength={200}
              onFocus={e => fresh && e.target.select()} onChange={e => setName(e.target.value)} onBlur={rename}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); editor.commands.focus('start'); } }} />
            : <h1 className="nb-title">{file.name}</h1>}
          <div className="nb-actions">
            {file.can_edit && <button className="btn" onClick={onShare}><ShareNetworkIcon />Share</button>}
            <Menu className="btn" label="Copy this note" width={240} trigger={copied ? <><CheckIcon />Copied</> : <><CopyIcon />Copy</>}>
              <button onClick={() => copy('markdown')}><MarkdownLogoIcon />Copy as Markdown<small>for ChatGPT, Claude, GitHub</small></button>
              <button onClick={() => copy('rich')}><CopySimpleIcon />Copy as rich text<small>for Docs, Word, email</small></button>
              <button onClick={() => copy('text')}><CopyIcon />Copy as plain text</button>
            </Menu>
            <Menu label="More" trigger={<DotsThreeIcon weight="bold" />}>
              <button onClick={onCopy}><CopySimpleIcon />{file.can_edit ? 'Duplicate' : 'Save a copy to my notes'}</button>
              {file.can_edit && <button className="danger" onClick={onDelete}><TrashIcon />Delete note</button>}
            </Menu>
          </div>
        </div>
        {file.can_edit
          ? <p className={`nb-saving ${saving}`} role="status">{status}{saving === 'failed' && <button className="text-btn" onClick={() => { dirty.current = true; save(); }}>Retry</button>}</p>
          : <p className="nb-viewonly"><EyeIcon />View only · shared by <b>{file.owner.name}</b> ({file.owner.email})
            <button className="text-btn" onClick={onCopy}><CopySimpleIcon />Save a copy to my notes</button></p>}
      </div>
      {file.can_edit && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="nb-body" />
    </div>
  );
}
