import { useState, useEffect } from 'react';
import { LoadProvider } from './context/LoadContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { LoadInventory } from './components/LoadInventory';
import { LoadSchedule } from './components/LoadSchedule';
import { Analysis } from './components/Analysis';
import { Reports } from './components/Reports';
import { ApplianceLibrary } from './components/ApplianceLibrary';
import { Settings } from './components/Settings';
import { AssumptionsViewer } from './components/AssumptionsViewer';
import { ValidationReport, PhaseBalanceReport } from './components/ValidationReport';
import { TestRunner } from './components/TestRunner';
import { Documentation } from './components/Documentation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CommandPalette } from './components/CommandPalette';
import { NAV_ITEMS } from './components/nav';

export type ViewKey =
  | 'dashboard' | 'inventory' | 'schedule' | 'analysis' | 'reports'
  | 'library' | 'settings' | 'assumptions' | 'validation' | 'phase'
  | 'tests' | 'docs';

// Theme provider — persists user choice on <html data-theme>.
function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('kad-theme') as 'dark' | 'light') || 'dark'; } catch { return 'dark'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('kad-theme', theme); } catch {}
  }, [theme]);
  return { theme, toggle: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')) };
}

export default function App() {
  const [view, setView] = useState<ViewKey>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { theme, toggle } = useTheme();

  // Global ⌘K / Ctrl+K to open the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(o => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <ErrorBoundary>
      <LoadProvider>
        <div className="flex h-screen overflow-hidden bg-surface-base bg-grid text-text-primary">
          <Sidebar view={view} setView={setView} open={sidebarOpen} setOpen={setSidebarOpen} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header onToggleSidebar={() => setSidebarOpen(o => !o)} view={view} theme={theme} onToggleTheme={toggle} onOpenPalette={() => setPaletteOpen(true)} />
            <main className="flex-1 overflow-y-auto">
              {view === 'dashboard' && <Dashboard onNavigate={setView} />}
              {view === 'inventory' && <LoadInventory />}
              {view === 'schedule' && <LoadSchedule />}
              {view === 'analysis' && <Analysis />}
              {view === 'reports' && <Reports />}
              {view === 'library' && <ApplianceLibrary />}
              {view === 'settings' && <Settings />}
              {view === 'assumptions' && <AssumptionsViewer />}
              {view === 'validation' && <ValidationReport />}
              {view === 'phase' && <PhaseBalanceReport />}
              {view === 'tests' && <TestRunner />}
              {view === 'docs' && <Documentation />}
            </main>
          </div>
          {paletteOpen && (
            <CommandPalette commands={NAV_ITEMS.map(n => ({ key: n.key, label: n.label, desc: n.desc, icon: n.emoji, group: n.group }))} setView={setView} onClose={() => setPaletteOpen(false)} />
          )}
        </div>
      </LoadProvider>
    </ErrorBoundary>
  );
}
