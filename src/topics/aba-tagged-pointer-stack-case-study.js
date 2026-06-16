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
      heading: 'What it is',
      paragraphs: [
        'The ABA problem happens when a compare-and-swap operation observes value A, another thread changes the value to B and then back to A, and the first thread incorrectly assumes nothing changed. In pointer-based lock-free structures, A is often an address that has been removed, freed, and reused.',
        'Treiber-style stacks are the canonical teaching example. The stack top is manipulated by CAS. If top cycles back to the same address while a paused thread still holds an old snapshot, a CAS can succeed with a stale next pointer.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'T1 reads top = A and A.next = B, planning to pop A by CAS(top, A, B). T1 pauses. T2 pops A, pops B, and pushes A again. Now top is A, but B is no longer the correct next node. T1 resumes and CAS sees A, so it can install B as top and corrupt the stack.',
        'The typical repair is to compare a stronger identity: pointer plus version tag. T1 reads A:v7. T2 operations advance the tag to A:v10. T1 CAS expects A:v7 and fails. Safe memory reclamation also matters because delaying address reuse prevents stale pointers from becoming valid-looking new objects.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A lock-free free-list allocator reuses nodes aggressively. Under load, one thread pauses after reading a head node and its successor. Another thread removes both nodes, recycles the first address for a different object, and pushes it back. The paused thread resumes and links the old successor into the list. A tagged head pointer catches the intervening modifications; hazard pointers or epochs prevent the old address from being reused while it is still hazardous.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: Treiber stack is referenced in Rochester synchronization pseudocode at https://www.cs.rochester.edu/research/synchronization/pseudocode/duals.html and in the elimination-backoff stack paper at https://www.inf.ufsc.br/~dovicchi/pos-ed/pos/artigos/p206-hendler.pdf. Michael and Scott discuss pointer_t with count fields in their non-blocking queue paper: https://www.cs.rochester.edu/~scott/papers/1996_PODC_queues.pdf. Study Linearizability History Checker, Hazard Pointers & Epoch Reclamation, Generational Arena Slot Map, Lock-Free Queue, SharedArrayBuffer & Atomics, and Nonblocking Progress Guarantees next.',
      ],
    },
  ],
};
