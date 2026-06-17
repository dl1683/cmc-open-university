// ABA tagged pointer stack: the same pointer value can hide an intervening
// remove/reuse cycle unless CAS compares a version as well as the address.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'aba-tagged-pointer-stack-case-study',
  title: 'ABA Tagged Pointer Stack Case Study',
  category: 'Data Structures',
  summary: 'A lock-free stack failure mode: CAS sees pointer A again after A was removed and reused; tagged pointers and reclamation make the change visible.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['ABA failure', 'tagged pointer fix'], defaultValue: 'ABA failure' },
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

function stackGraph(title, topLabel = 'top=A', tag = '') {
  return graphState({
    nodes: [
      { id: 'top', label: 'top', x: 0.8, y: 3.5, note: topLabel },
      { id: 'a', label: 'A', x: 2.8, y: 2.2, note: tag || 'addr A' },
      { id: 'b', label: 'B', x: 4.9, y: 2.2, note: 'next' },
      { id: 'c', label: 'C', x: 7.0, y: 2.2, note: 'tail' },
      { id: 't1', label: 'T1', x: 2.8, y: 5.4, note: 'paused' },
      { id: 't2', label: 'T2', x: 5.4, y: 5.4, note: 'mutates' },
      { id: 'cas', label: 'CAS', x: 8.5, y: 4.0, note: 'compare' },
    ],
    edges: [
      { id: 'e-top-a', from: 'top', to: 'a' },
      { id: 'e-a-b', from: 'a', to: 'b' },
      { id: 'e-b-c', from: 'b', to: 'c' },
      { id: 'e-t1-a', from: 't1', to: 'a' },
      { id: 'e-t2-b', from: 't2', to: 'b' },
      { id: 'e-cas-top', from: 'cas', to: 'top' },
    ],
  }, { title });
}

