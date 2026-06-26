// Linearizability: turn an overlapping concurrent history into a sequential
// history that preserves real-time order and the object's specification.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'linearizability-history-checker-case-study',
  title: 'Linearizability History Checker Case Study',
  category: 'Data Structures',
  summary: 'Check a concurrent object by placing each operation at one instant between call and return, then testing real-time order and object semantics.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['history intervals', 'checking proof'], defaultValue: 'history intervals' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function intervalPlot(points, markers = []) {
  return plotState({
    axes: { x: { label: 'time', min: 0, max: 10 }, y: { label: 'operation lane', min: 0, max: 5 } },
    series: points,
    markers,
  });
}

function checkerGraph(title) {
  return graphState({
    nodes: [
      { id: 'history', label: 'history', x: 0.8, y: 3.5, note: 'calls' },
      { id: 'rt', label: 'real-time', x: 2.6, y: 1.8, note: 'order' },
      { id: 'spec', label: 'spec', x: 2.6, y: 5.2, note: 'queue' },
      { id: 'search', label: 'search', x: 4.6, y: 3.5, note: 'orders' },
      { id: 'points', label: 'points', x: 6.5, y: 2.0, note: 'instant' },
      { id: 'witness', label: 'witness', x: 6.5, y: 5.2, note: 'proof' },
      { id: 'verdict', label: 'verdict', x: 8.6, y: 3.5, note: 'pass/fail' },
    ],
    edges: [
      { id: 'e-history-rt', from: 'history', to: 'rt' },
      { id: 'e-history-spec', from: 'history', to: 'spec' },
      { id: 'e-rt-search', from: 'rt', to: 'search' },
      { id: 'e-spec-search', from: 'spec', to: 'search' },
      { id: 'e-search-points', from: 'search', to: 'points' },
      { id: 'e-search-witness', from: 'search', to: 'witness' },
      { id: 'e-points-verdict', from: 'points', to: 'verdict' },
      { id: 'e-witness-verdict', from: 'witness', to: 'verdict' },
    ],
  }, { title });
}

function* historyIntervals() {
  yield {
    state: intervalPlot([
      { id: 'enqA', label: 'enq A', points: [{ x: 1, y: 4 }, { x: 5, y: 4 }] },
      { id: 'enqB', label: 'enq B', points: [{ x: 2, y: 3 }, { x: 6, y: 3 }] },
      { id: 'deq', label: 'deq -> A', points: [{ x: 4, y: 2 }, { x: 8, y: 2 }] },
    ]),
    highlight: { active: ['enqA', 'enqB', 'deq'] },
    explanation: 'A concurrent history records invocation and response intervals. Linearizability asks whether each operation can be assigned one instant inside its interval so the object looks sequential.',
    invariant: 'The linearization point must lie between call and return.',
  };

  yield {
    state: intervalPlot(
      [
        { id: 'enqA', label: 'enq A', points: [{ x: 1, y: 4 }, { x: 5, y: 4 }] },
        { id: 'enqB', label: 'enq B', points: [{ x: 2, y: 3 }, { x: 6, y: 3 }] },
        { id: 'deq', label: 'deq -> A', points: [{ x: 4, y: 2 }, { x: 8, y: 2 }] },
      ],
      [
        { id: 'lpA', x: 3.2, y: 4, label: 'A' },
        { id: 'lpB', x: 5.4, y: 3, label: 'B' },
        { id: 'lpD', x: 6.6, y: 2, label: 'D' },
      ],
    ),
    highlight: { found: ['lpA', 'lpB', 'lpD'], active: ['enqA', 'deq'] },
    explanation: 'One witness order is enq(A), enq(B), deq() -> A. The operations overlap, so enq(A) and enq(B) can be placed in either order unless real-time order forces one before the other.',
  };

  yield {
    state: labelMatrix(
      'Real-time constraints',
      [
        { id: 'a_b', label: 'A vs B' },
        { id: 'a_d', label: 'A vs D' },
        { id: 'b_d', label: 'B vs D' },
      ],
      [
        { id: 'intervals', label: 'intervals' },
        { id: 'forced', label: 'forced?' },
      ],
      [
        ['overlap', 'no'],
        ['overlap', 'no'],
        ['overlap', 'no'],
      ],
    ),
    highlight: { active: ['a_b:forced', 'a_d:forced', 'b_d:forced'] },
    explanation: 'If operations overlap, linearizability can order them either way. If one response happens before another invocation, that order is forced. This locality is why linearizability is compositional.',
  };

  yield {
    state: labelMatrix(
      'Queue semantic check',
      [
        { id: 'order1', label: 'A,B,D' },
        { id: 'order2', label: 'B,A,D' },
        { id: 'order3', label: 'D,A,B' },
      ],
      [
        { id: 'queue', label: 'queue result' },
        { id: 'verdict', label: 'verdict' },
      ],
      [
        ['deq returns A', 'valid'],
        ['deq returns B', 'reject'],
        ['empty deq', 'reject'],
      ],
    ),
    highlight: { found: ['order1:verdict'], removed: ['order2:verdict', 'order3:verdict'] },
    explanation: 'The checker searches sequential orders that respect the intervals and then runs the object spec. A queue that enqueues B before A cannot explain deq returning A.',
  };

  yield {
    state: checkerGraph('A checker returns either a witness or a counterexample'),
    highlight: { active: ['history', 'rt', 'spec', 'search'], found: ['witness', 'verdict'] },
    explanation: 'A linearizability checker is a proof search. Passing histories need a witness order and points. Failing histories need the smallest contradictory core so the algorithm bug can be understood.',
  };
}

