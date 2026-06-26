// 2-SAT: given a boolean formula in conjunctive normal form where every clause
// has exactly two literals, decide satisfiability in linear time by reducing
// the problem to strongly connected components on an implication graph.

import { graphState } from '../core/state.js';

export const topic = {
  id: 'two-sat',
  title: '2-SAT',
  category: 'Algorithms',
  summary: 'Decide satisfiability of a 2-CNF boolean formula in linear time by building an implication graph and finding its strongly connected components.',
  controls: [],
  run,
};

// Example: 4 variables x1..x4, 5 clauses.
// Clauses:
//   (x1 OR x2)
//   (NOT x1 OR x3)
//   (NOT x2 OR NOT x3)
//   (x3 OR x4)
//   (NOT x4 OR x1)
//
// Implication graph: each clause (a OR b) becomes two edges: NOT a -> b, NOT b -> a.
// Variables: x1, x2, x3, x4 and their negations ~x1, ~x2, ~x3, ~x4.

const VARS = ['x1', 'x2', 'x3', 'x4'];
const NEG = (v) => `~${v}`;
const IS_NEG = (v) => v.startsWith('~');
const BASE = (v) => IS_NEG(v) ? v.slice(1) : v;
const COMPLEMENT = (v) => IS_NEG(v) ? v.slice(1) : `~${v}`;

const CLAUSES = [
  ['x1', 'x2'],           // (x1 OR x2)
  ['~x1', 'x3'],          // (NOT x1 OR x3)
  ['~x2', '~x3'],         // (NOT x2 OR NOT x3)
  ['x3', 'x4'],           // (x3 OR x4)
  ['~x4', 'x1'],          // (NOT x4 OR x1)
];

// Build the implication graph.
// (a OR b) => (NOT a -> b) AND (NOT b -> a)
function buildImplicationEdges(clauses) {
  const edges = [];
  for (const [a, b] of clauses) {
    edges.push({ from: COMPLEMENT(a), to: b });
    edges.push({ from: COMPLEMENT(b), to: a });
  }
  return edges;
}

// Layout: positive literals on top row, negative literals on bottom row.
const NODE_POSITIONS = {
  x1:  { x: 1.5, y: 1.5 },
  x2:  { x: 4.0, y: 1.5 },
  x3:  { x: 6.5, y: 1.5 },
  x4:  { x: 9.0, y: 1.5 },
  '~x1': { x: 1.5, y: 4.5 },
  '~x2': { x: 4.0, y: 4.5 },
  '~x3': { x: 6.5, y: 4.5 },
  '~x4': { x: 9.0, y: 4.5 },
};

const ALL_LITERALS = [...VARS, ...VARS.map(NEG)];

const IMPL_EDGES = buildImplicationEdges(CLAUSES);

function makeNodes(highlights = {}) {
  return ALL_LITERALS.map((lit) => ({
    id: lit,
    label: lit,
    x: NODE_POSITIONS[lit].x,
    y: NODE_POSITIONS[lit].y,
    note: highlights[lit] || '',
  }));
}

function makeEdges(edgeList) {
  return edgeList.map((e, i) => ({
    id: `e${i}`,
    from: e.from,
    to: e.to,
  }));
}

// Tarjan's SCC on the implication graph
function computeSCCs(literals, edges) {
  const adj = new Map(literals.map((l) => [l, []]));
  for (const e of edges) {
    if (adj.has(e.from)) adj.get(e.from).push(e.to);
  }

  const disc = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const sccs = [];
  let timer = 0;

  function dfs(u) {
    timer++;
    disc.set(u, timer);
    low.set(u, timer);
    stack.push(u);
    onStack.add(u);

    for (const v of (adj.get(u) || [])) {
      if (!disc.has(v)) {
        dfs(v);
        low.set(u, Math.min(low.get(u), low.get(v)));
      } else if (onStack.has(v)) {
        low.set(u, Math.min(low.get(u), disc.get(v)));
      }
    }

    if (disc.get(u) === low.get(u)) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        scc.push(w);
      } while (w !== u);
      sccs.push(scc);
    }
  }

  for (const lit of literals) {
    if (!disc.has(lit)) dfs(lit);
  }

  return sccs;
}

