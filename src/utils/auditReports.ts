// =======================================================================
//  Audit-Grade Report Generators
//  Phase Balance · Assumptions · Validation · Audit Trail
// =======================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Load, SummaryMetrics, ExpertLevel } from '../types';
import { POLICY_PACK, getPolicyStats } from '../core/assumptions/policy';
import { getValidationMatrix, type Severity } from '../core/validation/rules';
import { balancePhases } from '../core/phase/balancer';
import { analyzeSystemHarmonics } from '../core/harmonics/engine';
import { analyzeSystemPF } from '../core/pf/engine';
import { analyzeSystemSurges } from '../core/surge/engine';
import { fmtW, fmtWh, fmtKVA, fmtPct, calcConnectedLoad, calcDailyEnergy } from './calculations';
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

const ORANGE: [number, number, number] = [26, 43, 107];
const SLATE_500: [number, number, number] = [100, 116, 139];
const SLATE_300: [number, number, number] = [203, 213, 225];
const SLATE_700: [number, number, number] = [30, 41, 59];

const SEV_COLORS: Record<Severity, [number, number, number]> = {
  error: [239, 68, 68],
  warning: [245, 158, 11],
  advisory: [59, 130, 246],
  info: [16, 185, 129],
  assumption: [139, 92, 246],
};

interface ReportMeta {
  projectName: string;
  expertLevel: ExpertLevel;
  generatedAt: Date;
}

function header(doc: jsPDF, meta: ReportMeta, page: number, total: number) {
  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, 210, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...ORANGE);
  t(doc, 'KAD Calculator', 14, 11);
  doc.setTextColor(...SLATE_500);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  t(doc, 'Engineering Audit Report', 38, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_300);
  t(doc, meta.projectName.substring(0, 50), 210 - 14, 11, { align: 'right' });
  doc.setDrawColor(...SLATE_700);
  doc.setLineWidth(0.3);
  doc.line(14, 14, 210 - 14, 14);
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
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.8);
  doc.line(14, y + 1.5, 60, y + 1.5);
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

function updatePageCount(doc: jsPDF, meta: ReportMeta) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...SLATE_500);
    t(doc, `Generated: ${meta.generatedAt.toLocaleString()}`, 14, 290);
    t(doc, `Mode: ${meta.expertLevel}  ·  Page ${i} / ${total}`, 105, 290, { align: 'center' });
    t(doc, 'KAD Calculator · Load Analysis Engine v4.0', 210 - 14, 290, { align: 'right' });
  }
}

