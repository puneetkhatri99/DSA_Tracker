import 'katex/dist/katex.min.css';
import { CheckIcon, CopyIcon } from '@phosphor-icons/react';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Mathematics } from '@tiptap/extension-mathematics';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { type Editor, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';
import { useState } from 'react';
import { SmartPaste } from './paste';

const lowlight = createLowlight(common);
const LANGS = lowlight.listLanguages().sort();

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

// Code blocks get a language picker (while editing) and a copy button.
function CodeBlockView({ node, editor, updateAttributes }: NodeViewProps) {
  const [copied, setCopied] = useState(false);
  const lang = (node.attrs.language as string | null) || '';
  const copy = () => copyText(node.textContent).then(ok => { setCopied(ok); setTimeout(() => setCopied(false), 2000); });
  return (
    <NodeViewWrapper className="code-block">
      <div className="code-bar" contentEditable={false}>
        {editor.isEditable
          ? <select value={lang} aria-label="Code language" onChange={e => updateAttributes({ language: e.target.value || null })}>
            <option value="">plain text</option>
            {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          : <span>{lang || 'code'}</span>}
        <button type="button" className={copied ? 'done' : ''} onClick={copy}>{copied ? <><CheckIcon />Copied</> : <><CopyIcon />Copy</>}</button>
      </div>
      <pre><NodeViewContent<'code'> as="code" className={lang ? `hljs language-${lang}` : 'hljs'} /></pre>
    </NodeViewWrapper>
  );
}

// Equations are edited in place: click one to change its LaTeX.
function editMath(editor: Editor, kind: 'inline' | 'block', latex: string, pos: number) {
  if (!editor.isEditable) return;
  const next = prompt('LaTeX', latex);
  if (next === null) return;
  const chain = editor.chain().setNodeSelection(pos);
  if (!next.trim()) chain.deleteSelection().run();
  else if (kind === 'inline') chain.updateInlineMath({ latex: next, pos }).run();
  else chain.updateBlockMath({ latex: next, pos }).run();
}

export function noteExtensions(editor: () => Editor | null) {
  return [
    StarterKit.configure({ codeBlock: false, link: { openOnClick: false, autolink: true, defaultProtocol: 'https' } }),
    CodeBlockLowlight.extend({ addNodeView: () => ReactNodeViewRenderer(CodeBlockView) }).configure({ lowlight, defaultLanguage: null }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    Mathematics.configure({
      katexOptions: { throwOnError: false },
      inlineOptions: { onClick: (node, pos) => { const e = editor(); if (e) editMath(e, 'inline', node.attrs.latex, pos); } },
      blockOptions: { onClick: (node, pos) => { const e = editor(); if (e) editMath(e, 'block', node.attrs.latex, pos); } },
    }),
    Placeholder.configure({ placeholder: 'Start writing, or paste an answer from ChatGPT or Claude…' }),
    Markdown,
    SmartPaste,
  ];
}
