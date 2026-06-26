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
  const graphNodeCount = 9;
  const graphEdgeCount = 9;
  const specPieces = ['vars', 'Init', 'Next', 'Inv'];
  const checkerStructures = ['frontier', 'seen set', 'parents', 'fingerprint'];
  const maxProcesses = 6;
  const boundedPeak = 1900;
  const unboundedPeak = 5000;

  yield {
    state: modelGraph('TLC explores the reachable state graph'),
    highlight: { active: ['spec', 'init', 'next', 'frontier', 'seen', 'e-spec-init', 'e-spec-next', 'e-init-frontier', 'e-next-frontier', 'e-frontier-seen'], found: ['inv'] },
    explanation: `A TLA+ spec defines variables, initial states, and next-state actions. TLC explores the finite reachable state graph across ${graphNodeCount} nodes linked by ${graphEdgeCount} edges, remembering states it has seen and checking properties along the way.`,
    invariant: `Model checking exhaustively checks the ${graphNodeCount}-node model you bounded, not the implementation or every possible universe.`,
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
    explanation: `The useful mental model is small: ${specPieces.length} pieces (${specPieces.join(', ')}) are all you need. State variables describe a snapshot, Init creates starting snapshots, Next creates successor snapshots, and invariants must hold in every reachable snapshot.`,
  };

  yield {
    state: stateExplosionPlot(),
    highlight: { active: ['small', 'wide', 'cap'] },
    explanation: `State spaces grow quickly: at ${maxProcesses} processes the bounded model has ${boundedPeak} states while the unbounded model reaches ${unboundedPeak}. Good models bound data, abstract irrelevant values, split properties, and keep enough detail to preserve the design bug being investigated.`,
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
    explanation: `Model checking is a graph search with ${checkerStructures.length} engineering data structures (${checkerStructures.join(', ')}): frontier queues, visited-state sets, fingerprints, parent pointers, and sometimes disk-backed storage.`,
  };
}

function* counterexampleTrace() {
  const traceSteps = ['s0', 's1', 's2', 's3'];
  const traceLen = traceSteps.length;
  const fixCategories = ['spec bug', 'model gap', 'design bug', 'bad bound'];
  const disciplines = ['abstract', 'fairness', 'symmetry', 'trace'];

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
    explanation: `The payoff is a concrete trace: ${traceLen} states (${traceSteps.join(' → ')}) form a short sequence of model states and actions showing how the design violates an invariant or deadlocks.`,
  };

  yield {
    state: modelGraph('Invariant failure points back to the trace'),
    highlight: { active: ['inv', 'trace', 'fix', 'e-inv-trace', 'e-trace-fix'], compare: ['ok'] },
    explanation: `A counterexample is not only a red mark. It is a reproducible design execution across ${traceLen} states that tells the engineer which interleaving or missing state transition matters.`,
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
    explanation: `Do not blindly patch the invariant. The ${fixCategories.length} fix categories (${fixCategories.join(', ')}) help decide whether the trace exposes a spec typo, a missing environment behavior, a real design flaw, or an unrealistic bound.`,
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
    explanation: `A useful model is intentionally smaller than production but still faithful to the failure mode. The ${disciplines.length} disciplines (${disciplines.join(', ')}) guide the art of choosing abstractions that preserve the bug class.`,
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
    { heading: 'How to read the animation', paragraphs: ['Read the animation as graph search over a design. TLA+ describes states and actions; TLC explores the finite state graph. The frontier holds states to expand, and the seen set prevents repeated work.', {type: 'image', src: './assets/gifs/tla-plus-state-space-model-checking-primer.gif', alt: 'Animated walkthrough of the tla plus state space model checking primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: ['Some bugs exist in the design before code exists. Distributed locks, retry loops, and quorum workflows fail when legal steps interleave badly. Model checking exists to find reachable bad states before implementation commits the design.', {type: 'callout', text: 'Model checking changes design review from sampled stories to reachable-state evidence: if a bad state exists in the bound, TLC can hand back the path.'},], },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is a design document plus scenario tests. That catches likely paths but samples only a few interleavings. Human invariant arguments help, but people skip stale messages, retries, and rare timeout orders.'], },
    { heading: 'The wall', paragraphs: ['The wall is state explosion. Three clients with three states already create 27 client-state combinations before locks and messages. Once message delivery orders are included, the graph is too large to inspect by hand.'], },
    { heading: 'The core insight', paragraphs: ['Treat the design as a graph. Init defines starting states, Next defines legal transitions, and invariants define facts that must hold in every reachable state. TLC searches that graph and returns a concrete counterexample path when a property fails.'], },
    { heading: 'How it works', paragraphs: ['A useful model keeps only the details needed for the bug class. Actions describe guarded transitions such as acquire, release, timeout, or message delivery. TLC tries every enabled action within the finite bounds.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/TLC_one-bit_clock_states.png', alt: 'Finite state graph for a one-bit TLA plus clock model', caption: 'Even a tiny TLA+ model becomes a reachable-state graph that TLC can exhaustively check inside the chosen bounds. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:TLC_one-bit_clock_states.png.'},], },
    { heading: 'Why it works', paragraphs: ['For finite safety checking, correctness is induction over reachability. Initial states are checked, and every successor generated from a reachable state is checked before completion. If a bad state appears, parent links give a constructive proof path.'], },
    { heading: 'Cost and complexity', paragraphs: ['Cost is states times transitions. Doubling clients or messages can more than double the graph because combinations multiply. Abstraction controls cost, but deleting the detail that creates the bug makes the proof irrelevant.'], },
    { heading: 'Real-world uses', paragraphs: ['TLA+ fits protocols, lock managers, queue ownership, retries, storage metadata, cache coherence, and transaction workflows. It is also a communication tool because ambiguous prose must become variables, actions, and properties.'], },
    { heading: 'Where it fails', paragraphs: ['A model can be too detailed and explode, or too abstract and miss the bug. It also does not prove that code matches the model. Liveness checks can mislead if fairness assumptions hide or invent progress problems.'], },
    { heading: 'Worked example', paragraphs: ['Model one lock and two clients. Each client is idle, waiting, or holding, giving 3 * 3 = 9 client combinations. Add owner in none, A, or B, and the raw space is at most 27 snapshots before messages.', 'The invariant is that A and B cannot both hold the lock. If acquire forgets to check the current owner, TLC can produce A acquires, B requests, B acquires, and then both clients hold. The counterexample names the missing guard.'], },
    { heading: 'Sources and study next', paragraphs: ['Read Lamport TLA+ materials, the TLC documentation, and the model-checking paper by Yu, Manolios, and Lamport. Study finite state machines, BFS, DFS, invariants, temporal logic, Alloy, SMT solvers, Raft, leases, and snapshot isolation next.'], },
  ],
};
