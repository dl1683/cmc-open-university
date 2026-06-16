// Safe memory reclamation for lock-free data structures: hazard pointers and
// epoch-based reclamation prevent freed nodes from being reused too early.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'hazard-pointers-epoch-reclamation',
  title: 'Hazard Pointers & Epoch Reclamation',
  category: 'Data Structures',
  summary: 'The missing half of lock-free linked structures: protect nodes while readers hold raw pointers, then retire and reclaim only when reuse is safe.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['hazard pointers', 'epoch reclamation'], defaultValue: 'hazard pointers' },
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

function* hazardPointers() {
  yield {
    state: graphState({
      nodes: [
        { id: 'load', label: 'load ptr', x: 0.9, y: 2.8, note: 'node*' },
        { id: 'publish', label: 'publish HP', x: 2.8, y: 2.8, note: 'thread slot' },
        { id: 'check', label: 'recheck', x: 4.8, y: 2.8, note: 'still linked?' },
        { id: 'use', label: 'use node', x: 6.7, y: 2.8, note: 'safe read' },
        { id: 'clear', label: 'clear HP', x: 8.6, y: 2.8, note: 'done' },
      ],
      edges: [
        { id: 'e-load-publish', from: 'load', to: 'publish', weight: '' },
        { id: 'e-publish-check', from: 'publish', to: 'check', weight: '' },
        { id: 'e-check-use', from: 'check', to: 'use', weight: '' },
        { id: 'e-use-clear', from: 'use', to: 'clear', weight: '' },
      ],
    }, { title: 'A reader publishes the node it might dereference' }),
    highlight: { active: ['publish', 'check'], found: ['use'] },
    explanation: 'A hazard pointer is a public promise: this thread may dereference that node. A remover can unlink the node, but it must not free or reuse it while any hazard pointer still names it.',
  };

  yield {
    state: labelMatrix(
      'Retire list scan',
      [
        { id: 'A', label: 'node A' },
        { id: 'B', label: 'node B' },
        { id: 'C', label: 'node C' },
      ],
      [
        { id: 'retired', label: 'retired?' },
        { id: 'hazard', label: 'HP hit?' },
        { id: 'action', label: 'action' },
      ],
      [
        ['yes', 'no', 'free'],
        ['yes', 'yes', 'keep'],
        ['yes', 'no', 'free'],
      ],
    ),
    highlight: { found: ['A:action', 'C:action'], active: ['B:hazard'] },
    explanation: 'Removed nodes first go to a retire list. Periodically, a thread scans all hazard-pointer slots; retired nodes not found in that public set can be reclaimed.',
    invariant: 'Unlinked does not mean freeable.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'pop', label: 'pop A', x: 0.9, y: 2.8, note: 'unlink' },
        { id: 'free', label: 'free A', x: 2.7, y: 2.8, note: 'too soon' },
        { id: 'alloc', label: 'alloc A', x: 4.5, y: 2.8, note: 'same addr' },
        { id: 'cas', label: 'CAS sees A', x: 6.5, y: 2.8, note: 'ABA' },
        { id: 'bug', label: 'bug', x: 8.4, y: 2.8, note: 'stale ptr' },
      ],
      edges: [
        { id: 'e-pop-free', from: 'pop', to: 'free', weight: '' },
        { id: 'e-free-alloc', from: 'free', to: 'alloc', weight: '' },
        { id: 'e-alloc-cas', from: 'alloc', to: 'cas', weight: '' },
        { id: 'e-cas-bug', from: 'cas', to: 'bug', weight: '' },
      ],
    }, { title: 'Early reuse creates ABA-style failures' }),
    highlight: { active: ['free', 'alloc', 'cas'], found: ['bug'] },
    explanation: 'Safe reclamation is also an ABA defense. If an address is freed and reused while another thread still holds the old pointer, a compare-and-swap can be fooled by the same address carrying new meaning.',
  };

  yield {
    state: labelMatrix(
      'Hazard pointer tradeoffs',
      [
        { id: 'progress', label: 'progress' },
        { id: 'cost', label: 'cost' },
        { id: 'failure', label: 'failure' },
        { id: 'fit', label: 'fit' },
      ],
      [
        { id: 'property', label: 'property' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['thread-local', 'portable'],
        ['scan HPs', 'overhead'],
        ['stalled thread', 'bounded impact'],
        ['arbitrary nodes', 'precise'],
      ],
    ),
    highlight: { found: ['progress:lesson', 'failure:lesson', 'fit:lesson'] },
    explanation: 'Hazard pointers are precise and portable, but scans cost CPU. They are useful when you need to protect individual nodes and cannot rely on a runtime garbage collector.',
  };
}

