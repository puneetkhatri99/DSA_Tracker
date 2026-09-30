import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useEffect, useRef } from 'react';
import { hljs } from '../highlight';

export const inlineMd = (s: string) => DOMPurify.sanitize(marked.parseInline(s) as string);

// Mermaid is large, so it loads only when a diagram is on screen.
let mermaid: Promise<typeof import('mermaid').default> | undefined;
export function loadMermaid() {
  return (mermaid ||= import('mermaid').then(({ default: m }) => {
    m.initialize({ startOnLoad: false, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default' });
    return m;
  }));
}

export function Markdown({ body }: { body: string }) {
  const el = useRef<HTMLElement>(null);
  useEffect(() => {
    const art = el.current!;
    art.innerHTML = DOMPurify.sanitize(marked.parse(body) as string);
    const diagrams: HTMLElement[] = [];
    art.querySelectorAll<HTMLElement>('pre code').forEach(c => {
      if (!c.classList.contains('language-mermaid')) return hljs.highlightElement(c);
      const pre = c.parentElement!;
      pre.className = 'mermaid';
      pre.textContent = c.textContent;
      diagrams.push(pre);
    });
    if (diagrams.length) loadMermaid().then(m => m.run({ nodes: diagrams, suppressErrors: true }));
  }, [body]);
  return <article className="md" ref={el} />;
}
