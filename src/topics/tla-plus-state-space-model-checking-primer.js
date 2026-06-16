// TLA+ model checking: define variables, initial states, next actions, and
// invariants, then explore the reachable state graph for counterexamples.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'tla-plus-state-space-model-checking-primer',
  title: 'TLA+ State-Space Model Checking Primer',
  category: 'Concepts',
  summary: 'A model-checking primer: variables, Init, Next, actions, reachable-state frontier, invariants, liveness checks, state explosion, and minimal counterexample traces.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['state graph', 'counterexample trace'], defaultValue: 'state graph' },
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

function modelGraph(title) {
  return graphState({
    nodes: [
      { id: 'spec', label: 'spec', x: 0.8, y: 3.5, note: 'TLA+' },
      { id: 'init', label: 'Init', x: 2.1, y: 1.7, note: 'states' },
      { id: 'next', label: 'Next', x: 2.1, y: 5.2, note: 'actions' },
      { id: 'frontier', label: 'frontier', x: 3.9, y: 3.5, note: 'queue' },
      { id: 'seen', label: 'seen', x: 5.6, y: 2.0, note: 'hash' },
      { id: 'inv', label: 'inv', x: 5.6, y: 5.0, note: 'check' },
      { id: 'ok', label: 'ok', x: 7.5, y: 2.0, note: 'done' },
      { id: 'trace', label: 'trace', x: 7.5, y: 5.0, note: 'counter' },
      { id: 'fix', label: 'fix spec', x: 9.0, y: 3.5, note: 'iterate' },
    ],
    edges: [
      { id: 'e-spec-init', from: 'spec', to: 'init' },
      { id: 'e-spec-next', from: 'spec', to: 'next' },
      { id: 'e-init-frontier', from: 'init', to: 'frontier' },
      { id: 'e-next-frontier', from: 'next', to: 'frontier' },
      { id: 'e-frontier-seen', from: 'frontier', to: 'seen' },
      { id: 'e-frontier-inv', from: 'frontier', to: 'inv' },
      { id: 'e-seen-ok', from: 'seen', to: 'ok' },
      { id: 'e-inv-trace', from: 'inv', to: 'trace' },
      { id: 'e-trace-fix', from: 'trace', to: 'fix' },
    ],
  }, { title });
}

function stateExplosionPlot() {
  return plotState({
    axes: {
      x: { label: 'processes', min: 1, max: 8 },
      y: { label: 'states', min: 0, max: 5200 },
    },
    series: [
      { id: 'small', label: 'bounded', points: [{ x: 1, y: 12 }, { x: 2, y: 54 }, { x: 3, y: 180 }, { x: 4, y: 520 }, { x: 5, y: 1100 }, { x: 6, y: 1900 }] },
      { id: 'wide', label: 'unbounded', points: [{ x: 1, y: 20 }, { x: 2, y: 120 }, { x: 3, y: 700 }, { x: 4, y: 1800 }, { x: 5, y: 3500 }, { x: 6, y: 5000 }] },
    ],
    markers: [
      { id: 'cap', x: 5, y: 3500, label: 'cap' },
    ],
  });
}

