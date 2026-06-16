// Symbolic execution: fork program paths, collect path constraints, and ask a
// solver for concrete inputs that exercise each feasible path.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'symbolic-execution-path-constraints',
  title: 'Symbolic Execution Path Constraints',
  category: 'Concepts',
  summary: 'Explore code paths with symbolic inputs: fork branches, accumulate constraints, solve feasible paths, and generate concrete tests or bug witnesses.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['path forking', 'test generation'], defaultValue: 'path forking' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function symbolicGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'x', x: 0.9, y: 3.8, note: 'symbolic' },
      { id: 'branch', label: 'if', x: 2.5, y: 3.8, note: 'x > 0' },
      { id: 'true', label: 'T', x: 4.2, y: 2.3, note: 'x>0' },
      { id: 'false', label: 'F', x: 4.2, y: 5.4, note: 'x<=0' },
      { id: 'pc', label: 'PC', x: 5.9, y: 3.8, note: 'constraints' },
      { id: 'solver', label: 'SMT', x: 7.4, y: 3.8, note: 'solver' },
      { id: 'test', label: 'test', x: 9.0, y: 2.3, note: 'x=7' },
      { id: 'bug', label: 'bug', x: 9.0, y: 5.4, note: 'witness' },
    ],
    edges: [
      { id: 'e-input-branch', from: 'input', to: 'branch' },
      { id: 'e-branch-true', from: 'branch', to: 'true' },
      { id: 'e-branch-false', from: 'branch', to: 'false' },
      { id: 'e-true-pc', from: 'true', to: 'pc' },
      { id: 'e-false-pc', from: 'false', to: 'pc' },
      { id: 'e-pc-solver', from: 'pc', to: 'solver' },
      { id: 'e-solver-test', from: 'solver', to: 'test' },
      { id: 'e-solver-bug', from: 'solver', to: 'bug' },
    ],
  }, { title });
}

function* pathForking() {
  yield {
    state: symbolicGraph('Symbolic input turns one run into a tree of paths'),
    highlight: { active: ['input', 'branch', 'true', 'false', 'e-input-branch', 'e-branch-true', 'e-branch-false'], compare: ['solver'] },
    explanation: 'Symbolic execution treats an input as a symbol instead of one concrete value. At a branch, it forks execution states and records the condition needed for each path.',
  };
  yield {
    state: labelMatrix(
      'Path constraints',
      [
        { id: 'p1', label: 'path A' },
        { id: 'p2', label: 'path B' },
        { id: 'p3', label: 'path C' },
        { id: 'p4', label: 'path D' },
      ],
      [
        { id: 'constraint', label: 'constraint' },
        { id: 'solver', label: 'solver result' },
      ],
      [
        ['x > 0 && x < 10', 'SAT x=7'],
        ['x <= 0 && x == -1', 'SAT x=-1'],
        ['x > 0 && x < 0', 'UNSAT'],
        ['len(buf) > n', 'bug witness'],
      ],
    ),
    highlight: { active: ['p1:solver', 'p2:solver'], removed: ['p3:solver'], found: ['p4:solver'] },
    explanation: 'The path condition is a conjunction of branch constraints. A solver finds concrete inputs for satisfiable paths and prunes impossible paths.',
    invariant: 'Each generated test should satisfy the exact path condition it claims to cover.',
  };
  yield {
    state: symbolicGraph('The hard problem is path explosion'),
    highlight: { active: ['true', 'false', 'pc'], compare: ['solver'], found: ['test'] },
    explanation: 'Every symbolic branch can double the number of execution states. Real engines need search heuristics, state merging, timeouts, environment models, and summaries to stay useful.',
  };
}

