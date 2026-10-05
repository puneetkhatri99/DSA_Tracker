import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';

// A dropdown like the account menu, but placed with fixed coordinates so a scrolling sidebar can't clip it.
// Clicking any item closes it; so do Esc, a click outside, scrolling and resizing.
export function Menu({ trigger, label, children, className = 'icon', width = 220 }:
  { trigger: ReactNode; label: string; children: ReactNode; className?: string; width?: number }) {
  const wrap = useRef<HTMLDetailsElement>(null);
  const [pos, setPos] = useState<CSSProperties>();
  const close = () => { if (wrap.current) wrap.current.open = false; };

  useEffect(() => {
    if (!pos) return;
    const outside = (e: Event) => { if (!wrap.current?.contains(e.target as Node)) close(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); wrap.current?.querySelector('summary')?.focus(); } };
    addEventListener('click', outside);
    addEventListener('keydown', esc);
    addEventListener('resize', close);
    addEventListener('scroll', outside, true);
    return () => {
      removeEventListener('click', outside); removeEventListener('keydown', esc);
      removeEventListener('resize', close); removeEventListener('scroll', outside, true);
    };
  }, [pos]);

  const toggled = () => {
    const d = wrap.current!;
    if (!d.open) return setPos(undefined);
    const r = d.querySelector('summary')!.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.right - width, innerWidth - width - 8));
    const below = r.bottom + 6 + 260 < innerHeight;
    setPos({ position: 'fixed', left, width, ...(below ? { top: r.bottom + 6 } : { bottom: innerHeight - r.top + 6 }) });
  };

  return (
    <details className="nb-menu" ref={wrap} onToggle={toggled}>
      <summary className={className} title={label} aria-label={label}>{trigger}</summary>
      {pos && <div className="menu" style={pos} role="menu" onClick={close}>{children}</div>}
    </details>
  );
}
