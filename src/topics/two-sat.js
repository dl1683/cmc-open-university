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
        'The top row shows positive literals (x1, x2, x3, x4). The bottom row shows their negations (~x1, ~x2, ~x3, ~x4). Directed edges are implications: an edge from p to q means "if p is true, then q must be true."',
        'The animation builds the implication graph clause by clause. Each clause (a OR b) adds two edges: NOT a -> b and NOT b -> a. Active nodes (highlighted) show the current implication pair being added.',
        'Once the graph is complete, Tarjan\'s SCC algorithm runs. Nodes in the same SCC are mutually forced: if any one is true, all must be true. The critical check is whether any variable x and its negation ~x land in the same SCC. If they do, x must be both true and false, which is impossible. If they do not, the formula is satisfiable, and the algorithm assigns truth values by SCC topological order. Found nodes (final highlight) are the TRUE literals in the satisfying assignment.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Boolean satisfiability (SAT) asks whether a boolean formula has a truth assignment that makes it true. General SAT is NP-complete: no known polynomial-time algorithm exists, and most researchers believe none will be found. But 2-SAT, where every clause has exactly two literals, is solvable in linear time.',
        'Aspvall, Plass, and Tarjan proved this in 1979 by reducing 2-SAT to strongly connected components on a directed implication graph. The reduction is clean: build a graph from the clauses, run one SCC pass, and read off the answer. The result is one of the sharpest complexity boundaries in computer science: 2-SAT is in P, but 3-SAT (three literals per clause) is NP-complete.',
        'The practical payoff is large. Many real constraint systems naturally produce 2-literal clauses: scheduling with pairwise conflicts, circuit design rules, configuration compatibility checks, and type inference constraints. Recognizing that a problem is 2-SAT means it can be solved exactly and fast, instead of resorting to heuristic SAT solvers or exponential backtracking.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Try all possible truth assignments. With n boolean variables, there are 2^n assignments. For each one, check every clause. If all clauses are satisfied, return the assignment. If no assignment works, the formula is unsatisfiable.',
        'This works for small n. Four variables means 16 assignments, each checking 5 clauses: 80 operations. Ten variables means 1,024 assignments. Twenty variables means about a million. The approach is correct and easy to implement.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Exponential growth kills brute force. Thirty variables produce a billion assignments. Fifty variables produce over 10^15. Real configuration problems and scheduling systems can have thousands of variables.',
        'The waste is structural. Brute force treats every variable as independent, but 2-literal clauses create chains of forced consequences. If (x1 OR x2) is a clause and x1 is false, then x2 must be true. That truth may force x3 via another clause, which forces x4 via a third. These implication chains mean one choice can cascade through the entire formula. The question is whether the cascades are consistent or contradictory, and answering that does not require trying every starting point.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Every 2-literal clause (a OR b) is logically equivalent to two implications: NOT a implies b, and NOT b implies a. If a is false, b must be true. If b is false, a must be true. These implications form a directed graph where each literal is a node and each implication is an edge.',
        'In this implication graph, a directed path from p to q means "if p is true, then q is forced true." A cycle means all literals in the cycle are mutually forced. If a variable x and its negation ~x are in the same cycle (same strongly connected component), then x being true forces ~x true, and ~x being true forces x true. That is a contradiction: the formula is unsatisfiable. If no such contradiction exists, the formula is satisfiable, and the SCC structure directly produces a valid assignment.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Step 1: Build the implication graph. For each clause (a OR b), add directed edge NOT a -> b and directed edge NOT b -> a. The graph has 2n nodes (one per literal) and 2m edges (two per clause).',
        'Step 2: Run Tarjan\'s SCC algorithm on the implication graph. This finds every maximal group of mutually reachable literals in one DFS pass, using disc/low-link values.',
        'Step 3: Check for contradictions. For each variable x, check whether x and ~x are in the same SCC. If any variable fails this check, the formula is unsatisfiable.',
        'Step 4: Assign truth values. Tarjan\'s algorithm outputs SCCs in reverse topological order. For each variable x, compare the SCC index of x with the SCC index of ~x. Whichever literal appears in the later SCC (topologically) gets assigned TRUE. This ensures consistency: if p implies q, then whenever p is true, q is also true.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The contradiction check is correct because of a symmetry property of the implication graph. For every edge NOT a -> b, there is also an edge NOT b -> a (the contrapositive). This means if there is a path from x to ~x, there is also a path from x to ~x through the same chain of contrapositives, creating a path from ~x to x. So x and ~x are in the same SCC: they mutually force each other, and no truth value can satisfy both.',
        'The assignment rule is correct because of the topological ordering. If literal p implies literal q (there is a path from p to q), then the SCC of p appears no later than the SCC of q in topological order. The rule assigns TRUE to the literal whose SCC comes later. So if p is assigned TRUE and p implies q, then q\'s SCC is at least as late as p\'s, and q is also assigned TRUE. Implications are preserved.',
        'The contrapositive symmetry also guarantees consistency of negations. If x is assigned TRUE, then ~x\'s SCC comes earlier in topological order. If ~x implied some literal r, then r\'s SCC is at least as late as ~x\'s, but the assignment of r depends on its own variable\'s SCC comparison, not on ~x. The structure prevents any chain of implications from forcing both a literal and its negation to be TRUE simultaneously.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Building the implication graph: O(m) time and O(n + m) space, where n is the number of variables and m is the number of clauses. Each clause produces two edges.',
        'Tarjan\'s SCC: O(V + E) = O(2n + 2m) = O(n + m). Every node is visited once, every edge examined once.',
        'Contradiction check: O(n). One comparison per variable.',
        'Assignment: O(n). One SCC-index comparison per variable.',
        'Total: O(n + m). Linear in the size of the formula. Doubling the variables and clauses doubles the work. A formula with 10,000 variables and 50,000 clauses takes about 120,000 operations. Brute force on the same problem would need 2^10,000 assignments, a number with over 3,000 digits.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Scheduling with pairwise conflicts: "event A and event B cannot both happen at time slot 1" becomes a 2-SAT clause. The solver finds a conflict-free schedule or proves none exists in linear time.',
        'Circuit design: design-rule checks often reduce to 2-SAT. Two signal wires cannot be routed through the same channel, two components cannot share the same power rail under certain conditions. Each constraint is a 2-literal clause.',
        'Type inference: some type systems express compatibility constraints as implications between type variables. When each constraint involves at most two type variables, the inference problem reduces to 2-SAT.',
        'Configuration management: software feature flags with pairwise compatibility rules. "If feature A is enabled, feature B must also be enabled" is a direct implication. "Features C and D cannot both be disabled" is a 2-SAT clause. The solver determines whether a valid configuration exists.',
        'Network reliability: routing constraints where each path choice excludes at most one other path choice yield a 2-SAT instance.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        '3-SAT is NP-complete. Adding even one clause with three literals to a 2-SAT formula moves the problem to a fundamentally harder class. No polynomial-time algorithm is known for 3-SAT, and the Cook-Levin theorem shows that any NP problem can be reduced to it. The boundary between 2-SAT (polynomial) and 3-SAT (NP-complete) is one of the sharpest in complexity theory.',
        'Weighted and optimization variants are harder. MAX-2-SAT (maximize the number of satisfied clauses) is NP-hard. Weighted 2-SAT (each clause has a weight, maximize total weight of satisfied clauses) is also NP-hard. The tractability of 2-SAT depends on requiring all clauses to be satisfied simultaneously.',
        'The implication graph offers no useful information about how close an unsatisfiable formula is to being satisfiable. It gives a binary yes/no answer. If the formula is unsatisfiable, 2-SAT does not suggest which clauses to relax or which variables to flip.',
        'Dynamic updates are expensive. Adding or removing a clause changes the implication graph and can change the SCC structure. There is no efficient incremental 2-SAT algorithm; the standard approach rebuilds the graph and reruns SCC detection from scratch.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Formula: (x1 OR x2) AND (NOT x1 OR x3) AND (NOT x2 OR NOT x3) AND (x3 OR x4) AND (NOT x4 OR x1). Four variables, five clauses.',
        'Build implication graph. Clause 1: (x1 OR x2) adds ~x1 -> x2 and ~x2 -> x1. Clause 2: (NOT x1 OR x3) adds x1 -> x3 and ~x3 -> ~x1. Clause 3: (NOT x2 OR NOT x3) adds x2 -> ~x3 and x3 -> ~x2. Clause 4: (x3 OR x4) adds ~x3 -> x4 and ~x4 -> x3. Clause 5: (NOT x4 OR x1) adds x4 -> x1 and ~x1 -> ~x4. Total: 8 nodes, 10 edges.',
        'Run Tarjan\'s SCC. The algorithm discovers components by tracking disc/low-link values through DFS. Key cycles emerge: following x1 -> x3 -> ~x2 and other paths, the algorithm identifies which literals mutually force each other.',
        'Check for contradictions. For each variable, verify that x_i and ~x_i are in different SCCs. Here, no variable shares an SCC with its negation. The formula is satisfiable.',
        'Assign truth values. Compare SCC indices: x1\'s SCC appears later topologically than ~x1\'s SCC, so x1 = TRUE. Similarly, x2 = FALSE (its negation\'s SCC is later), x3 = TRUE, x4 = TRUE. Verify: (TRUE OR FALSE) = TRUE, (FALSE OR TRUE) = TRUE, (TRUE OR FALSE) = TRUE, (TRUE OR TRUE) = TRUE, (FALSE OR TRUE) = TRUE. All five clauses satisfied.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Aspvall, B., Plass, M.F., and Tarjan, R.E. (1979), "A linear-time algorithm for testing the truth of certain quantified boolean formulas," Information Processing Letters. This paper established the SCC-based linear-time algorithm for 2-SAT. Tarjan, R.E. (1972), "Depth-First Search and Linear Graph Algorithms," SIAM Journal on Computing, for the SCC algorithm itself. Cook, S.A. (1971), "The complexity of theorem-proving procedures," for the NP-completeness of SAT and the significance of the 2-SAT boundary.',
        'Prerequisites: Strongly Connected Components (Tarjan\'s disc/low-link algorithm is the engine that powers the satisfiability check), topological sort (the assignment step uses SCC topological order to ensure consistency), graph DFS (the traversal primitive underlying SCC detection).',
        'Natural extensions: 3-SAT and general SAT solvers (DPLL, CDCL) for the NP-complete case where 2-SAT\'s polynomial trick no longer applies; MAX-SAT for optimization variants; constraint satisfaction problems (CSP) as the broader framework that generalizes SAT.',
        'Contrasting alternatives: backtracking SAT solvers handle arbitrary clause sizes but run in exponential worst case. Unit propagation in DPLL exploits forced assignments like 2-SAT does, but cannot guarantee polynomial time on 3-SAT instances.',
      ],
    },
  ],
};
