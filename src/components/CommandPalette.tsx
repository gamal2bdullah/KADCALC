import { useEffect, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import type { ViewKey } from '../App';

interface Cmd { key: ViewKey; label: string; desc: string; icon: string; group: string; }

// Command palette (⌘K / Ctrl+K) — fast navigation + actions for large projects.
export function CommandPalette({
  commands, setView, onClose,
}: {
  commands: Cmd[]; setView: (v: ViewKey) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, commands.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
      if (e.key === 'Enter') { const c = filtered()[active]; if (c) { setView(c.key); onClose(); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, q]);

  const filtered = () => {
    const s = q.toLowerCase();
    return commands.filter(c => c.label.toLowerCase().includes(s) || c.desc.toLowerCase().includes(s) || c.group.toLowerCase().includes(s));
  };
  const list = filtered();

  return (
    <div className="fixed inset-0 z-[1600] bg-surface-overlay/60 backdrop-blur-sm flex items-start justify-center p-4 pt-[12vh]" onClick={onClose}>
      <div className="w-full max-w-xl panel panel-raised shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-medium">
          <Search className="w-4 h-4 text-text-tertiary" />
          <input
            autoFocus
            value={q}
            onChange={e => { setQ(e.target.value); setActive(0); }}
            placeholder="Search views, actions…"
            className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-tertiary"
          />
          <span className="text-[10px] text-text-tertiary mono">ESC</span>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {list.length === 0 && <div className="px-4 py-6 text-center text-sm text-text-tertiary">No results</div>}
          {list.map((c, i) => (
            <button
              key={c.key}
              onMouseEnter={() => setActive(i)}
              onClick={() => { setView(c.key); onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${i === active ? 'bg-accent/15' : 'hover:bg-surface-2/40'}`}
            >
              <span className="text-sm">{c.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text-primary font-medium truncate">{c.label}</div>
                <div className="text-[11px] text-text-tertiary truncate">{c.desc}</div>
              </div>
              <span className="text-[10px] text-text-secondary mono uppercase">{c.group}</span>
              {i === active && <CornerDownLeft className="w-3.5 h-3.5 text-accent" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
