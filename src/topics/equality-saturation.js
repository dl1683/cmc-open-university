// Equality saturation and e-graphs: keep all equivalent rewrites at once,
// saturate the space with algebraic facts, then extract the cheapest program.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'equality-saturation',
  title: 'E-Graphs & Equality Saturation',
  category: 'Concepts',
  summary: 'Rewrite without committing too early: an e-graph stores many equivalent programs, then extracts the cheapest one.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['rewrite saturation', 'cost extraction'], defaultValue: 'rewrite saturation' },
  ],
  run,
};

const NODES = [
  { id: 'start', label: '(x * 2) + 0', x: 1.1, y: 4.8, note: 'input program' },
  { id: 'drop0', label: 'x * 2', x: 3.2, y: 3.2, note: 'add-zero' },
  { id: 'add', label: 'x + x', x: 5.3, y: 4.6, note: 'strength reduce' },
  { id: 'shift', label: 'x << 1', x: 7.4, y: 3.0, note: 'machine rule' },
  { id: 'mulback', label: '2 * x', x: 5.2, y: 1.4, note: 'commute' },
  { id: 'dead', label: '((x * 2) + 0) + 0', x: 2.4, y: 7.0, note: 'also equal' },
];

const EDGES = [
  { id: 'e-start-drop0', from: 'start', to: 'drop0', weight: '+0 -> nothing' },
  { id: 'e-drop0-add', from: 'drop0', to: 'add', weight: 'x*2 -> x+x' },
  { id: 'e-add-shift', from: 'add', to: 'shift', weight: 'x+x -> x<<1' },
  { id: 'e-drop0-mulback', from: 'drop0', to: 'mulback', weight: 'commute *' },
  { id: 'e-start-dead', from: 'start', to: 'dead', weight: 'add +0' },
  { id: 'e-dead-drop0', from: 'dead', to: 'drop0', weight: 'drop both +0' },
];

function graph(upTo, title) {
  const nodeIds = new Set(upTo.nodes);
  return graphState({
    nodes: NODES.filter((n) => nodeIds.has(n.id)),
    edges: EDGES.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to) && upTo.edges.includes(e.id)),
  }, { title });
}

function* rewriteSaturation() {
  yield {
    state: graph({ nodes: ['start'], edges: [] }, 'one expression, one class'),
    highlight: { active: ['start'] },
    explanation: 'Classic rewrite optimizers choose one path: apply a rule, replace the expression, hope you did not make tomorrow worse. Equality saturation refuses to choose early. It stores the input program in an e-graph, applies every sound rewrite it can find, and keeps all equivalent forms alive together.',
  };

  yield {
    state: graph({ nodes: ['start', 'drop0', 'dead'], edges: ['e-start-drop0', 'e-start-dead', 'e-dead-drop0'] }, 'algebraic identities add alternatives'),
    highlight: { active: ['drop0'], compare: ['dead'], found: ['e-start-drop0'] },
    explanation: 'The first rewrite drops "+ 0", producing x * 2. Another legal rewrite can even add a useless +0. That looks silly, but the e-graph is not a greedy optimizer; it is a database of equalities. Some rewrites look locally worse and later unlock a globally better form.',
    invariant: 'A rewrite adds an equality. It does not delete the old expression.',
  };

  yield {
    state: graph({ nodes: ['start', 'drop0', 'dead', 'add', 'mulback'], edges: ['e-start-drop0', 'e-start-dead', 'e-dead-drop0', 'e-drop0-add', 'e-drop0-mulback'] }, 'multiply, add, and commute live together'),
    highlight: { active: ['add'], compare: ['mulback'], visited: ['start'] },
    explanation: 'Now x * 2 becomes x + x, and commutativity also records 2 * x. In a real e-graph these nodes are grouped into e-classes: sets of equivalent expressions. Congruence closure then propagates equality upward, so if a subexpression becomes equal, larger expressions that contain it can merge too. That propagation is the hard data-structure win.',
  };

  yield {
    state: graph({ nodes: ['start', 'drop0', 'dead', 'add', 'mulback', 'shift'], edges: EDGES.map((e) => e.id) }, 'saturated enough to choose'),
    highlight: { found: ['shift', 'e-add-shift'], visited: ['start', 'drop0', 'add', 'mulback', 'dead'] },
    explanation: 'A machine-specific rule now turns x + x into x << 1. Equality saturation stops when no more useful rewrites fire or when a time/node budget is hit. Only then does extraction choose an answer. This separation matters: exploration collects equivalent possibilities; extraction decides what "best" means for the target machine.',
    invariant: 'Saturate first, extract later: do not let local rewrite order decide the final program.',
  };
}

