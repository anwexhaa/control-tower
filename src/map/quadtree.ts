/* ============================================================================
   A point quadtree over screen positions.

   Hit-testing 1,200 markers against a moving cursor by scanning the array is
   1,200 distance checks per mousemove. A quadtree turns that into a handful.

   It is rebuilt when the transform or the fleet changes — not per frame —
   because insertion is the expensive half and neither of those happens at
   60 Hz.
   ========================================================================== */

export interface QuadPoint<T> {
  x: number;
  y: number;
  value: T;
}

interface Node<T> {
  x: number;
  y: number;
  w: number;
  h: number;
  points: QuadPoint<T>[] | null;
  children: [Node<T>, Node<T>, Node<T>, Node<T>] | null;
}

const CAPACITY = 8;
const MAX_DEPTH = 10;

function makeNode<T>(x: number, y: number, w: number, h: number): Node<T> {
  return { x, y, w, h, points: [], children: null };
}

export class Quadtree<T> {
  private root: Node<T>;
  private count = 0;

  constructor(x: number, y: number, width: number, height: number) {
    this.root = makeNode(x, y, width, height);
  }

  get size(): number {
    return this.count;
  }

  insert(point: QuadPoint<T>): void {
    this.insertInto(this.root, point, 0);
    this.count++;
  }

  private insertInto(node: Node<T>, point: QuadPoint<T>, depth: number): void {
    if (node.children) {
      this.insertInto(this.childFor(node, point.x, point.y), point, depth + 1);
      return;
    }

    node.points!.push(point);
    if (node.points!.length <= CAPACITY || depth >= MAX_DEPTH) return;

    // Split, then push the held points down one level.
    const hw = node.w / 2;
    const hh = node.h / 2;
    node.children = [
      makeNode(node.x, node.y, hw, hh),
      makeNode(node.x + hw, node.y, hw, hh),
      makeNode(node.x, node.y + hh, hw, hh),
      makeNode(node.x + hw, node.y + hh, hw, hh),
    ];
    const held = node.points!;
    node.points = null;
    for (const p of held) {
      this.insertInto(this.childFor(node, p.x, p.y), p, depth + 1);
    }
  }

  private childFor(node: Node<T>, x: number, y: number): Node<T> {
    const right = x >= node.x + node.w / 2 ? 1 : 0;
    const bottom = y >= node.y + node.h / 2 ? 1 : 0;
    return node.children![bottom * 2 + right];
  }

  /** Closest point within `radius` screen pixels, or null. */
  nearest(x: number, y: number, radius: number): QuadPoint<T> | null {
    let best: QuadPoint<T> | null = null;
    let bestSq = radius * radius;

    const visit = (node: Node<T>): void => {
      // Skip whole branches whose bounding box is already too far away.
      const dx = x < node.x ? node.x - x : x > node.x + node.w ? x - node.x - node.w : 0;
      const dy = y < node.y ? node.y - y : y > node.y + node.h ? y - node.y - node.h : 0;
      if (dx * dx + dy * dy > bestSq) return;

      if (node.points) {
        for (const p of node.points) {
          const ex = p.x - x;
          const ey = p.y - y;
          const d = ex * ex + ey * ey;
          if (d <= bestSq) {
            bestSq = d;
            best = p;
          }
        }
        return;
      }
      for (const child of node.children!) visit(child);
    };

    visit(this.root);
    return best;
  }
}
