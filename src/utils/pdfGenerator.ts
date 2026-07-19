// =======================================================================
//  Professional PDF Report Generator
//  Uses jsPDF + jspdf-autotable for engineering-grade reports
// =======================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Load, SummaryMetrics, ExpertLevel } from '../types';
import {
  fmtW, fmtWh, fmtA, fmtKVA, fmtPct,
  calcConnectedLoad, calcRunningLoad, calcDailyEnergy, calcDayEnergy, calcNightEnergy,
  calcAnnualEnergy, calcApparentPower, calcFullLoadCurrent, calcSurgePower,
  calcDemandLoad, calcDiversifiedLoad, calcCoincidentLoad,
  SURGE_MULTIPLIERS, NEC_DEMAND_FACTORS, validateLoad
} from './calculations';
import { PDF_RGB } from '../theme/colors';
// ---- Arabic PDF support -------------------------------------------------
// Embeds the Amiri font (OFL) and reshapes/reorders RTL text so Arabic project
// and load names render correctly in jsPDF (which is not Arabic-aware by default).
import { ARABIC_FONT_NAME, ARABIC_FONT_BASE64 } from './arabicFont';
import arabicReshaper from 'arabic-reshaper';
import bidiFactory from 'bidi-js';

const AR_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const bidiEngine = bidiFactory();

// Register the embedded Amiri font on a freshly-created jsPDF instance.
function regFont(doc: any) {
  try {
    doc.addFileToVFS(ARABIC_FONT_NAME + '.ttf', ARABIC_FONT_BASE64);
    doc.addFont(ARABIC_FONT_NAME + '.ttf', ARABIC_FONT_NAME, 'normal');
  } catch { /* already registered or unsupported — non-fatal */ }
  return doc;
}

// Reshape (connect Arabic letters) then reorder (BiDi algorithm) so Arabic
// renders correctly in jsPDF, while leaving Latin/digits untouched.
function shape(s: string): string {
  if (!AR_RE.test(s)) return s;
  const reshaped = arabicReshaper.convertArabic(s);
  const levels = bidiEngine.getEmbeddingLevels(reshaped);
  return bidiEngine.getReorderedString(reshaped, levels);
}

// Draw text, auto-switching to Amiri and shaping when Arabic is present.
function t(doc: any, text: string | string[], x: number, y: number, opts?: any) {
  if (Array.isArray(text)) {
    const has = text.some(s => AR_RE.test(s));
    if (has) doc.setFont(ARABIC_FONT_NAME, 'normal');
    doc.text(text.map(s => (AR_RE.test(s) ? shape(s) : s)), x, y, opts);
    if (has) doc.setFont('helvetica', 'normal');
  } else if (AR_RE.test(text)) {
    doc.setFont(ARABIC_FONT_NAME, 'normal');
    doc.text(shape(text), x, y, opts);
    doc.setFont('helvetica', 'normal');
  } else {
    doc.text(text, x, y, opts);
  }
}

// autoTable wrapper: reshape + render any Arabic cell content in Amiri.
function tbl(doc: any, opts: any) {
  const userHook = opts.didParseCell;
  autoTable(doc, {
    ...opts,
    didParseCell: (data: any) => {
      if (data.cell.text.some((s: string) => AR_RE.test(s))) {
        data.cell.styles.font = ARABIC_FONT_NAME;
        data.cell.text = data.cell.text.map((s: string) => (AR_RE.test(s) ? shape(s) : s));
      }
      if (userHook) userHook(data);
    },
  });
}

// Brand-consistent RGB palette sourced from the single design-token layer.
const ORANGE = PDF_RGB.brand;
const AMBER = PDF_RGB.sun;
const SLATE_900 = PDF_RGB.slate900;
const SLATE_800 = PDF_RGB.slate800;
const SLATE_700 = PDF_RGB.slate700;
const SLATE_500 = PDF_RGB.slate500;
const SLATE_300 = PDF_RGB.slate300;
const GREEN = PDF_RGB.green;
const BLUE = PDF_RGB.blue;
const PINK = PDF_RGB.pink;
const CYAN = PDF_RGB.cyan;

interface ReportMeta {
  projectName: string;
  expertLevel: ExpertLevel;
  generatedAt: Date;
}

