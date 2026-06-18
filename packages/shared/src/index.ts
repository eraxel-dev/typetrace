import type * as ts from "typescript";

export type TraceStepKind =
  | "infer"
  | "conditional"
  | "union"
  | "intersection"
  | "mapped";

export interface TraceStep {
  id: string;
  kind: TraceStepKind;
  sourceType: string;
  targetType: string;
  reason: string;
}

export interface TraceResult {
  symbol: string;
  finalType: string;
  steps: TraceStep[];
}

export interface GraphNode {
  id: string;
  label: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ProjectContext {
  program: ts.Program;
  checker: ts.TypeChecker;
}