function* abaFailure() {
  yield {
    state: stackGraph('Treiber-style stack starts with A -> B -> C'),
    highlight: { active: ['top', 'a', 'b', 'c', 'e-top-a', 'e-a-b', 'e-b-c'], compare: ['t1'] },
    explanation: 'A Treiber stack keeps a top pointer and uses CAS to pop and push. Thread T1 reads top = A and next = B, then pauses before it can CAS top from A to B.',
    invariant: 'CAS compares the current value with the old value. It does not know the value history.',
  };

  yield {
    state: labelMatrix(
      'T1 snapshot',
      [
        { id: 'top', label: 'top' },
        { id: 'next', label: 'A.next' },
        { id: 'plan', label: 'plan' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['A', 'observed head'],
        ['B', 'next after A'],
        ['CAS A -> B', 'pop A'],
      ],
    ),
    highlight: { active: ['top:value', 'next:value', 'plan:value'] },
    explanation: 'T1 has a plan that is valid only if the stack still has A followed by B when it resumes. The raw pointer value alone cannot prove that.',
  };

  yield {
    state: stackGraph('T2 pops A, pops B, then pushes A again'),
    highlight: { active: ['t2', 'a', 'b', 'e-t2-b'], removed: ['b'], compare: ['t1'] },
    explanation: 'While T1 is paused, T2 changes the stack from A -> B -> C to C, then pushes A back on top. The top pointer value is again A, but the abstract stack is not the old stack.',
  };

  yield {
    state: stackGraph('T1 resumes and CAS(top, A, B) can succeed incorrectly'),
    highlight: { active: ['t1', 'cas', 'top', 'a', 'e-cas-top'], removed: ['b'], found: ['cas'] },
    explanation: 'Because top is A again, T1 CAS can succeed and install B as top even though B was already removed. The stack can resurrect a node or splice in freed memory.',
  };

  yield {
    state: labelMatrix(
      'Why this is not just a stack bug',
      [
        { id: 'cas', label: 'CAS' },
        { id: 'reuse', label: 'reuse' },
        { id: 'memory', label: 'memory' },
        { id: 'proof', label: 'proof' },
      ],
      [
        { id: 'issue', label: 'issue' },
        { id: 'repair', label: 'repair' },
      ],
      [
        ['value-only', 'tag or LL/SC'],
        ['same address', 'delay reuse'],
        ['freed node', 'hazard/epoch'],
        ['bad history', 'linearize fail'],
      ],
    ),
    highlight: { active: ['cas:repair', 'memory:repair'], compare: ['proof:issue'] },
    explanation: 'ABA is the interaction of CAS, pointer reuse, and stale snapshots. It belongs next to linearizability and memory reclamation, not only next to stacks.',
  };
}

function* taggedPointerFix() {
  yield {
    state: stackGraph('Make top a pair: pointer plus version tag', 'A:v7', 'v7'),
    highlight: { active: ['top', 'a'], compare: ['cas'] },
    explanation: 'A tagged pointer stores both the address and a version. CAS compares the full pair. Reusing address A no longer recreates the exact old top value because the tag changes.',
    invariant: 'Compare identity, not just address.',
  };

  yield {
    state: labelMatrix(
      'Tagged sequence',
      [
        { id: 'read', label: 'T1 reads' },
        { id: 'popA', label: 'T2 pop A' },
        { id: 'popB', label: 'T2 pop B' },
        { id: 'pushA', label: 'T2 push A' },
        { id: 'resume', label: 'T1 CAS' },
      ],
      [
        { id: 'top', label: 'top pair' },
        { id: 'result', label: 'result' },
      ],
      [
        ['A:v7', 'snapshot'],
        ['B:v8', 'changed'],
        ['C:v9', 'changed'],
        ['A:v10', 'same addr'],
        ['expect A:v7', 'fails'],
      ],
    ),
    highlight: { active: ['read:top', 'pushA:top'], found: ['resume:result'] },
    explanation: 'The address cycles back to A, but the full top pair does not. T1 expected A:v7 and sees A:v10, so it must reread the stack before trying again.',
  };

  yield {
    state: labelMatrix(
      'Fix menu',
      [
        { id: 'tag', label: 'tag bits' },
        { id: 'dwcas', label: 'wide CAS' },
        { id: 'llsc', label: 'LL/SC' },
        { id: 'hp', label: 'hazard ptr' },
        { id: 'epoch', label: 'epoch' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['detect cycles', 'tag wrap'],
        ['ptr + tag', 'HW support'],
        ['detect writes', 'platform'],
        ['delay reuse', 'scan cost'],
        ['bulk reuse', 'stalls'],
      ],
    ),
    highlight: { found: ['tag:helps', 'hp:helps', 'epoch:helps'], compare: ['tag:limit'] },
    explanation: 'Tagged pointers make changes visible to CAS. Safe reclamation delays address reuse. Many systems combine both because one protects logical identity and the other protects memory lifetime.',
  };

  yield {
    state: stackGraph('With tags, T1 retries instead of corrupting the stack', 'A:v10', 'v10'),
    highlight: { active: ['t1', 'top', 'a', 'cas'], found: ['b'], compare: ['t2'] },
    explanation: 'The failed CAS is a success for correctness. It sends T1 back to the read phase, where it can observe the current stack and compute a new valid pop plan.',
  };

  yield {
    state: labelMatrix(
      'Case study lesson',
      [
        { id: 'slotmap', label: 'slot map' },
        { id: 'stack', label: 'LF stack' },
        { id: 'queue', label: 'LF queue' },
        { id: 'rcu', label: 'RCU' },
      ],
      [
        { id: 'identity', label: 'identity' },
        { id: 'lifetime', label: 'lifetime' },
      ],
      [
        ['index+gen', 'owner arena'],
        ['ptr+tag', 'hazard/epoch'],
        ['node refs', 'hazard/GC'],
        ['version ptr', 'grace period'],
      ],
    ),
    highlight: { active: ['slotmap:identity', 'stack:identity'], found: ['stack:lifetime', 'rcu:lifetime'] },
    explanation: 'The same idea appears outside lock-free stacks. Slot maps use generations, RCU uses versioned publication, and queues rely on lifetime discipline. Stale identity is a general data-structure bug class.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ABA failure') yield* abaFailure();
  else if (view === 'tagged pointer fix') yield* taggedPointerFix();
  else throw new InputError('Pick an ABA view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Compare-and-swap is the basic hardware primitive behind many lock-free stacks, queues, free lists, and handle tables. It asks whether a memory location still equals an expected value and, if so, replaces it. The dangerous shortcut is to treat equal bits as equal state.',
        'ABA is the counterexample. A location can hold A, change to B, and later hold A again while a paused thread still has an old plan based on the first A. The CAS comparison sees the same value, but the history that made the plan valid has disappeared.',
      ],
    },
    {
      heading: 'The failure in a Treiber stack',
      paragraphs: [
        'A Treiber stack pop reads top = A and A.next = B, then plans CAS(top, A, B). That plan is valid only while A is still the current head and B is still the successor of A. If the stack changes, the plan must be recomputed.',
        'Now pause that thread. Another thread pops A, pops B, and pushes A again. The top pointer is A again, so the paused CAS can succeed and install B as the new top even though B has already been removed. Depending on memory reuse, the result can be a lost node, a resurrected node, or a pointer into freed memory.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The bug is stale identity. In a pointer stack, A is an address. An address can be removed, freed, reused, and published again. Equal address bits do not prove equal abstract node identity or equal list structure.',
        'The repair is two-part. Compare stronger identity, and control memory lifetime. A tagged pointer compares address plus version. Hazard pointers, epochs, reference counting, RCU-style grace periods, or garbage collection keep removed nodes from being recycled while old readers may still dereference them.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A tagged stack stores top as a pair such as pointer A and version 7. Every successful push or pop that changes top increments the version. A CAS compares the whole pair, not just the address. If another thread cycles the address back to A, the pair becomes A with a later version, so the stale CAS fails.',
        'The tag does not by itself make dereferencing safe. A paused thread may still hold a pointer to a node that another thread removed. Safe reclamation prevents that node from being freed or reused until no thread can still hold the old reference. Tagged identity and reclamation solve different halves of the same failure class.',
      ],
    },
    {
      heading: 'Invariants and proof shape',
      paragraphs: [
        'The intended stack invariant is that top names the first node of a well-formed linked list and each successful pop linearizes at the CAS that moves top from the observed node to its observed successor. ABA breaks that proof because the CAS may succeed against a head value that is numerically equal but no longer represents the observed list.',
        'With a sufficiently wide tag, the linearization proof has a stronger comparison: top must still be the same pointer-version pair that the thread observed. If the pair changed, the operation retries. Reclamation adds the lifetime invariant: no node can be recycled while a concurrent operation may still read it through an old pointer.',
      ],
    },
    {
      heading: 'Costs and platform constraints',
      paragraphs: [
        'A pointer-version pair must be updated atomically. Some platforms provide a double-width CAS. Some designs use spare alignment bits or architecture-specific pointer tagging. Some avoid the pattern and choose primitives such as load-linked/store-conditional where available. The implementation is constrained by the hardware memory model and atomic width.',
        'Reclamation has its own costs. Hazard pointers require publishing protected pointers and scanning them before freeing retired nodes. Epoch reclamation is often cheaper per operation but can delay memory recovery if a thread stalls inside an old epoch. Garbage-collected runtimes reduce reuse hazards but still need the stack algorithm to be linearizable.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A narrow tag can wrap. If the pointer and tag pair repeats while an old operation is still live, ABA can return. That makes tag width a correctness parameter, not an aesthetic one. High-contention structures, small tags, and long-paused threads are a dangerous combination.',
        'A tag also does not fix memory ordering, missing reclamation, or an incorrect stack algorithm. Loads of next pointers need the right acquire and release relationships around publication. A node that has been removed cannot be freed merely because top no longer points at it; another thread may still have the old snapshot.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Tagged identity works well for Treiber stacks, freelists, generation-indexed arenas, slot maps, and handle tables. In all of those structures, a location can be reused for a different abstract object, and a generation or version number helps stale users notice that reuse.',
        'The idea is also useful pedagogically. It connects low-level atomics to linearizability: the successful CAS is only a valid linearization point if it proves that the operation is acting on the state it observed.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'A tagged pointer is not a complete lock-free design. If the platform cannot atomically compare the full pair, or if the tag space is too small for the reuse rate, the design may need a different primitive or a different structure. If memory reclamation is the main risk, hazard pointers or epochs are not optional add-ons.',
        'It is also the wrong abstraction when blocking locks are acceptable and simpler. A mutex can be the better engineering choice when contention is low, the critical section is short, and the team does not need nonblocking progress guarantees.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the ABA-failure view, follow T1 rather than T2. T1 reads top A and successor B, then pauses. T2 changes the stack while T1 is not looking. The important frame is not that A returns to the top; it is that A returns without restoring the old A -> B -> C history that made T1 plan valid.',
        'In the tagged-pointer view, compare A:v7 with A:v10. The address is the same, but the identity pair is different, so the stale CAS fails. Read the fix menu as a separation of concerns: tags detect logical cycles, while hazard pointers and epochs delay unsafe address reuse.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A memory allocator uses a lock-free freelist to recycle fixed-size nodes. Under load, one thread reads the head and pauses. Other threads pop and return nodes quickly enough that the same address appears at the head again. A raw pointer CAS can accept the stale head and corrupt the freelist.',
        'The repaired design stores head as pointer plus generation, increments the generation on every successful head update, and retires removed nodes through an epoch or hazard-pointer scheme. The CAS now proves that the head has not changed since the reader snapshot, and reclamation prevents stale readers from dereferencing freed memory.',
      ],
    },
    {
      heading: 'Broader pattern',
      paragraphs: [
        'ABA is not only a stack problem. Lock-free queues, freelists, work-stealing structures, RCU-published pointers, handle tables, and slot maps can all confuse reused storage with unchanged identity. The surface syntax changes, but the bug class is stale identity plus unsafe reuse.',
        'Generation numbers in slot maps are the friendly version of the same idea. A handle is not just an index; it is an index plus generation. If the slot is freed and reused, the old handle no longer matches the new occupant. Tagged pointers bring that discipline to concurrent pointer updates.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: Treiber stack is referenced in Rochester synchronization pseudocode at https://www.cs.rochester.edu/research/synchronization/pseudocode/duals.html and in the elimination-backoff stack paper at https://www.inf.ufsc.br/~dovicchi/pos-ed/pos/artigos/p206-hendler.pdf. Michael and Scott discuss pointer_t with count fields in their non-blocking queue paper at https://www.cs.rochester.edu/~scott/papers/1996_PODC_queues.pdf.',
        'Study Linearizability History Checker, Hazard Pointers and Epoch Reclamation, Generational Arena Slot Map, Lock-Free Queue, SharedArrayBuffer and Atomics, Nonblocking Progress Guarantees, and memory-order acquire/release rules next.',
      ],
    },
  ],
};