function* costExtraction() {
  yield {
    state: matrixState({
      title: 'All equivalent, different costs',
      rows: [
        { id: 'start', label: '(x*2)+0' },
        { id: 'drop0', label: 'x*2' },
        { id: 'add', label: 'x+x' },
        { id: 'shift', label: 'x<<1' },
      ],
      columns: [
        { id: 'latency', label: 'latency' },
        { id: 'code', label: 'code size' },
        { id: 'portable', label: 'portable?' },
      ],
      values: [
        [4, 4, 11],
        [3, 2, 11],
        [2, 2, 11],
        [1, 1, 10],
      ],
      format: (v) => {
        if (v === 10) return 'target-specific';
        if (v === 11) return 'yes';
        return String(v);
      },
    }),
    highlight: { compare: ['shift:portable'], found: ['shift:latency', 'shift:code'] },
    explanation: 'Extraction turns the saturated e-graph into an optimization problem. If the target CPU has a cheap shift instruction, x << 1 wins on latency and code size. If portability or overflow semantics forbid that rule, the extractor can choose x + x or x * 2 instead. The e-graph kept the choices alive long enough for a real cost model to decide.',
  };

  yield {
    state: matrixState({
      title: 'Why greedy rewriting fails',
      rows: [
        { id: 'greedy', label: 'greedy pass' },
        { id: 'egraph', label: 'e-graph pass' },
        { id: 'learned', label: 'learned rules' },
      ],
      columns: [
        { id: 'keeps', label: 'keeps alternatives' },
        { id: 'risk', label: 'main risk' },
        { id: 'best', label: 'best for' },
      ],
      values: [
        [1, 4, 7],
        [2, 5, 8],
        [2, 6, 9],
      ],
      format: (v) => ['', 'no', 'yes', '', 'phase ordering', 'graph blowup', 'unsound rule', 'fast compiler passes', 'deep algebraic optimization', 'ML-guided program search'][v],
    }),
    highlight: { compare: ['greedy:risk'], active: ['egraph:keeps'], found: ['egraph:best'] },
    explanation: 'Compiler engineers call the greedy problem phase ordering: run simplification before vectorization and you miss one optimization; run vectorization before simplification and you miss another. Equality saturation replaces phase order with a shared space of equal programs. The price is graph growth, so practical engines need budgets, rule scheduling, and extraction costs.',
  };

  yield {
    state: graph({ nodes: ['start', 'drop0', 'add', 'shift'], edges: ['e-start-drop0', 'e-drop0-add', 'e-add-shift'] }, 'the selected proof path'),
    highlight: { found: ['start', 'drop0', 'add', 'shift'], active: ['e-start-drop0', 'e-drop0-add', 'e-add-shift'] },
    explanation: 'The chosen program is not just a string. It comes with a proof path through equalities: (x * 2) + 0 equals x * 2, equals x + x, equals x << 1 under the target rule set. That proof-object flavor is why e-graphs connect cleanly to theorem proving, program synthesis, tensor-graph optimization, and the verifier loops in Code World Models Case Study and AlphaEvolve Case Study.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'rewrite saturation') yield* rewriteSaturation();
  else if (view === 'cost extraction') yield* costExtraction();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `An e-graph is a data structure for representing many equivalent expressions at once. Equality saturation is the optimization strategy built on top: repeatedly apply rewrite rules, merge equivalent expressions, and delay the final choice until extraction. The core move is anti-greedy. Instead of rewriting A into B and forgetting A, the e-graph records that A and B are equal.`,
        `This matters whenever local rewrites fight each other. Compilers, SQL optimizers, tensor-graph optimizers, and symbolic algebra systems all suffer phase-ordering problems: a rule that looks good now can block a better rule later. Equality saturation keeps alternatives alive until a cost model can choose for the actual target.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `An e-graph contains e-nodes and e-classes. An e-node is an operator applied to child e-classes, such as add(a, b). An e-class is a set of e-nodes known to be equivalent. Rewrite rules search for matching patterns and add new e-nodes into existing or new e-classes. When two classes are proven equal, they merge, and congruence closure propagates that equality to parents.`,
        `Saturation means repeatedly running those rewrites until no more useful changes appear or a resource budget is reached. Extraction then solves a dynamic-programming-style cost problem over the e-graph: choose the cheapest expression in each class according to latency, code size, numerical stability, energy, or any target-specific cost model.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The danger is explosion. Rewrites can add an enormous number of equivalent forms, many of which are useless. Practical equality saturation uses rule schedules, node limits, timeouts, analysis data, and extraction costs to keep the search finite. Union-Find (Disjoint Sets) intuition helps: merging equivalence classes is central, but e-graphs also maintain operator structure and parent links, so they are richer than plain disjoint sets.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `The egg project made equality saturation practical for research and production-style optimizers. E-graphs have been used for floating-point rewrites, DSP and hardware optimization, SQL and tensor algebra rewrites, theorem-proving workflows, and program-synthesis loops. The pattern also explains a lot of modern AI-for-code systems: generate many candidate programs, prove or test equivalence where possible, and extract the cheapest verified result.`,
        `This is close in spirit to Evolutionary Search, but the meaning of "mutation" is different. Evolutionary search can try arbitrary candidates and rely on a fitness function. Equality saturation applies sound rewrites, so every retained expression stays inside the equivalence class. That soundness is why it pairs naturally with verifiers.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The most important pitfall is unsound rewriting. Algebraic identities depend on semantics: x + 0 = x is safe for integers, but floating-point rules involving reassociation, NaNs, infinities, and overflow can be false under strict semantics. Another trap is assuming saturation always finishes. It often does not; production systems use budgets and accept "saturated enough." Finally, the best extracted expression depends on the cost model. A rule that wins on one CPU, compiler flag, or numerical contract may lose on another.`,
      ],
    },
    {
      heading: `Sources and study next`,
      paragraphs: [
        `Primary source: "egg: Fast and Extensible Equality Saturation" at https://arxiv.org/abs/2004.03082. Study Union-Find (Disjoint Sets) for equivalence-class intuition, Graph BFS for graph search instincts, Finite State Machines and Pratt Parser Expression AST for rewrite-rule matching over syntax, Control Flow Graph & Dominator Tree and Static Single Assignment & Phi Nodes for compiler IR context, Linear Scan Register Allocation for the machine-code payoff, Evolutionary Search for black-box optimization contrast, and Code World Models Case Study for the verifier-centered AI-code direction this points toward.`,
      ],
    },
  ],
};
