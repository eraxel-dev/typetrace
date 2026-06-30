import { buildGraph } from "@typetrace/graph-engine";
import type { TraceResult } from "@typetrace/shared";
import { SVG, registerWindow, type Svg } from "@svgdotjs/svg.js";
import dagre from "dagre";
import { createSVGWindow } from "svgdom";

import type { Reporter } from "./types.js";

const NODE_HEIGHT = 28;
const CHAR_WIDTH = 7.5;
const NODE_PADDING_X = 24;
const MIN_NODE_WIDTH = 48;
const CANVAS_MARGIN = 24;

const FILL_NODE = "#ffffff";
const STROKE_NODE = "#334155";
const TEXT_NODE = "#0f172a";
const STROKE_EDGE = "#94a3b8";
const TEXT_EDGE = "#475569";
const FONT_FAMILY =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

interface LaidOutNode {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

function nodeWidth(label: string): number {
  return Math.max(label.length * CHAR_WIDTH + NODE_PADDING_X, MIN_NODE_WIDTH);
}

/**
 * Render a {@link TraceResult} as a standalone SVG string.
 *
 * The trace is first reduced to a deduplicated DAG via `buildGraph`, laid out
 * top-to-bottom with dagre, then drawn with svg.js running against an svgdom
 * window so the whole pipeline works server-side with no browser. Each node is a
 * rounded `<rect>` with a centred type-string `<text>`; each edge is a straight
 * `<path>` between node centres with its reason `<text>` at the midpoint.
 */
export class SvgReporter implements Reporter {
  render(result: TraceResult): string {
    const graph = buildGraph(result);

    const layout = new dagre.graphlib.Graph({ multigraph: true });
    layout.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 70 });
    layout.setDefaultEdgeLabel(() => ({}));

    for (const node of graph.nodes) {
      layout.setNode(node.id, {
        label: node.label,
        width: nodeWidth(node.label),
        height: NODE_HEIGHT,
      });
    }

    graph.edges.forEach((edge, index) => {
      layout.setEdge(edge.from, edge.to, { label: edge.label }, String(index));
    });

    dagre.layout(layout);

    const window = createSVGWindow();
    const document = window.document;
    registerWindow(window, document);
    const canvas = SVG(document.documentElement) as unknown as Svg;

    let maxX = 0;
    let maxY = 0;
    const placed = new Map<string, LaidOutNode>();

    for (const node of graph.nodes) {
      const laid = layout.node(node.id);
      const positioned: LaidOutNode = {
        x: laid.x,
        y: laid.y,
        width: laid.width,
        height: laid.height,
        label: node.label,
      };
      placed.set(node.id, positioned);
      maxX = Math.max(maxX, positioned.x + positioned.width / 2);
      maxY = Math.max(maxY, positioned.y + positioned.height / 2);
    }

    canvas.size(maxX + CANVAS_MARGIN, maxY + CANVAS_MARGIN);

    for (const edge of graph.edges) {
      const from = placed.get(edge.from);
      const to = placed.get(edge.to);
      if (from === undefined || to === undefined) {
        continue;
      }

      canvas
        .path(`M ${String(from.x)} ${String(from.y)} L ${String(to.x)} ${String(to.y)}`)
        .fill("none")
        .stroke({ color: STROKE_EDGE, width: 1.5 });

      if (edge.label.length > 0) {
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        canvas
          .text(edge.label)
          .font({ family: FONT_FAMILY, size: 11, anchor: "middle", fill: TEXT_EDGE })
          .center(midX, midY);
      }
    }

    for (const node of placed.values()) {
      canvas
        .rect(node.width, node.height)
        .move(node.x - node.width / 2, node.y - node.height / 2)
        .radius(6)
        .fill(FILL_NODE)
        .stroke({ color: STROKE_NODE, width: 1.5 });

      canvas
        .text(node.label)
        .font({ family: FONT_FAMILY, size: 13, anchor: "middle", fill: TEXT_NODE })
        .center(node.x, node.y);
    }

    return canvas.svg();
  }
}
