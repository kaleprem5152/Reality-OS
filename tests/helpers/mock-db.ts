import type { ProjectRow, ReportRow } from "@/db/schema";

export interface RecordedQuery {
  operation: "select" | "insert" | "update" | "delete" | "execute";
  table?: unknown;
  fields?: unknown;
  whereCondition?: unknown;
  joins?: Array<{ table: unknown; condition: unknown }>;
  orderByArgs?: unknown[];
  limitCount?: number;
  offsetCount?: number;
  insertValues?: unknown;
  updateSet?: unknown;
  returningFields?: unknown;
  sqlQuery?: unknown;
}

export interface WorkspaceMemberQueryResult {
  membershipId: string;
  workspaceId: string;
  workspaceName: string;
  role: string;
  joinedAt: Date | string;
  workspaceCreatedAt: Date | string;
}

export class MockQueryChain<T = unknown> implements PromiseLike<T> {
  private query: RecordedQuery;
  private onExecute: (query: RecordedQuery) => Promise<T>;

  constructor(
    operation: RecordedQuery["operation"],
    onExecute: (query: RecordedQuery) => Promise<T>,
    initial?: Partial<RecordedQuery>,
  ) {
    this.query = { operation, ...initial };
    this.onExecute = onExecute;
  }

  from(table: unknown): this {
    this.query.table = table;
    return this;
  }

  innerJoin(table: unknown, condition: unknown): this {
    if (!this.query.joins) this.query.joins = [];
    this.query.joins.push({ table, condition });
    return this;
  }

  leftJoin(table: unknown, condition: unknown): this {
    if (!this.query.joins) this.query.joins = [];
    this.query.joins.push({ table, condition });
    return this;
  }

  where(condition: unknown): this {
    this.query.whereCondition = condition;
    return this;
  }

  orderBy(...args: unknown[]): this {
    this.query.orderByArgs = args;
    return this;
  }

  limit(count: number): this {
    this.query.limitCount = count;
    return this;
  }

  offset(count: number): this {
    this.query.offsetCount = count;
    return this;
  }

  values(vals: unknown): this {
    this.query.insertValues = vals;
    return this;
  }

  set(vals: unknown): this {
    this.query.updateSet = vals;
    return this;
  }

  returning(fields?: unknown): this {
    this.query.returningFields = fields ?? true;
    return this;
  }

  onConflictDoNothing(): this {
    return this;
  }

  onConflictDoUpdate(): this {
    return this;
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.onExecute(this.query).then(onfulfilled, onrejected);
  }
}

export interface MockDb {
  select: (fields?: unknown) => MockQueryChain<any>;
  insert: (table: unknown) => MockQueryChain<any>;
  update: (table: unknown) => MockQueryChain<any>;
  delete: (table: unknown) => MockQueryChain<any>;
  execute: (sql: unknown) => MockQueryChain<any>;
  queueResult: (result: unknown) => void;
  queueResults: (...results: unknown[]) => void;
  queueWorkspaceMemberships: (memberships: Array<Partial<WorkspaceMemberQueryResult>>) => void;
  queueProjects: (projects: Array<Partial<ProjectRow>>) => void;
  queueReports: (reports: Array<Partial<ReportRow>>) => void;
  setDefaultResult: (result: unknown) => void;
  throwOnNext: (err: Error) => void;
  throwAlways: (err: Error | null) => void;
  getExecutedQueries: () => RecordedQuery[];
  getLastQuery: () => RecordedQuery | undefined;
  reset: () => void;
}

/**
 * Creates a mock Drizzle database object that matches the real query chains used in Reality.OS.
 * Completely isolates tests from PostgreSQL.
 */