// Assign variables from SCC reverse topological order
function assignFromSCCs(sccs, vars) {
  // sccIndex: literal -> SCC index (Tarjan outputs SCCs in reverse topological order)
  const sccIndex = new Map();
  for (let i = 0; i < sccs.length; i++) {
    for (const lit of sccs[i]) sccIndex.set(lit, i);
  }

  const assignment = {};
  for (const v of vars) {
    // In Tarjan's output, lower SCC index = later in topological order.
    // A literal whose SCC comes later in topological order should be TRUE.
    // Tarjan outputs in reverse topological order, so lower index = later topologically.
    const posIdx = sccIndex.get(v);
    const negIdx = sccIndex.get(NEG(v));
    // The literal in the later SCC (lower index in Tarjan's output) gets TRUE.
    assignment[v] = posIdx < negIdx;
  }
  return assignment;
}

export function* run() {
  const graphEdges = makeEdges(IMPL_EDGES);
  const adj = new Map(ALL_LITERALS.map((l) => [l, []]));
  for (const e of IMPL_EDGES) {
    if (adj.has(e.from)) adj.get(e.from).push(e.to);
  }

  // Step 1: Show the clauses
  yield {
    state: graphState({ nodes: makeNodes(), edges: [] }),
    highlight: {},
    explanation: 'Five clauses with four boolean variables: (x1 OR x2), (NOT x1 OR x3), (NOT x2 OR NOT x3), (x3 OR x4), (NOT x4 OR x1). Each variable has a positive literal (top row) and a negative literal (bottom row). The goal: find a truth assignment satisfying all clauses, or prove none exists.',
  };

  // Step 2-6: Build implication edges clause by clause
  const builtEdges = [];
  for (let ci = 0; ci < CLAUSES.length; ci++) {
    const [a, b] = CLAUSES[ci];
    const notA = COMPLEMENT(a);
    const notB = COMPLEMENT(b);
    builtEdges.push({ from: notA, to: b });
    builtEdges.push({ from: notB, to: a });

    yield {
      state: graphState({
        nodes: makeNodes(),
        edges: makeEdges(builtEdges),
      }),
      highlight: {
        active: [notA, b, notB, a],
        compare: builtEdges.slice(-2).map((_, i) => `e${builtEdges.length - 2 + i}`),
      },
      explanation: `Clause ${ci + 1}: (${a} OR ${b}). This means if ${a} is false then ${b} must be true, and if ${b} is false then ${a} must be true. Add two implication edges: ${notA} -> ${b} and ${notB} -> ${a}. Every 2-CNF clause produces exactly two directed edges in the implication graph.`,
    };
  }

  // Step 7: Full implication graph
  yield {
    state: graphState({
      nodes: makeNodes(),
      edges: graphEdges,
    }),
    highlight: {},
    explanation: `The complete implication graph has ${ALL_LITERALS.length} nodes (one per literal) and ${graphEdges.length} directed edges (two per clause). A path from literal p to literal q means "if p is true then q must be true." The graph encodes every forced consequence of every possible assignment.`,
  };

  // Step 8-12: Run Tarjan's SCC with step-by-step visualization
  const disc = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const sccs = [];
  let timer = 0;

  const snapshot = (extra = {}) => graphState({
    nodes: makeNodes(Object.fromEntries(
      ALL_LITERALS.map((l) => [
        l,
        disc.has(l) ? `d=${disc.get(l)} l=${low.get(l)}` : '',
      ])
    )),
    edges: graphEdges,
  });

  const sccColors = () => {
    const result = [];
    for (const scc of sccs) result.push(...scc);
    return result;
  };

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'Now run Tarjan\'s strongly connected components algorithm on the implication graph. SCCs reveal which literals are mutually forced: if p and q are in the same SCC, then p being true forces q true and vice versa. The critical test: if any variable x shares an SCC with its negation ~x, then x must be both true and false simultaneously, making the formula unsatisfiable.',
  };

  // Iterative Tarjan's
  for (const startLit of ALL_LITERALS) {
    if (disc.has(startLit)) continue;

    const dfsStack = [{ node: startLit, ni: 0 }];
    timer++;
    disc.set(startLit, timer);
    low.set(startLit, timer);
    stack.push(startLit);
    onStack.add(startLit);

    yield {
      state: snapshot(),
      highlight: { active: [startLit], visited: [...stack] },
      explanation: `Start DFS from ${startLit}. Set disc[${startLit}] = ${timer}, low[${startLit}] = ${timer}. Push onto the SCC stack.`,
    };

    while (dfsStack.length > 0) {
      const frame = dfsStack[dfsStack.length - 1];
      const u = frame.node;
      const neighbors = adj.get(u) || [];

      if (frame.ni < neighbors.length) {
        const v = neighbors[frame.ni];
        frame.ni++;

        if (!disc.has(v)) {
          timer++;
          disc.set(v, timer);
          low.set(v, timer);
          stack.push(v);
          onStack.add(v);
          dfsStack.push({ node: v, ni: 0 });

          yield {
            state: snapshot(),
            highlight: {
              active: [v],
              found: sccColors(),
              visited: stack.filter((s) => s !== v),
            },
            explanation: `Tree edge ${u} -> ${v}. Discover ${v}: disc = ${timer}, low = ${timer}. This implication edge means "if ${u} is true then ${v} must be true."`,
          };
        } else if (onStack.has(v)) {
          const oldLow = low.get(u);
          low.set(u, Math.min(low.get(u), disc.get(v)));

          yield {
            state: snapshot(),
            highlight: {
              active: [u],
              swap: [v],
              found: sccColors(),
              visited: stack.filter((s) => s !== u),
            },
            explanation: `Back edge ${u} -> ${v}. Node ${v} is on the SCC stack (disc = ${disc.get(v)}). Update low[${u}] = min(${oldLow}, ${disc.get(v)}) = ${low.get(u)}. This back edge proves ${u} and ${v} are in the same SCC — they mutually force each other.`,
          };
        }
      } else {
        dfsStack.pop();

        if (dfsStack.length > 0) {
          const parent = dfsStack[dfsStack.length - 1].node;
          const oldLow = low.get(parent);
          low.set(parent, Math.min(low.get(parent), low.get(u)));
          if (low.get(parent) < oldLow) {
            yield {
              state: snapshot(),
              highlight: {
                active: [parent],
                compare: [u],
                found: sccColors(),
                visited: stack.filter((s) => s !== parent),
              },
              explanation: `Return from ${u} to ${parent}. Propagate: low[${parent}] = min(${oldLow}, ${low.get(u)}) = ${low.get(parent)}.`,
            };
          }
        }

        if (disc.get(u) === low.get(u)) {
          const scc = [];
          let w;
          do {
            w = stack.pop();
            onStack.delete(w);
            scc.push(w);
          } while (w !== u);
          sccs.push(scc);

          yield {
            state: snapshot(),
            highlight: {
              found: sccColors(),
              active: scc,
              visited: stack,
            },
            explanation: `disc[${u}] = low[${u}] = ${disc.get(u)}, so ${u} is an SCC root. Pop: {${scc.join(', ')}}. This is SCC #${sccs.length}. All literals in this group mutually force each other — if any one is true, all must be true.`,
          };
        }
      }
    }
  }

  // Check satisfiability
  const sccIndex = new Map();
  for (let i = 0; i < sccs.length; i++) {
    for (const lit of sccs[i]) sccIndex.set(lit, i);
  }

  let contradictionVar = null;
  for (const v of VARS) {
    if (sccIndex.get(v) === sccIndex.get(NEG(v))) {
      contradictionVar = v;
      break;
    }
  }

  if (contradictionVar) {
    yield {
      state: snapshot(),
      highlight: {
        found: sccColors(),
        active: [contradictionVar, NEG(contradictionVar)],
      },
      explanation: `UNSATISFIABLE: ${contradictionVar} and ${NEG(contradictionVar)} are in the same SCC. This means ${contradictionVar} being true forces ${NEG(contradictionVar)} true, and vice versa — a contradiction. No truth assignment can satisfy all clauses.`,
    };
    return;
  }

  yield {
    state: snapshot(),
    highlight: { found: sccColors() },
    explanation: `No variable shares an SCC with its negation. The formula is SATISFIABLE. Now assign truth values: for each variable, the literal whose SCC appears later in topological order gets TRUE. Tarjan\'s algorithm outputs SCCs in reverse topological order, so a lower SCC index means later topologically.`,
  };

  // Assign variables
  const assignment = assignFromSCCs(sccs, VARS);
  const trueSet = [];
  const falseSet = [];
  for (const v of VARS) {
    if (assignment[v]) {
      trueSet.push(v);
      falseSet.push(NEG(v));
    } else {
      falseSet.push(v);
      trueSet.push(NEG(v));
    }
  }

  yield {
    state: graphState({
      nodes: makeNodes(Object.fromEntries([
        ...trueSet.map((l) => [l, 'TRUE']),
        ...falseSet.map((l) => [l, 'FALSE']),
      ])),
      edges: graphEdges,
    }),
    highlight: {
      found: trueSet,
      visited: falseSet,
    },
    explanation: `Assignment: ${VARS.map((v) => `${v} = ${assignment[v]}`).join(', ')}. Verify: ${CLAUSES.map(([a, b]) => {
      const aVal = IS_NEG(a) ? !assignment[BASE(a)] : assignment[a];
      const bVal = IS_NEG(b) ? !assignment[BASE(b)] : assignment[b];
      return `(${a} OR ${b}) = (${aVal} OR ${bVal}) = ${aVal || bVal}`;
    }).join('; ')}. All clauses satisfied. Total work: O(n + m) where n = variables and m = clauses — linear time via one SCC pass.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has one node for every literal, where a literal is a boolean variable or its negation. A directed edge p -> q means that if p is true, q must also be true.',
        {
          type: 'callout',
          text: '2-SAT is fast because every clause becomes implication edges, and contradiction reduces to one SCC membership test for each variable and its negation.',
        },
        'Active edges are implications being added from clauses, and found groups are strongly connected components. A strongly connected component is a set of nodes where every node can reach every other node.',
        {
          type: 'image',
          src: './assets/gifs/two-sat.gif',
          alt: 'Animated walkthrough of the two sat visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Boolean satisfiability asks whether true and false values can make a formula true. General SAT is hard in the worst case, but 2-SAT restricts every clause to two literals.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to try every truth assignment. With n variables, there are 2 to the n assignments, and each assignment can be checked against every clause.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is exponential growth. Thirty variables create about one billion assignments, and fifty variables create more than one quadrillion assignments.',
        'Brute force also ignores forced consequences. If a clause is (a OR b), then setting a false immediately forces b true, and that new truth can force more truths through other clauses.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Each clause (a OR b) is equivalent to two implications: NOT a -> b and NOT b -> a. If one side of the OR is false, the other side must be true.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Implication_graph.svg',
          alt: 'Implication graph for a 2-satisfiability instance with literals and directed edges',
          caption: 'An implication graph makes each clause operational: every OR clause becomes two forced edges. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Implication_graph.svg.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build a graph with two nodes per variable, one for x and one for NOT x. For every clause (a OR b), add the two implication edges NOT a -> b and NOT b -> a.',
        'Run a strongly connected components algorithm such as Tarjan or Kosaraju. Then check every variable; if x and NOT x share a component, return unsatisfiable.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'If x and NOT x are in the same component, x true forces NOT x true and NOT x true forces x true. No boolean assignment can make both a variable and its negation true, so the formula is unsatisfiable.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Scc-1.svg',
          alt: 'Directed graph with shaded strongly connected components',
          caption: 'Strongly connected components partition a directed graph into mutually reachable regions; 2-SAT rejects exactly when a variable and its negation share one. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Scc-1.svg.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For n variables and m clauses, the graph has 2n nodes and 2m edges. SCC detection costs O(V + E), which becomes O(n + m).',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        '2-SAT fits scheduling and configuration when constraints are pairwise. A rule such as not both A and B becomes (NOT A OR NOT B), and a dependency such as A requires B becomes (NOT A OR B).',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The method fails when clauses need three or more literals. 3-SAT is NP-complete, so the implication-graph shortcut no longer gives a linear-time decision procedure.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use formula (x1 OR x2) AND (NOT x1 OR x3) AND (NOT x2 OR NOT x3). It has three variables, so brute force would check 8 assignments.',
        'Build implications: ~x1 -> x2, ~x2 -> x1, x1 -> x3, ~x3 -> ~x1, x2 -> ~x3, and x3 -> ~x2. The assignment x1 = true, x2 = false, x3 = true satisfies all three clauses.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Aspvall, Plass, and Tarjan, A linear-time algorithm for testing the truth of certain quantified boolean formulas (1979). Study directed graphs, DFS, strongly connected components, topological sort, 3-SAT, DPLL, CDCL, and MAX-SAT next.',
      ],
    },
  ],
};