// ====================================================================
//  ASSUMPTIONS REPORT
// ====================================================================
export function generateAssumptionsReport(loads: Load[], _summary: SummaryMetrics, meta: ReportMeta) {
  const doc = regFont(new jsPDF({ unit: 'mm', format: 'a4' }));
  header(doc, meta, 1, 99);
  title(doc, 'Assumptions & Policy Audit', 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_500);
  t(doc, `${meta.projectName}  ·  ${loads.length} loads  ·  Complete policy registry & rationale`, 14, 28);

  let y = 38;
  y = section(doc, '1.', 'Policy Statistics', y);
  const stats = getPolicyStats();
  tbl(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Total Policies Registered', stats.total.toString()],
      ['High Confidence Policies', `${stats.byConfidence.High} (${Math.round((stats.byConfidence.High / stats.total) * 100)}%)`],
      ['Medium Confidence', stats.byConfidence.Medium.toString()],
      ['Low Confidence', stats.byConfidence.Low.toString()],
      ['Last Reviewed', stats.lastReviewed],
      ...Object.entries(stats.bySource).map(([src, n]) => [`Source: ${src}`, n.toString()]),
    ],
    theme: 'grid',
    headStyles: { fillColor: [26, 43, 107] as any, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [60, 70, 90] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  y = section(doc, '2.', 'Complete Policy Registry', y);
  tbl(doc, {
    startY: y,
    head: [['ID', 'Name', 'Default', 'Range', 'Source', 'Conf.', 'Override']],
    body: POLICY_PACK.map(p => [
      p.policyId,
      p.name,
      `${p.defaultValue} ${p.unit}`,
      `${p.allowedRange.min}–${p.allowedRange.max}`,
      p.sourceType,
      p.confidenceLevel,
      p.overrideAllowed,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 6.5, textColor: [60, 70, 90] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Detailed rationale section
  let pIdx = 0;
  for (const p of POLICY_PACK) {
    if (y > 240) { doc.addPage(); header(doc, meta, doc.getNumberOfPages() + 1, 99); y = 22; }
    pIdx++;
    y = section(doc, '2.' + pIdx, `${p.policyId} — ${p.name}`, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...SLATE_500);
    const lines = doc.splitTextToSize(p.engineeringRationale, 182);
    t(doc, lines, 14, y);
    y += lines.length * 3.5 + 2;
    doc.setFontSize(7);
    doc.setTextColor(...SLATE_500);
    t(doc, `Scope: ${p.scope}`, 14, y);
    y += 3.5;
    t(doc, `Reference: ${p.sourceReference}  ·  Reviewed: ${p.lastReviewed}`, 14, y);
    y += 5;
  }

  updatePageCount(doc, meta);
  doc.save(`${meta.projectName.replace(/\s+/g, '-')}-Assumptions-Audit.pdf`);
}

// ====================================================================
//  VALIDATION REPORT
// ====================================================================
export function generateValidationReport(loads: Load[], _summary: SummaryMetrics, meta: ReportMeta) {
  const doc = regFont(new jsPDF({ unit: 'mm', format: 'a4' }));
  header(doc, meta, 1, 99);
  title(doc, 'Validation Matrix Report', 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_500);
  t(doc, `${meta.projectName}  ·  ${loads.length} loads  ·  5-severity validation engine`, 14, 28);

  const matrix = getValidationMatrix(loads);
  let y = 38;

  y = section(doc, '1.', 'Severity Summary', y);
  tbl(doc, {
    startY: y,
    head: [['Severity', 'Count', 'Description']],
    body: [
      ['Error', matrix.error.length.toString(), 'Blocks save — must be fixed'],
      ['Warning', matrix.warning.length.toString(), 'Engineering review needed'],
      ['Advisory', matrix.advisory.length.toString(), 'Optimization recommendation'],
      ['Info', matrix.info.length.toString(), 'Informational note'],
      ['Assumption', matrix.assumption.length.toString(), 'Default value in use'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [26, 43, 107] as any, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [60, 70, 90] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Issues detail
  const allIssues = [
    ...matrix.error.map(r => ({ ...r, severity: 'error' as Severity })),
    ...matrix.warning.map(r => ({ ...r, severity: 'warning' as Severity })),
    ...matrix.advisory.map(r => ({ ...r, severity: 'advisory' as Severity })),
    ...matrix.assumption.map(r => ({ ...r, severity: 'assumption' as Severity })),
  ];
  if (allIssues.length > 0) {
    y = section(doc, '2.', `Validation Issues (${allIssues.length})`, y);
    tbl(doc, {
      startY: y,
      head: [['Sev', 'Rule', 'Load', 'Field', 'Message', 'Fix']],
      body: allIssues.map(r => [r.severity.toUpperCase(), r.ruleId, r.loadName || '-', r.field, r.message, r.fixSuggestion]),
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 6, textColor: [60, 70, 90] },
      didParseCell: (data: any) => {
        if (data.column.index === 0 && data.section === 'body') {
          const sev = data.cell.text[0]?.toLowerCase();
          if (sev && SEV_COLORS[sev as Severity]) {
            data.cell.styles.fillColor = SEV_COLORS[sev as Severity];
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: 14, right: 14 },
    });
  }

  updatePageCount(doc, meta);
  doc.save(`${meta.projectName.replace(/\s+/g, '-')}-Validation-Matrix.pdf`);
}

// ====================================================================
//  PHASE BALANCE REPORT
// ====================================================================
export function generatePhaseBalanceReport(loads: Load[], _summary: SummaryMetrics, meta: ReportMeta) {
  const doc = regFont(new jsPDF({ unit: 'mm', format: 'a4' }));
  header(doc, meta, 1, 99);
  title(doc, 'Phase Balance Report', 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_500);
  t(doc, `${meta.projectName}  ·  Multi-pass greedy + refinement algorithm`, 14, 28);

  const r = balancePhases(loads);
  let y = 38;

  y = section(doc, '1.', 'Phase Distribution', y);
  tbl(doc, {
    startY: y,
    head: [['Phase', 'Connected Load', 'Percentage']],
    body: [
      ['L1', fmtW(r.phases.L1, 0), ((r.phases.L1 / r.totalConnected) * 100).toFixed(1) + '%'],
      ['L2', fmtW(r.phases.L2, 0), ((r.phases.L2 / r.totalConnected) * 100).toFixed(1) + '%'],
      ['L3', fmtW(r.phases.L3, 0), ((r.phases.L3 / r.totalConnected) * 100).toFixed(1) + '%'],
      ['Total', fmtW(r.totalConnected, 0), '100.0%'],
    ],
    foot: [[{ content: `Imbalance: ${r.imbalancePercent.toFixed(1)}% (${r.imbalanceStatus})  ·  Score: ${r.balancingScore.toFixed(0)}/100`, colSpan: 3, styles: { fontStyle: 'bold', textColor: [26, 43, 107] } }]],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, textColor: [60, 70, 90] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  y = section(doc, '2.', 'Surge Stacking Analysis', y);
  tbl(doc, {
    startY: y,
    head: [['Phase', 'Peak Surge', 'Stacking Risk']],
    body: r.surgeStacking.map(s => [s.phase, fmtW(s.peakSurge, 0), s.stackingRisk.toUpperCase()]),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, textColor: [60, 70, 90] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  if (r.recommendations.length > 0) {
    y = section(doc, '3.', 'Recommendations', y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...SLATE_500);
    r.recommendations.forEach(rec => {
      const lines = doc.splitTextToSize(`• ${rec}`, 182);
      t(doc, lines, 14, y);
      y += lines.length * 4 + 1;
    });
  }

  if (y > 220) { doc.addPage(); header(doc, meta, doc.getNumberOfPages() + 1, 99); y = 22; }
  y = section(doc, '4.', 'Phase Allocation Map', y);
  tbl(doc, {
    startY: y,
    head: [['Load', 'Phase', 'Reasoning']],
    body: r.allocations.map(a => [a.loadName, a.phase, a.reasoning]),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, textColor: [60, 70, 90] },
    margin: { left: 14, right: 14 },
  });

  updatePageCount(doc, meta);
  doc.save(`${meta.projectName.replace(/\s+/g, '-')}-Phase-Balance.pdf`);
}

// ====================================================================
//  AUDIT TRAIL REPORT
// ====================================================================
export function generateAuditTrailReport(loads: Load[], summary: SummaryMetrics, meta: ReportMeta) {
  const doc = regFont(new jsPDF({ unit: 'mm', format: 'a4' }));
  header(doc, meta, 1, 99);
  title(doc, 'Calculation Audit Trail', 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_500);
  t(doc, `${meta.projectName}  ·  Complete formula & input traceability for every metric`, 14, 28);

  let y = 38;
  y = section(doc, '1.', 'System-Level Metrics Audit', y);

  tbl(doc, {
    startY: y,
    head: [['Metric', 'Value', 'Formula', 'Confidence']],
    body: [
      ['Total Connected', fmtW(summary.totalConnectedLoadW, 0), 'Σ ratedPowerW × qty', 'High'],
      ['Max Demand', fmtW(summary.maximumDemandW, 0), 'max(hourly operating profile)', 'High'],
      ['Daily Energy', fmtWh(summary.totalDailyEnergyWh, 0), 'avg(summer × 183, winter × 182) / 365', 'High'],
      ['Annual Energy', fmtWh(summary.annualEnergyKWh * 1000, 0), 'daily × 365', 'High'],
      ['Peak kVA', fmtKVA(summary.peakDemandKVA), 'kW / 0.85 PF', 'High'],
      ['Max Surge', fmtW(summary.maximumSurgeKW * 1000, 0), 'Σ rated × surgeMultiplier × qty', 'High'],
      ['Load Factor', fmtPct(summary.loadFactor), '(daily / 24) / peak × 100', 'High'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [26, 43, 107] as any, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [60, 70, 90] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Per-load audit
  y = section(doc, '2.', 'Per-Load Audit Trail (First 20 loads)', y);
  tbl(doc, {
    startY: y,
    head: [['ID', 'Name', 'PF', 'Ku', 'DF', 'Surge×', 'Conn (W)', 'Daily (Wh)', 'Conf.']],
    body: loads.slice(0, 20).map(l => {
      const conn = calcConnectedLoad(l);
      const daily = calcDailyEnergy(l);
      return [l.loadId, l.loadName, l.powerFactor.toFixed(2), l.utilizationFactorKu.toFixed(2), l.demandFactor.toFixed(2), l.surgeMultiplier + '×', fmtW(conn, 0), fmtWh(daily, 0), l.confidenceLevel];
    }),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, textColor: [60, 70, 90] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Audit metadata
  if (y > 220) { doc.addPage(); header(doc, meta, doc.getNumberOfPages() + 1, 99); y = 22; }
  y = section(doc, '3.', 'Data Source & Confidence Distribution', y);
  const confDist = { High: 0, Medium: 0, Low: 0 };
  loads.forEach(l => { if (l.confidenceLevel in confDist) confDist[l.confidenceLevel as keyof typeof confDist]++; });
  const srcDist = loads.reduce((acc, l) => { acc[l.dataSource] = (acc[l.dataSource] || 0) + 1; return acc; }, {} as Record<string, number>);

  tbl(doc, {
    startY: y,
    head: [['Dimension', 'Value', 'Count']],
    body: [
      ['Confidence', 'High', confDist.High.toString()],
      ['Confidence', 'Medium', confDist.Medium.toString()],
      ['Confidence', 'Low', confDist.Low.toString()],
      ...Object.entries(srcDist).map(([k, v]) => ['Source', k, v.toString()]),
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [60, 70, 90] },
    margin: { left: 14, right: 14 },
  });

  updatePageCount(doc, meta);
  doc.save(`${meta.projectName.replace(/\s+/g, '-')}-Audit-Trail.pdf`);
}

// ====================================================================
//  HARMONIC RISK REPORT
// ====================================================================
export function generateHarmonicReport(loads: Load[], _summary: SummaryMetrics, meta: ReportMeta) {
  const doc = regFont(new jsPDF({ unit: 'mm', format: 'a4' }));
  header(doc, meta, 1, 99);
  title(doc, 'Harmonic Risk Report', 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_500);
  t(doc, `${meta.projectName}  ·  IEEE 519 compliance & mitigation analysis`, 14, 28);

  const r = analyzeSystemHarmonics(loads);
  let y = 38;

  y = section(doc, '1.', 'System Harmonic Summary', y);
  tbl(doc, {
    startY: y,
    head: [['Metric', 'Value', 'Status']],
    body: [
      ['Average THD', `${r.avgTHD.toFixed(1)}%`, r.avgTHD < 5 ? 'PASS' : 'REVIEW'],
      ['Maximum THD', `${r.maxTHD.toFixed(1)}%`, r.maxTHD < 8 ? 'PASS' : r.maxTHD < 20 ? 'WARNING' : 'NON-COMPLIANT'],
      ['Non-linear Loads', `${r.totalNonLinear} of ${loads.length}`, '—'],
      ['Total Filter Required', `${r.totalFilterKvar.toFixed(1)} kVAr`, r.totalFilterKvar > 0 ? 'FILTER NEEDED' : 'OK'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [26, 43, 107] as any, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, textColor: [60, 70, 90] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  y = section(doc, '2.', 'Per-Load Harmonic Analysis', y);
  tbl(doc, {
    startY: y,
    head: [['Load', 'THD%', 'Class', 'Severity', 'Filter', 'Compliance']],
    body: r.perLoad.map(a => [a.loadName, `${a.thdPercent.toFixed(0)}%`, a.harmonicClass, a.severity, a.filterType, a.complianceFlag]),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [60, 70, 90] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  if (r.recommendations.length > 0) {
    y = section(doc, '3.', 'Recommendations', y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...SLATE_500);
    r.recommendations.forEach(rec => {
      const lines = doc.splitTextToSize(`• ${rec}`, 182);
      t(doc, lines, 14, y);
      y += lines.length * 4 + 1;
    });
  }

  updatePageCount(doc, meta);
  doc.save(`${meta.projectName.replace(/\s+/g, '-')}-Harmonic-Risk.pdf`);
}

// ====================================================================
//  EXCEPTION REPORT — critical issues across all systems
// ====================================================================
export function generateExceptionReport(loads: Load[], _summary: SummaryMetrics, meta: ReportMeta) {
  const doc = regFont(new jsPDF({ unit: 'mm', format: 'a4' }));
  header(doc, meta, 1, 99);
  title(doc, 'Exception Report', 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_500);
  t(doc, `${meta.projectName}  ·  All critical exceptions across systems`, 14, 28);

  let y = 38;
  const allExceptions: { source: string; severity: string; message: string; loadName?: string }[] = [];

  // Validation
  const matrix = getValidationMatrix(loads);
  matrix.error.forEach(e => allExceptions.push({ source: 'Validation', severity: 'ERROR', message: e.message, loadName: e.loadName }));
  matrix.warning.forEach(w => allExceptions.push({ source: 'Validation', severity: 'WARN', message: w.message, loadName: w.loadName }));

  // Phase balance
  const phase = balancePhases(loads);
  phase.violations.forEach(v => allExceptions.push({ source: 'Phase Balance', severity: v.severity.toUpperCase(), message: v.reason, loadName: v.loadName }));
  if (phase.imbalancePercent > 15) allExceptions.push({ source: 'Phase Balance', severity: 'WARN', message: `Imbalance ${phase.imbalancePercent.toFixed(1)}% exceeds 15% policy` });

  // Surge
  const surge = analyzeSystemSurges(loads);
  surge.perLoad.filter(p => p.riskLevel === 'high').forEach(p => allExceptions.push({ source: 'Surge', severity: 'HIGH', message: `LRA ${p.lra.toFixed(0)}A from ${p.loadName}`, loadName: p.loadName }));

  // Harmonics
  const harm = analyzeSystemHarmonics(loads);
  harm.perLoad.filter(p => p.complianceFlag === 'non-compliant').forEach(p => allExceptions.push({ source: 'Harmonics', severity: 'ERROR', message: `THD ${p.thdPercent}% non-compliant`, loadName: p.loadName }));
  if (harm.systemLevelWarning) allExceptions.push({ source: 'Harmonics', severity: 'WARN', message: harm.systemLevelWarning });

  // PF
  const pfRes = analyzeSystemPF(loads);
  if (pfRes.systemNeedsCorrection) allExceptions.push({ source: 'Power Factor', severity: 'WARN', message: `System PF ${pfRes.weightedPF.toFixed(2)} below 0.95 target — needs ${pfRes.totalKvarCorrection.toFixed(1)} kVAr correction` });

  y = section(doc, '1.', `Exception Summary (${allExceptions.length} items)`, y);
  tbl(doc, {
    startY: y,
    head: [['Sev', 'Source', 'Load', 'Issue']],
    body: allExceptions.map(e => [e.severity, e.source, e.loadName || '-', e.message]),
    theme: 'grid',
    headStyles: { fillColor: [239, 68, 68] as any, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, textColor: [60, 70, 90] },
    margin: { left: 14, right: 14 },
  });

  updatePageCount(doc, meta);
  doc.save(`${meta.projectName.replace(/\s+/g, '-')}-Exception-Report.pdf`);
}

// ====================================================================
//  ENTRY POINT
// ====================================================================
export type AuditReportType = 'assumptions' | 'validation' | 'phase' | 'audit' | 'harmonic' | 'exception';

export function generateAuditPDF(type: AuditReportType, loads: Load[], summary: SummaryMetrics, projectName: string, expertLevel: ExpertLevel) {
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
    switch (type) {
      case 'assumptions': generateAssumptionsReport(loads, summary, meta); break;
      case 'validation': generateValidationReport(loads, summary, meta); break;
      case 'phase': generatePhaseBalanceReport(loads, summary, meta); break;
      case 'audit': generateAuditTrailReport(loads, summary, meta); break;
      case 'harmonic': generateHarmonicReport(loads, summary, meta); break;
      case 'exception': generateExceptionReport(loads, summary, meta); break;
    }
  } catch (err) {
    console.error('Audit report failed:', err);
    alert('Report generation failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
  }
}
