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
      heading: 'How to read the animation',
      paragraphs: [
        'In the ABA-failure view, read the top pointer as the only value that compare-and-swap can see. Compare-and-swap, or CAS, is an atomic instruction that replaces a memory value only if it still equals an expected value.',
        'The dangerous frame is when T1 expects top A while T2 has already removed A, removed B, and pushed A again. The pointer value is the same, but the stack history is not the same.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt:'Intel CPU die showing hardware compare-and-swap circuitry', caption:'Modern CPUs provide hardware CAS (CMPXCHG) instructions â€” but equal bits do not guarantee equal state. Source: Wikimedia Commons, KL/Intel, Public domain'},
        'Lock-free data structures avoid ordinary locks by letting threads retry small atomic updates. A Treiber stack is the standard example: the stack head is one pointer, and each push or pop tries to change that pointer with CAS.',
        'The problem is that CAS compares bits, not identity over time. If a memory address disappears and later returns, a paused thread can mistake a new state for the old one.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious pop algorithm reads top, reads top.next, and tries CAS(top, oldTop, next). If CAS succeeds, the operation treats that instant as its linearization point, the single moment where the concurrent operation appears to happen.',
        'That approach is not naive. It is fast, small, and correct when nodes are never reused while another thread can still hold an old pointer.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg', alt:'Linked list structure showing pointer connections between nodes', caption:'A Treiber stack is a singly-linked list modified by CAS on the head pointer. ABA corrupts this structure when a freed node reappears at the same address. Source: Wikimedia Commons, Lasindi, Public domain'},
        'The wall is reuse. A thread can read A.next = B, pause, and later see top = A again after another thread has removed A and B and reused A at the head.',
        'The stale CAS may install B as the new top even though B is no longer in the stack. That can lose nodes, resurrect removed nodes, or point into memory that has already been freed.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type:'callout', text:'The ABA bug is stale identity: a pointer can be freed, reused, and republished at the same address. A CAS sees equal bits but the underlying structure has changed. This is the fundamental failure mode of all pointer-based lock-free data structures.'},
        'The core insight is to compare identity, not only address. A tagged pointer stores a pointer plus a version number, so A at version 7 is different from A at version 10.',
        'That fixes only the logical comparison. Memory reclamation is the second half: removed nodes must not be freed or reused while another thread may still hold an old reference.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type:'callout', text:'A tagged pointer is pointer + version packed into a single atomic word. The version increments on every modification. If address A is freed and reallocated, the new version differs from the old, so stale CAS operations fail correctly.'},
        'On every push or pop, the stack head changes from one pair to another pair: for example, A:v7 to B:v8. A paused pop that expects A:v7 will fail if the head later becomes A:v10.',
        'Safe reclamation runs beside the tagged head. Hazard pointers publish which nodes a thread may read; epoch reclamation waits until all old readers leave an epoch before recycling retired nodes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that a successful pop can linearize only if the head pair is exactly the pair the thread observed. If any intervening push or pop changes the head, the version changes and the stale operation retries.',
        'Reclamation adds the lifetime invariant. A node may leave the abstract stack, but its storage cannot be reused until no concurrent reader can still dereference the old pointer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The happy-path time per push or pop is still constant, but failed CAS retries grow with contention. If 8 threads hammer one stack head, the algorithm can spend much of its time rereading the same location and losing races.',
        'The memory cost is the tag plus reclamation metadata. Hazard pointers add per-thread protected-pointer slots and scanning work; epochs reduce per-operation overhead but can hold retired nodes for a long time when one thread stalls.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt:'Process state diagram showing transitions', caption:'Lock-free algorithms manage concurrent state transitions without mutual exclusion â€” tagged pointers ensure each transition observes consistent state. Source: Wikimedia Commons, CC BY-SA 3.0'},
        'Tagged identity appears in lock-free stacks, freelists, queues, slot maps, handle tables, and generation-indexed arenas. The shared access pattern is storage reuse: an address or index can name a different object later.',
        'The same idea shows up in user-facing handles. A slot-map handle often stores index plus generation, so an old handle cannot access a new object that reused the same slot.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A small tag can wrap. If the pair cycles from A:v7 back to A:v7 while a paused operation is still live, the same failure returns.',
        'Tags also do not fix memory ordering or lifetime by themselves. A stack can compare the right pair and still be wrong if it frees a node too early or publishes node fields without the acquire-release ordering that readers expect.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with top = A:v7 and list A -> B -> C. T1 reads A:v7 and B, then pauses for 5 ms.',
        'During that pause, T2 pops A, making top = B:v8, pops B, making top = C:v9, then pushes A back, making top = A:v10. T1 resumes and tries CAS from A:v7 to B:v8; because the current head is A:v10, the CAS fails and T1 rereads instead of corrupting the stack.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Treiber stack pseudocode from Rochester synchronization pages, Michael and Scott non-blocking queue paper, and Maged Michael hazard pointers. Study linearizability next because ABA breaks the proof point for a successful CAS.',
        'Then study epoch reclamation, Read-Copy-Update, lock-free queues, SharedArrayBuffer Atomics, and generational arena slot maps. Those topics show the same split between logical identity and memory lifetime.',
      ],
    },
  ],
};