"use client";

import { jsPDF } from "jspdf";
import type { Project, Report, ReportContent } from "@/lib/types";
import { formatCrore, formatDate } from "@/lib/format";

/**
 * Generates a real, readable PDF from a saved report using jsPDF.
 * Returns nothing — triggers a browser download.
 */
export function exportReportPdf(report: Report, project: Project | null): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const CONTENT_W = W - M * 2;
  let y = 0;
  let page = 1;

  const footer = () => {
    doc.setFontSize(8);
    doc.setTextColor(150, 158, 168);
    doc.text(
      `RealityOS — Infrastructure Intelligence · Illustrative prototype data, not verified project facts · Page ${page}`,
      M,
      H - 24,
    );
  };

  const ensureSpace = (need: number) => {
    if (y + need > H - 56) {
      footer();
      doc.addPage();
      page += 1;
      y = 56;
      doc.setFontSize(9);
      doc.setTextColor(102, 112, 133);
      doc.text(`${report.title} (continued)`, M, 40);
    }
  };

  const heading = (text: string) => {
    ensureSpace(34);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(23, 32, 43);
    y += 20;
    doc.text(text, M, y);
    y += 6;
    doc.setDrawColor(226, 230, 235);
    doc.line(M, y, W - M, y);
    y += 12;
  };

  const body = (text: string, indent = 0, size = 10) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(61, 71, 86);
    const lines = doc.splitTextToSize(text, CONTENT_W - indent) as string[];
    for (const line of lines) {
      ensureSpace(size + 4);
      doc.text(line, M + indent, y);
      y += size + 3.6;
    }
    y += 3;
  };

  const bullet = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(61, 71, 86);
    const lines = doc.splitTextToSize(text, CONTENT_W - 16) as string[];
    lines.forEach((line, i) => {
      ensureSpace(14);
      if (i === 0) {
        doc.setFillColor(53, 92, 125);
        doc.circle(M + 3, y - 3, 1.6, "F");
      }
      doc.text(line, M + 14, y);
      y += 13.6;
    });
    y += 2;
  };

  const table = (cols: string[], rows: string[][]) => {
    const colW = CONTENT_W / cols.length;
    ensureSpace(28 + rows.length * 16);
    doc.setFillColor(249, 250, 251);
    doc.rect(M, y, CONTENT_W, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(102, 112, 133);
    cols.forEach((c, i) => doc.text(c.toUpperCase(), M + i * colW + 4, y + 12.5));
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(23, 32, 43);
    rows.forEach((row) => {
      const cellLines = row.map((cell, i) => doc.splitTextToSize(cell, colW - 8) as string[]);
      const rowH = Math.max(...cellLines.map((l) => l.length)) * 11.5 + 6;
      ensureSpace(rowH + 4);
      row.forEach((_, i) => {
        cellLines[i].forEach((line, li) => doc.text(line, M + i * colW + 4, y + 11 + li * 11.5));
      });
      y += rowH;
      doc.setDrawColor(226, 230, 235);
      doc.line(M, y, W - M, y);
    });
    y += 10;
  };

  /* ------------------------------- Cover band ------------------------------ */
  doc.setFillColor(53, 92, 125);
  doc.rect(0, 0, W, 92, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(report.title, M, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`RealityOS planning report · ${report.reportType} · ${report.status}`, M, 62);
  doc.text(`Generated ${formatDate(report.createdAt)} · Report ${report.id}`, M, 76);

  y = 116;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(102, 112, 133);
  doc.text(
    `Project: ${project ? `${project.name} (${project.id}) — ${project.infraType}, ${project.region}` : report.projectId}`,
    M, y,
  );
  y += 24;

  const c = report.content ?? ({} as ReportContent);

  heading("Executive summary");
  body(c.executiveSummary || "No executive summary provided.");

  if (c.assumptions?.length) {
    heading("Planning assumptions");
    c.assumptions.forEach((a) => bullet(a));
  }

  if (c.costBreakdown?.length) {
    heading("Cost breakdown");
    table(
      ["Component", "Value", "Note"],
      c.costBreakdown.map((r) => [r.label, formatCrore(r.valueCrore), r.note ?? "—"]),
    );
  }

  if (c.milestones?.length) {
    heading("Proposed milestones");
    table(
      ["Phase", "Window", "Detail"],
      c.milestones.map((m) => [m.phase, m.window, m.detail]),
    );
  }

  if (c.riskRegister?.length) {
    heading("Risk register");
    table(
      ["Risk", "Severity", "Mitigation"],
      c.riskRegister.map((r) => [r.risk, r.severity, r.mitigation]),
    );
  }

  if (c.environmental?.length) {
    heading("Environmental considerations");
    c.environmental.forEach((e) => bullet(e));
  }

  if (c.recommendations?.length) {
    heading("Recommendations and rationale");
    c.recommendations.forEach((r, i) => {
      bullet(`${i + 1}. ${r.title}`);
      body(`Why: ${r.rationale}`, 16, 9.5);
    });
  }

  if (c.evidence?.length) {
    heading("Evidence and sources");
    table(
      ["Reference", "Nature"],
      c.evidence.map((e) => [e.label, e.kind === "Illustrative" ? "Illustrative (demo dataset)" : "Internal analysis"]),
    );
    body("No external verified sources are attached in this prototype build. Illustrative evidence must not be treated as verified findings.", 0, 8.5);
  }

  footer();
  doc.save(`${report.id}_${report.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 48)}.pdf`);
}
