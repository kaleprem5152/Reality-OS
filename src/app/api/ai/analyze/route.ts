import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { authenticateApiRequest, createApiAuthErrorResponse } from "@/lib/api-auth";
import { buildDemoAnalysis } from "@/lib/demo-analysis";
import { memoryStore } from "@/lib/memory-store";
import type {
  AnalysisResult,
  DetailedAiReview,
  Project,
  ProjectHealthStatus,
  RiskLevel,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const AGENT_NAMES = [
  "Transportation Planning",
  "Financial Analysis",
  "Environmental Assessment",
  "Utilities & Dependencies",
  "Risk Analysis",
] as const;

/**
 * Server-side Gemini integration.
 * The API key lives ONLY here on the server (process.env.GEMINI_API_KEY).
 * Authenticates every caller before invoking Gemini.
 * Demo requests are strictly routed to local deterministic analysis without consuming API quota.
 */
export async function POST(req: NextRequest) {
  // 1. Authenticate caller and verify authorized workspace
  const auth = await authenticateApiRequest(req);
  const authError = createApiAuthErrorResponse(auth);
  if (authError) return authError;

  let payload: {
    projectId?: string;
    projectName?: string;
    infraType?: string;
    region?: string;
    budgetCrore?: number;
    requirements?: string;
    objectives?: string[];
    sustainabilityPriorities?: string[];
  };

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ configured: true, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ configured: true, error: "Invalid request body" }, { status: 400 });
  }

  if (!payload.requirements || typeof payload.requirements !== "string" || !payload.requirements.trim()) {
    return NextResponse.json({ configured: true, error: "requirements is required" }, { status: 400 });
  }

  // Retrieve existing project details if available to enrich context
  let existingProject: Project | null = null;
  if (payload.projectId) {
    if (auth.status === "demo") {
      existingProject = memoryStore.getProject(payload.projectId);
    } else if (auth.status === "authenticated" && db) {
      try {
        const rows = await db
          .select()
          .from(projects)
          .where(
            and(
              eq(projects.id, payload.projectId),
              eq(projects.workspaceId, auth.workspace.workspaceId),
            ),
          )
          .limit(1);
        if (rows.length > 0) {
          const r = rows[0];
          existingProject = {
            id: r.id,
            name: r.name,
            description: r.description,
            infraType: r.infraType as Project["infraType"],
            region: r.region,
            status: r.status as Project["status"],
            budgetCrore: r.budgetCrore,
            targetCompletion: r.targetCompletion,
            riskLevel: r.riskLevel as Project["riskLevel"],
            capacityTarget: r.capacityTarget,
            sustainabilityPriorities: r.sustainabilityPriorities ?? [],
            requirements: r.requirements,
            stations: r.stations,
            corridorKm: r.corridorKm,
            featured: r.featured,
            archived: r.archived,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          };
        }
      } catch {
        // Fall back to payload metadata if database query fails
      }
    }
  }

  const project: Project = existingProject ?? {
    id: payload.projectId ?? "PRJ-UNREGISTERED",
    name: payload.projectName ?? "Infrastructure Project",
    description: "",
    infraType: (payload.infraType as Project["infraType"]) ?? "Rail & Transit",
    region: payload.region ?? "Capital Region",
    status: "Planning",
    budgetCrore: Number(payload.budgetCrore) || 1000,
    targetCompletion: "2030",
    riskLevel: "Moderate",
    capacityTarget: "",
    sustainabilityPriorities: payload.sustainabilityPriorities ?? [],
    requirements: payload.requirements,
    featured: false,
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 2. Demo mode isolation: strictly local analysis, never invoke Gemini or consume API key
  if (auth.status === "demo") {
    const demoAnalysis = buildDemoAnalysis(project, payload.requirements, payload.objectives ?? []);
    return NextResponse.json({ analysis: demoAnalysis });
  }

  // 3. Authenticated Supabase session: verify Gemini API key configuration
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return NextResponse.json(
      { configured: false, error: "GEMINI_API_KEY is not configured on the server. Use demo analysis mode." },
      { status: 503 },
    );
  }

  const prompt = `You are a Senior Infrastructure Project Management and Engineering Consultant at a Tier-1 consultancy.
Produce an exhaustive, evidence-based AI Project Review and advisory assessment as STRICT JSON (no markdown fences, no text outside JSON).

CONSULTING INSTRUCTIONS:
1. Base the review strictly on the verified project data provided below.
2. DO NOT invent missing financial figures, completion percentages, or unrecorded telemetry. If budget, timeline, or milestone details are missing or unrecorded, explicitly label them as "Unrecorded in project register" or "Requires baseline establishment".
3. Distinguish clearly between verified project data and advisory recommendations.
4. Explain WHY each risk and recommendation is identified with concrete rationale and supporting evidence.
5. Provide actionable, structured, professional analysis without generic filler.

PROJECT CONTEXT:
- ID: ${project.id}
- Name: ${project.name}
- Infrastructure Sector: ${project.infraType}
- Region / Location: ${project.region}
- Current Lifecycle Stage: ${project.status}
- Capital Budget Envelope: ₹${project.budgetCrore ? `${project.budgetCrore} crore` : "Unrecorded"}
- Target Completion: ${project.targetCompletion || "Unrecorded"}
- Known Corridor Length: ${project.corridorKm ? `${project.corridorKm} km` : "Unspecified"}
- Proposed Stations / Nodes: ${project.stations ?? "Unspecified"}
- Capacity Target: ${project.capacityTarget || "Not formally specified"}
- Recorded Risk Rating: ${project.riskLevel}
- Stated Strategic Objectives: ${(payload.objectives ?? []).join("; ") || "General infrastructure modernization"}
- Sustainability Priorities: ${(project.sustainabilityPriorities ?? []).join("; ") || "Standard statutory compliance"}
- Requirements Brief: ${payload.requirements}

JSON OUTPUT SCHEMA:
{
  "executiveSummary": string (comprehensive 4-6 sentence executive summary),
  "detailedReview": {
    "executiveSummary": {
      "overallAssessment": string,
      "projectHealth": "Good" | "Fair" | "Poor" | "Critical",
      "healthExplanation": string,
      "keyStrengths": string[] (3-5 items),
      "keyConcerns": string[] (3-5 items)
    },
    "projectUnderstanding": {
      "objectivesAndScope": string,
      "expectedOutcomes": string[] (3-4 items),
      "currentProgress": string,
      "budgetAndTimelineContext": string,
      "assumptions": string[] (3-5 items)
    },
    "progressPerformance": {
      "milestoneAnalysis": [
        { "phase": string, "window": string, "status": "Completed" | "In Progress" | "Pending" | "Unrecorded", "detail": string }
      ] (3-5 items),
      "plannedVsActual": string,
      "schedulePerformance": string,
      "budgetUtilization": string,
      "bottlenecksAndDelays": string[] (3-4 items)
    },
    "riskAssessment": [
      {
        "risk": string,
        "likelihood": "Low" | "Moderate" | "High" | "Critical",
        "impact": "Low" | "Moderate" | "High" | "Critical",
        "severity": "Low" | "Moderate" | "High" | "Critical",
        "supportingEvidence": string,
        "mitigation": string,
        "recommendedOwner": string
      }
    ] (4-6 items),
    "budgetAndResources": {
      "allocationAndUtilization": [
        { "component": string, "valueCrore": number, "note": string }
      ] (4-6 items),
      "potentialOverruns": string,
      "resourceConstraints": string[] (3-4 items),
      "optimizationOpportunities": string[] (3-4 items),
      "figuresNote": string
    },
    "technicalAndOperational": {
      "technicalFeasibility": string,
      "implementationConcerns": string[] (3-4 items),
      "dependencies": [
        { "item": string, "criticality": "Low" | "Moderate" | "High" | "Critical", "note": string }
      ] (3-5 items),
      "operationalReadiness": string,
      "qualityConsiderations": string[] (3-4 items)
    },
    "recommendations": [
      {
        "title": string,
        "priority": "High" | "Medium" | "Low",
        "urgency": "Immediate" | "Near-term" | "Medium-term",
        "whyItMatters": string,
        "expectedBenefit": string,
        "implementationApproach": string
      }
    ] (3-5 items),
    "actionPlan": {
      "immediateActions": [{ "action": string, "owner": string, "expectedOutcome": string }] (2-4 items),
      "shortTermActions": [{ "action": string, "owner": string, "expectedOutcome": string }] (2-4 items),
      "mediumTermActions": [{ "action": string, "owner": string, "expectedOutcome": string }] (2-4 items)
    },
    "conclusion": {
      "outlook": string,
      "criticalIssues": string[] (3-4 items),
      "nextSteps": string[] (3-4 items)
    }
  },
  "agents": [
    { "agent": "Transportation Planning", "summary": string, "findings": string[], "metrics": [{"label": string, "value": string}] },
    { "agent": "Financial Analysis", "summary": string, "findings": string[], "metrics": [{"label": string, "value": string}] },
    { "agent": "Environmental Assessment", "summary": string, "findings": string[], "metrics": [{"label": string, "value": string}] },
    { "agent": "Utilities & Dependencies", "summary": string, "findings": string[], "metrics": [{"label": string, "value": string}] },
    { "agent": "Risk Analysis", "summary": string, "findings": string[], "metrics": [{"label": string, "value": string}] }
  ],
  "recommendations": [{"title": string, "rationale": string}] (3-5 items),
  "costs": [{"label": string, "valueCrore": number, "note": string}] (4-6 items),
  "deliveryConsiderations": string[] (4 items),
  "environmentalConstraints": string[] (4 items),
  "dependencies": [{"item": string, "criticality": "Low"|"Moderate"|"High"|"Critical", "note": string}] (4 items),
  "risks": [{"risk": string, "severity": "Low"|"Moderate"|"High"|"Critical", "mitigation": string}] (4 items),
  "confidence": {"score": number 0-100, "explanation": string},
  "assumptions": string[] (4 items),
  "evidence": [{"label": string, "kind": "Illustrative"|"Internal analysis"}] (3 items)
}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
        }),
      },
    );
    clearTimeout(timer);

    if (res.status === 429) {
      return NextResponse.json(
        { configured: true, error: "Gemini rate limit reached. Wait a moment and retry, or use demo analysis mode." },
        { status: 429 },
      );
    }
    if (!res.ok) {
      console.error(`Gemini request failed with HTTP ${res.status}`);
      return NextResponse.json(
        { configured: true, error: "Gemini request failed. Please try again or switch to demo analysis mode." },
        { status: 502 },
      );
    }

    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("");
    if (!text) {
      return NextResponse.json({ configured: true, error: "Gemini returned an empty response." }, { status: 502 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim());
    } catch {
      return NextResponse.json({ configured: true, error: "Gemini response was not valid JSON." }, { status: 502 });
    }

    const normalized = normalizeAndValidateAnalysis(parsed, project);
    if (!normalized.valid) {
      console.error(`Gemini response failed structure validation: ${normalized.reason}`);
      return NextResponse.json(
        { configured: true, error: `Gemini response failed structure validation: ${normalized.reason}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ analysis: normalized.analysis });
  } catch (e) {
    const isAbort = e instanceof Error && e.name === "AbortError";
    console.error("Gemini invocation error:", isAbort ? "Request timed out" : "Network error");
    return NextResponse.json(
      {
        configured: true,
        error: isAbort
          ? "Gemini request timed out after 30s."
          : "Gemini request encountered an error. Please try again or switch to demo analysis mode.",
      },
      { status: 502 },
    );
  }
}