function header(doc: jsPDF, meta: ReportMeta, page: number, total: number) {
  // Top accent bar
  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, 210, 4, 'F');

  // Brand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...ORANGE);
  t(doc, 'KAD Calculator', 14, 11);
  doc.setTextColor(...SLATE_500);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  t(doc, 'Engineering Load Analysis Report', 38, 11);

  // Project name on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_300);
  t(doc, meta.projectName.substring(0, 50), 210 - 14, 11, { align: 'right' });

  // Separator
  doc.setDrawColor(...SLATE_700);
  doc.setLineWidth(0.3);
  doc.line(14, 14, 210 - 14, 14);

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_500);
  t(doc, `Generated: ${meta.generatedAt.toLocaleString()}`, 14, 290);
  t(doc, `Mode: ${meta.expertLevel}  ·  Page ${page} / ${total}`, 105, 290, { align: 'center' });
  t(doc, 'KAD Calculator · Load Analysis Engine v4.0', 210 - 14, 290, { align: 'right' });
}

function title(doc: jsPDF, text: string, y = 22) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...SLATE_300);
  t(doc, text, 14, y);
  // Underline
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.8);
  doc.line(14, y + 1.5, 60, y + 1.5);
}

function subtitle(doc: jsPDF, text: string, y = 30) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_500);
  t(doc, text, 14, y);
}

function section(doc: jsPDF, num: string, title: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...ORANGE);
  t(doc, num, 14, y);
  doc.setTextColor(...SLATE_300);
  t(doc, title, 24, y);
  doc.setDrawColor(...SLATE_700);
  doc.setLineWidth(0.2);
  doc.line(14, y + 1.5, 210 - 14, y + 1.5);
  return y + 7;
}

function paragraph(doc: jsPDF, text: string, y: number, maxWidth = 182): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_500);
  const lines = doc.splitTextToSize(text, maxWidth);
  t(doc, lines, 14, y);
  return y + lines.length * 4 + 2;
}

function kpiBox(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string, color: [number, number, number]) {
  // Background
  doc.setFillColor(...SLATE_800);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F');
  // Left accent
  doc.setFillColor(...color);
  doc.rect(x, y, 1, h, 'F');
  // Label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_500);
  t(doc, label.toUpperCase(), x + 3, y + 4);
  // Value
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...color);
  t(doc, value, x + 3, y + h - 3);
}