function* epochReclamation() {
  yield {
    state: graphState({
      nodes: [
        { id: 'enter', label: 'pin', x: 0.9, y: 2.8, note: 'enter op' },
        { id: 'epoch', label: 'epoch', x: 2.7, y: 2.8, note: 'announce' },
        { id: 'retire', label: 'retire', x: 4.6, y: 2.8, note: 'garbage bag' },
        { id: 'advance', label: 'advance', x: 6.6, y: 2.8, note: 'all moved' },
        { id: 'free', label: 'free old', x: 8.5, y: 2.8, note: 'safe' },
      ],
      edges: [
        { id: 'e-enter-epoch', from: 'enter', to: 'epoch', weight: '' },
        { id: 'e-epoch-retire', from: 'epoch', to: 'retire', weight: '' },
        { id: 'e-retire-advance', from: 'retire', to: 'advance', weight: '' },
        { id: 'e-advance-free', from: 'advance', to: 'free', weight: '' },
      ],
    }, { title: 'Epoch reclamation waits for all active readers to move on' }),
    highlight: { active: ['epoch', 'retire', 'advance'], found: ['free'] },
    explanation: 'Epoch-based reclamation protects groups of nodes. Threads announce the current epoch while accessing the structure. Retired nodes are freed only after every active thread has passed beyond the epoch that could still reference them.',
  };

  yield {
    state: labelMatrix(
      'Three epoch bags',
      [
        { id: 'e0', label: 'epoch e' },
        { id: 'e1', label: 'e+1' },
        { id: 'e2', label: 'e+2' },
      ],
      [
        { id: 'bag', label: 'bag' },
        { id: 'state', label: 'state' },
      ],
      [
        ['oldest', 'freeable'],
        ['middle', 'waiting'],
        ['new', 'retiring'],
      ],
    ),
    highlight: { found: ['e0:state'], active: ['e2:state'] },
    explanation: 'A common model keeps garbage bags for recent epochs. When all threads have announced a sufficiently new epoch, the oldest bag can be reclaimed in bulk.',
    invariant: 'Bulk reclamation buys speed by giving up per-node precision.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'stalled reader time', min: 0, max: 100 }, y: { label: 'unreclaimed nodes', min: 0, max: 1000 } },
      series: [
        { id: 'hp', label: 'hazard pointers', points: [{ x: 0, y: 20 }, { x: 25, y: 40 }, { x: 50, y: 60 }, { x: 100, y: 80 }] },
        { id: 'ebr', label: 'epoch reclamation', points: [{ x: 0, y: 20 }, { x: 25, y: 200 }, { x: 50, y: 520 }, { x: 100, y: 950 }] },
      ],
    }),
    highlight: { active: ['ebr'], compare: ['hp'] },
    explanation: 'Epoch reclamation can be very fast when threads keep moving. A stalled or crashed participant can delay reclamation and allow retired garbage to grow.',
  };

  yield {
    state: labelMatrix(
      'Reclamation choices',
      [
        { id: 'hp', label: 'hazard ptr' },
        { id: 'ebr', label: 'epoch' },
        { id: 'rcu', label: 'RCU' },
      ],
      [
        { id: 'best', label: 'best at' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['precision', 'scan cost'],
        ['speed', 'stalls'],
        ['read-mostly', 'grace period'],
      ],
    ),
    highlight: { found: ['hp:best', 'ebr:best', 'rcu:best'] },
    explanation: 'There is no universal winner. Hazard pointers, epochs, and RCU choose different points in the precision, throughput, read-path cost, and stalled-thread tradeoff space.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'hazard pointers') yield* hazardPointers();
  else if (view === 'epoch reclamation') yield* epochReclamation();
  else throw new InputError('Pick a reclamation view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Hazard pointers and epoch-based reclamation solve the memory problem behind many lock-free data structures. Removing a node from a lock-free queue, stack, or list does not mean no thread still holds a raw pointer to it. If the node is freed and reused too early, another thread can dereference freed memory or suffer an ABA-style bug.',
        'A garbage-collected language hides much of this issue. In C, C++, Rust internals, kernels, and high-performance runtimes, memory reuse must be made explicit. Safe reclamation is the contract between the lock-free algorithm and the allocator.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Hazard pointers are precise. Before a thread dereferences a node, it publishes that pointer in a visible hazard slot and rechecks that the pointer is still valid. Removed nodes are retired, not immediately freed. A scan compares retired nodes with all published hazard pointers; only nodes absent from the hazard set can be reclaimed.',
        'Epoch reclamation is bulk-oriented. Threads pin or announce an epoch when entering an operation. Removed nodes go into bags tagged with the current epoch. When all active threads have moved beyond an epoch, old bags can be freed. This is fast, but a stalled participant can delay reclamation for everyone.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Hazard pointers spend CPU scanning hazard slots and managing retire lists, but they bound the damage from a stalled thread more precisely. Epoch reclamation can have very low overhead on the common path, but unreclaimed memory can grow if a thread pins an epoch for too long. RCU is another point in the design space, optimized for read-mostly workloads and grace periods. These costs are why memory reclamation is usually designed with the data structure, not bolted on afterward.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'Maged Michael introduced hazard pointers as a portable safe memory reclamation method for lock-free objects. Rust Crossbeam exposes epoch-based reclamation for concurrent data structures, and Linux RCU is a major production example of grace-period based reclamation for read-mostly kernel structures.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Lock-free does not mean memory-management-free. It also does not mean wait-free: a system can avoid locks and still suffer from unbounded retired garbage or slow scans. Do not hold epoch guards across blocking operations, long async awaits, or arbitrary user callbacks. Do not forget the recheck step after publishing a hazard pointer.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Hazard Pointers: Safe Memory Reclamation for Lock-Free Objects at https://dl.acm.org/doi/10.1109/TPDS.2004.8, Crossbeam epoch documentation at https://docs.rs/crossbeam-epoch, and Linux RCU documentation at https://docs.kernel.org/next/RCU/whatisRCU.html. Study ABA Tagged Pointer Stack, Nonblocking Progress Guarantees, Linearizability History Checker, Lock-Free Queue, Bw-Tree Delta Chain & Mapping Table, Stack, and Logical Clocks next.',
      ],
    },
  ],
};