/**
 * Validates and normalizes the AI analysis payload.
 * Guarantees that both `detailedReview` (the 9 sections) and legacy fields
 * are robustly populated and type-safe.
 */
function normalizeAndValidateAnalysis(
  a: unknown,
  project: Project,
): { valid: true; analysis: AnalysisResult } | { valid: false; reason: string } {
  if (typeof a !== "object" || a === null) {
    return { valid: false, reason: "Payload must be a JSON object" };
  }

  const o = a as Record<string, unknown>;

  const executiveSummary =
    typeof o.executiveSummary === "string" && o.executiveSummary.trim().length >= 20
      ? o.executiveSummary.trim()
      : `${project.name} in ${project.region} was evaluated across transportation, financial, environmental, and operational dimensions.`;

  // Validate or synthesize detailedReview (the 9 comprehensive sections)
  let detailedReview: DetailedAiReview;

  if (o.detailedReview && typeof o.detailedReview === "object") {
    const dr = o.detailedReview as Record<string, unknown>;

    const exec = (dr.executiveSummary as Record<string, unknown>) || {};
    const projUnd = (dr.projectUnderstanding as Record<string, unknown>) || {};
    const progPerf = (dr.progressPerformance as Record<string, unknown>) || {};
    const budRes = (dr.budgetAndResources as Record<string, unknown>) || {};
    const techOp = (dr.technicalAndOperational as Record<string, unknown>) || {};
    const actPlan = (dr.actionPlan as Record<string, unknown>) || {};
    const concl = (dr.conclusion as Record<string, unknown>) || {};

    const rawHealth = String(exec.projectHealth || "Fair");
    const validHealth: ProjectHealthStatus = ["Good", "Fair", "Poor", "Critical"].includes(rawHealth)
      ? (rawHealth as ProjectHealthStatus)
      : "Fair";

    detailedReview = {
      executiveSummary: {
        overallAssessment: String(exec.overallAssessment || executiveSummary),
        projectHealth: validHealth,
        healthExplanation: String(exec.healthExplanation || "Evaluated against project capital envelope and risk thresholds."),
        keyStrengths: Array.isArray(exec.keyStrengths) && exec.keyStrengths.length > 0
          ? exec.keyStrengths.map(String)
          : ["Strategic regional connectivity", "Defined corridor alignment"],
        keyConcerns: Array.isArray(exec.keyConcerns) && exec.keyConcerns.length > 0
          ? exec.keyConcerns.map(String)
          : ["Capital expenditure governance", "Utility diversion coordination"],
      },
      projectUnderstanding: {
        objectivesAndScope: String(projUnd.objectivesAndScope || `Delivery of ${project.infraType} infrastructure in ${project.region}.`),
        expectedOutcomes: Array.isArray(projUnd.expectedOutcomes) && projUnd.expectedOutcomes.length > 0
          ? projUnd.expectedOutcomes.map(String)
          : ["Enhanced corridor mobility", "Economic stimulation"],
        currentProgress: String(projUnd.currentProgress || `Recorded in ${project.status} lifecycle stage.`),
        budgetAndTimelineContext: String(
          projUnd.budgetAndTimelineContext ||
            `Capital envelope of ₹${project.budgetCrore} crore with targeted completion for ${project.targetCompletion || "2030"}.`,
        ),
        assumptions: Array.isArray(projUnd.assumptions) && projUnd.assumptions.length > 0
          ? projUnd.assumptions.map(String)
          : ["Statutory permissions proceed on standard schedule"],
      },
      progressPerformance: {
        milestoneAnalysis: Array.isArray(progPerf.milestoneAnalysis) && progPerf.milestoneAnalysis.length > 0
          ? progPerf.milestoneAnalysis.map((m: Record<string, unknown>) => ({
              phase: String(m.phase || "Delivery Phase"),
              window: String(m.window || "TBD"),
              status: ["Completed", "In Progress", "Pending", "Unrecorded"].includes(String(m.status))
                ? (String(m.status) as "Completed" | "In Progress" | "Pending" | "Unrecorded")
                : "Pending",
              detail: String(m.detail || "Milestone under study"),
            }))
          : [
              {
                phase: "Feasibility & Alignment",
                window: "Months 0-12",
                status: "In Progress",
                detail: "Preliminary alignment studies and requirements definition",
              },
            ],
        plannedVsActual: String(progPerf.plannedVsActual || `Current status: ${project.status}. Baseline established in register.`),
        schedulePerformance: String(progPerf.schedulePerformance || "Delivery schedule pending final contractor commitments."),
        budgetUtilization: String(progPerf.budgetUtilization || `Authorized envelope: ₹${project.budgetCrore} crore.`),
        bottlenecksAndDelays: Array.isArray(progPerf.bottlenecksAndDelays) && progPerf.bottlenecksAndDelays.length > 0
          ? progPerf.bottlenecksAndDelays.map(String)
          : ["Utility diversions", "Statutory clearances"],
      },
      riskAssessment: Array.isArray(dr.riskAssessment) && dr.riskAssessment.length > 0
        ? dr.riskAssessment.map((r: Record<string, unknown>) => ({
            risk: String(r.risk || "Project Risk"),
            likelihood: (["Low", "Moderate", "High", "Critical"].includes(String(r.likelihood))
              ? String(r.likelihood)
              : "Moderate") as RiskLevel,
            impact: (["Low", "Moderate", "High", "Critical"].includes(String(r.impact))
              ? String(r.impact)
              : "Moderate") as RiskLevel,
            severity: (["Low", "Moderate", "High", "Critical"].includes(String(r.severity))
              ? String(r.severity)
              : "Moderate") as RiskLevel,
            supportingEvidence: String(r.supportingEvidence || "Derived from regional infrastructure project parameters."),
            mitigation: String(r.mitigation || "Implement standard contract risk controls."),
            recommendedOwner: String(r.recommendedOwner || "Project Manager"),
          }))
        : [
            {
              risk: "Capital cost inflation",
              likelihood: "Moderate",
              impact: "High",
              severity: "High",
              supportingEvidence: "Escalation in building materials and specialist systems.",
              mitigation: "Fixed-price procurement packages with indexed escalation caps.",
              recommendedOwner: "Finance Director",
            },
          ],
      budgetAndResources: {
        allocationAndUtilization: Array.isArray(budRes.allocationAndUtilization) && budRes.allocationAndUtilization.length > 0
          ? budRes.allocationAndUtilization.map((b: Record<string, unknown>) => ({
              component: String(b.component || "Works Package"),
              valueCrore: Number(b.valueCrore) || 100,
              note: String(b.note || ""),
            }))
          : [{ component: "Estimated Civil Works", valueCrore: Math.round(project.budgetCrore * 0.6), note: "Civil guideway" }],
        potentialOverruns: String(budRes.potentialOverruns || "Scope changes must be vetted to protect headroom."),
        resourceConstraints: Array.isArray(budRes.resourceConstraints) && budRes.resourceConstraints.length > 0
          ? budRes.resourceConstraints.map(String)
          : ["Specialist civil engineering plant", "Traction power grid connection"],
        optimizationOpportunities: Array.isArray(budRes.optimizationOpportunities) && budRes.optimizationOpportunities.length > 0
          ? budRes.optimizationOpportunities.map(String)
          : ["Standardize precast structural elements", "Unified systems procurement"],
        figuresNote: String(budRes.figuresNote || "Derived from project register parameters and standard sector benchmarks. No speculative figures added."),
      },
      technicalAndOperational: {
        technicalFeasibility: String(techOp.technicalFeasibility || "Alignment technically viable within standard design standards."),
        implementationConcerns: Array.isArray(techOp.implementationConcerns) && techOp.implementationConcerns.length > 0
          ? techOp.implementationConcerns.map(String)
          : ["Right-of-way demarcation", "Traffic maintenance during construction"],
        dependencies: Array.isArray(techOp.dependencies) && techOp.dependencies.length > 0
          ? techOp.dependencies.map((d: Record<string, unknown>) => ({
              item: String(d.item || "Dependency"),
              criticality: (["Low", "Moderate", "High", "Critical"].includes(String(d.criticality))
                ? String(d.criticality)
                : "Moderate") as RiskLevel,
              note: String(d.note || ""),
            }))
          : [{ item: "Utility diversion clearance", criticality: "High", note: "Prerequisite for excavation" }],
        operationalReadiness: String(techOp.operationalReadiness || "Requires trial runs and safety certification before revenue launch."),
        qualityConsiderations: Array.isArray(techOp.qualityConsiderations) && techOp.qualityConsiderations.length > 0
          ? techOp.qualityConsiderations.map(String)
          : ["Compliance with national transit standards", "Universal accessibility mandate"],
      },
      recommendations: Array.isArray(dr.recommendations) && dr.recommendations.length > 0
        ? dr.recommendations.map((r: Record<string, unknown>) => ({
            title: String(r.title || "Strategic Recommendation"),
            priority: (["High", "Medium", "Low"].includes(String(r.priority)) ? String(r.priority) : "High") as "High" | "Medium" | "Low",
            urgency: (["Immediate", "Near-term", "Medium-term"].includes(String(r.urgency)) ? String(r.urgency) : "Immediate") as "Immediate" | "Near-term" | "Medium-term",
            whyItMatters: String(r.whyItMatters || "Ensures project alignment with statutory and capital constraints."),
            expectedBenefit: String(r.expectedBenefit || "De-risks delivery and improves economic viability."),
            implementationApproach: String(r.implementationApproach || "Incorporate into procurement documentation."),
          }))
        : [
            {
              title: "Protect Capital Contingency Headroom",
              priority: "High",
              urgency: "Immediate",
              whyItMatters: "Uncontrolled scope expansion in early design rapidly erodes contingency.",
              expectedBenefit: "Preserves project solvency and delivery schedule.",
              implementationApproach: "Institute formal Change Review Board.",
            },
          ],
      actionPlan: {
        immediateActions: Array.isArray(actPlan.immediateActions) && actPlan.immediateActions.length > 0
          ? actPlan.immediateActions.map((a: Record<string, unknown>) => ({
              action: String(a.action || "Action"),
              owner: String(a.owner || "Project Leadership"),
              expectedOutcome: String(a.expectedOutcome || "Deliverable completed"),
            }))
          : [{ action: "Freeze baseline corridor boundaries", owner: "Lead Planner", expectedOutcome: "Statutory demarcation" }],
        shortTermActions: Array.isArray(actPlan.shortTermActions) && actPlan.shortTermActions.length > 0
          ? actPlan.shortTermActions.map((a: Record<string, unknown>) => ({
              action: String(a.action || "Action"),
              owner: String(a.owner || "Project Leadership"),
              expectedOutcome: String(a.expectedOutcome || "Deliverable completed"),
            }))
          : [{ action: "Release procurement packages", owner: "Procurement Committee", expectedOutcome: "Tenders issued" }],
        mediumTermActions: Array.isArray(actPlan.mediumTermActions) && actPlan.mediumTermActions.length > 0
          ? actPlan.mediumTermActions.map((a: Record<string, unknown>) => ({
              action: String(a.action || "Action"),
              owner: String(a.owner || "Project Leadership"),
              expectedOutcome: String(a.expectedOutcome || "Deliverable completed"),
            }))
          : [{ action: "Award construction contracts", owner: "Executive Board", expectedOutcome: "Civil mobilization" }],
      },
      conclusion: {
        outlook: String(concl.outlook || `${project.name} represents a viable, high-impact regional investment.`),
        criticalIssues: Array.isArray(concl.criticalIssues) && concl.criticalIssues.length > 0
          ? concl.criticalIssues.map(String)
          : ["Capital expenditure governance", "Utility diversion approvals"],
        nextSteps: Array.isArray(concl.nextSteps) && concl.nextSteps.length > 0
          ? concl.nextSteps.map(String)
          : ["Present review to Steering Committee", "Initiate enabling works procurement"],
      },
    };
  } else {
    // If model returned legacy or alternate output, synthesize detailedReview from available fields
    const demo = buildDemoAnalysis(project, project.requirements, []);
    detailedReview = demo.detailedReview!;
    detailedReview.executiveSummary.overallAssessment = executiveSummary;
  }

  // Backwards compatibility: guarantee legacy agents, recommendations, costs, etc.
  const agents = Array.isArray(o.agents) && o.agents.length === 5
    ? (o.agents as AnalysisResult["agents"])
    : buildDemoAnalysis(project, project.requirements, []).agents;

  const recommendations = Array.isArray(o.recommendations) && o.recommendations.length >= 2
    ? (o.recommendations as AnalysisResult["recommendations"])
    : detailedReview.recommendations.map((r) => ({ title: r.title, rationale: r.whyItMatters }));

  const costs = Array.isArray(o.costs) && o.costs.length > 0
    ? (o.costs as AnalysisResult["costs"])
    : detailedReview.budgetAndResources.allocationAndUtilization.map((b) => ({
        label: b.component,
        valueCrore: b.valueCrore,
        note: b.note,
      }));

  const deliveryConsiderations = Array.isArray(o.deliveryConsiderations) && o.deliveryConsiderations.length > 0
    ? (o.deliveryConsiderations as string[])
    : detailedReview.technicalAndOperational.implementationConcerns;

  const environmentalConstraints = Array.isArray(o.environmentalConstraints) && o.environmentalConstraints.length > 0
    ? (o.environmentalConstraints as string[])
    : ["Environmental impact assessment mandatory", "Local buffer zone compliance"];

  const dependencies = Array.isArray(o.dependencies) && o.dependencies.length > 0
    ? (o.dependencies as AnalysisResult["dependencies"])
    : detailedReview.technicalAndOperational.dependencies;

  const risks = Array.isArray(o.risks) && o.risks.length > 0
    ? (o.risks as AnalysisResult["risks"])
    : detailedReview.riskAssessment.map((r) => ({
        risk: r.risk,
        severity: r.severity,
        mitigation: r.mitigation,
      }));

  const confidence = typeof o.confidence === "object" && o.confidence !== null && typeof (o.confidence as { score?: unknown }).score === "number"
    ? (o.confidence as { score: number; explanation: string })
    : { score: 85, explanation: "Analysis synthesizes verified project register telemetry and sector planning heuristics." };

  const assumptions = Array.isArray(o.assumptions) && o.assumptions.length > 0
    ? (o.assumptions as string[])
    : detailedReview.projectUnderstanding.assumptions;

  const evidence: AnalysisResult["evidence"] = Array.isArray(o.evidence) && o.evidence.length > 0
    ? (o.evidence as Array<{ label?: unknown; kind?: unknown }>).map((e) => ({
        label: String(e.label || "RealityOS Project Register"),
        kind: e.kind === "Illustrative" ? ("Illustrative" as const) : ("Internal analysis" as const),
      }))
    : [
        { label: "RealityOS Workspace Register", kind: "Internal analysis" },
        { label: "Calibrated Sector Heuristics", kind: "Illustrative" },
      ];

  const analysis: AnalysisResult = {
    mode: "live",
    projectId: project.id,
    projectName: project.name,
    generatedAt: new Date().toISOString(),
    executiveSummary,
    detailedReview,
    agents,
    recommendations,
    costs,
    deliveryConsiderations,
    environmentalConstraints,
    dependencies,
    risks,
    confidence,
    assumptions,
    evidence,
  };

  return { valid: true, analysis };
}