// ====================================================================
//  REPORT 1: EXECUTIVE SUMMARY
// ====================================================================
export function generateExecutiveReport(loads: Load[], summary: SummaryMetrics, meta: ReportMeta) {
  const doc = regFont(new jsPDF({ unit: 'mm', format: 'a4' }));
  const totalPagesPlaceholder = 1; // we'll update later

  // Page 1: Cover
  header(doc, meta, 1, totalPagesPlaceholder);
  doc.setFillColor(...SLATE_900);
  doc.rect(0, 14, 210, 282, 'F');

  // Big project title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...ORANGE);
  t(doc, meta.projectName, 14, 50);
  doc.setFontSize(12);
  doc.setTextColor(...SLATE_300);
  t(doc, 'Solar Load Analysis · Executive Summary', 14, 58);
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_500);
  t(doc, `Engineering Report  ·  ${meta.expertLevel} Mode  ·  ${loads.length} loads analyzed`, 14, 64);

  // Big metrics
  const bigY = 80;
  kpiBox(doc, 14, bigY, 88, 22, 'Total Connected Load', fmtW(summary.totalConnectedLoadW, 1), ORANGE);
  kpiBox(doc, 108, bigY, 88, 22, 'Maximum Demand', fmtW(summary.maximumDemandW, 1), AMBER);
  kpiBox(doc, 14, bigY + 26, 88, 22, 'Daily Energy', fmtWh(summary.totalDailyEnergyWh, 1), GREEN);
  kpiBox(doc, 108, bigY + 26, 88, 22, 'Annual Energy', fmtWh(summary.annualEnergyKWh * 1000, 0), BLUE);
  kpiBox(doc, 14, bigY + 52, 88, 22, 'Peak kVA', fmtKVA(summary.peakDemandKVA), CYAN);
  kpiBox(doc, 108, bigY + 52, 88, 22, 'Maximum Surge', fmtW(summary.maximumSurgeKW * 1000, 0), PINK);

  // Section: Project Description
  let y = 170;
  y = section(doc, '1.', 'Executive Summary', y);
  const totalDayPct = ((summary.dayEnergyWh / Math.max(1, summary.totalDailyEnergyWh)) * 100).toFixed(0);
  const txt = `This report presents a comprehensive engineering analysis of the electrical load profile for ${meta.projectName}. ` +
    `The system comprises ${loads.length} loads distributed across ${summary.byCategory.length} categories, ` +
    `with a total connected load of ${fmtW(summary.totalConnectedLoadW, 1)} and a maximum demand of ${fmtW(summary.maximumDemandW, 1)}. ` +
    `Total daily energy consumption is ${fmtWh(summary.totalDailyEnergyWh, 1)}, of which ${totalDayPct}% occurs during daytime hours. ` +
    `Peak apparent power reaches ${fmtKVA(summary.peakDemandKVA)} with a maximum aggregate inrush of ${fmtW(summary.maximumSurgeKW * 1000, 0)}.`;
  y = paragraph(doc, txt, y);

  // Section: Category breakdown table
  y = section(doc, '2.', 'Load Categories Breakdown', y);
  tbl(doc, {
    startY: y,
    head: [['Category', 'Loads', 'Connected', 'Daily Energy', 'Annual', '%']],
    body: summary.byCategory.map(c => {
      const count = loads.filter(l => l.categoryMain === c.name).length;
      const conn = loads.filter(l => l.categoryMain === c.name).reduce((s, l) => s + calcConnectedLoad(l), 0);
      const annual = c.value * 365;
      const pct = (c.value / Math.max(1, summary.totalDailyEnergyWh)) * 100;
      return [c.name, count.toString(), fmtW(conn, 0), fmtWh(c.value, 0), fmtWh(annual / 1000, 0) + ' kWh', pct.toFixed(1) + '%'];
    }),
    foot: [['TOTAL', loads.length.toString(), fmtW(summary.totalConnectedLoadW, 0), fmtWh(summary.totalDailyEnergyWh, 0), fmtWh(summary.annualEnergyKWh, 0) + ' kWh', '100.0%']],
    theme: 'grid',
    headStyles: { fillColor: PDF_RGB.sun, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    footStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [60, 70, 90] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Section: Recommendations
  if (y > 240) { doc.addPage(); header(doc, meta, 2, totalPagesPlaceholder); doc.setFillColor(...SLATE_900); doc.rect(0, 14, 210, 282, 'F'); y = 22; }
  y = section(doc, '3.', 'Engineering Recommendations', y);

  const recs: { icon: '✓' | '⚠'; text: string; color: readonly [number, number, number] }[] = [
    { icon: '✓', color: GREEN, text: `Peak demand: ${fmtW(summary.maximumDemandW, 1)} — size inverter at minimum ${fmtW(summary.maximumDemandW * 1.25, 1)} (NEC 25% oversize rule, Art. 690.8)` },
    { icon: '✓', color: GREEN, text: `Total surge: ${fmtW(summary.maximumSurgeKW * 1000, 0)} — verify inverter surge rating or use soft-starters for motor loads` },
    { icon: '✓', color: GREEN, text: `Day energy: ${fmtWh(summary.dayEnergyWh, 0)} (${totalDayPct}%) — Night: ${fmtWh(summary.nightEnergyWh, 0)} — Optimize shiftable loads to daytime` },
    { icon: '✓', color: GREEN, text: `Critical loads: ${fmtWh(summary.criticalLoadWh, 0)}/day — required battery backup capacity` },
    { icon: '⚠', color: AMBER, text: `Load factor: ${fmtPct(summary.loadFactor)} — ${summary.loadFactor < 25 ? 'low utilization, consider load management' : 'healthy utilization profile'}` },
  ];

  recs.forEach(r => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...r.color);
    t(doc, r.icon, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_300);
    const lines = doc.splitTextToSize(r.text, 180);
    t(doc, lines, 20, y);
    y += lines.length * 4 + 2;
  });

  updatePageCount(doc, meta);
  doc.save(`${meta.projectName.replace(/\s+/g, '-')}-Executive-Summary.pdf`);
}

