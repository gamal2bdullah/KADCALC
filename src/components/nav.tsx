import {
  LayoutDashboard, ListChecks, Table2, BarChart3, GitBranch, ShieldCheck,
  BookOpen, FileText, Library, TestTube, FileCode, Settings as SettingsIcon, type LucideIcon,
} from 'lucide-react';
import type { ViewKey } from '../App';

export interface NavItem {
  key: ViewKey; label: string; icon: LucideIcon; desc: string; group: string; emoji: string;
}

// Single navigation config — shared by Sidebar (grouped) and Command Palette.
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard',  label: 'Dashboard',          icon: LayoutDashboard, desc: 'Overview & KPIs',                       group: 'Plan',     emoji: '📊' },
  { key: 'inventory',  label: 'Load Inventory',     icon: ListChecks,      desc: 'Manage all loads',                     group: 'Plan',     emoji: '📋' },
  { key: 'schedule',   label: 'Master Schedule',    icon: Table2,          desc: 'Engineering load schedule',           group: 'Plan',     emoji: '🗓️' },
  { key: 'analysis',   label: 'Analysis Engine',    icon: BarChart3,       desc: 'Profiles, peaks, demand',             group: 'Analyze',  emoji: '📈' },
  { key: 'phase',      label: 'Phase Balancer',      icon: GitBranch,       desc: '3-phase optimization',                group: 'Analyze',  emoji: '⚡' },
  { key: 'validation', label: 'Validation Matrix',  icon: ShieldCheck,     desc: '5-severity rules',                    group: 'Analyze',  emoji: '✅' },
  { key: 'assumptions',label: 'Assumptions',        icon: BookOpen,        desc: 'Policy registry',                     group: 'Evidence', emoji: '📚' },
  { key: 'reports',    label: 'Engineering Reports',icon: FileText,         desc: 'Technical summaries',                 group: 'Evidence', emoji: '📄' },
  { key: 'tests',      label: 'Test Suite',         icon: TestTube,        desc: 'Self-audit engine',                   group: 'Evidence', emoji: '🧪' },
  { key: 'library',    label: 'Appliance Library',  icon: Library,          desc: 'Reference database',                  group: 'Library',  emoji: '🔧' },
  { key: 'docs',       label: 'Documentation',      icon: FileCode,        desc: 'Architecture & formulas',            group: 'Library',  emoji: '📘' },
  { key: 'settings',   label: 'Project Settings',   icon: SettingsIcon,    desc: 'Project configuration',               group: 'Library',  emoji: '⚙️' },
];

export const NAV_GROUPS = ['Plan', 'Analyze', 'Evidence', 'Library'] as const;