function* stateGraph() {
  yield {
    state: modelGraph('TLC explores the reachable state graph'),
    highlight: { active: ['spec', 'init', 'next', 'frontier', 'seen', 'e-spec-init', 'e-spec-next', 'e-init-frontier', 'e-next-frontier', 'e-frontier-seen'], found: ['inv'] },
    explanation: 'A TLA+ spec defines variables, initial states, and next-state actions. TLC explores the finite reachable state graph, remembering states it has seen and checking properties along the way.',
    invariant: 'Model checking checks the model you bounded, not the implementation or every possible universe.',
  };

  yield {
    state: labelMatrix(
      'Spec pieces',
      [
        { id: 'vars', label: 'vars' },
        { id: 'init', label: 'Init' },
        { id: 'next', label: 'Next' },
        { id: 'inv', label: 'Inv' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'bug', label: 'bug caught' },
      ],
      [
        ['state fields', 'missing state'],
        ['start set', 'bad start'],
        ['actions', 'bad interleave'],
        ['always true', 'safety fail'],
      ],
    ),
    highlight: { active: ['vars:means', 'next:bug', 'inv:bug'], found: ['init:means'] },
    explanation: 'The useful mental model is small: state variables describe a snapshot, Init creates starting snapshots, Next creates successor snapshots, and invariants must hold in every reachable snapshot.',
  };

  yield {
    state: stateExplosionPlot(),
    highlight: { active: ['small', 'wide', 'cap'] },
    explanation: 'State spaces grow quickly. Good models bound data, abstract irrelevant values, split properties, and keep enough detail to preserve the design bug being investigated.',
  };

  yield {
    state: labelMatrix(
      'Checker data structures',
      [
        { id: 'frontier', label: 'frontier' },
        { id: 'seen', label: 'seen set' },
        { id: 'parent', label: 'parents' },
        { id: 'finger', label: 'fingerprint' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['states', 'BFS/DFS'],
        ['visited', 'dedup'],
        ['predecessor', 'trace'],
        ['hash', 'memory'],
      ],
    ),
    highlight: { active: ['frontier:stores', 'seen:stores', 'parent:why'], found: ['finger:why'] },
    explanation: 'Model checking is a graph search with engineering constraints: frontier queues, visited-state sets, fingerprints, parent pointers, and sometimes disk-backed storage.',
  };
}

function* counterexampleTrace() {
  yield {
    state: labelMatrix(
      'Counterexample trace',
      [
        { id: 's0', label: 's0' },
        { id: 's1', label: 's1' },
        { id: 's2', label: 's2' },
        { id: 's3', label: 's3' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'action', label: 'action' },
        { id: 'check', label: 'check' },
      ],
      [
        ['empty q', 'Init', 'ok'],
        ['A holds', 'AcquireA', 'ok'],
        ['B holds', 'AcquireB', 'ok'],
        ['cycle wait', 'WaitBoth', 'deadlock'],
      ],
    ),
    highlight: { active: ['s3:check'], found: ['s1:action', 's2:action'] },
    explanation: 'The payoff is a concrete trace: a short sequence of model states and actions showing how the design violates an invariant or deadlocks.',
  };

  yield {
    state: modelGraph('Invariant failure points back to the trace'),
    highlight: { active: ['inv', 'trace', 'fix', 'e-inv-trace', 'e-trace-fix'], compare: ['ok'] },
    explanation: 'A counterexample is not only a red mark. It is a reproducible design execution that tells the engineer which interleaving or missing state transition matters.',
  };

  yield {
    state: labelMatrix(
      'What to fix',
      [
        { id: 'spec', label: 'spec bug' },
        { id: 'model', label: 'model gap' },
        { id: 'design', label: 'design bug' },
        { id: 'bound', label: 'bad bound' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'response', label: 'response' },
      ],
      [
        ['wrong formula', 'repair spec'],
        ['missing action', 'add action'],
        ['real flaw', 'change design'],
        ['too small', 'raise scope'],
      ],
    ),
    highlight: { active: ['design:response', 'model:response'], compare: ['spec:response'] },
    explanation: 'Do not blindly patch the invariant. Decide whether the trace exposes a spec typo, a missing environment behavior, a real design flaw, or an unrealistic bound.',
  };

  yield {
    state: labelMatrix(
      'Modeling discipline',
      [
        { id: 'abstract', label: 'abstract' },
        { id: 'fair', label: 'fairness' },
        { id: 'sym', label: 'symmetry' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'good', label: 'good' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['small values', 'hide bug'],
        ['progress', 'wrong liveness'],
        ['merge states', 'false merge'],
        ['minimal', 'ignored'],
      ],
    ),
    highlight: { found: ['abstract:good', 'trace:good'], compare: ['fair:risk'] },
    explanation: 'A useful model is intentionally smaller than production but still faithful to the failure mode. The art is choosing abstractions that preserve the bug class.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'state graph') yield* stateGraph();
  else if (view === 'counterexample trace') yield* counterexampleTrace();
  else throw new InputError('Pick a TLA+ model-checking view.');
}

export const article = {
  references: [
    { title: 'TLA+ and TLC Wiki', url: 'https://docs.tlapl.us/' },
    { title: 'Model Checking TLA+ Specifications', url: 'https://lamport.azurewebsites.net/pubs/yuanyu-model-checking.pdf' },
    { title: 'Current TLA+ Tools', url: 'https://github.com/tlaplus/tlaplus/blob/master/general/docs/current-tools.md' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['TLA+ is a language for modeling systems as state machines. TLC is a model checker for TLA+ specifications. It explores reachable states and checks whether invariants and other properties hold.', 'The official TLA+ wiki frames the tools as a way to eliminate fundamental design errors, especially in concurrent and distributed systems: https://docs.tlapl.us/.'] },
    { heading: 'How it works', paragraphs: ['A spec names variables, defines Init, defines Next, and states properties. TLC instantiates a finite model, explores successors, deduplicates visited states, checks invariants, and reports a trace when a property fails.', 'Lamport and Yu describe TLC as a model checker for debugging a TLA+ specification by checking invariance properties of a finite-state model: https://lamport.azurewebsites.net/pubs/yuanyu-model-checking.pdf.'] },
    { heading: 'Complete case study', paragraphs: ['A lock service allows clients to acquire A, acquire B, and wait for both. The model finds an interleaving where one client holds A, another holds B, and both wait forever. The counterexample trace is a design artifact: it shows exactly which action sequence creates deadlock.', 'The fix might be lock ordering, timeout, preemption, or a different protocol. The trace tells the team which fix needs to be represented in the model.'] },
    { heading: 'Data structures', paragraphs: ['A model checker is graph search: frontier, visited set, state fingerprint, parent pointer, property evaluator, and trace reconstruction. These ordinary structures are what make a formal method feel concrete.', 'State explosion is the main cost. Bound the model, abstract irrelevant data, use symmetry when valid, and check one property at a time when necessary.'] },
    { heading: 'Pitfalls', paragraphs: ['A model can be wrong in both directions. Too much detail explodes the state space. Too little detail proves a toy that hides the real race. A passing model is evidence about the bounded abstraction, not a production proof.', 'Counterexamples also need judgment. Some are real design bugs; some are missing environment assumptions; some are spec typos. Treat the trace as an investigation object.'] },
    { heading: 'Study next', paragraphs: ['Study Finite State Machine, Graph BFS, Symbolic Execution Path Constraints, Alloy Relational Model Finder, SMT Solver Theory Combination, and Property-Based Testing Shrinking next.'] },
  ],
};
