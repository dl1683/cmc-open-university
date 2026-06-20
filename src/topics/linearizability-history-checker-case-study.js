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
        'The animation shows a linearizability checker working through a concurrent history of queue operations. Each operation appears as a horizontal interval from its invocation time to its response time. The checker must place one linearization point inside each interval so the resulting sequential order satisfies the queue specification.',
        {
          type: 'bullets',
          items: [
            'Active intervals are the operations currently under consideration -- the checker is deciding where to place their linearization points.',
            'Found markers are linearization points that satisfy both real-time constraints and the sequential specification. A found witness proves the history is linearizable.',
            'Removed entries are candidate orderings the checker has rejected because they violate the queue spec (e.g., dequeuing B when A is at the front).',
            'Compare markers highlight pairs of operations being tested for real-time ordering constraints.',
          ],
        },
        'In the "history intervals" view, watch how overlap between intervals creates freedom: overlapping operations can be ordered either way, while non-overlapping operations have a forced order. In the "checking proof" view, watch how the checker combines real-time edges with the sequential spec to prune impossible orderings before searching for a witness.',
        {
          type: 'note',
          text: 'The animation uses a FIFO queue as the concurrent object because queues expose linearizability violations clearly: if enq(A) completed before deq() started, and deq() returns B while A was never dequeued, no sequential FIFO queue can explain that result. The same checking framework applies to any data type with a sequential specification -- stacks, registers, sets, maps, priority queues.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Lock-free and concurrent data structures are notoriously hard to get right. A lock-free queue might pass a million stress tests and still contain a bug that appears only when three threads interleave in a specific order that happens once per billion executions. The Michael-Scott queue had a subtle ABA bug that survived years of deployment. The original publication of the LCRQ queue contained a linearizability violation found only by automated checking.',
        'The core difficulty is that concurrent correctness is not a property of any single execution path. It is a property of all possible interleavings. A queue with two enqueues and one dequeue has 6 possible orderings. With ten concurrent operations, there are over 3.6 million. With twenty, the number exceeds 10^18. No human can inspect these by hand.',
        {
          type: 'quote',
          text: 'Linearizability provides the illusion that each operation applied by concurrent processes takes effect instantaneously at some point between its invocation and its response.',
          attribution: 'Herlihy and Wing, "Linearizability: A Correctness Condition for Concurrent Objects," ACM TOPLAS, 1990',
        },
        'A linearizability checker mechanizes this question. Given a recorded history of concurrent operations -- who called what, when they started, when they returned, what they got back -- the checker determines whether there exists any sequential ordering that (1) places each operation at one instant inside its real-time interval and (2) satisfies the sequential specification of the object. If no such ordering exists, the implementation has a bug. If one exists, the checker can produce the witness.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct for testing a concurrent queue is end-state validation. Run N threads, have them enqueue and dequeue items, then check: did every enqueued item get dequeued exactly once? Is the final queue the right size? This is what most stress tests do, and it catches gross corruption -- double-frees, lost nodes, memory stomps.',
        'A slightly more sophisticated approach is to replay operations in the order they were invoked, or in the order they returned, and check whether the results match. This feels rigorous because it produces a concrete sequential history to compare against.',
        {
          type: 'table',
          headers: ['Testing strategy', 'What it catches', 'What it misses'],
          rows: [
            ['End-state count', 'Lost or duplicated items, memory corruption', 'Wrong ordering of returns (queue returns B when A should come first)'],
            ['Replay by invocation order', 'Some ordering bugs', 'Overlapping operations that could legally be reordered'],
            ['Replay by response order', 'Some ordering bugs', 'Early-completing operations forced before later ones'],
            ['Random sequential replay', 'Some ordering bugs, by luck', 'No guarantee of finding the right witness or proving none exists'],
            ['Linearizability checker', 'Any violation of the sequential spec under any legal ordering', 'Nothing within its model (but see limitations)'],
          ],
        },
        'End-state checks and replay by fixed order are both reasonable starting points. They run fast, they catch crashes, and they build confidence. The problem is that they have enormous blind spots for exactly the bugs that matter most in lock-free code.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'End-state checking fails because a queue can have the right final size while returning values in an impossible order. Suppose thread 1 enqueues A, thread 2 enqueues B after A completes, and thread 3 dequeues and gets B. The queue still has one item (A), the sizes balance, but no FIFO queue should skip A when it was enqueued first and never removed.',
        'Replay by invocation order fails because overlapping operations do not have a forced invocation order. If enq(A) starts at time 1 and enq(B) starts at time 2 but both are still running at time 3, either could take effect first. Picking invocation order is arbitrary and might reject a perfectly linearizable history.',
        'Replay by response order has the same flaw in reverse. An operation that returns early might need to be ordered after one that returns late, because their intervals overlap and the sequential spec demands a different arrangement.',
        {
          type: 'diagram',
          text: 'Why fixed-order replay is wrong:\n\n  Thread 1:  |---enq(A)---|              A returns before B starts\n  Thread 2:       |---enq(B)---|         B overlaps with A\n  Thread 3:            |---deq()->A---|  deq overlaps with B\n\n  Invocation order:  enq(A), enq(B), deq()  --> deq returns A  (valid)\n  Response order:    enq(A), enq(B), deq()  --> deq returns A  (valid)\n\n  But change it slightly:\n\n  Thread 1:  |---enq(A)---------|         A has a long interval\n  Thread 2:       |--enq(B)--|            B finishes inside A\n  Thread 3:                |--deq()->B--| deq starts after B ends\n\n  Invocation order:  enq(A), enq(B), deq()  --> expects deq returns A\n  But deq returned B.  Replay says FAIL.\n  Actual witness:    enq(B), enq(A), deq()  --> deq returns B  (valid!)\n  A and B overlap, so this reordering is legal.  Replay missed it.',
          label: 'Fixed-order replay rejects valid histories when intervals overlap',
        },
        'The fundamental problem is that the checker must search over all orderings consistent with real-time constraints. Any fixed replay strategy picks one ordering and can both miss valid witnesses and fail to identify real bugs.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Linearizability reduces concurrent correctness to a search problem: find a sequential ordering that respects real-time constraints and satisfies the object specification, or prove none exists.',
        'Two operations are constrained by real-time order when one completes before the other begins. If enq(A) returns at time 3 and deq() is invoked at time 5, then enq(A) must precede deq() in every legal witness. Two operations that overlap in time have no forced order -- the checker may place either one first.',
        {
          type: 'diagram',
          text: 'The two constraints that define the search space:\n\n  REAL-TIME ORDER (from intervals)\n  ================================\n  op A returns before op B starts  -->  A must precede B\n  op A and op B overlap            -->  either order is legal\n\n  SEQUENTIAL SPECIFICATION (from the data type)\n  =============================================\n  After enq(X), enq(Y):  deq() must return X    (FIFO)\n  After push(X), push(Y): pop() must return Y   (LIFO)\n  After write(X): read() must return X           (register)\n\n  LINEARIZABILITY = exists an ordering satisfying BOTH constraints',
          label: 'Linearizability sits at the intersection of timing and semantics',
        },
        'The key property that makes linearizability useful is locality (also called composability): a history is linearizable if and only if each object in the history is independently linearizable. This means you can check one queue, one stack, and one register separately, and if each passes, the whole system passes. No other major consistency condition has this property. Serializability, for example, is not composable -- two individually serializable objects can produce a combined history that is not serializable.',
        {
          type: 'note',
          text: 'Locality is why linearizability became the standard correctness condition for concurrent data structures rather than serializability. You can build and verify one lock-free queue in isolation, then compose it with other linearizable objects, and the composition is automatically linearizable. This is the same reason interface contracts work in software engineering: local guarantees compose into global ones.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A linearizability checker takes a recorded concurrent history and processes it in three phases: extract real-time constraints, enumerate candidate orderings, and validate each candidate against the sequential specification.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Phase 1: Extract real-time partial order\n// For each pair of operations, if one returned before the other was invoked,\n// record a "must precede" edge.\nfunction extractRealTimeEdges(history) {\n  const edges = [];\n  for (const a of history) {\n    for (const b of history) {\n      if (a !== b && a.returnTime < b.invokeTime) {\n        edges.push({ before: a.id, after: b.id });\n      }\n    }\n  }\n  return edges;\n}\n\n// Phase 2: Search orderings consistent with real-time edges\n// This is a topological sort of a partial order -- but with backtracking,\n// because we also need the sequential spec to accept.\nfunction findWitness(ops, edges, spec) {\n  if (ops.length === 0) return [];  // all placed: success\n  // Find ops with no unplaced predecessor\n  const ready = ops.filter(op =>\n    !edges.some(e => e.after === op.id && ops.some(o => o.id === e.before))\n  );\n  for (const next of ready) {\n    const result = spec.apply(next);     // run op against spec state\n    if (result.valid) {\n      const rest = findWitness(\n        ops.filter(o => o !== next), edges, spec.clone()\n      );\n      if (rest !== null) return [next, ...rest];\n    }\n    spec.undo(next);                     // backtrack\n  }\n  return null;  // no valid ordering from this state\n}',
        },
        'Phase 1 runs in O(n^2) time for n operations and produces the real-time partial order. Phase 2 is the expensive part: it performs a backtracking search over topological orderings of the partial order, checking each candidate against the sequential specification. In the worst case, the number of topological orderings of n elements with no real-time constraints is n!, but real histories have many non-overlapping operations that dramatically reduce the search space.',
        'The checking-proof view in the animation shows this pipeline. The history node feeds into both the real-time constraint extractor and the sequential spec. The search node combines these to try candidate orderings. Each candidate either produces a witness (linearization points placed inside intervals) or gets rejected. If all candidates are rejected, the checker returns a counterexample.',
        {
          type: 'table',
          headers: ['Checker component', 'Input', 'Output', 'Complexity driver'],
          rows: [
            ['Interval recorder', 'Runtime execution', 'List of (thread, op, args, result, start, end)', 'Instrumentation overhead'],
            ['Real-time extractor', 'Interval list', 'Partial order (DAG of must-precede edges)', 'O(n^2) pairs'],
            ['Spec simulator', 'Operation sequence', 'Accept/reject with state', 'Per-operation cost of the spec (usually O(1))'],
            ['Ordering search', 'Partial order + spec', 'Witness or counterexample', 'Topological orderings of the partial order (worst case n!)'],
            ['Pruning engine', 'Partial search state', 'Reduced search tree', 'Memoization, symmetry, state canonicalization'],
          ],
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness of linearizability checking rests on two invariants that hold at every step of the search.',
        'First invariant: each linearization point must fall inside its operation interval. This is not negotiable. An operation that ran from time 3 to time 7 cannot take effect at time 2 or time 9. This constraint is what makes linearizability match observable behavior -- a client that calls an operation and gets a response can only observe effects that happened between those two moments.',
        'Second invariant: the sequential ordering must respect all real-time edges. If operation A completed before operation B was invoked, then A takes effect before B in every legal witness. This prevents the checker from "explaining away" a bug by reordering operations that a real client could distinguish.',
        {
          type: 'diagram',
          text: 'Correctness argument for the checker:\n\n  If witness found:\n    1. Every op has a point inside its interval         (interval rule)\n    2. Points respect real-time order                   (ordering rule)\n    3. Sequential spec accepts the point-ordered history (semantics rule)\n    ==> The concurrent history IS linearizable\n\n  If no witness found:\n    1. Every possible placement of points was tried\n    2. Every placement violates interval, ordering, or semantics\n    ==> The concurrent history is NOT linearizable\n    ==> The implementation has a bug\n\n  The checker is complete: it will find a witness if one exists.\n  The checker is sound: a reported violation is a real violation.',
          label: 'Soundness and completeness of linearizability checking',
        },
        'Linearizability is strictly stronger than sequential consistency. Sequential consistency requires a legal sequential ordering consistent with each thread program order, but allows reordering across threads. Linearizability adds the real-time constraint: non-overlapping operations across any threads must keep their observed order. This is why linearizability is the gold standard for concurrent objects -- it matches what any external observer could deduce from timing alone.',
        {
          type: 'table',
          headers: ['Consistency model', 'Respects program order?', 'Respects real-time order?', 'Composable?'],
          rows: [
            ['Sequential consistency', 'Yes (per thread)', 'No', 'No'],
            ['Linearizability', 'Yes (per thread)', 'Yes', 'Yes'],
            ['Serializability', 'No (reorders within transaction)', 'No', 'No'],
            ['Strict serializability', 'Yes', 'Yes', 'No'],
            ['Eventual consistency', 'No', 'No', 'No'],
          ],
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Linearizability checking is NP-complete in general. Gibbons and Korach proved this in 1997 by reduction from set cover. The hardness comes from histories where many operations overlap, creating an exponential number of candidate orderings.',
        {
          type: 'table',
          headers: ['History shape', 'Overlapping ops', 'Search space', 'Practical time'],
          rows: [
            ['Fully sequential (no overlap)', '0', '1 ordering (just validate)', 'O(n) spec checks'],
            ['Light contention (2-3 threads)', '2-5 at a time', 'Small combinatorial windows', 'Milliseconds for 1000 ops'],
            ['Moderate contention (8 threads)', '5-10 at a time', 'Manageable with pruning', 'Seconds for 1000 ops'],
            ['High contention (all overlap)', 'n', 'n! orderings', 'Minutes for 20 ops, infeasible for 30+'],
          ],
        },
        'In practice, histories from real systems have limited concurrency. At any moment, only a few operations overlap. The Wing-Gong algorithm (1993) exploits this by maintaining a set of "pending" operations and only searching orderings among currently overlapping ones. Lowe (2017) further improved practical performance by caching equivalent search states, cutting redundant exploration by orders of magnitude on real histories.',
        'The recording overhead is the other cost. Each operation needs a start timestamp, end timestamp, thread ID, arguments, and return value. On modern hardware, timestamping with rdtsc or clock_gettime adds 20-50 nanoseconds per operation. For a lock-free queue doing ~100M operations/second, this is a 2-5% overhead -- acceptable for testing, too expensive for production.',
        {
          type: 'note',
          text: 'The NP-completeness result applies to the general problem. For specific data types, checking can be polynomial. Linearizability of a single read-write register is checkable in O(n log n) time. For queues with a bounded number of threads, polynomial algorithms exist (Bouajjani et al., 2015). The practical message: structure your tests to limit concurrency windows, and the checker stays fast.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a concurrent FIFO queue with three operations recorded by a test harness:',
        {
          type: 'code',
          language: 'text',
          text: 'Thread 1:  enq(A)  invoked at t=1, returned at t=5\nThread 2:  enq(B)  invoked at t=2, returned at t=6\nThread 3:  deq()   invoked at t=4, returned at t=8, result=A',
        },
        'Step 1: Extract real-time constraints. Check every pair of operations for non-overlapping intervals:',
        {
          type: 'bullets',
          items: [
            'enq(A) [1,5] vs enq(B) [2,6]: they overlap (2 < 5), so no forced order.',
            'enq(A) [1,5] vs deq() [4,8]: they overlap (4 < 5), so no forced order.',
            'enq(B) [2,6] vs deq() [4,8]: they overlap (4 < 6), so no forced order.',
          ],
        },
        'All three operations overlap with each other. The real-time partial order has zero edges. The checker has full freedom to try all 3! = 6 orderings.',
        'Step 2: Try each ordering against the FIFO queue spec:',
        {
          type: 'table',
          headers: ['Candidate ordering', 'Queue simulation', 'deq() returns', 'Verdict'],
          rows: [
            ['enq(A), enq(B), deq()', 'queue=[A,B], deq front', 'A', 'VALID -- matches observed result'],
            ['enq(A), deq(), enq(B)', 'queue=[A], deq front', 'A', 'VALID -- matches observed result'],
            ['enq(B), enq(A), deq()', 'queue=[B,A], deq front', 'B', 'REJECT -- observed A, got B'],
            ['enq(B), deq(), enq(A)', 'queue=[B], deq front', 'B', 'REJECT -- observed A, got B'],
            ['deq(), enq(A), enq(B)', 'queue=[], deq empty', 'error', 'REJECT -- deq from empty queue'],
            ['deq(), enq(B), enq(A)', 'queue=[], deq empty', 'error', 'REJECT -- deq from empty queue'],
          ],
        },
        'The checker finds two valid witnesses. It picks the first one: enq(A) at t=3.2, enq(B) at t=5.4, deq() at t=6.6. Each point falls inside its interval. The history is linearizable.',
        'Now change the scenario: suppose deq() returned B instead of A. The same table shows that orderings 3 and 4 would produce B, but they require enq(B) before enq(A). Since all intervals overlap, this is allowed by real-time constraints. So the history is still linearizable, with witness: enq(B), enq(A), deq().',
        'For a true violation: suppose enq(A) runs from t=1 to t=3 (finishes early), enq(B) runs from t=4 to t=7, and deq() runs from t=5 to t=8 returning B. Now enq(A) [1,3] finishes before enq(B) [4,7] starts, so enq(A) must precede enq(B). And enq(A) [1,3] finishes before deq() [5,8] starts, so enq(A) must precede deq(). The only orderings with enq(A) first and deq() returning B require the queue to skip A -- impossible for a FIFO. The counterexample core is three operations: enq(A) completed, enq(B) started later, deq() skipped A and returned B.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Tool / System', 'What it checks', 'Approach'],
          rows: [
            ['Knossos (Jepsen)', 'Distributed databases (etcd, CockroachDB, TiDB, etc.)', 'Records client-visible request/response history, checks linearizability of each key independently'],
            ['Line-Up (Microsoft Research)', 'Concurrent .NET collections', 'Enumerates thread interleavings using CHESS, checks each for linearizability'],
            ['Lincheck (JetBrains)', 'Java/Kotlin concurrent data structures', 'Model-checks bounded interleavings with pluggable sequential specs'],
            ['P (Microsoft Research)', 'Asynchronous state machines', 'Specification-based checking including linearizability as a special case'],
            ['CDSChecker', 'C/C++11 lock-free code', 'Exhaustive exploration of memory-model-permitted behaviors'],
          ],
        },
        'Jepsen is the most visible user of linearizability checking in production. Kyle Kingsbury records client request/response histories against distributed databases under fault injection (network partitions, process kills, clock skew). Knossos, the linearizability checker inside Jepsen, then determines whether the observed history is consistent with a linearizable register, set, or queue. Jepsen has found linearizability violations in etcd, CockroachDB, MongoDB, Cassandra, VoltDB, and many others.',
        'In concurrent data structure research, linearizability checking is how new algorithms are validated. The typical workflow is: implement the lock-free structure, run millions of random concurrent operations, record the history, and check it. This is faster feedback than manual proof construction and catches bugs that proofs miss when the implementation diverges from the design.',
        {
          type: 'note',
          text: 'Linearizability checking is a testing technique, not a verification technique. It checks recorded histories, not all possible histories. A clean check over 10 million operations does not prove the implementation is correct -- it means those 10 million operations were linearizable. Model checkers like CDSChecker and Lincheck address this gap by systematically exploring interleavings, but they are limited to small state spaces.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Linearizability is a single-object property. It says nothing about transactions spanning multiple objects. A bank transfer that debits account A and credits account B requires both operations to appear atomic together. Linearizability of each account separately does not guarantee this -- you can observe a state where the money has left A but not arrived at B. Multi-object atomicity requires serializability or strict serializability, which are different (and non-composable) conditions.',
        {
          type: 'table',
          headers: ['Limitation', 'What goes wrong', 'What to use instead'],
          rows: [
            ['Multi-object transactions', 'Each object linearizable, but cross-object invariants violated', 'Strict serializability or transactional memory'],
            ['Progress guarantees', 'Linearizability says nothing about whether operations complete', 'Lock-freedom, wait-freedom, obstruction-freedom (separate properties)'],
            ['Memory reclamation', 'Checking does not cover use-after-free or ABA from recycled memory', 'Hazard pointers, epoch reclamation, or GC'],
            ['Nondeterministic specs', 'If the spec has multiple legal returns (e.g., tryLock), search space explodes', 'Restricted specs or relaxed checking'],
            ['Scale', 'NP-complete in the number of overlapping operations', 'Bounded checking windows, state caching, type-specific polynomial algorithms'],
          ],
        },
        'History capture itself introduces failure modes. Clock skew between recording threads can make non-overlapping operations appear to overlap (or vice versa). On x86, rdtsc provides monotonic timestamps within a socket but can skew across sockets. On ARM, the generic timer has coarser resolution. Missing responses (from crashes or timeouts) create "pending" operations that the checker must handle conservatively -- they can be ordered anywhere, which dramatically expands the search space.',
        'Weak memory models add another layer. On ARM or RISC-V, stores can become visible to different threads in different orders. A history that appears non-linearizable under sequential consistency might be explained by store-buffer forwarding or load reordering. CDSChecker handles this by exploring all memory-model-permitted behaviors, but this is a separate tool from a pure linearizability checker.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'quote',
          text: 'Linearizability is a local property: a system is linearizable if and only if each individual object is linearizable. Locality is important because it allows concurrent systems to be designed and constructed in a modular fashion.',
          attribution: 'Herlihy and Wing, 1990, Section 3.4',
        },
        {
          type: 'bullets',
          items: [
            'Primary source: Herlihy and Wing, "Linearizability: A Correctness Condition for Concurrent Objects," ACM TOPLAS 12(3), 1990. Defines the model, proves locality, and shows the relationship to sequential consistency.',
            'NP-completeness proof: Gibbons and Korach, "Testing Shared Memories," SIAM Journal on Computing 26(4), 1997. Shows that linearizability checking is NP-complete by reduction from set cover.',
            'Practical checker: Wing and Gong, "Testing and Verifying Concurrent Objects," Journal of Parallel and Distributed Computing 17(1-2), 1993. The first practical linearizability checker algorithm.',
            'Modern tool: Lowe, "Testing for Linearizability," Concurrency and Computation: Practice and Experience, 2017. Competitive graph-search algorithm with state caching that handles real histories efficiently.',
            'Production use: Kingsbury, Jepsen (https://jepsen.io/). Applies linearizability checking to distributed databases under fault injection.',
          ],
        },
        'Prerequisite topics: understand concurrent execution models, thread interleaving, and compare-and-swap atomics before studying linearizability. The Lock-Free Queue topic shows the Michael-Scott queue whose correctness depends on linearizability arguments.',
        'Extension topics: Nonblocking Progress Guarantees (lock-freedom, wait-freedom) cover liveness properties that linearizability intentionally ignores. Hazard Pointers and Epoch Reclamation address memory safety, another orthogonal concern. Distributed Snapshot Consistent Cut extends the idea of "one instant per operation" to distributed systems where there is no shared clock.',
        'Contrasting alternatives: study Sequential Consistency (weaker, not composable), Serializability (transaction-oriented, not composable), and Eventual Consistency (much weaker, designed for availability over correctness) to understand the design space that linearizability occupies.',
      ],
    },
  ],
};
