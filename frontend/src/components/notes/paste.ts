import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// Answers copied from ChatGPT or Claude reach the clipboard in one of two shapes:
//  - selected with the mouse: HTML, with maths rendered by KaTeX and a header + "Copy" button inside each code block;
//  - their own Copy button: markdown as plain text, with maths as $…$, $$…$$, \(…\) or \[…\].
// Both should land as real headings, lists, tables, code blocks and equations.

const tex = (el: Element) => el.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim();

function mathEl(doc: Document, tag: 'div' | 'span', latex: string) {
  const el = doc.createElement(tag);
  el.dataset.type = tag === 'div' ? 'block-math' : 'inline-math';
  el.dataset.latex = latex;
  return el;
}

export function cleanPastedHTML(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('.katex-display').forEach(el => { const t = tex(el); if (t) el.replaceWith(mathEl(doc, 'div', t)); });
  doc.querySelectorAll('.katex').forEach(el => { const t = tex(el); if (t) el.replaceWith(mathEl(doc, 'span', t)); });
  doc.querySelectorAll('mjx-container').forEach(el => {   // MathJax (some other sites) keeps its source in an <annotation> too
    const t = tex(el);
    if (t) el.replaceWith(mathEl(doc, el.getAttribute('display') === 'true' ? 'div' : 'span', t));
  });
  // A code block keeps only its <code>: drops the language label and the "Copy code" button around it.
  doc.querySelectorAll('pre').forEach(pre => {
    const code = pre.querySelector('code');
    if (code && pre.firstElementChild !== code) pre.replaceChildren(code);
  });
  doc.querySelectorAll('button').forEach(b => b.remove());
  return doc.body.innerHTML;
}

// HTML with no structure in it (an editor or terminal that wraps text in <div>/<span>) is really plain text.
const plainWrapper = (html: string) => !/<(h[1-6]|ul|ol|table|pre|blockquote|strong|b|em|i|a|code|img|hr)\b/i.test(html);

export const looksLikeMarkdown = (t: string) =>
  /^(#{1,6}\s|\s*([-*+]|\d+[.)])\s|```|~~~|>\s|\|.*\|)|\*\*\S|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|\$\$|\\\[|\\\(/m.test(t);

// The editor reads $…$ and $$…$$; ChatGPT writes \(…\) and \[…\]. Code is left alone.
export function normalizeMath(md: string) {
  return md.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/).map((part, i) => i % 2 ? part : part
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, t: string) => `\n$$\n${t.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, t: string) => `$${t.trim()}$`)).join('');
}

export const SmartPaste = Extension.create({
  name: 'smartPaste',
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [new Plugin({
      key: new PluginKey('smartPaste'),
      props: {
        transformPastedHTML: cleanPastedHTML,
        handlePaste(view, event) {
          const data = event.clipboardData;
          const text = data?.getData('text/plain');
          const html = data?.getData('text/html');
          if (!text || view.state.selection.$from.parent.type.spec.code) return false;   // inside a code block: paste as is
          if ((html && !plainWrapper(html)) || !looksLikeMarkdown(text)) return false;
          return editor.commands.insertContent(normalizeMath(text), { contentType: 'markdown' });
        },
      },
    })];
  },
});