export function createMockDb(): MockDb {
  const executedQueries: RecordedQuery[] = [];
  const resultQueue: unknown[] = [];
  let defaultResult: unknown = [];
  let nextError: Error | null = null;
  let alwaysError: Error | null = null;

  async function executeHandler(query: RecordedQuery): Promise<any> {
    executedQueries.push({ ...query });

    if (alwaysError) {
      throw alwaysError;
    }

    if (nextError) {
      const err = nextError;
      nextError = null;
      throw err;
    }

    if (resultQueue.length > 0) {
      const next = resultQueue.shift();
      if (next instanceof Error) {
        throw next;
      }
      if (typeof next === "function") {
        return next(query);
      }
      return next;
    }

    // Default fallbacks based on query type
    if (query.operation === "execute") {
      return { rows: [{ "?column?": 1 }] };
    }

    if (query.operation === "insert" && query.returningFields) {
      const vals = query.insertValues;
      if (Array.isArray(vals)) {
        return vals.map((v, i) => createMockProjectRow({ id: `PRJ-MOCK-${i + 1}`, ...v }));
      }
      if (vals && typeof vals === "object") {
        return [createMockProjectRow({ id: "PRJ-MOCK-1", ...vals })];
      }
      return [];
    }

    if (query.operation === "update" && query.returningFields) {
      const setVals = query.updateSet;
      if (setVals && typeof setVals === "object") {
        return [createMockProjectRow({ id: "PRJ-MOCK-1", ...setVals })];
      }
      return [];
    }

    return defaultResult;
  }

  const mockDb: MockDb = {
    select(fields?: unknown) {
      return new MockQueryChain("select", executeHandler, { fields });
    },
    insert(table: unknown) {
      return new MockQueryChain("insert", executeHandler, { table });
    },
    update(table: unknown) {
      return new MockQueryChain("update", executeHandler, { table });
    },
    delete(table: unknown) {
      return new MockQueryChain("delete", executeHandler, { table });
    },
    execute(sql: unknown) {
      return new MockQueryChain("execute", executeHandler, { sqlQuery: sql });
    },
    queueResult(result: unknown) {
      resultQueue.push(result);
    },
    queueResults(...results: unknown[]) {
      resultQueue.push(...results);
    },
    queueWorkspaceMemberships(memberships: Array<Partial<WorkspaceMemberQueryResult>>) {
      const rows = memberships.map((m, idx) => createMockWorkspaceMembershipRow({
        membershipId: `mem-mock-${idx + 1}`,
        workspaceId: "ws-mock-alpha",
        workspaceName: "Alpha Authority Workspace",
        role: "editor",
        ...m,
      }));
      resultQueue.push(rows);
    },
    queueProjects(projects: Array<Partial<ProjectRow>>) {
      const rows = projects.map((p, idx) => createMockProjectRow({
        id: `PRJ-${1001 + idx}`,
        ...p,
      }));
      resultQueue.push(rows);
    },
    queueReports(reports: Array<Partial<ReportRow>>) {
      const rows = reports.map((r, idx) => createMockReportRow({
        id: `RPT-${5001 + idx}`,
        ...r,
      }));
      resultQueue.push(rows);
    },
    setDefaultResult(result: unknown) {
      defaultResult = result;
    },
    throwOnNext(err: Error) {
      nextError = err;
    },
    throwAlways(err: Error | null) {
      alwaysError = err;
    },
    getExecutedQueries() {
      return [...executedQueries];
    },
    getLastQuery() {
      return executedQueries[executedQueries.length - 1];
    },
    reset() {
      executedQueries.length = 0;
      resultQueue.length = 0;
      defaultResult = [];
      nextError = null;
      alwaysError = null;
    },
  };

  return mockDb;
}

/**
 * Creates a mock WorkspaceMemberQueryResult row for database query results.
 */
export function createMockWorkspaceMembershipRow(
  overrides: Partial<WorkspaceMemberQueryResult> = {},
): WorkspaceMemberQueryResult {
  return {
    membershipId: "mem-mock-1",
    workspaceId: "ws-mock-alpha",
    workspaceName: "Alpha Authority Workspace",
    role: "editor",
    joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    workspaceCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

/**
 * Creates a complete mock ProjectRow matching the Drizzle schema.
 */
export function createMockProjectRow(overrides: Partial<ProjectRow> = {}): ProjectRow {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "PRJ-1001",
    workspaceId: "ws-mock-alpha",
    createdBy: "usr-mock-1",
    name: "Urban Rail Corridor Alpha",
    description: "Rapid transit modernization project",
    infraType: "Rail & Transit",
    region: "Metropolitan Central",
    status: "Planning",
    budgetCrore: 2500,
    targetCompletion: "2029-Q4",
    riskLevel: "Moderate",
    capacityTarget: "500,000 daily commuters",
    sustainabilityPriorities: ["Solar powered stations", "Regenerative braking"],
    requirements: "Zero net emissions transit corridor",
    stations: 12,
    corridorKm: 34.5,
    featured: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Creates a complete mock ReportRow matching the Drizzle schema.
 */
export function createMockReportRow(overrides: Partial<ReportRow> = {}): ReportRow {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "RPT-5001",
    workspaceId: "ws-mock-alpha",
    projectId: "PRJ-1001",
    createdBy: "usr-mock-1",
    title: "Environmental Feasibility Assessment",
    reportType: "Environmental",
    status: "Final",
    content: {
      executiveSummary: "Environmental impact within statutory limits.",
      metrics: { airQualityImprovement: "18%" },
    },
    createdAt: now,
    ...overrides,
  };
}