function* testGeneration() {
  yield {
    state: symbolicGraph('KLEE-style engines solve paths into tests'),
    highlight: { active: ['pc', 'solver', 'test', 'e-pc-solver', 'e-solver-test'], compare: ['bug'] },
    explanation: 'When a path reaches normal exit, the engine can solve its path condition and emit a concrete test case. When a path reaches an error, the solution becomes a reproducing input.',
  };
  yield {
    state: labelMatrix(
      'Symbolic engine state',
      [
        { id: 'pc', label: 'program counter' },
        { id: 'stack', label: 'stack' },
        { id: 'memory', label: 'address space' },
        { id: 'constraints', label: 'path condition' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['next instruction', 'forks often'],
        ['call frames', 'recursion depth'],
        ['symbolic bytes', 'aliasing'],
        ['branch facts', 'solver cost'],
      ],
    ),
    highlight: { active: ['constraints:stores', 'memory:stores'], compare: ['constraints:risk'], found: ['pc:stores'] },
    explanation: 'A symbolic executor is an interpreter plus a constraint store. Memory models and solver queries usually dominate engineering complexity.',
  };
  yield {
    state: symbolicGraph('Static analysis and symbolic execution complement each other'),
    highlight: { active: ['input', 'pc', 'solver', 'bug'], visited: ['branch'], found: ['test'] },
    explanation: 'Abstract Interpretation & Interval Domain can cheaply find suspicious regions. Symbolic execution can then spend solver time on a narrower path and produce concrete evidence.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'path forking') yield* pathForking();
  else if (view === 'test generation') yield* testGeneration();
  else throw new InputError('Pick a symbolic-execution view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Symbolic execution runs a program with symbolic inputs instead of only concrete values. When execution reaches a branch, the engine forks states and records the constraint that makes each side feasible. A solver later turns a feasible path condition into concrete input.',
        'The output is unusually useful: a test case for an explored path, or a bug witness for an error path. That makes symbolic execution a bridge between static analysis and testing.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each execution state stores a program counter, stack, memory model, symbolic objects, and a path condition. For if (x > 0), the true state adds x > 0 and the false state adds x <= 0. If later constraints contradict earlier ones, the solver proves the path unsatisfiable and the engine prunes it.',
        'The engine asks solver questions at branches, assertions, memory accesses, and test generation points. The hard part is not the idea; it is the combinatorics. Branches multiply states, loops keep producing new conditions, and realistic libraries or operating-system calls need models.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose a parser has an input byte n and a buffer length len. One branch checks n < len, another checks n == 7, and a bug occurs when the second branch is true after the first. A symbolic engine can accumulate n < len and n == 7, ask the solver for a satisfying assignment, and emit n = 7 with a length greater than 7 as a concrete reproducer.',
        'If another path requires n < 0 and n > 5 for an unsigned byte, the solver marks it unsatisfiable. That path disappears without a human having to write a test for it.',
      ],
    },
    {
      heading: 'Engineering notes',
      paragraphs: [
        'Search strategy matters. Depth-first search finds deep bugs but can starve siblings. Breadth-first search improves coverage but stores more states. Coverage-guided search, random-path search, state merging, and function summaries are practical responses to path explosion.',
        'The best targets are narrow interfaces with meaningful branches: parsers, protocol handlers, codecs, arithmetic validators, and security-sensitive input checks. The worst targets are large apps with uncontrolled I/O, huge libraries, clocks, network calls, and opaque native dependencies unless those dependencies are modeled.',
        'Symbolic execution is strongest when paired with other modules. Data-Flow Worklist Analysis and Abstract Interpretation & Interval Domain can identify where precision is needed. Taint Analysis Source-to-Sink Case Study can identify which paths touch dangerous sinks. Symbolic execution can then generate concrete witnesses.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: KLEE intrinsics docs at https://klee-se.org/docs/intrinsics/, KLEE USENIX paper page at https://www.usenix.org/legacyurl/klee-unassisted-and-automatic-generation-high-coverage-tests-complex-systems-programs-0, KLEE 2019 overview at https://link.springer.com/article/10.1007/s10009-020-00570-3, and Imperial KLEE symbolic-execution slides at https://srg.doc.ic.ac.uk/files/slides/symex-tarot-18.pdf. Study Tree Traversals, Recursion, Control Flow Graph & Dominator Tree, Abstract Interpretation & Interval Domain, and Taint Analysis Source-to-Sink Case Study next.',
      ],
    },
  ],
};