function* checkingProof() {
  yield {
    state: checkerGraph('Inputs: history plus sequential specification'),
    highlight: { active: ['history', 'rt', 'spec', 'e-history-rt', 'e-history-spec'], compare: ['verdict'] },
    explanation: 'The checker needs both timing and meaning. Timing gives real-time constraints. The sequential specification says what each operation may return after earlier operations.',
  };

  yield {
    state: labelMatrix(
      'Candidate order pruning',
      [
        { id: 'rt', label: 'real-time' },
        { id: 'pending', label: 'pending ops' },
        { id: 'spec', label: 'spec state' },
        { id: 'memo', label: 'memo key' },
      ],
      [
        { id: 'keeps', label: 'keeps' },
        { id: 'cuts', label: 'cuts' },
      ],
      [
        ['rt edges', 'late ops first'],
        ['open intervals', 'early close'],
        ['queue contents', 'bad returns'],
        ['seen states', 'repeat search'],
      ],
    ),
    highlight: { active: ['rt:cuts', 'spec:cuts', 'memo:cuts'], found: ['pending:keeps'] },
    explanation: 'Naive search can explode. Practical checkers prune with real-time edges, object state, pending-operation sets, and memoization of equivalent partial searches.',
  };

  yield {
    state: intervalPlot(
      [
        { id: 'enqA', label: 'enq A', points: [{ x: 1, y: 4 }, { x: 3, y: 4 }] },
        { id: 'enqB', label: 'enq B', points: [{ x: 4, y: 3 }, { x: 7, y: 3 }] },
        { id: 'deq', label: 'deq -> B', points: [{ x: 5, y: 2 }, { x: 8, y: 2 }] },
      ],
      [
        { id: 'force', x: 3.0, y: 4, label: 'A before' },
        { id: 'bad', x: 6.0, y: 2, label: 'B?' },
      ],
    ),
    highlight: { active: ['enqA', 'deq'], removed: ['bad'], found: ['force'] },
    explanation: 'Here enq(A) returns before deq starts, so A must be visible before the dequeue. If deq returns B while A is still queued ahead of B, the history is not linearizable.',
  };

  yield {
    state: labelMatrix(
      'Counterexample core',
      [
        { id: 'a', label: 'enq A' },
        { id: 'b', label: 'enq B' },
        { id: 'd', label: 'deq -> B' },
      ],
      [
        { id: 'fact', label: 'fact' },
        { id: 'why', label: 'why' },
      ],
      [
        ['A done first', 'must appear'],
        ['B overlaps D', 'may appear'],
        ['returns B', 'skips A'],
      ],
    ),
    highlight: { active: ['a:why', 'd:why'], compare: ['b:why'] },
    explanation: 'A useful failure is small. The counterexample says exactly which completed operation must be before the read and which return value violates the sequential queue spec.',
  };

  yield {
    state: labelMatrix(
      'Where linearization points live',
      [
        { id: 'queueEnq', label: 'MS enq' },
        { id: 'queueDeq', label: 'MS deq' },
        { id: 'stackPop', label: 'stack pop' },
        { id: 'seqlock', label: 'seqlock read' },
      ],
      [
        { id: 'point', label: 'point' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['link CAS', 'publish item'],
        ['head CAS', 'claim item'],
        ['top CAS', 'remove item'],
        ['even version', 'valid snapshot'],
      ],
    ),
    highlight: { found: ['queueEnq:point', 'queueDeq:point', 'stackPop:point'], compare: ['seqlock:point'] },
    explanation: 'For many concurrent structures, the proof centers on one atomic event. The hard part is proving that event matches the abstract operation even when helper threads and retries appear in the implementation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'history intervals') yield* historyIntervals();
  else if (view === 'checking proof') yield* checkingProof();
  else throw new InputError('Pick a linearizability view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as the state machine for linearizability history checking. Active items are the current decision point, found items are committed results, and removed items are paths ruled out by the invariant. The first safe inference is to name what state changed and why that move is legal.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Linearlizable_Process.svg',
          alt: 'Linearizability process diagram with a linearized subhistory and a non-linear branch',
          caption: 'Linearizability turns an overlapping history into a legal linear subhistory without moving completed-before-started operations across each other. Source: Wikimedia Commons, File: Linearlizable_Process.svg.',
        },
        {
          type: 'callout',
          text: "Key insight: linearizability is not the order events happened to be logged in. It is the existence of some legal sequential order that preserves real-time facts clients could observe.",
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Shared_memory.svg',
          alt: 'Three CPUs connected by a system bus to shared memory',
          caption: 'Shared memory makes one object reachable from many execution points. Correctness must be stated at the interface, not at any one CPU timeline. Source: Wikimedia Commons, File: Shared_memory.svg.',
        },
        {
          type: 'callout',
          text: "A checker does not prove the implementation correct for all executions. It proves or refutes one observed history. The power comes from generating many hostile histories and making each failure exact.",
        },
        {
          type: 'callout',
          text: "The formal definition has only two hard requirements: preserve what each process observed, and preserve non-overlap in real time. Everything else is search freedom.",
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Data_Queue.svg',
          alt: 'A FIFO queue diagram with input at one end and output at the other',
          caption: 'The sequential queue contract is simple: values leave in the same order they entered. Concurrent histories are hard because the entry order may be only partially known. Source: Wikimedia Commons, File: Data Queue.svg.',
        },
        {
          type: 'callout',
          text: "The checker must be permissive about overlap and strict about non-overlap. Most bad tests get one of those two rules wrong.",
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/UML_queue_class.svg',
          alt: 'UML class diagram for a generic queue with enqueue and dequeue operations',
          caption: 'The checker needs an abstract object contract, not implementation code. For a queue, that contract is just the legal behavior of create, enqueue, and dequeue. Source: Wikimedia Commons, File: UML queue class.svg.',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Detailed_petri_net.png',
          alt: 'A Petri net with places, transitions, arcs, and tokens',
          caption: 'A checker is also a state-transition search: tokens, transitions, and enabled moves are the same mental shape as candidate operations, spec states, and legal next steps. Source: Wikimedia Commons, File: Detailed petri net.png.',
        },
        {
          type: 'callout',
          text: "Linearizability is a safety property. It says bad returns never happen. It does not say operations eventually finish.",
        },
        {
          type: 'callout',
          text: "NP-completeness means the explosion is not just a naive implementation detail. Some histories really contain an exponential choice problem.",
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Reachability_graph_for_petri_net.png',
          alt: 'A reachability graph with multiple states and transitions',
          caption: 'Search cost comes from the reachable state graph. Linearizability checkers fight the same explosion with pruning, memoization, symmetry, and small counterexample extraction. Source: Wikimedia Commons, File: Reachability graph for petri net.png.',
        },
        {
          type: 'callout',
          text: "The return value alone is never enough. The same deq() -> B can be legal or illegal depending on whether A and B overlapped.",
        },
        {
          type: 'callout',
          text: "The most dangerous false pass is not caused by clever concurrency. It is caused by a spec that forgot to state the promise users rely on.",
        },
        'This topic is a case study, so the visual is not decoration. It shows which records, counters, queues, maps, or gates must agree before the system can return a trustworthy result.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'linearizability history checking exists because a simple implementation works on a small example but fails when scale, latency, privacy, or correctness constraints arrive. The system needs a data structure that keeps the useful fast path without hiding the boundary conditions.',
        'The practical problem is not only speed. Cost, auditability, rollback, freshness, and slice-level behavior all affect whether the design is usable in production.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep one global rule, one score, one cache, one dashboard, or one list. That is easy to build and easy to explain. It often works until traffic shape or correctness requirements become more specific.',
        'The next obvious approach is to add capacity or widen the search. That may improve the average case, but it usually fails to encode the rule that decides which work is allowed, fresh, fair, or safe.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the missing boundary. A system can look correct globally while a narrow slice is wrong, stale, unfair, or too expensive. Once the boundary is missing, more throughput can make the failure faster.',
        'The concrete failure is usually visible as mixed state: one version reads another version cache, one user receives another user answer, one queue loses priority, or one metric hides a failing slice. The design needs an invariant that prevents that mixture.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make the boundary a first-class data structure in linearizability history checking. Keys, clocks, queues, ledgers, folds, or gates are not metadata; they are the mechanism that preserves correctness.',
        'The invariant should be checkable from stored state. If an operator cannot reconstruct why a result was allowed, denied, filled, scored, or rolled back, the system is relying on memory instead of design.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The mechanism starts by normalizing the input into records with stable identities. It then routes those records through the smallest structure that can answer the current decision: a map lookup, ordered queue, version gate, slice table, or witness search.',
        'Each step writes enough state for the next step to be local. Local means a cancel finds one order id, a cache gate checks one record, a rollout query joins one packet id, or a checker advances one legal candidate. That locality is what turns a broad problem into an executable workflow.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is preservation. Before a step, the invariant names which records may interact. The step reads only allowed state, writes the result, and leaves the invariant true for the next step.',
        'This is stronger than a dashboard claim. A dashboard can show an average after the fact; the invariant prevents an illegal result from being served in the first place. When the invariant fails, the system should produce a denial, rollback, miss, or counterexample instead of a quiet answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is extra state. Maps, ledgers, clocks, slice tags, fold maps, queues, and audit rows consume memory and engineering time. The payoff is that expensive work becomes targeted instead of global.',
        'Cost behaves with the number of records, versions, slices, or live candidates. Doubling traffic does not only double compute; it can double cache pressure, queue length, audit rows, or search width. The dominant operation is the one on the hot path for the real workload.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'linearizability history checking fits systems where correctness is operational, not just mathematical. Fraud models, retrieval systems, matching engines, model-serving stacks, evaluation gates, and rollout systems all need stored evidence for why one result was chosen.',
        'The access pattern determines fit. Repeated decisions benefit from maps and caches, ordered fairness needs queues and sequence numbers, release safety needs ledgers, and concurrent correctness needs histories that can be searched.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the boundary is chosen for convenience instead of the product promise. Random folds fail for time-forward prediction, global canaries fail for slice-specific regressions, and similarity search fails when authorization is the real question.',
        'It also fails when evidence is not versioned. A stale record can be more dangerous than a miss because it looks supported. The design needs no-store, deny, rollback, or human-review paths for cases outside the invariant.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a FIFO queue with enq(A) running from t=1 to t=5, enq(B) from t=2 to t=6, and deq() from t=4 to t=8 returning A. All intervals overlap, so the real-time graph has zero edges. The checker may try 3! = 6 candidate orders.',
        'Orders enq(A), enq(B), deq() and enq(A), deq(), enq(B) are valid because deq returns A. Since at least one witness exists, the history is linearizable. The checker does not need every witness; one legal witness proves this run.',
        'Now change intervals so enq(A) runs t=1..3, enq(B) runs t=4..7, and deq() runs t=5..8 returning B. Real time forces A before the dequeue, and no earlier dequeue removed A. Every legal FIFO order returns A, so the checker returns a counterexample.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Herlihy and Wing, Linearizability: A Correctness Condition for Concurrent Objects; Wing and Gong, Testing and Verifying Concurrent Objects; Gavin Lowe, Testing for Linearizability; Gibbons and Korach, Testing Shared Memories; and Jepsen analyses at https://jepsen.io/. Study FIFO Queue, Compare-and-Swap, Sequential Consistency, Strict Serializability, and Distributed Systems Testing next.',
      ],
    },
  ],
};
