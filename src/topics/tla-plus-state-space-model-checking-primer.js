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
    {
      heading: 'Why this exists',
      paragraphs: [
        `TLA+ exists because some bugs live in the design before any implementation exists. Distributed systems, lock managers, retry loops, quorum protocols, and concurrent workflows can fail even when each individual step looks reasonable. The failure is a reachable sequence of legal actions: client A waits, client B retries, a message is delayed, a timeout fires, and a state that was supposed to be impossible appears.`,
        `Code review and tests are weak at this kind of bug because they sample executions. A reviewer follows the path that seems likely. A test runner schedules a few interleavings. The system may still contain a deadlock, split brain, stale read, lost update, or broken ownership invariant in a path nobody happened to exercise.`,
        `TLA+ moves the question earlier. Instead of asking whether one program run behaved, you write a model of the design as a state machine and ask which states are reachable. TLC, the model checker, explores a finite version of that state space and reports a concrete counterexample when a property fails. The official TLA+ materials frame this as a way to eliminate fundamental design errors in concurrent and distributed systems: https://docs.tlapl.us/.`,
        {type: `callout`, text: `Model checking changes design review from sampled stories to reachable-state evidence: if a bad state exists in the bound, TLC can hand back the path.`},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is to draw the protocol and write scenario tests. That is not foolish. A small sequence diagram catches many missing transitions, and executable tests are necessary later. The problem is coverage. A lock service with two clients and two locks already has enough interleavings to hide a circular wait.`,
        `Another reasonable approach is to reason informally from invariants. You might say each lock has at most one owner, every committed entry has a quorum, or every message is eventually handled. Those statements are useful, but the human proof often skips the uncomfortable cases: retry after partial failure, two timeouts in a row, a node that receives an old message, or a client that observes the system during reconfiguration.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is state explosion plus human selectivity. If a system has several variables, each with several possible values, the total number of snapshots grows as their combinations multiply. Add process interleavings and message queues, and the graph becomes too large to inspect by hand.`,
        `The second wall is that implementation tests arrive late. By the time a bug is found in code, the team may have already built APIs, storage formats, and operational assumptions around the flawed design. A model is cheaper because it can be wrong on purpose. It can use tiny bounded sets, abstract messages, and simplified time while preserving the bug class that matters.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that a design can be treated as a graph of states. A state is one valuation of the model variables. Init defines the possible starting states. Next defines which actions can produce successor states. Invariants state facts that must hold in every reachable state. Liveness properties state progress obligations, usually with fairness assumptions.`,
        `TLC turns that specification into graph search. It starts from Init, applies Next to generate successors, stores a visited set so it does not revisit the same state forever, checks properties on each state, and keeps enough parent information to reconstruct a failing path. Lamport and Yu describe TLC as a model checker for debugging TLA+ specifications by checking invariance properties of a finite-state model: https://lamport.azurewebsites.net/pubs/yuanyu-model-checking.pdf.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A useful model begins with variables that are just detailed enough. For a lock protocol, variables might be lock ownership, waiting clients, outstanding messages, and a small set of client states. The model does not need real TCP packets or production timestamps if the property depends only on ownership and waiting.`,
        `Actions describe legal transitions. Acquire may move a client from idle to holding a lock. Release may free a lock. Timeout may move a waiting client back to retry. Message delivery may update a replica. The model checker does not guess which action is realistic next; it tries every enabled action inside the finite bounds.`,
        `Properties are the reason to model. A safety invariant says something bad never happens: two owners for one lock, a committed value without a quorum, a negative balance, or a queue item lost from all data structures. A liveness property says something good eventually happens: a request eventually completes, a leader is eventually elected, or a retry loop does not starve forever under the stated fairness assumptions.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The state-graph view should be read as the model checker, not as the production system. The spec creates the initial nodes and transition rules. The frontier stores states still waiting to expand. The seen set prevents duplicate work. The invariant checker is the gate every reachable state must pass.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/3/3d/TLC_one-bit_clock_states.png`, alt: `Finite state graph for a one-bit TLA plus clock model`, caption: `Even a tiny TLA+ model becomes a reachable-state graph that TLC can exhaustively check inside the chosen bounds. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:TLC_one-bit_clock_states.png.`},
        `The counterexample view shows the real payoff. A failure is not a vague warning. It is a replayable sequence of model states and actions: start here, take this legal action, then this one, and the property breaks. That trace is often more useful than a failing test because it names the design interleaving, not just the symptom observed in one implementation run.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Within its finite model, TLC is exhaustive. If every reachable state has been explored and the invariant held in each one, then the invariant holds for that bounded model. The argument is plain induction over graph reachability: Init states pass, and every successor generated from already reachable states is checked before the search finishes.`,
        `If an invariant fails, parent pointers give the proof of failure. The checker does not merely claim that a bad state exists. It returns the chain of actions from an initial state to that state. That makes the result falsifiable and actionable: the engineer can decide whether the trace is a real design bug, a missing environment assumption, a spec typo, or an unrealistic bound.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `The cost is dominated by states and transitions. If you double the number of processes, messages, or data values, the state space can grow far more than double because combinations multiply. TLC needs memory for the visited set, time to generate successors, property checks for each state, and sometimes disk-backed storage or fingerprints to keep large searches practical.`,
        `Abstraction is the main performance tool. Replace unimportant payloads with small symbols. Bound process counts. Collapse symmetric identities when the property does not care which client is named A or B. Split one huge property into focused models. Each abstraction is a risk: remove the detail that creates the bug, and the model can prove a toy while production remains unsafe.`,
        `Liveness adds another tax. Safety asks whether a bad state is reachable. Liveness asks about infinite behavior and fairness: whether the system can avoid progress forever. Those checks require more discipline because the wrong fairness assumption can either hide a starvation bug or invent an impossible one.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `TLA+ is strongest for protocols and coordination logic: leader election, distributed locks, transaction state machines, snapshot protocols, retries, deduplication, queue ownership, consensus-adjacent designs, cache coherence rules, and storage metadata updates. These systems have small logical states but many interleavings.`,
        `It is also useful as a design communication tool. A good spec forces the team to name variables, actions, and invariants. The model becomes a sharper artifact than a prose design document because every ambiguity eventually has to become a transition or a property.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `TLA+ fails when the model is either too faithful or not faithful enough. Too much implementation detail explodes the state space before it teaches anything. Too little detail removes the bug. The skill is not writing a large spec; it is preserving the failure mode while deleting everything irrelevant to that failure mode.`,
        `It also does not prove that the implementation matches the model. A checked design can still be implemented incorrectly, deployed with different timeouts, or connected to an environment the spec never modeled. Treat the model checker as a design verifier, not as a substitute for code review, property-based tests, fault injection, or production telemetry.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study finite state machines for the modeling base, graph BFS and DFS for the search mechanics, hash tables for visited-state storage, property-based testing for executable sampling, Alloy for bounded relational models, SMT solvers for formula-backed constraints, and distributed systems topics such as Raft, two-phase commit, leases, fencing tokens, and snapshot isolation. Then practice by modeling one small real workflow before trying to model a whole service.`,
      ],
    },
  ],
};
