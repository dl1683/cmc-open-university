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
  const steps = ['load', 'publish', 'recheck', 'use', 'clear'];
  const retiredNodes = ['A', 'B', 'C'];

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
    explanation: `A hazard pointer is a public promise across ${steps.length} steps: ${steps.join(' → ')}. A remover can unlink the node, but it must not free or reuse it while any hazard pointer still names it.`,
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
    explanation: `${retiredNodes.length} removed nodes (${retiredNodes.join(', ')}) first go to a retire list. Periodically, a thread scans all hazard-pointer slots; retired nodes not found in that public set can be reclaimed.`,
    invariant: `Unlinked does not mean freeable — ${retiredNodes.filter((_, i) => i !== 1).length} of ${retiredNodes.length} nodes are freed here because no HP protects them.`,
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
    explanation: `Safe reclamation is also an ABA defense. The ${steps.length}-step protocol prevents early reuse: if an address is freed and reused while another thread still holds the old pointer, a compare-and-swap can be fooled by the same address carrying new meaning.`,
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
    explanation: `Hazard pointers are precise and portable, but scanning ${retiredNodes.length} retired nodes against all HP slots costs CPU. They are useful when you need to protect individual nodes and cannot rely on a runtime garbage collector.`,
  };
}

function* epochReclamation() {
  const epochBags = 3;
  const epochSteps = ['pin', 'epoch', 'retire', 'advance', 'free'];

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
    explanation: `Epoch-based reclamation protects groups of nodes through ${epochSteps.length} steps: ${epochSteps.join(' → ')}. Threads announce the current epoch while accessing the structure. Retired nodes are freed only after every active thread has passed beyond the epoch that could still reference them.`,
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
    explanation: `A common model keeps ${epochBags} garbage bags for recent epochs. When all threads have announced a sufficiently new epoch, the oldest of the ${epochBags} bags can be reclaimed in bulk.`,
    invariant: `Bulk reclamation across ${epochBags} epoch bags buys speed by giving up per-node precision.`,
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
    explanation: `Epoch reclamation can be very fast when threads keep moving through the ${epochSteps.length}-step protocol. A stalled or crashed participant can delay reclamation across all ${epochBags} bags and allow retired garbage to grow.`,
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
    explanation: `There is no universal winner among the ${epochBags} reclamation strategies shown. Hazard pointers, epochs, and RCU choose different points in the precision, throughput, read-path cost, and stalled-thread tradeoff space.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views selected by the dropdown. The hazard-pointer view shows a five-step reader protocol (load, publish, recheck, use, clear) followed by a retire-list scan and an ABA failure scenario. The epoch-reclamation view shows the pin-retire-advance lifecycle, three epoch bags, a stalled-reader memory plot, and a comparison table.',
        {type: "callout", text: "Safe reclamation separates logical removal from physical reuse: a removed node is not free until old readers are proven gone."},
        'Active highlights mark the node or step currently being decided. Found highlights mark outcomes already proven safe. In the retire-list table, a found marker on the action column means the node will be freed; an active marker on a hazard column means the node is still protected and must wait.',
        'Watch the ABA frame carefully. It traces what happens when free-then-reuse happens before a paused reader resumes. The bug at the end is the consequence, not the cause. The cause is that free happened while a stale pointer still existed in another thread.',
        {type: 'image', src: './assets/gifs/hazard-pointers-epoch-reclamation.gif', alt: 'Animated walkthrough of the hazard pointers epoch reclamation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A lock-free stack, queue, or linked list can be logically correct and still crash. A compare-and-swap (CAS) can atomically unlink a node from the structure, but CAS tells you nothing about who else still holds a raw pointer to that node. In languages without garbage collection -- C, C++, Rust unsafe blocks, kernel code -- freeing a node while another thread holds a pointer to it produces a use-after-free bug.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg', alt: 'Linked list nodes connected by pointers', caption: 'Lock-free stacks, queues, and lists remove linked nodes before memory can always be reused. The pointer topology and the lifetime topology are different questions. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Linked_list.svg.'},
        'This is the missing half of manual-memory lock-free programming. The data-structure algorithm decides when a node is logically removed. The reclamation protocol decides when the removed node\'s memory is physically safe to reuse. Without that second protocol, every lock-free structure either leaks memory or crashes under concurrency.',
        'Garbage-collected runtimes solve this automatically: the collector traces live references and frees only unreachable objects. But in systems without a GC -- operating-system kernels, database engines, embedded firmware, high-frequency trading systems -- you need an explicit protocol. Hazard pointers and epoch-based reclamation are the two dominant answers.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is to free the node immediately after the CAS that unlinks it. In single-threaded code this is correct: once the list no longer points to the node, nobody can reach it. Teams reach for this approach because it keeps memory usage minimal and matches the mental model from sequential programming.',
        'The second instinct, once the first crashes, is reference counting. Attach an atomic counter to each node, increment on access, decrement on release, and free when the counter hits zero. This works for some structures but adds a write to every read path, creates contention on the counter cache line, and cannot handle cycles without a supplementary collector.',
        'A third common attempt is to never free removed nodes at all. This eliminates use-after-free but turns every long-running data structure into a memory leak. Under sustained load, the process eventually exhausts memory. Safe reclamation is the contract that sits between these extremes: remove the node from the structure now, defer physical reclamation, and free only after the system has proof that no active operation can still dereference it.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is invisible pointers. When thread T1 loads a pointer to node A and then gets preempted, that pointer lives in a CPU register or on T1\'s stack. The allocator has no visibility into registers. The data structure has no list of who read what. The operating system scheduler does not notify your code before preempting a thread.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Intel i7 processor die photograph', caption: 'Compare-and-swap is a hardware-level state transition, but it cannot reveal pointer history or paused readers by itself. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:KL_Intel_i7_die.jpg.'},
        'If another thread frees node A and the allocator hands the same address to a new allocation, T1 wakes up holding a pointer to memory that now belongs to a different object. A CAS comparing the old pointer will succeed because the bit pattern matches, but the semantic meaning is gone. This is the ABA problem: same Address, different object, Bogus Acceptance.',
        'No amount of CAS cleverness inside the data structure can fix this. The structure needs an external protocol that tracks which threads might still hold old pointers and delays reclamation until those threads are provably done. That protocol is what hazard pointers and epoch reclamation provide.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Logical removal and physical reclamation are separate events that must never be conflated. A node can be unreachable from the shared structure and still not be freeable. The correct question is not "is the node linked?" It is "can any active operation still dereference a previously loaded pointer to this node?"',
        'Hazard pointers answer that question with per-pointer precision. Before a thread dereferences a node, it writes that node\'s address into a public slot visible to all threads, then rechecks that the node is still reachable from the structure. Reclaimers scan all hazard slots before freeing; any retired node whose address appears in a slot survives.',
        'Epoch reclamation answers with temporal boundaries. Each thread announces which epoch it is operating in. Retired nodes are tagged with the epoch in which they were removed. The system frees a batch of retired nodes only after every active thread has advanced past that epoch, proving that no thread can still hold pointers from that era.',
        'Both approaches convert an invisible question (who holds old pointers?) into a visible one (what did threads publish?). The difference is granularity: hazard pointers track individual addresses; epochs track time intervals.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Hazard pointers follow a five-step reader protocol: load, publish, recheck, use, clear. The reader loads a candidate pointer from the shared structure. It then writes that pointer into its hazard slot -- a per-thread public memory location. Before using the pointer, it reloads the shared link to verify the node is still there. If the recheck fails (the node was unlinked between load and publish), the reader restarts. If it passes, the reader dereferences freely. After the operation, it clears the slot.',
        'The recheck is the step that makes publication meaningful. Without it, a thread could publish a pointer to a node that was already unlinked and retired in the gap between load and publication. The three-step sequence (load, publish, recheck) closes that race window.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt: 'Process state diagram showing transitions among execution states', caption: 'Epoch reclamation is a state protocol: active participants delay freeing, inactive or advanced participants let old bags become reclaimable. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Process_states.svg.'},
        'On the remover side, an unlinked node goes onto a per-thread retire list instead of being freed. When the retire list reaches a threshold (commonly 2 * threads * hazard-slots-per-thread), the thread scans every published hazard slot, collects the protected set, and frees any retired node not in that set. Protected nodes stay on the retire list for the next scan.',
        'Epoch reclamation works differently. A thread pins itself to the current global epoch before touching the structure. While pinned, it may hold pointers from that epoch. Unlinked nodes go into a garbage bag tagged with the current epoch. The global epoch advances only when every active thread has moved forward or unpinned. Once the epoch advances far enough (typically two increments past a bag\'s epoch), that bag\'s contents are freed in bulk.',
        'The epoch approach is faster on the common path because each reader publishes only one epoch number, not every individual pointer. But the protection is coarse: if one thread stays pinned in an old epoch, every bag from that epoch onward is held back, regardless of which nodes that thread actually accessed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Hazard pointers maintain a precise invariant: a node cannot be reclaimed while any thread\'s hazard slot contains its address. The recheck ensures the publication is not stale -- the thread proved the structure still contained the node after the slot was written. Any reclaimer that runs after this point will see the slot and skip the node.',
        'Epoch reclamation maintains a temporal invariant: retired nodes from epoch E are not freed until every thread that was active during epoch E has either left or advanced past E. If pointers do not escape the pinned critical section (the code between pin and unpin), then once a thread unpins, it cannot hold any pointer from that epoch. When all threads have advanced, the proof is complete.',
        'Both invariants depend on cooperation. Every thread must follow the protocol honestly: publish before dereference, clear after use, pin before access, unpin after completion. A thread that skips publication or holds pointers past its unpin violates the contract and introduces undefined behavior. The lock-free algorithm itself must still be correct (linearizable updates, proper CAS logic). Reclamation only adds the guarantee that memory reuse is safe after correct removal.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Hazard-pointer publication requires a store with release semantics and the recheck requires an acquire load. On x86 this is relatively cheap (stores are release by default), but on ARM or RISC-V the memory barriers are real instructions. Each reclamation scan is O(T * H + R) where T is the number of threads, H is hazard slots per thread, and R is the retire-list length. With 64 threads and 2 slots each, scanning 128 slots against hundreds of retired nodes is nontrivial.',
        'Epoch reclamation\'s read-side cost is typically one atomic increment (pin) and one atomic decrement (unpin) per operation, plus a check of the global epoch. Reclamation is amortized: when the epoch advances, an entire bag is freed in one pass. The worst-case memory footprint is (number of retired nodes) * (epochs held back), which can grow without bound if a thread stalls.',
        'Concrete numbers: in a lock-free queue with 16 threads doing 10 million operations per second, hazard pointers might hold back at most 16 * 2 = 32 nodes per scan (bounded). Epoch reclamation under the same load could hold back zero nodes if all threads are fast, or millions if one thread blocks for a second. The choice depends on whether you need bounded memory or maximum throughput.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Hazard pointers are used in Facebook/Meta\'s Folly library for lock-free hash maps, queues, and freelists. They are specified in the C++ standard proposal P2530 and implemented in libcds (Concurrent Data Structures). They fit any structure where a reader holds a small, fixed number of node pointers and needs portable, bounded-memory protection.',
        'Epoch reclamation powers Rust\'s crossbeam-epoch crate, which underlies many concurrent data structures in the Rust ecosystem including concurrent skip lists and lock-free deques. Java\'s ConcurrentHashMap uses a related approach where GC acts as the reclaimer. Sled, an embedded database in Rust, used epoch-based reclamation for its lock-free B-tree.',
        'Linux kernel RCU (Read-Copy-Update) is the most deployed grace-period reclamation system. It protects read-mostly kernel data structures (routing tables, module lists, security policies) where readers must pay near-zero cost and writers can afford to wait a grace period. The kernel guarantees quiescent states through context switches, making the read path literally a single instruction on some architectures.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not use these mechanisms when a garbage collector or ownership model already solves the lifetime problem. Adding manual reclamation to a managed environment creates complexity without buying safety. In Rust safe code, the borrow checker already prevents use-after-free; reclamation protocols are needed only inside unsafe blocks that implement lock-free structures.',
        'Do not use epoch reclamation across blocking operations, long async awaits, or arbitrary user callbacks. A pinned epoch must represent a short critical section. If user code can pause indefinitely while pinned, memory retention grows without bound. Crossbeam mitigates this with a \'Collector::flush\' mechanism, but the fundamental limitation remains: epoch reclamation assumes short operations.',
        'For hazard pointers, the classic implementation bug is forgetting the recheck after publication. A thread publishes a pointer that was already unlinked, then treats the publication as proof of safety. Without the recheck, the hazard slot protects a node that was never validated, and reclamation can free it out from under the reader.',
        'Another hazard-pointer bug is clearing the slot too early or allocating too few slots for the operation\'s needs. If a traversal holds two node pointers simultaneously (current and next), it needs two hazard slots. Using one slot means the unprotected pointer can be reclaimed mid-traversal. For epoch reclamation, the corresponding bug is letting a pointer escape the pinned region -- storing an old pointer and using it after unpinning invalidates the epoch proof entirely.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a lock-free stack with head -> A -> B -> null. Thread T1 wants to pop: it reads head and gets pointer 0xA000 (node A). Before T1 can execute its CAS, the OS preempts it. Thread T2 runs, pops A with a successful CAS (head now points to B), and pops B. The stack is empty. T2 then pushes a new node C. The allocator happens to give C the address 0xA000 -- the same address A had.',
        'T1 resumes. It executes CAS(&head, 0xA000, B). The head is 0xA000 (node C), which matches T1\'s expected value. CAS succeeds. But T1 just set head to B, which was already popped and freed. The stack now points into reclaimed memory. This is the ABA problem: the address matches but the identity does not.',
        'With hazard pointers: T1 publishes 0xA000 in its hazard slot before the CAS. T2 pops A and puts it on the retire list. When T2 scans hazard slots, it finds 0xA000 and does not free A. The allocator never recycles the address, so the ABA scenario cannot arise. When T1 finishes and clears its slot, the next scan frees A safely.',
        'With epoch reclamation: T1 pins in epoch 5 before reading head. T2 also pins in epoch 5, pops A and B, and retires both into epoch 5\'s bag. T2 unpins. But T1 is still pinned in epoch 5, so the global epoch cannot advance past 5. Epoch 5\'s bag cannot be freed. The allocator never gets A\'s memory back, so 0xA000 cannot be reused. When T1 unpins, the epoch eventually advances, and the bag is freed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational paper is Maged M. Michael, "Hazard Pointers: Safe Memory Reclamation for Lock-Free Objects," IEEE Transactions on Parallel and Distributed Systems, 2004 (https://dl.acm.org/doi/10.1109/TPDS.2004.8). For epoch reclamation, see Keir Fraser\'s 2004 PhD thesis "Practical Lock-Freedom" from the University of Cambridge, which formalized epoch-based approaches.',
        'For implementations, the crossbeam-epoch crate documentation (https://docs.rs/crossbeam-epoch) is the clearest modern reference. The Linux kernel RCU documentation (https://docs.kernel.org/next/RCU/whatisRCU.html) covers grace-period reclamation in production at massive scale. The C++ proposal P2530 specifies hazard pointers for the standard library.',
        'Study ABA Tagged Pointer Stack next to see the address-reuse failure in a concrete stack. Study Nonblocking Progress Guarantees to distinguish lock-free, wait-free, and obstruction-free claims. Study Lock-Free Queue and Bw-Tree for larger structures that need reclamation discipline. Study Logical Clocks if the epoch concept made you want a broader model of time in concurrent systems.',
      ],
    },
  ],
};