// ====================================================================
//  REPORT 2: DEMAND ANALYSIS
// ====================================================================
export function generateDemandReport(loads: Load[], summary: SummaryMetrics, meta: ReportMeta) {
  const doc = regFont(new jsPDF({ unit: 'mm', format: 'a4' }));
  header(doc, meta, 1, 99);

  title(doc, 'Maximum Demand Analysis', 22);
  subtitle(doc, `${meta.projectName}  ·  ${loads.length} loads  ·  ${meta.expertLevel} Mode`, 28);

  // Page 1: Demand metrics
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let y = 38;
  y = section(doc, '1.', 'Demand Metrics', y);

  tbl(doc, {
    startY: y,
    head: [['Metric', 'Value', 'Notes']],
    body: [
      ['Total Connected Load', fmtW(summary.totalConnectedLoadW, 1), 'Sum of rated × qty'],
      ['Maximum Demand (Operating Peak)', fmtW(summary.maximumDemandW, 1), 'Peak of hourly operating profile'],
      ['Demand / Connected Ratio', fmtPct((summary.maximumDemandW / Math.max(1, summary.totalConnectedLoadW)) * 100), 'Efficiency of utilization'],
      ['Coincident Peak Load', fmtW(summary.coincidentPeakLoadW, 1), 'Demand × coincidence factor'],
      ['Diversified Load', fmtW(summary.diversifiedLoadW, 1), 'Coincident / diversity factor'],
      ['Peak Demand (kW)', fmtW(summary.peakDemandKW * 1000, 1), 'Real power at peak'],
      ['Peak Demand (kVA)', fmtKVA(summary.peakDemandKVA), 'Apparent power at peak (assumes PF=0.85)'],
      ['Estimated Max Current', fmtA(summary.estimatedMaxCurrentA), 'Per-phase at peak'],
      ['Maximum Aggregate Surge', fmtW(summary.maximumSurgeKW * 1000, 1), 'Sum of all inrush currents'],
      ['Load Factor', fmtPct(summary.loadFactor), 'Average / peak ratio'],
    ],
    theme: 'grid',
    headStyles: { fillColor: PDF_RGB.sun, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [60, 70, 90] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 1: { fontStyle: 'bold', textColor: PDF_RGB.sun } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // NEC Demand Factors
  y = section(doc, '2.', 'NEC Demand Factors (Article 220)', y);
  tbl(doc, {
    startY: y,
    head: [['Description', 'Factor']],
    body: NEC_DEMAND_FACTORS.map(f => [f.description, (f.factor * 100).toFixed(0) + '%']),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [60, 70, 90] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Surge multipliers
  y = section(doc, '3.', 'Surge Multipliers Reference', y);
  tbl(doc, {
    startY: y,
    head: [['Load Type', 'Multiplier', 'Description']],
    body: SURGE_MULTIPLIERS.map(s => [s.name, s.multiplier + '×', s.description]),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, textColor: [60, 70, 90] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Top loads
  if (y > 230) { doc.addPage(); header(doc, meta, 2, 99); y = 22; }
  y = section(doc, '4.', 'Top 15 Loads by Connected Power', y);
  const top = [...loads].map(l => ({ load: l, conn: calcConnectedLoad(l), surge: calcSurgePower(l) })).sort((a, b) => b.conn - a.conn).slice(0, 15);
  tbl(doc, {
    startY: y,
    head: [['#', 'Name', 'Tag', 'Category', 'Qty', 'Rated (W)', 'Connected', 'Surge']],
    body: top.map((m, i) => [i + 1, m.load.loadName, m.load.loadTag, m.load.categoryMain, m.load.quantity, m.load.ratedPowerW, fmtW(m.conn, 0), fmtW(m.surge, 0)]),
    theme: 'striped',
    headStyles: { fillColor: PDF_RGB.sun, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, textColor: [60, 70, 90] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  updatePageCount(doc, meta);
  doc.save(`${meta.projectName.replace(/\s+/g, '-')}-Demand-Analysis.pdf`);
}

// ====================================================================
//  REPORT 3: SEASONAL
// ====================================================================
export function generateSeasonalReport(loads: Load[], summary: SummaryMetrics, meta: ReportMeta) {
  const doc = regFont(new jsPDF({ unit: 'mm', format: 'a4' }));
  header(doc, meta, 1, 99);

  title(doc, 'Seasonal Load Analysis', 22);
  subtitle(doc, `${meta.projectName}  ·  Summer vs Winter Comparison`, 28);

  let y = 38;
  y = section(doc, '1.', 'Seasonal Energy Comparison', y);

  // Summer
  const summerDay = loads.reduce((s, l) => s + (l.dayHoursSummer * calcRunningLoad(l) * (l.dutyCyclePercent / 100) * l.utilizationFactorKu * l.demandFactor * l.operatingDaysPerWeek / 7), 0);
  const summerNight = loads.reduce((s, l) => s + (l.nightHoursSummer * calcRunningLoad(l) * (l.dutyCyclePercent / 100) * l.utilizationFactorKu * l.demandFactor * l.operatingDaysPerWeek / 7), 0);
  // Winter
  const winterDay = loads.reduce((s, l) => s + (l.dayHoursWinter * calcRunningLoad(l) * (l.dutyCyclePercent / 100) * l.utilizationFactorKu * l.demandFactor * l.operatingDaysPerWeek / 7), 0);
  const winterNight = loads.reduce((s, l) => s + (l.nightHoursWinter * calcRunningLoad(l) * (l.dutyCyclePercent / 100) * l.utilizationFactorKu * l.demandFactor * l.operatingDaysPerWeek / 7), 0);

  tbl(doc, {
    startY: y,
    head: [['Period', 'Day Energy', 'Night Energy', 'Total Daily', 'Est. Annual', 'Days']],
    body: [
      ['Summer (Apr–Sep)', fmtWh(summerDay, 0), fmtWh(summerNight, 0), fmtWh(summerDay + summerNight, 0), fmtWh((summerDay + summerNight) * 183, 0), '183'],
      ['Winter (Oct–Mar)', fmtWh(winterDay, 0), fmtWh(winterNight, 0), fmtWh(winterDay + winterNight, 0), fmtWh((winterDay + winterNight) * 182, 0), '182'],
      ['Annual Average', fmtWh((summerDay + winterDay) / 2, 0), fmtWh((summerNight + winterNight) / 2, 0), fmtWh(((summerDay + summerNight) + (winterDay + winterNight)) / 2, 0), fmtWh(((summerDay + summerNight) * 183 + (winterDay + winterNight) * 182), 0), '365'],
    ],
    theme: 'grid',
    headStyles: { fillColor: PDF_RGB.sun, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [60, 70, 90] },
    columnStyles: { 4: { fontStyle: 'bold', textColor: PDF_RGB.sun } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Seasonal variance note
  const variance = Math.abs(((summary.totalDailyEnergyWh - (winterDay + winterNight)) / Math.max(1, summary.totalDailyEnergyWh)) * 100);
  y = paragraph(doc, `Seasonal variance: ${variance.toFixed(1)}% — ${variance > 20 ? 'significant seasonal swing; size solar/battery system for summer peak' : 'moderate seasonal behavior'}.`, y);

  // Category seasonal breakdown
  y = section(doc, '2.', 'Category-wise Seasonal Distribution', y);
  tbl(doc, {
    startY: y,
    head: [['Category', 'Summer Daily', 'Winter Daily', 'Difference', 'Ratio (S/W)']],
    body: summary.byCategory.map(c => {
      const catLoads = loads.filter(l => l.categoryMain === c.name);
      const summer = catLoads.reduce((s, l) => s + calcDailyEnergy(l, 'summer'), 0);
      const winter = catLoads.reduce((s, l) => s + calcDailyEnergy(l, 'winter'), 0);
      const diff = summer - winter;
      const ratio = winter > 0 ? (summer / winter).toFixed(2) : '∞';
      return [c.name, fmtWh(summer, 0), fmtWh(winter, 0), fmtWh(diff, 0), ratio + '×'];
    }),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [60, 70, 90] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Phase balance
  if (y > 200) { doc.addPage(); header(doc, meta, 2, 99); y = 22; }
  y = section(doc, '3.', 'Phase Balance Analysis', y);
  const phases = [0, 0, 0];
  loads.forEach((l, idx) => {
    const conn = calcConnectedLoad(l);
    if (l.phaseType === '3Ø') {
      phases[0] += conn / 3; phases[1] += conn / 3; phases[2] += conn / 3;
    } else {
      phases[idx % 3] += conn;
    }
  });
  const total = phases.reduce((a, b) => a + b, 0);
  const maxP = Math.max(...phases);
  const minP = Math.min(...phases);
  const imb = maxP > 0 ? ((maxP - minP) / maxP) * 100 : 0;

  tbl(doc, {
    startY: y,
    head: [['Phase', 'Connected Load', 'Percentage']],
    body: [
      ['Phase L1', fmtW(phases[0], 0), total > 0 ? ((phases[0] / total) * 100).toFixed(1) + '%' : '0%'],
      ['Phase L2', fmtW(phases[1], 0), total > 0 ? ((phases[1] / total) * 100).toFixed(1) + '%' : '0%'],
      ['Phase L3', fmtW(phases[2], 0), total > 0 ? ((phases[2] / total) * 100).toFixed(1) + '%' : '0%'],
      ['Total', fmtW(total, 0), '100.0%'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [60, 70, 90] },
    foot: [[{ content: `Phase Imbalance: ${imb.toFixed(1)}%  ${imb > 15 ? '(EXCEEDS 15% LIMIT)' : '(within acceptable range)'}`, colSpan: 3, styles: { fontStyle: 'bold', textColor: imb > 15 ? [239, 68, 68] : [16, 185, 129], fillColor: [248, 250, 252] } }]],
    margin: { left: 14, right: 14 },
  });

  updatePageCount(doc, meta);
  doc.save(`${meta.projectName.replace(/\s+/g, '-')}-Seasonal-Report.pdf`);
}

// ====================================================================
//  REPORT 4: COMPLIANCE / VALIDATION
// ====================================================================
export function generateComplianceReport(loads: Load[], summary: SummaryMetrics, meta: ReportMeta) {
  const doc = regFont(new jsPDF({ unit: 'mm', format: 'a4' }));
  header(doc, meta, 1, 99);

  title(doc, 'Compliance & Validation Report', 22);
  subtitle(doc, `${meta.projectName}  ·  Data Quality, Validation & Power Quality Audit`, 28);

  let y = 38;

  // Validation status
  const allIssues = loads.flatMap(l => validateLoad(l).map(i => ({ ...i, loadName: l.loadName })));
  const errors = allIssues.filter(i => i.type === 'error');
  const warnings = allIssues.filter(i => i.type === 'warning');
  const phantom = loads.filter(l => l.phantomLoadW > 0);
  const highTHD = loads.filter(l => l.thdPercent > 15);

  y = section(doc, '1.', 'Data Validation Summary', y);
  tbl(doc, {
    startY: y,
    head: [['Check', 'Status', 'Count', 'Notes']],
    body: [
      ['Critical Errors', errors.length === 0 ? 'PASS' : 'FAIL', errors.length.toString(), errors.length === 0 ? 'All required fields valid' : 'Review errors before proceeding'],
      ['Warnings', warnings.length === 0 ? 'PASS' : 'REVIEW', warnings.length.toString(), 'Engineering judgment advised'],
      ['Phantom Loads', phantom.length.toString(), phantom.length.toString() + ' loads', `${(summary.phantomLossWh / 1000).toFixed(1)} kWh/day standby waste`],
      ['High THD Loads', highTHD.length.toString(), highTHD.length.toString() + ' loads', highTHD.length > 0 ? 'Consider harmonic filtering (IEEE 519)' : 'Power quality compliant'],
      ['Loads with Confidence', loads.filter(l => l.confidenceLevel === 'High').length.toString() + ' high', `${loads.filter(l => l.confidenceLevel === 'Low').length} low confidence`, 'Review low-confidence data'],
    ],
    theme: 'grid',
    headStyles: { fillColor: PDF_RGB.sun, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [60, 70, 90] },
    columnStyles: { 1: { fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Issues table
  if (errors.length > 0 || warnings.length > 0) {
    y = section(doc, '2.', 'Validation Issues Detail', y);
    tbl(doc, {
      startY: y,
      head: [['Type', 'Load', 'Field', 'Message']],
      body: [
        ...errors.map(i => ['ERROR', i.loadName, i.field, i.message]),
        ...warnings.slice(0, 15).map(i => ['WARN', i.loadName, i.field, i.message]),
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7, textColor: [60, 70, 90] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Phantom audit
  if (y > 220) { doc.addPage(); header(doc, meta, 2, 99); y = 22; }
  y = section(doc, '3.', 'Phantom / Standby Load Audit', y);
  if (phantom.length > 0) {
    tbl(doc, {
      startY: y,
      head: [['Load', 'Phantom W', '24h Loss', 'Annual Loss']],
      body: phantom.map(l => [l.loadName, l.phantomLoadW.toString(), fmtWh(l.phantomLoadW * 24, 0), fmtWh((l.phantomLoadW * 24 * 365) / 1000, 1) + ' kWh']),
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [60, 70, 90] },
      foot: [[{ content: `Total Phantom Loss: ${(summary.phantomLossWh / 1000).toFixed(2)} kWh/day · ${fmtWh((summary.phantomLossWh * 365) / 1000, 0)} kWh/year`, colSpan: 4, styles: { fontStyle: 'bold', textColor: PDF_RGB.sun, fillColor: [223, 228, 237] } }]],
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    y = paragraph(doc, 'No phantom loads detected — system is free of standby waste.', y);
  }

  // THD warning
  if (y > 220) { doc.addPage(); header(doc, meta, 3, 99); y = 22; }
  y = section(doc, '4.', 'Power Quality — THD Warning', y);
  if (highTHD.length > 0) {
    tbl(doc, {
      startY: y,
      head: [['Load', 'Category', 'THD (%)', 'Harmonic Class', 'Recommendation']],
      body: highTHD.map(l => [l.loadName, l.categoryMain, l.thdPercent.toString(), l.harmonicClass, l.thdPercent > 25 ? 'Active filter required' : 'Consider harmonic filter']),
      theme: 'grid',
      headStyles: { fillColor: [239, 68, 68] as any, textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7, textColor: [60, 70, 90] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  } else {
    y = paragraph(doc, 'All loads within IEEE 519 THD limits (≤15% for typical distribution systems).', y);
  }

  updatePageCount(doc, meta);
  doc.save(`${meta.projectName.replace(/\s+/g, '-')}-Compliance-Report.pdf`);
}

// ====================================================================
//  REPORT 5: CUSTOM — Full engineering schedule
// ====================================================================
export function generateCustomReport(loads: Load[], summary: SummaryMetrics, meta: ReportMeta) {
  const doc = regFont(new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' }));
  header(doc, meta, 1, 99);

  title(doc, 'Custom Engineering Report', 22);
  subtitle(doc, `${meta.projectName}  ·  Full Load Schedule & Analysis  ·  Generated ${meta.generatedAt.toLocaleString()}`, 28);

  let y = 38;
  y = section(doc, '1.', 'Key Metrics', y);

  // Compact KPI grid
  const kpiY = y;
  kpiBox(doc, 14, kpiY, 60, 18, 'Connected', fmtW(summary.totalConnectedLoadW, 1), ORANGE);
  kpiBox(doc, 78, kpiY, 60, 18, 'Max Demand', fmtW(summary.maximumDemandW, 1), AMBER);
  kpiBox(doc, 142, kpiY, 60, 18, 'Daily', fmtWh(summary.totalDailyEnergyWh, 1), GREEN);
  kpiBox(doc, 206, kpiY, 60, 18, 'Annual', fmtWh(summary.annualEnergyKWh * 1000, 0), BLUE);
  y = kpiY + 24;

  y = section(doc, '2.', 'Complete Load Schedule', y);

  tbl(doc, {
    startY: y,
    head: [['ID', 'Tag', 'Name', 'Cat.', 'Qty', 'W', 'PF', 'Ku', 'DF', 'Surge×', 'Hrs', 'Conn (W)', 'Daily (Wh)', 'Annual (kWh)']],
    body: loads.map(l => {
      const conn = calcConnectedLoad(l);
      const daily = calcDailyEnergy(l);
      const annual = calcAnnualEnergy(l);
      const hrs = l.dayHoursSummer + l.nightHoursSummer;
      return [l.loadId, l.loadTag, l.loadName, l.categoryMain, l.quantity, l.ratedPowerW, l.powerFactor.toFixed(2), l.utilizationFactorKu.toFixed(2), l.demandFactor.toFixed(2), l.surgeMultiplier + '×', hrs.toFixed(1), fmtW(conn, 0), fmtWh(daily, 0), (annual / 1000).toFixed(1)];
    }),
    foot: [['TOTAL', '', `${loads.length} loads`, '', loads.reduce((s, l) => s + l.quantity, 0).toString(), '', '', '', '', '', '', fmtW(summary.totalConnectedLoadW, 0), fmtWh(summary.totalDailyEnergyWh, 0), (summary.annualEnergyKWh).toFixed(0)]],
    theme: 'grid',
    headStyles: { fillColor: PDF_RGB.sun, textColor: 255, fontSize: 7, fontStyle: 'bold' },
    footStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 6.5, textColor: [60, 70, 90] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Category summary
  if (y > 170) { doc.addPage(); header(doc, meta, 2, 99); y = 22; }
  y = section(doc, '3.', 'Category Summary', y);
  tbl(doc, {
    startY: y,
    head: [['Category', 'Loads', 'Connected', 'Demand', 'Coincident', 'Diversified', 'Daily', 'Annual', 'Surge']],
    body: summary.byCategory.map(c => {
      const catLoads = loads.filter(l => l.categoryMain === c.name);
      const conn = catLoads.reduce((s, l) => s + calcConnectedLoad(l), 0);
      const demand = catLoads.reduce((s, l) => s + calcDemandLoad(l), 0);
      const coinc = catLoads.reduce((s, l) => s + calcCoincidentLoad(l), 0);
      const div = catLoads.reduce((s, l) => s + calcDiversifiedLoad(l), 0);
      const surge = catLoads.reduce((s, l) => s + calcSurgePower(l), 0);
      return [c.name, catLoads.length.toString(), fmtW(conn, 0), fmtW(demand, 0), fmtW(coinc, 0), fmtW(div, 0), fmtWh(c.value, 0), fmtWh(c.value * 365 / 1000, 0) + ' kWh', fmtW(surge, 0)];
    }),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, textColor: [60, 70, 90] },
    margin: { left: 14, right: 14 },
  });

  updatePageCount(doc, meta);
  doc.save(`${meta.projectName.replace(/\s+/g, '-')}-Custom-Report.pdf`);
}

// ====================================================================
//  Full schedule report (separate)
// ====================================================================
export function generateFullScheduleReport(loads: Load[], summary: SummaryMetrics, meta: ReportMeta) {
  const doc = regFont(new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' }));
  header(doc, meta, 1, 99);

  title(doc, 'Master Load Schedule — Complete', 22);
  subtitle(doc, `${meta.projectName}  ·  ${loads.length} loads  ·  All engineering parameters`, 28);

  let y = 38;

  tbl(doc, {
    startY: y,
    head: [['ID', 'Tag', 'Name', 'Category', 'Space', 'Qty', 'Rated (W)', 'Run (W)', 'PF', 'Ku', 'DF', 'CF', 'Div', 'Duty%', 'Surge×', 'Hrs/d', 'Conn', 'Demand', 'Surge', 'FLC (A)', 'kVA', 'Day (Wh)', 'Night (Wh)', 'Daily (Wh)']],
    body: loads.map(l => {
      const conn = calcConnectedLoad(l);
      const demand = calcDemandLoad(l);
      const surge = calcSurgePower(l);
      const flc = calcFullLoadCurrent(l);
      const kva = calcApparentPower(l);
      const day = calcDayEnergy(l);
      const night = calcNightEnergy(l);
      const daily = calcDailyEnergy(l);
      const hrs = l.dayHoursSummer + l.nightHoursSummer;
      return [l.loadId, l.loadTag, l.loadName, l.categoryMain, l.spaceArea, l.quantity, l.ratedPowerW, l.runningPowerW, l.powerFactor.toFixed(2), l.utilizationFactorKu.toFixed(2), l.demandFactor.toFixed(2), l.coincidenceFactor.toFixed(2), l.diversityFactor.toFixed(2), l.dutyCyclePercent, l.surgeMultiplier + '×', hrs.toFixed(1), fmtW(conn, 0), fmtW(demand, 0), fmtW(surge, 0), flc.toFixed(2), kva.toFixed(2), fmtWh(day, 0), fmtWh(night, 0), fmtWh(daily, 0)];
    }),
    foot: [['TOTAL', '', '', '', '', loads.reduce((s, l) => s + l.quantity, 0).toString(), '', '', '', '', '', '', '', '', '', '', fmtW(summary.totalConnectedLoadW, 0), fmtW(summary.maximumDemandW, 0), fmtW(summary.maximumSurgeKW * 1000, 0), '', fmtKVA(summary.peakDemandKVA), fmtWh(summary.dayEnergyWh, 0), fmtWh(summary.nightEnergyWh, 0), fmtWh(summary.totalDailyEnergyWh, 0)]],
    theme: 'grid',
    headStyles: { fillColor: PDF_RGB.sun, textColor: 255, fontSize: 6, fontStyle: 'bold' },
    footStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 6, fontStyle: 'bold' },
    bodyStyles: { fontSize: 5.5, textColor: [60, 70, 90] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 8, right: 8 },
  });

  updatePageCount(doc, meta);
  doc.save(`${meta.projectName.replace(/\s+/g, '-')}-Master-Schedule.pdf`);
}

// ====================================================================
//  Helper: update page numbers after all pages are generated
// ====================================================================
function updatePageCount(doc: jsPDF, meta: ReportMeta) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    // Re-render footer with correct page number
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...SLATE_500);
    t(doc, `Generated: ${meta.generatedAt.toLocaleString()}`, 14, 290);
    t(doc, `Mode: ${meta.expertLevel}  ·  Page ${i} / ${total}`, 105, 290, { align: 'center' });
    t(doc, 'KAD Calculator · Load Analysis Engine v4.0', 210 - 14, 290, { align: 'right' });
  }
}

// ====================================================================
//  Main entry point — dispatches by report type
// ====================================================================
export type ReportType = 'exec' | 'demand' | 'seasonal' | 'compliance' | 'custom';

export function generatePDFReport(type: ReportType, loads: Load[], summary: SummaryMetrics, projectName: string, expertLevel: ExpertLevel) {
  const meta: ReportMeta = {
    projectName: projectName || 'Solar Load Project',
    expertLevel,
    generatedAt: new Date(),
  };

  if (loads.length === 0) {
    alert('Cannot generate report: no loads defined. Please add at least one load.');
    return;
  }

  try {
    switch (type) {
      case 'exec':
        generateExecutiveReport(loads, summary, meta);
        break;
      case 'demand':
        generateDemandReport(loads, summary, meta);
        break;
      case 'seasonal':
        generateSeasonalReport(loads, summary, meta);
        break;
      case 'compliance':
        generateComplianceReport(loads, summary, meta);
        break;
      case 'custom':
        generateCustomReport(loads, summary, meta);
        break;
    }
  } catch (err) {
    console.error('PDF generation failed:', err);
    alert('PDF generation failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
  }
}

export function generateSchedulePDF(loads: Load[], summary: SummaryMetrics, projectName: string, expertLevel: ExpertLevel) {
  const meta: ReportMeta = {
    projectName: projectName || 'Solar Load Project',
    expertLevel,
    generatedAt: new Date(),
  };
  if (loads.length === 0) {
    alert('Cannot generate report: no loads defined.');
    return;
  }
  try {
    generateFullScheduleReport(loads, summary, meta);
  } catch (err) {
    console.error('PDF generation failed:', err);
    alert('PDF generation failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
  }
}
