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
        "The animation is not showing threads running. It is showing the evidence left after they ran: a history of invocations, responses, arguments, return values, and time intervals. Linearizability asks whether that evidence could have come from one sequential object, even though the calls overlapped in real time.",
        {
          type: 'bullets',
          items: [
            "Active intervals are operations whose positions in the abstract sequential history are still undecided.",
            "Found markers are linearization points in a witness order. They are proof objects: each one says where an operation can be treated as taking effect.",
            "Removed entries are candidate orders rejected by the sequential specification. For a FIFO queue, a dequeue returning B is impossible while A is still the oldest enqueued value.",
            "Compare markers are real-time constraints. If one response occurs before another invocation, the checker must preserve that order in every candidate witness.",
          ],
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Linearlizable_Process.svg',
          alt: 'Linearizability process diagram with a linearized subhistory and a non-linear branch',
          caption: 'Linearizability turns an overlapping history into a legal linear subhistory without moving completed-before-started operations across each other. Source: Wikimedia Commons, File: Linearlizable_Process.svg.',
        },
        "In the history-intervals view, overlap is freedom. If enq(A) and enq(B) overlap, either can be placed first unless the queue result forces one order. If enq(A) returns before deq() is invoked, that freedom disappears: every legal witness must put enq(A) before deq().",
        {
          type: 'callout',
          text: "Key insight: linearizability is not the order events happened to be logged in. It is the existence of some legal sequential order that preserves real-time facts clients could observe.",
        },
        "In the checking-proof view, the graph separates the two sources of truth. Timing gives a partial order. The object specification gives legal behavior. The checker succeeds only if the intersection of those two constraint systems contains at least one sequential history.",
        {
          type: 'note',
          text: "The animation uses a FIFO queue because queues make the semantic failure visible. If A is definitely in the queue before B and no operation removes A, then a later dequeue cannot return B. The same checker shape applies to stacks, registers, sets, maps, counters, locks, and distributed key-value objects, provided you supply the right sequential specification.",
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        "The first-principles problem is simple: clients call methods at overlapping times, but the object specification is usually sequential. A queue spec says enqueue changes the tail and dequeue removes the oldest item. It does not say what should happen when one enqueue is half complete while another thread is dequeuing. Linearizability is the bridge between the real concurrent execution and the simple sequential contract programmers depend on.",
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Shared_memory.svg',
          alt: 'Three CPUs connected by a system bus to shared memory',
          caption: 'Shared memory makes one object reachable from many execution points. Correctness must be stated at the interface, not at any one CPU timeline. Source: Wikimedia Commons, File: Shared_memory.svg.',
        },
        "A stress test that only checks final counts is not enough. A broken queue can enqueue A and B, return B first, leave A behind, and still end with the right number of elements. The data did not disappear. The order contract was violated.",
        "The interleaving space is the wall. Three concurrent operations have at most 6 abstract orders. Ten have at most 3,628,800. Twenty have about 2.43 * 10^18. Real-time constraints cut this down, but high-contention histories still contain many plausible orders. Manual review does not scale because the bug may be in the one order no one tries.",
        {
          type: 'quote',
          text: "Linearizability provides the illusion that each operation applied by concurrent processes takes effect instantaneously at some point between its invocation and its response.",
          attribution: 'Herlihy and Wing, "Linearizability: A Correctness Condition for Concurrent Objects," ACM TOPLAS, 1990',
        },
        "A history checker mechanizes the question. Given a recorded history -- process id, object id, method, arguments, invocation time, response time, and return value -- it asks whether there is a legal sequential explanation. A witness proves this recorded execution is linearizable. A counterexample proves this recorded execution violates the claimed object contract.",
        {
          type: 'callout',
          text: "A checker does not prove the implementation correct for all executions. It proves or refutes one observed history. The power comes from generating many hostile histories and making each failure exact.",
        },
      ],
    },
    {
      heading: 'The Herlihy-Wing formalism',
      paragraphs: [
        "Herlihy and Wing define correctness over histories. A history H is a finite sequence of invocation and response events. An invocation names an object, an operation, arguments, and a process. A response names the matching operation result. A well-formed process subhistory H|p alternates invocation and matching response events, so one process does not start a second operation before finishing the first.",
        "For an object x, H|x is the subhistory containing only events on x. A sequential history is one where every invocation is followed immediately by its matching response, except possibly one final pending invocation. A history is complete when every invocation has a matching response. complete(H) removes pending invocations from H.",
        {
          type: 'table',
          headers: ['Formal object', 'Meaning in the checker', 'Why it matters'],
          rows: [
            ['H', 'The observed concurrent history', 'The raw evidence: calls and returns in real time'],
            ['H|p', 'One process timeline', 'Preserves program order for each client'],
            ['H|x', 'One object timeline', 'Lets locality reason per object'],
            ['complete(H)', 'History after removing pending calls', 'Avoids judging operations that never returned'],
            ['<H', 'Real-time order relation', 'If response(a) precedes invocation(b), then a must precede b'],
            ['S', 'Candidate legal sequential history', 'The witness the checker is trying to find'],
          ],
        },
        "Two histories are equivalent when every process sees the same subhistory in both. A sequential history is legal when each object subhistory obeys that object's sequential specification. For a FIFO queue, legal means dequeue returns the oldest enqueued item not already dequeued, or empty when no such item exists.",
        "A history H is linearizable when H can be extended by appending responses to some pending invocations, then trimmed to complete(H'), so that there exists a legal sequential history S with two properties: S is equivalent to complete(H'), and real-time order in H is included in the sequential order of S.",
        {
          type: 'callout',
          text: "The formal definition has only two hard requirements: preserve what each process observed, and preserve non-overlap in real time. Everything else is search freedom.",
        },
        "The popular phrase linearization point is a proof convenience. It says the operation can be treated as if it took effect at one instant between invocation and response. A checker usually searches for the induced sequential order. If that order respects <H, the corresponding points can be placed inside the operation intervals.",
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "The obvious approach is to run many threads and validate aggregate facts: every inserted value appears once, no value appears twice, final size is correct, no pointer corruption occurs. That is useful. It catches memory corruption, lost nodes, duplicate nodes, and basic accounting mistakes.",
        "The next obvious approach is fixed replay. Sort operations by invocation time and simulate a sequential queue. Or sort by response time and simulate that. Or pick a random order and try a few thousand samples. These strategies feel close to the truth because they convert the concurrent execution into a sequential one.",
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Data_Queue.svg',
          alt: 'A FIFO queue diagram with input at one end and output at the other',
          caption: 'The sequential queue contract is simple: values leave in the same order they entered. Concurrent histories are hard because the entry order may be only partially known. Source: Wikimedia Commons, File: Data Queue.svg.',
        },
        {
          type: 'table',
          headers: ['Strategy', 'Why it is tempting', 'Why it fails'],
          rows: [
            ['Final-state check', 'Fast and simple', 'Misses impossible return order when counts still balance'],
            ['Invocation-order replay', 'Uses the order calls began', 'Rejects valid histories where a later call took effect first'],
            ['Response-order replay', 'Uses the order clients observed completion', 'Rejects valid histories where an earlier response linearized later'],
            ['Random replay', 'Sometimes finds a witness cheaply', 'Cannot prove no witness exists'],
            ['Linearizability checking', 'Searches all legal witnesses', 'Can be exponential in high-overlap histories'],
          ],
        },
        "Fixed replay is not just incomplete. It is unsound as a rejection test. When operations overlap, invocation order and response order are observations about endpoints, not proof of the abstract effect order.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "The wall is that concurrency creates a partial order, not a total order. A history does not usually tell you whether enq(A) or enq(B) took effect first. It tells you only whether one operation completed before another began. Everything else is open.",
        {
          type: 'diagram',
          text: 'Fixed-order replay is wrong:\n\n  Thread 1:  |---------- enq(A) ----------|\n  Thread 2:      |--- enq(B) ---|\n  Thread 3:                  |--- deq() -> B ---|\n\n  Invocation order:  enq(A), enq(B), deq()  => expects A\n  Response order:    enq(B), enq(A), deq()  => gets B\n\n  The response-order witness is legal because enq(A) and enq(B) overlap.\n  A long-running call may linearize after a shorter overlapping call.',
          label: 'Overlap permits reorderings that endpoint sorting cannot see',
        },
        "The opposite mistake is also common. If enq(A) returns at t=3 and deq() starts at t=5, the checker cannot put deq() before enq(A). A real client could observe that A completed before the dequeue was even invoked. Moving A after the dequeue would explain the result by violating time.",
        {
          type: 'callout',
          text: "The checker must be permissive about overlap and strict about non-overlap. Most bad tests get one of those two rules wrong.",
        },
        "The sequential specification supplies the other half of the wall. For a queue, the checker may choose among many candidate orders, but it cannot invent a queue that skips the oldest value. For a register, a read must return the latest write in the chosen order. For a lock, two successful acquires without an intervening release cannot both be legal.",
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "Linearizability reduces concurrent correctness to a constrained witness search. Find a legal sequential history S such that every process sees the same calls and returns it actually saw, and every completed-before-started pair keeps the same order.",
        "This is a first-principles move. The checker does not need to know the implementation. It does not inspect CAS loops, locks, retry paths, memory reclamation, or Raft internals. It treats the object as a black box and asks whether the externally visible behavior has a sequential explanation.",
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/UML_queue_class.svg',
          alt: 'UML class diagram for a generic queue with enqueue and dequeue operations',
          caption: 'The checker needs an abstract object contract, not implementation code. For a queue, that contract is just the legal behavior of create, enqueue, and dequeue. Source: Wikimedia Commons, File: UML queue class.svg.',
        },
        {
          type: 'table',
          headers: ['Constraint', 'Comes from', 'Example'],
          rows: [
            ['Process equivalence', 'Client program order', 'Thread 7 saw write(1) return before read() returned 1'],
            ['Real-time order', 'Invocation and response intervals', 'write(1) returned before read() was invoked'],
            ['Sequential legality', 'Object specification', 'A register read returns the most recent write in S'],
            ['Pending-operation rule', 'Herlihy-Wing completion', 'A crashed or timed-out call may be dropped unless a matching response is added'],
          ],
        },
        "The property that makes this useful is locality. Herlihy and Wing prove that a history is linearizable if and only if each object's subhistory is linearizable. That is why we can check a queue, a register, and a set separately when operations are single-object operations. Serializability does not have this exact object-local theorem.",
        {
          type: 'note',
          text: "Locality is not a license to ignore cross-object invariants. If one user action must debit account A and credit account B atomically, the transaction itself must be the object being specified. Linearizability of two independent account objects does not by itself make the transfer atomic.",
        },
      ],
    },
    {
      heading: 'How a checker works',
      paragraphs: [
        "A practical checker has four moving parts: history normalization, real-time edge extraction, sequential-spec simulation, and backtracking search with pruning.",
        {
          type: 'code',
          language: 'javascript',
          text: 'function findWitness(unplaced, edges, specState, prefix) {\n  if (unplaced.length === 0) return prefix;\n\n  const ready = unplaced.filter(op =>\n    !edges.some(edge =>\n      edge.after === op.id && unplaced.some(other => other.id === edge.before)\n    )\n  );\n\n  for (const op of ready) {\n    const nextState = specStep(specState, op);\n    if (!nextState.valid) continue;\n\n    const rest = unplaced.filter(other => other.id !== op.id);\n    const witness = findWitness(rest, edges, nextState.value, [...prefix, op]);\n    if (witness) return witness;\n  }\n\n  return null;\n}',
        },
        "The pseudocode hides two important engineering details. First, specStep is a transition relation, not always a function. A nondeterministic object may have several legal next states. Second, practical checkers memoize failed states. A memo key often combines the set of already placed operations with a canonical form of the abstract object state.",
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Detailed_petri_net.png',
          alt: 'A Petri net with places, transitions, arcs, and tokens',
          caption: 'A checker is also a state-transition search: tokens, transitions, and enabled moves are the same mental shape as candidate operations, spec states, and legal next steps. Source: Wikimedia Commons, File: Detailed petri net.png.',
        },
        {
          type: 'table',
          headers: ['Phase', 'What it computes', 'Main failure mode'],
          rows: [
            ['Normalize history', 'Completed operations, pending calls, object partitions', 'Bad instrumentation creates impossible or ambiguous histories'],
            ['Extract real-time edges', 'A DAG where a -> b means a must precede b', 'Clock skew or coarse timestamps can erase or invent edges'],
            ['Simulate spec', 'Accept or reject each next operation', 'The model is wrong or too weak'],
            ['Search witnesses', 'Topological orders accepted by the spec', 'Too many overlapping operations'],
            ['Shrink failures', 'Small counterexample core', 'Failure is real but too large to understand'],
          ],
        },
        "The animation's graph is this pipeline in miniature. History feeds both timing and semantics. Timing says which orders are forbidden. Semantics says which returns are possible. Search tries ready operations until it either finds a witness or exhausts every branch.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "Soundness is direct from the definition. If the checker returns a witness S, every operation in S is one from the observed history, every process sees the same call/return behavior, every real-time edge from H is preserved, and the sequential spec accepts S. That is exactly Herlihy-Wing linearizability.",
        "Completeness comes from exhaustive search over the legal order space. If the checker explores every topological extension of the real-time partial order and runs every candidate through the sequential spec, then a missing witness means no legal linearization exists. A correct checker cannot reject a history merely because invocation-order replay failed.",
        {
          type: 'diagram',
          text: 'Soundness and completeness:\n\n  Witness found:\n    S is equivalent to complete(H)\n    S preserves every real-time edge in H\n    S is legal under the object spec\n    ==> H is linearizable\n\n  No witness found:\n    Every real-time-compatible order was searched\n    Every candidate violated the spec or a required edge\n    ==> H is not linearizable\n\n  The checker is only as correct as the history recorder and the spec model.',
          label: 'Soundness and completeness of history checking',
        },
        "Linearizability is stronger than sequential consistency because it adds real-time order. Sequential consistency preserves each process order, but it may move an operation that completed earlier after an operation that started later on another process. Linearizability forbids that move. This is the part that matches what clients can observe outside the object.",
        {
          type: 'table',
          headers: ['Model', 'What order must exist', 'What it does not give you'],
          rows: [
            ['Sequential consistency', 'A legal sequence preserving each process order', 'Real-time order across processes'],
            ['Linearizability', 'A legal sequence preserving process order and non-overlap order', 'Liveness, fairness, memory safety, or transactions across multiple objects'],
            ['Serializability', 'A serial transaction order equivalent to the execution', 'Real-time order'],
            ['Strict serializability', 'A serial transaction order that also preserves real-time order', 'Object-local modularity unless the transaction is the object'],
            ['Eventual consistency', 'Convergence after updates stop', 'Immediate reads that reflect recent writes'],
          ],
        },
        {
          type: 'callout',
          text: "Linearizability is a safety property. It says bad returns never happen. It does not say operations eventually finish.",
        },
      ],
    },
    {
      heading: 'NP-completeness and practical cost',
      paragraphs: [
        "The general finite-history checking problem is NP-complete when the object specification is part of the input and can express rich enough constraints. Membership in NP is straightforward: the certificate is the candidate sequential history S. Verification checks process equivalence, real-time edges, and the sequential spec in polynomial time, assuming each spec step is polynomial.",
        "The hardness proof idea is to encode a combinatorial choice problem into overlapping operations. Think of a set-cover instance. Selector operations represent candidate sets. Requirement operations represent universe elements that must be covered. The history is arranged so selectors overlap enough that real-time order does not choose for us. The return values are constructed so the sequential spec accepts exactly when the chosen selector operations cover every requirement within the allowed budget.",
        {
          type: 'callout',
          text: "NP-completeness means the explosion is not just a naive implementation detail. Some histories really contain an exponential choice problem.",
        },
        "That proof sketch is not how most day-to-day checkers fail. Real histories usually become expensive for a simpler reason: many operations overlap, so the real-time partial order has few edges. With no edges, the checker may have to consider n! sequential orders before the spec rejects them all.",
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Reachability_graph_for_petri_net.png',
          alt: 'A reachability graph with multiple states and transitions',
          caption: 'Search cost comes from the reachable state graph. Linearizability checkers fight the same explosion with pruning, memoization, symmetry, and small counterexample extraction. Source: Wikimedia Commons, File: Reachability graph for petri net.png.',
        },
        {
          type: 'table',
          headers: ['History shape', 'Real-time edges', 'Search behavior'],
          rows: [
            ['Fully sequential', 'Almost total order', 'One replay plus spec validation'],
            ['Low contention', 'Many edges, small overlap windows', 'Backtracking stays local'],
            ['Hot single key or hot queue', 'Few edges among many calls', 'Large topological-order search'],
            ['Many independent keys', 'Partitionable by key', 'Check each key or object separately'],
            ['Many pending calls', 'Weak constraints', 'Dropping or completing pending operations expands choices'],
          ],
        },
        "Practical checkers use several structural escapes. The Wing-Gong style of search keeps only currently minimal operations ready. Lowe-style graph search caches equivalent states so the same failed suffix is not recomputed. Jepsen and Knossos often exploit object partitioning: a register per key can be checked per key, then combined by locality or by stronger transactional analyses when multi-key operations matter.",
        {
          type: 'note',
          text: "Not every object has worst-case behavior in practice. Single-register histories, key-partitioned histories, bounded-overlap windows, and specialized algorithms can be much cheaper than the general problem. This is why production testing designs the workload and the model together.",
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "Consider this recorded FIFO queue history:",
        {
          type: 'code',
          language: 'text',
          text: 'Thread 1: enq(A) invoked at t=1, returned at t=5\nThread 2: enq(B) invoked at t=2, returned at t=6\nThread 3: deq()  invoked at t=4, returned at t=8, result=A',
        },
        "Step 1 extracts real-time constraints:",
        {
          type: 'bullets',
          items: [
            "enq(A) [1,5] overlaps enq(B) [2,6], so neither order is forced.",
            "enq(A) [1,5] overlaps deq() [4,8], so neither order is forced.",
            "enq(B) [2,6] overlaps deq() [4,8], so neither order is forced.",
          ],
        },
        "The real-time graph has zero edges. The checker may try all 3! = 6 candidate orders.",
        {
          type: 'table',
          headers: ['Candidate order', 'Queue simulation', 'Verdict'],
          rows: [
            ['enq(A), enq(B), deq()', 'deq returns A from [A,B]', 'Valid'],
            ['enq(A), deq(), enq(B)', 'deq returns A from [A]', 'Valid'],
            ['enq(B), enq(A), deq()', 'deq returns B from [B,A]', 'Reject'],
            ['enq(B), deq(), enq(A)', 'deq returns B from [B]', 'Reject'],
            ['deq(), enq(A), enq(B)', 'deq sees empty queue', 'Reject'],
            ['deq(), enq(B), enq(A)', 'deq sees empty queue', 'Reject'],
          ],
        },
        "The history is linearizable because at least one valid witness exists. The checker does not need all witnesses. One is enough.",
        "Now change only the return value: deq() returns B. Because all intervals still overlap, the checker can choose enq(B), deq(), enq(A) or enq(B), enq(A), deq(). The changed history is still linearizable. Returning B is surprising under invocation order, but legal under the actual intervals.",
        "A true violation needs a real-time edge. Suppose enq(A) runs from t=1 to t=3, enq(B) runs from t=4 to t=7, and deq() runs from t=5 to t=8 returning B. Now enq(A) must precede both enq(B) and deq(). Every legal FIFO order with A first makes deq() return A unless A was removed by an earlier dequeue. No such operation exists. The minimal counterexample is exactly those three operations.",
        {
          type: 'callout',
          text: "The return value alone is never enough. The same deq() -> B can be legal or illegal depending on whether A and B overlapped.",
        },
      ],
    },
    {
      heading: 'Jepsen examples',
      paragraphs: [
        "Jepsen is the clearest public example of history checking as engineering practice. It generates concurrent client operations, injects faults such as partitions, crashes, pauses, and clock skew, records request and response histories, and checks those histories against a model. The result is not a vague performance graph. It is either a witness, a counterexample, or a statement that the generated histories did not reveal a violation.",
        {
          type: 'table',
          headers: ['Jepsen case', 'What the checker looked for', 'Important factual point'],
          rows: [
            ['etcd 0.4.1 and 3.4.3', 'Register, set, transaction, lock, and watch histories', 'Jepsen reported stale reads by default in 0.4.1; in 3.4.3, key-value operations appeared strict serializable, while the lock API was unsafe for mutual exclusion.'],
            ['MongoDB 3.6.4 and 4.2.6', 'Single-document linearizability and later transaction isolation', 'Strong single-document settings could appear linearizable, but weaker write concerns could lose writes; 4.2.6 transaction findings were snapshot-isolation anomalies, not simply queue-style linearizability failures.'],
            ['Redis-Raft 1b3fbf6', 'Append and read histories through a Raft-backed Redis state machine', 'Early versions showed total data loss on failover, split-brain lost updates, and transient empty reads on startup.'],
            ['Knossos', 'A compare-and-set register or other model over recorded operations', 'The model is explicit; a read of an old value after a completed write becomes a small, checkable contradiction.'],
          ],
        },
        "The etcd example is especially important because it corrects a common misconception. Jepsen did not simply label etcd bad. The 2020 etcd 3.4.3 analysis reported that key-value reads, writes, and transactions appeared strict serializable under tested faults. The serious issue was lock semantics: multiple clients could hold the same etcd lock, especially under pauses, partitions, or short leases. That is a model distinction, not a branding distinction.",
        "The MongoDB example corrects another common mistake. Linearizability is not the same as ACID and not the same as snapshot isolation. Jepsen 4.2.6 used Elle to infer transaction dependency cycles and found read skew, cyclic information flow, duplicate writes, and internal consistency violations. Those are transaction-isolation failures. A linearizability checker over one document is the wrong tool for the whole multi-document claim.",
        "Redis-Raft shows why history checking is useful during system construction. If a read returns an empty state after a committed append, the history exposes the contradiction without requiring a reviewer to inspect every Raft callback. The counterexample says exactly what the client observed: append succeeded, later read missed it.",
        {
          type: 'note',
          text: "Jepsen results are experimental evidence. They can prove the presence of bugs by producing a bad history. They cannot prove the absence of bugs, because unobserved histories may still fail.",
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "Linearizability fails as a complete correctness story whenever the object boundary is wrong. If the system promise is a money transfer, checking account A and account B independently is insufficient. The transfer must be modeled as one transaction object, or the checker can miss the state where the debit became visible without the credit.",
        {
          type: 'table',
          headers: ['Limitation', 'What goes wrong', 'Better frame'],
          rows: [
            ['Wrong object boundary', 'Per-object checks miss cross-object invariants', 'Model the transaction or global invariant directly'],
            ['Liveness', 'A system can be linearizable while some calls hang forever', 'Lock-freedom, wait-freedom, obstruction-freedom, timeouts'],
            ['Memory safety', 'Use-after-free, ABA, and reclamation bugs may not appear as bad return values', 'Sanitizers, model checking, hazard pointers, epochs'],
            ['Weak specifications', 'A model that allows too much will accept buggy behavior', 'Sharper sequential spec and negative examples'],
            ['Bad instrumentation', 'Clock skew, missing responses, or client-side retries distort the history', 'Monotonic clocks, unique operation ids, recorder validation'],
            ['High contention', 'The search becomes too large to finish', 'Partitioning, bounded windows, memoization, specialized checkers'],
          ],
        },
        "Weak memory models also require care, but not because a bad public history can be explained away. If clients observe a non-linearizable API history, the object violated the API contract. Weak memory matters when proving or exploring which low-level executions an implementation can produce. Tools such as CDSChecker explore memory-model-permitted interleavings below the API-history layer.",
        "The largest practical failure is a vague model. A checker can only reject behavior the spec forbids. If a distributed lock spec says acquire may sometimes succeed concurrently, the checker will accept concurrent holders. If the product documentation implies mutual exclusion, the spec must say exactly that.",
        {
          type: 'callout',
          text: "The most dangerous false pass is not caused by clever concurrency. It is caused by a spec that forgot to state the promise users rely on.",
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'quote',
          text: "Linearizability is a local property: a system is linearizable if and only if each individual object is linearizable.",
          attribution: 'Herlihy and Wing, 1990, Section 3.4',
        },
        {
          type: 'bullets',
          items: [
            'Primary source: Maurice P. Herlihy and Jeannette M. Wing, "Linearizability: A Correctness Condition for Concurrent Objects," ACM TOPLAS 12(3), 1990. Defines histories, legality, real-time order, linearization, and locality.',
            'Practical checker lineage: Jeannette M. Wing and C. Gong, "Testing and Verifying Concurrent Objects," Journal of Parallel and Distributed Computing 17(1-2), 1993.',
            'Modern checker: Gavin Lowe, "Testing for Linearizability," Concurrency and Computation: Practice and Experience, 2017. Explains efficient graph search and state caching for practical histories.',
            'Complexity: Gibbons and Korach, "Testing Shared Memories," SIAM Journal on Computing 26(4), 1997, plus later complexity work on linearizability and concurrent-system verification.',
            'Jepsen examples: etcd 3.4.3 (https://jepsen.io/analyses/etcd-3.4.3), MongoDB 4.2.6 (https://jepsen.io/analyses/mongodb-4.2.6), and Redis-Raft 1b3fbf6 (https://jepsen.io/analyses/redis-raft-1b3fbf6).',
            'Images: Wikimedia Commons files Linearlizable_Process.svg, Shared_memory.svg, Data_Queue.svg, UML_queue_class.svg, Detailed_petri_net.png, and Reachability_graph_for_petri_net.png.',
          ],
        },
        "Study prerequisites: compare-and-swap, lock-free queues, process interleavings, FIFO queues, and sequential specifications. A learner who cannot simulate a sequential queue by hand is not ready to debug a concurrent queue history.",
        "Study next: sequential consistency to see what happens when real-time order is removed; strict serializability to lift the idea to transactions; nonblocking progress guarantees to separate safety from liveness; hazard pointers and epoch reclamation to understand memory safety bugs that linearizability alone will not catch.",
        "Production next: read Jepsen histories as proof artifacts. Do not start with the database name. Start with the model: register, set, compare-and-set register, lock, append-only list, or transaction graph. The model determines what kind of counterexample the checker can honestly report.",
      ],
    },
  ],
};
