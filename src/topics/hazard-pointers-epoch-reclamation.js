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
      heading: 'Why this exists',
      paragraphs: [
        'A lock-free stack, queue, or linked list can be logically correct and still be unsafe. A successful compare-and-swap may unlink a node from the structure, but that does not prove every other thread has stopped holding a raw pointer to that node.',
        'This is the missing half of manual-memory lock-free programming. The data structure must decide when a removed node can be freed or reused. If it frees too early, a paused reader can dereference reclaimed memory. If it never frees, the structure leaks under load.',
        'Garbage-collected runtimes hide most of this problem because the collector can find live references. C, C++, kernel code, Rust internals, and many high-performance runtimes need an explicit reclamation protocol.',
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The obvious approach is to free a node immediately after the CAS that removes it. That keeps memory usage low and matches how single-threaded code often feels: once the list no longer points at the node, the node is dead.',
        'The wall is that another thread may have loaded the pointer before the CAS. That pointer can live in a register or stack frame. The allocator cannot see it. If the node is freed and the address is reused, the paused thread can read new data through an old pointer.',
        'The other obvious approach is to never free removed nodes. That avoids use-after-free, but it turns every long-running data structure into a memory leak. Safe reclamation is the contract in between: remove now, retire the node, and reclaim only after the system has evidence that no active operation can still touch it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Logical removal and physical reclamation are separate events. A node can be unreachable from the shared structure and still not be freeable. The question is not "is the node linked?" The question is "can any active operation still dereference an old pointer to it?"',
        'Hazard pointers answer with precision. Before a thread dereferences a candidate node, it publishes that exact pointer in a public slot and then rechecks that the node is still valid. Reclaimers scan those slots and keep any retired node that appears there.',
        'Epoch reclamation answers with time. Threads announce that they are inside a critical operation in the current epoch. Retired nodes are grouped by epoch and freed only after every active participant has moved beyond the epoch that could still contain old pointers.',
      ],
    },
    {
      heading: 'Mechanism: hazard pointers',
      paragraphs: [
        'A reader loads a candidate pointer, writes that pointer into its hazard slot, and then reloads or revalidates the shared link. The recheck is essential. Without it, the node could be unlinked and retired in the gap between load and publication.',
        'Once the hazard pointer is published and the recheck passes, the thread may safely dereference the node. A remover can still unlink the node from the structure, but it cannot free or reuse the node while any hazard slot names it.',
        'Removed nodes go onto a retire list. When the list reaches a threshold, the thread scans all published hazard slots, builds the protected set, and frees retired nodes that are absent from that set. Nodes that are still protected stay retired and are checked again later.',
        'Hazard pointers are precise because protection is per node. They are also expensive enough to matter: publishing needs memory-ordering discipline, and reclamation scans are proportional to the number of participating threads and hazard slots.',
      ],
    },
    {
      heading: 'Mechanism: epoch reclamation',
      paragraphs: [
        'A thread pins or enters the current epoch before operating on the structure. While pinned, it promises that it may hold pointers read during that epoch. When it finishes, it unpins or announces that it is no longer active.',
        'A remover does not free an unlinked node. It retires the node into a bag associated with the current epoch. The global epoch advances only when active participants have moved forward or become inactive.',
        'After enough epoch advancement, the oldest bags can be freed in bulk. The exact implementation varies, but the safety idea is stable: a node is reclaimed only after no active thread can still be inside the epoch where the node became retired.',
        'Epoch reclamation is fast on the common path because readers usually publish only an epoch, not each pointer. The tax is coarse protection. One stalled participant can prevent many unrelated retired nodes from being reclaimed.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the hazard-pointer view, the important transition is load, publish, recheck, use, clear. Publication alone is not enough. The recheck closes the race where a remover could unlink the node before the hazard slot became visible.',
        'The retire-list table is the reclamation decision. A retired node with no hazard hit is freeable. A retired node with a hazard hit stays alive even though it is no longer linked. That distinction is the whole technique.',
        'The ABA frame shows why early reuse is dangerous. The address can look the same to compare-and-swap while the object behind that address has changed meaning. Delayed reuse removes one major way that stale pointers become plausible again.',
        'In the epoch view, watch the unit of protection change from one pointer to one time range. The three bags and the stalled-reader plot show the tradeoff: fewer per-node checks, but more unreclaimed memory when a participant stays pinned.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Hazard pointers preserve this invariant: a node cannot be reclaimed while an active thread has publicly declared that it may dereference that node. The recheck makes the declaration meaningful because it proves the thread did not protect a node that had already slipped out from under it.',
        'Epoch reclamation preserves a different invariant: retired nodes are not reclaimed until every active operation that could have seen them has ended or moved past the relevant epoch. If pointers do not escape the pinned operation, old nodes become unreachable once that epoch is gone.',
        'Both mechanisms are about evidence. They do not make the lock-free algorithm correct by themselves. The stack or queue still needs linearizable updates. Reclamation only makes it safe to reuse memory after those updates remove nodes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a lock-free stack with head A -> B. Thread T1 reads head and gets a pointer to A, then pauses before it can finish the pop. Thread T2 pops A with CAS, so A is no longer reachable from the stack.',
        'If T2 frees A immediately, the allocator may reuse the same address for a different node. T1 resumes with a pointer value that still compares equal to the old address but no longer means the old A. That is a use-after-free risk and can create ABA-style failures.',
        'With hazard pointers, T1 publishes A before dereferencing it and T2 keeps A on the retire list while that hazard slot names A. With epoch reclamation, T1 stays pinned in the epoch where it read A, so T2 can retire A but cannot free the old epoch bag until T1 leaves.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Hazard pointers spend work on publication, memory ordering, retire lists, and scans. A scan considers roughly participating threads times hazard slots, plus the retired nodes being tested. The benefit is precision: a stalled thread protects only the nodes it published.',
        'Epoch reclamation has a cheaper read path and bulk freeing. It works well when operations are short and participants reliably leave critical sections. Its bad case is memory growth: a stalled, crashed, or blocked participant can hold back every node retired behind its epoch.',
        'RCU is a related design point, usually tuned for read-mostly systems and grace periods. Reference counting is another contrast: it gives per-object lifetime tracking but can add writes, contention, and cycles. The right answer depends on the access pattern and progress requirements.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Hazard pointers fit lock-free stacks, queues, lists, maps, and freelists when readers may hold a small number of individual node pointers and the system needs portable node-level protection.',
        'Epoch reclamation fits high-throughput structures where operations are short, threads are known participants, and pointer lifetimes are naturally bounded by the operation. It is common in concurrent libraries because the fast path can be very small.',
        'Grace-period systems such as RCU fit read-mostly workloads where readers must be extremely cheap and updates can wait for a quiescent period. The common pattern is the same separation: publish new structure, retire old structure, reclaim after readers have moved on.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'Do not use these mechanisms when a normal garbage collector or ownership model already solves the lifetime problem at the right cost. Adding manual reclamation to a managed environment can create complexity without buying safety.',
        'Do not use epoch reclamation across blocking operations, long async awaits, or arbitrary user callbacks. A pinned epoch must be short. If user code can pause forever, memory retention can become unbounded.',
        'Do not assume reclamation solves every ABA problem. Delaying address reuse removes one common source of ABA, but algorithms that allow remove-and-reinsert patterns may still need version tags, counted pointers, or stronger validation.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'For hazard pointers, the classic bug is forgetting the recheck after publication. A thread can publish a pointer that was already unlinked, then treat the publication as proof of safety. It is not proof unless the structure still makes the node reachable under the algorithm rules.',
        'Another hazard-pointer bug is clearing the slot too early or using too few slots for the number of pointers an operation may dereference. A node is protected only while the right slot contains the right address.',
        'For epoch reclamation, the classic bug is letting a pointer escape the pinned region. If code stores an old node pointer and uses it after unpinning, the epoch proof is invalid. Dead threads, forgotten guards, and blocking calls create the same failure from the other side by preventing reclamation forever.',
      ],
    },
    {
      heading: 'Primary references',
      paragraphs: [
        'Maged M. Michael, "Hazard Pointers: Safe Memory Reclamation for Lock-Free Objects": https://dl.acm.org/doi/10.1109/TPDS.2004.8.',
        'Crossbeam epoch documentation: https://docs.rs/crossbeam-epoch.',
        'Linux RCU documentation: https://docs.kernel.org/next/RCU/whatisRCU.html.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study ABA Tagged Pointer Stack next if you want the address-reuse failure in a concrete stack. Study Nonblocking Progress Guarantees to separate lock-free, wait-free, and obstruction-free claims.',
        'Study Linearizability History Checker for correctness after memory safety is handled. Study Lock-Free Queue and Bw-Tree Delta Chain and Mapping Table for larger structures that need reclamation discipline. Study Logical Clocks if the epoch idea made you want a broader model of time in concurrent systems.',
      ],
    },
  ],
};
