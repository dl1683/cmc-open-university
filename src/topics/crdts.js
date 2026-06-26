// CRDTs: data structures that merge themselves. Give every replica its own
// slot, make merge an elementwise max, and concurrent edits converge without
// coordination — the math that runs collaborative editors and offline apps.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'crdts',
  title: 'CRDTs: Conflict-Free Replicated Data Types',
  category: 'Systems',
  summary: 'Counters and sets that replicas can edit concurrently and merge in any order — convergence by algebra, not by coordination.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['counters that merge', 'sets, registers & the laws'], defaultValue: 'counters that merge' },
  ],
  run,
};

// A G-counter, actually implemented: one slot per replica, increment your
// own slot only, merge = elementwise max, value = sum of slots.
const REPLICAS = ['A', 'B', 'C'];
const inc = (vec, who) => vec.map((v, i) => (i === REPLICAS.indexOf(who) ? v + 1 : v));
const merge = (a, b) => a.map((v, i) => Math.max(v, b[i]));
const value = (vec) => vec.reduce((s, v) => s + v, 0);

// The partition scenario, computed live: 6 likes land while A | B | C
// cannot talk. A gets 2, B gets 1, C gets 3.
let SA = [0, 0, 0];
let SB = [0, 0, 0];
let SC = [0, 0, 0];
SA = inc(inc(SA, 'A'), 'A');
SB = inc(SB, 'B');
SC = inc(inc(inc(SC, 'C'), 'C'), 'C');
const AB = merge(SA, SB);
const BA = merge(SB, SA);
const FULL = merge(AB, SC);
const COMMUTES = JSON.stringify(AB) === JSON.stringify(BA);
const IDEMPOTENT = JSON.stringify(merge(FULL, SB)) === JSON.stringify(FULL);

const counterMatrix = (title, rows) => matrixState({
  title,
  rows: rows.map(([id, label]) => ({ id, label })),
  columns: [
    { id: 'sa', label: 'slot A' },
    { id: 'sb', label: 'slot B' },
    { id: 'sc', label: 'slot C' },
    { id: 'val', label: 'value' },
  ],
  values: rows.map(([, , vec]) => [...vec, value(vec)]),
});

function* countersThatMerge() {
  yield {
    state: matrixState({
      title: 'A like-counter, replicated naively: one integer per replica',
      rows: [
        { id: 'a', label: 'replica A (count = 2)' },
        { id: 'b', label: 'replica B (count = 1)' },
        { id: 'fix', label: 'reconcile: max? overwrite? add?' },
      ],
      columns: [{ id: 'out', label: 'what reconciliation yields' }],
      values: [[1], [2], [3]],
      format: (v) => ['', '2 likes arrived here during the partition', '1 like arrived here — concurrently', 'max → 2 (lost a like) · overwrite → 1 or 2 (lost likes) · add → 3 now, 6 after the next sync (double-count)'][v],
    }),
    highlight: { removed: ['fix:out'] },
    explanation: 'Start with the broken design. A single replicated integer does not remember which replica contributed which likes. Max loses updates, overwrite loses updates, and add double-counts when gossip retries. The problem is not the merge code; the state shape lacks the history needed to merge safely.',
    invariant: 'A merged state must lose no update and count none twice — a bare integer cannot satisfy both.',
  };

  yield {
    state: counterMatrix('G-counter: one slot per replica, increment YOUR slot only', [
      ['a', 'replica A (+2 locally)', SA],
      ['b', 'replica B (+1 locally)', SB],
      ['c', 'replica C (+3 locally)', SC],
    ]),
    highlight: { active: ['a:sa', 'b:sb', 'c:sc'] },
    explanation: 'The G-counter fixes the shape: one monotone slot per replica, and a replica only increments its own slot. The value is the sum of slots. Concurrent increments no longer collide because they occupy different coordinates, just like version vectors separate causal histories by actor.',
    invariant: 'Each replica writes only its own slot: concurrent increments occupy disjoint coordinates and cannot conflict.',
  };

  yield {
    state: counterMatrix('Merge = elementwise max, in both orders', [
      ['ab', 'merge(A, B)', AB],
      ['ba', 'merge(B, A)', BA],
      ['full', 'merge(that, C)', FULL],
    ]),
    highlight: { found: ['full:val'], compare: ['ab:sa', 'ba:sa'] },
    explanation: `Merge is elementwise max. That keeps every replica\'s highest known contribution, so it neither drops a slot nor counts it twice. The live values show merge(A, B) = [${AB.join(', ')}] and merge(B, A) = [${BA.join(', ')}] - ${COMMUTES ? 'identical' : 'DIFFERENT'}. Folding in C gives [${FULL.join(', ')}], value ${value(FULL)}. Replaying B again changes nothing: ${IDEMPOTENT}.`,
    invariant: 'merge = elementwise max: commutative, associative, idempotent — any delivery order, any duplication, same result.',
  };

  yield {
    state: matrixState({
      title: 'PN-counter: subtraction without breaking the algebra',
      rows: [
        { id: 'p', label: 'P vector (increments)' },
        { id: 'n', label: 'N vector (decrements)' },
        { id: 'v', label: 'value = sum(P) − sum(N)' },
      ],
      columns: [{ id: 'out', label: 'state' }],
      values: [[1], [2], [3]],
      format: (v) => ['', '[2, 1, 3] — the six likes', '[0, 1, 0] — B\'s user un-liked once', '6 − 1 = 5'][v],
    }),
    highlight: { active: ['v:out'] },
    explanation: 'A decrement would shrink a slot, which breaks max-merge. The PN-counter keeps the algebra by splitting state into two grow-only counters: P for increments and N for decrements. Merge still uses max on both halves; subtraction happens only when reading the value.',
    invariant: 'PN-counter = two G-counters: every stored component still only grows; subtraction exists only in the read.',
  };
}

function* setsAndLaws() {
  yield {
    state: matrixState({
      title: 'LWW-register: last-writer-wins is a CRDT — a brutal one',
      rows: [
        { id: 'w1', label: 'replica A writes "Anna K." @ ts 1001' },
        { id: 'w2', label: 'replica B writes "Anna Q." @ ts 1003' },
        { id: 'merged', label: 'merge: keep the larger timestamp' },
      ],
      columns: [{ id: 'out', label: 'register value' }],
      values: [[1], [2], [3]],
      format: (v) => ['', '"Anna K." — the careful correction', '"Anna Q." — a typo, but the clock was 80ms fast', '"Anna Q." wins; the correction is silently gone'][v],
    }),
    highlight: { removed: ['merged:out'] },
    explanation: 'Last-writer-wins is a legal CRDT because replicas converge on the larger timestamp. It is also a dangerous one because convergence is achieved by discarding another value. Use it for fields where any winner is acceptable, not for human corrections, money, inventory, or anything where concurrent intent matters.',
    invariant: 'A CRDT guarantees replicas AGREE — it does not guarantee they agree on the value you wanted.',
  };

  yield {
    state: matrixState({
      title: 'OR-set: every add gets a unique tag; remove deletes only OBSERVED tags',
      rows: [
        { id: 'add1', label: 'A: add("milk")' },
        { id: 'rm', label: 'B: remove("milk") — concurrently' },
        { id: 'add2', label: 'A: add("milk") again — concurrently' },
        { id: 'merged', label: 'merged set' },
      ],
      columns: [{ id: 'tags', label: 'tags alive' }, { id: 'in', label: 'in set?' }],
      values: [[1, 2], [3, 4], [5, 6], [7, 8]],
      format: (v) => ['', '{milk·a1}', 'yes', 'tombstones {milk·a1}', 'removed what it SAW', '{milk·a7} — fresh tag', 'yes', '{milk·a7} survives; a1 is tombstoned', 'YES — add wins'][v],
    }),
    highlight: { found: ['merged:in'], removed: ['rm:in'] },
    explanation: 'The OR-set resolves add/remove races with tags. Every add creates a unique tag; remove tombstones only tags it has actually seen. In the table, B removes tag a1, but A\'s concurrent fresh tag a7 survives. This is why observed-remove sets fit carts and tag lists better than clock-based overwrites.',
    invariant: 'Remove affects only observed tags: a concurrent add\'s fresh tag survives every merge — add wins.',
  };

  yield {
    state: matrixState({
      title: 'Why these three laws and no others',
      rows: [
        { id: 'comm', label: 'commutative: m(a,b) = m(b,a)' },
        { id: 'assoc', label: 'associative: m(m(a,b),c) = m(a,m(b,c))' },
        { id: 'idem', label: 'idempotent: m(a,a) = a' },
      ],
      columns: [{ id: 'kills', label: 'the network failure it absorbs' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'messages arriving in different orders at different replicas', 'replicas syncing through different intermediaries / topologies', 'retries and gossip re-delivering the same state twice'][v],
    }),
    highlight: { active: ['comm:kills', 'assoc:kills', 'idem:kills'] },
    explanation: 'The laws match network failures. Commutativity absorbs message reordering, associativity absorbs different sync paths, and idempotence absorbs retries. A CRDT state forms a join semilattice: merge computes the least state that includes both histories.',
    invariant: 'Join semilattice + monotonic updates ⇒ strong eventual consistency: same updates seen, same state reached — guaranteed.',
  };

  yield {
    state: matrixState({
      title: 'The CRDT toolbox in production',
      rows: [
        { id: 'gc', label: 'G-counter / PN-counter' },
        { id: 'lww', label: 'LWW-register' },
        { id: 'orset', label: 'OR-set' },
        { id: 'seq', label: 'sequence CRDTs (RGA, Yjs, Automerge)' },
        { id: 'when', label: 'when NOT to use CRDTs' },
      ],
      columns: [{ id: 'where', label: 'where it runs' }],
      values: [[1], [2], [3], [4], [5]],
      format: (v) => ['', 'like/view counters; Phoenix presence counts', 'Cassandra & DynamoDB cell values — agreement over fidelity', 'Riak data types; collaborative tag lists; carts', 'Figma multiplayer, Apple Notes sync, Zed editor — concurrent text editing', 'invariants that must hold globally (unique usernames, account balances ≥ 0) — those need consensus, see Raft Leader Election'][v],
    }),
    highlight: { active: ['seq:where'], removed: ['when:where'] },
    explanation: 'The toolbox row is a practical picker. Counters, registers, sets, and sequence CRDTs all buy coordination-free convergence for different shapes of data. The final row is the boundary: CRDTs make replicas agree eventually, but uniqueness, account balances, and other global invariants need coordination or reservations.',
    invariant: 'CRDTs solve agreement-on-state without coordination; invariants that constrain ALL replicas at once still require consensus.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'counters that merge') yield* countersThatMerge();
  else if (view === 'sets, registers & the laws') yield* setsAndLaws();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "counters that merge" view opens with a broken design: a bare replicated integer that every merge strategy ruins. Watch max lose an increment, sum double-count on retry, and overwrite drop one side. Then the G-counter reshapes state into one slot per replica, and elementwise max becomes a safe merge. Active markers show which replica owns which slot. The key thing to track: every stored component only grows, so no delivery order can undo progress.',
        {
          type: 'callout',
          text: 'CRDTs move conflict resolution into the data type so replicas can merge by law instead of by coordination.',
        },
        'The "sets, registers & the laws" view contrasts three CRDT families. The LWW-register converges by discarding a concurrent value -- watch the red marker on the merge row. The OR-set converges by tagging adds and tombstoning only observed tags -- the green "found" marker shows the surviving fresh tag. The laws table maps each algebraic property to the network failure it absorbs. Read each row as a contract: if this law holds, that class of failure becomes harmless.',
        {type: 'image', src: './assets/gifs/crdts.gif', alt: 'Animated walkthrough of the crdts visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'When you replicate data across machines -- for availability, lower latency, or offline access -- you create a coordination problem. Two replicas may accept writes at the same time, and the system must reconcile those writes later. The traditional fix is a leader: route every write through one node that serializes operations, so conflicts never arise. That works until the leader is unreachable. During a network partition the system must choose between rejecting writes (losing availability) or accepting them on multiple nodes (risking inconsistency).',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Vector_Clock.svg/500px-Vector_Clock.svg.png',
          alt: 'Vector clock diagram with causal past, causal future, and independent events',
          caption: 'Vector clocks show why replicated data needs causal structure, not only wall-clock time. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Vector_Clock.svg/500px-Vector_Clock.svg.png',
        },
        'CRDTs eliminate this choice for a certain class of data. Instead of coordinating at write time, they embed the merge rule into the data type itself. Shapiro, Preguica, Baquero, and Zawirski formalized this in their 2011 INRIA report "Conflict-Free Replicated Data Types." Their insight: if a replicated data type\'s merge function satisfies certain algebraic properties, every replica will converge to the same state once it has seen the same updates -- regardless of delivery order, message duplication, or network topology. No leader, no lock, no round-trip.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is last-writer-wins (LWW): attach a timestamp to each write and keep whichever value has the larger timestamp. This is trivial to implement and it does produce agreement -- all replicas end up with the same value. The problem is how it gets there. Agreement is achieved by silently discarding one concurrent update. Under clock skew the "last" writer may be the one whose machine ran 80ms fast, not the one whose edit was more recent or more careful. For a display-name field where any value is acceptable, LWW is fine. For a counter, a shopping cart, or a shared document, silently dropping a concurrent edit is data loss.',
        'The second attempt is central coordination: route every write through a single leader that serializes all operations. This prevents conflicts entirely, giving a clean total order. But it fails offline, it adds latency proportional to the round-trip to the leader, and during network partitions the system must either refuse writes or risk split-brain. CRDTs occupy the space where local writes, offline progress, and partition tolerance matter more than having a total order on every operation.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the merge function. Consider a like counter replicated on two nodes. During a partition, replica A receives 2 likes (count = 2) and replica B receives 1 like (count = 1). When the partition heals, the system must reconcile. Taking the max yields 2 -- B\'s like is lost. Taking the sum yields 3 -- correct this one time, but the next gossip round re-delivers B\'s state and sum becomes 4, a double-count. Overwriting picks whichever arrived last -- one side is discarded. A bare integer does not record who contributed which increment, so no merge strategy can be both complete and safe.',
        'The same wall appears in sets. Replica A adds "milk" to a shopping list. Replica B, which already saw "milk," concurrently removes it. When the replicas sync, was "milk" added or removed? Without tracking which specific add operation the remove was responding to, the outcome depends on arrival order -- effectively random. The fundamental problem in both cases is identical: the data structure does not carry enough history to resolve concurrent operations deterministically.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Shapiro et al. identified two equivalent families. A state-based CRDT (CvRDT) ships its full state to other replicas and merges with a function that is commutative (merge(a, b) = merge(b, a)), associative (merge(merge(a, b), c) = merge(a, merge(b, c))), and idempotent (merge(a, a) = a). These three properties make the merge a "join" operation on a mathematical structure called a join-semilattice: a partially ordered set where every pair of elements has a unique least upper bound. That least upper bound is the merged state. Because it is unique, all replicas that have seen the same updates land on the same result, no matter what order they merged in.',
        'An operation-based CRDT (CmRDT) ships operations instead of full state. The delivery layer must guarantee causal order (operations from the same source arrive in source order), but concurrent operations must commute. The two families are equivalent in expressiveness -- any CvRDT can be rewritten as a CmRDT and vice versa -- though they differ in bandwidth (state-based sends entire state; operation-based sends only the operation) and in what the network must guarantee.',
        'The practical recipe is always the same: if a naive operation would break merge safety, store more structure until the merge becomes safe. A counter becomes a vector (one slot per replica). A set becomes a tagged set with tombstones. A register becomes a timestamped pair. The extra metadata is the price you pay for coordination-free convergence.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'G-Counter (grow-only counter): assign one slot per replica in a vector. Replica i increments only slot i. The visible value is the sum of all slots. Merge takes the componentwise maximum: merged[i] = max(a[i], b[i]). Because each slot is monotonically nondecreasing and only one replica writes to each slot, concurrent increments land in disjoint coordinates and survive every merge. With 3 replicas and states A = [2, 0, 0], B = [0, 1, 0], C = [0, 0, 3], merge(A, B) = [2, 1, 0], then merge that with C = [2, 1, 3], value = 6. All six increments preserved.',
        'PN-Counter (positive-negative counter): supports decrements by keeping two G-Counters, P for increments and N for decrements. Each half merges independently with componentwise max. The displayed value is sum(P) minus sum(N). Subtraction never touches the stored vectors -- it exists only when you read the value. Every stored component still grows monotonically, so the semilattice property holds for both halves.',
        'LWW-Register (last-writer-wins register): stores a value paired with a timestamp. Merge keeps whichever pair has the larger timestamp. This is a valid CRDT because max-timestamp is commutative, associative, and idempotent. It converges, but it converges by discarding the concurrent value with the smaller timestamp. Safe for fields where any single winner is acceptable. Dangerous for fields where concurrent intent matters.',
        'OR-Set (observed-remove set): every add operation gets a globally unique tag. Remove does not delete the element -- it tombstones only the tags it has observed. A concurrent add on another replica creates a fresh tag that the remove never saw, so the fresh tag survives merge. Result: add-wins semantics. If any replica adds an element concurrently with a remove, the element stays in the merged set.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Convergence is a theorem. For state-based CRDTs, the argument is: the set of possible states forms a join-semilattice under the merge function, and every local mutation moves the state upward in the partial order (monotonicity). After any two replicas exchange state and merge, both reach the same least upper bound. Each of the three laws absorbs a specific class of network misbehavior. Commutativity absorbs message reordering (A syncs before B or B before A -- same result). Associativity absorbs different sync topologies (A syncs with B then C, or with C then B -- same result). Idempotence absorbs duplicate delivery from gossip retries.',
        'For operation-based CRDTs, the proof requires that the delivery layer preserves causal order and that concurrent operations commute. Given those guarantees, every replica applies the same set of operations in a compatible order and arrives at the same state. Causal delivery is a stronger requirement than what state-based CRDTs need, but operation-based CRDTs use less bandwidth because only the operation travels, not the full state.',
        'The resulting guarantee is called Strong Eventual Consistency (SEC): any two replicas that have received the same set of updates are in the same state, immediately, with no rollbacks and no conflict-resolution step. This is strictly stronger than eventual consistency, which only promises convergence "eventually" without specifying when or how.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'G-Counter metadata is O(n) where n is the number of replicas: one integer slot per replica per counter. For 5 server replicas, each counter is a 5-element vector -- negligible. For a mobile app where every device is a "replica," n could be millions. At that scale you need hierarchical counters (aggregate at a datacenter, fan-in per-device counters) or replica-ID compaction. PN-Counters double the per-counter cost (two n-element vectors) but the scaling concern is the same.',
        'OR-Set metadata can grow without bound. Every add creates a tag, every remove creates a tombstone, and without garbage collection the tombstone set grows forever. Safe compaction requires causal stability: knowing that all replicas have seen the tombstoned tags, so those tombstones can be safely discarded. Proving causal stability requires version vectors or similar causal metadata -- which reintroduces a form of coordination at the compaction layer. This is why production CRDT systems always have a compaction protocol alongside the CRDT itself.',
        'State-based sync bandwidth is proportional to state size: the entire vector ships on every exchange. Delta-state CRDTs (Almeida, Shoker, Baquero, 2018) reduce this by shipping only the state that changed since the last sync, while preserving the semilattice merge contract. Operation-based CRDTs ship only the operation, but they require reliable causal broadcast, which has its own overhead in message buffering and ordering guarantees.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Riak KV was the first major database to ship built-in CRDT data types: counters, sets, registers, maps, and flags. Its implementation follows the Shapiro et al. specifications directly, using dotted version vectors for accurate causal tracking and tombstone compaction. Redis Enterprise Active-Active uses CRDTs to replicate data across geographically distributed clusters, with CRDT merge semantics for counters, sets, sorted sets, strings, and streams. Each cluster accepts writes locally; merge rules reconcile conflicts automatically across regions.',
        'Yjs and Automerge are the two dominant open-source CRDT libraries for collaborative text editing. Yjs uses a sequence CRDT based on YATA (Yet Another Transformation Approach) with unique position identifiers for concurrent insertions. Automerge uses a similar operation-based backend. Both power real-time editors: Yjs underlies collaborative features in ProseMirror, Tiptap, and BlockSuite; Automerge powers local-first applications that sync peer-to-peer without a central server.',
        'Figma built a custom CRDT for multiplayer canvas editing. Apple Notes uses CRDTs for cross-device sync. Phoenix Presence (Elixir) uses a CRDT presence tracker for real-time user lists. The pattern appears wherever a system needs local writes, partition tolerance, and eventual convergence without a coordination bottleneck.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'CRDTs guarantee replicas agree on state. They do not guarantee the agreed state satisfies a global invariant. Two users cannot both reserve the last airline seat, but two CRDT replicas will happily accept both reservations locally. Unique usernames, nonnegative account balances, inventory caps, and quota limits all require coordination, escrow, or partitioned authority -- CRDTs are the wrong tool for those problems.',
        'Unbounded metadata is the second failure mode. Tombstones, operation logs, and position identifiers grow forever without compaction. Compaction requires proving that all relevant replicas have observed the evidence being garbage-collected, which reintroduces coordination. Every production CRDT deployment must design a compaction protocol, and that protocol is often harder to get right than the CRDT itself.',
        'Semantic surprise is the third. An OR-set with add-wins semantics may keep an item a user thought they removed, because a concurrent add on another replica created a fresh tag the remove never saw. An LWW-register may discard a careful correction in favor of a typo from a replica whose clock ran fast. The merge rule is mathematically correct, but it may not match what the user intended. Product design must account for the actual merge semantics the CRDT provides, not the semantics the user imagines.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Setup: replicas A and B track a like counter using a G-Counter with two slots. Both start at [0, 0]. A network partition separates them. During the partition, A receives 2 likes and increments its own slot twice: A\'s state becomes [2, 0]. B receives 1 like and increments its own slot: B\'s state becomes [0, 1]. Neither has seen the other\'s updates.',
        'Merge: connectivity returns. A sends [2, 0] to B. B sends [0, 1] to A. Both compute merge([2, 0], [0, 1]) = [max(2, 0), max(0, 1)] = [2, 1]. Displayed value: 2 + 1 = 3. All three likes are preserved. No coordination was needed -- the vector shape made the merge deterministic.',
        'Idempotence: suppose B\'s message is delivered to A a second time (a gossip retry). A computes merge([2, 1], [0, 1]) = [max(2, 0), max(1, 1)] = [2, 1]. State unchanged. The retry was absorbed. Now suppose a third replica C starts at [0, 0], receives B\'s state first, then A\'s. C computes merge(merge([0, 0], [0, 1]), [2, 0]) = merge([0, 1], [2, 0]) = [2, 1]. Associativity and commutativity guarantee the same result regardless of which path the states took through the network.',
        'Contrast: with a plain integer counter, A has 2 and B has 1. max(2, 1) = 2 -- lost B\'s like. sum(2, 1) = 3 now, but the retry makes sum(3, 1) = 4 -- double-count. The integer lacks the per-replica structure that lets elementwise max be both complete (no lost updates) and safe (no double-counts).',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational paper is Shapiro, Preguica, Baquero, and Zawirski, "A Comprehensive Study of Convergent and Commutative Replicated Data Types" (INRIA TR 7506, 2011), at https://inria.hal.science/hal-00932836v1/document. It defines CvRDTs and CmRDTs, proves their equivalence, and catalogs G-Counter, PN-Counter, G-Set, 2P-Set, LWW-Register, OR-Set, and sequence CRDTs with full specifications. The 2018 survey by Preguica, Baquero, and Shapiro (https://arxiv.org/abs/1805.06358) covers delta-state CRDTs and production experience. The community index at https://crdt.tech/papers.html tracks the broader literature.',
        'Prerequisite topics: study Clocks and Ordering (Lamport clocks through TrueTime) to understand the causal metadata CRDTs rely on, and the CAP Theorem to understand the availability-consistency tradeoff that motivates CRDTs. Extensions: Delta-State CRDT Anti-Entropy shows how production systems reduce sync bandwidth. Sequence CRDTs for Collaborative Text and the Peritext Rich-Text CRDT Case Study cover the harder problem of concurrent text editing. Contrast with Raft Leader Election to see the consensus-based alternative for problems requiring global invariants.',
        'Exercise: design a CRDT for a shopping cart (hint: an OR-set of (item, quantity) pairs, with add-wins semantics). Then explain why the same approach fails for a bank account balance that must stay nonnegative. The boundary between "mergeable data" (where CRDTs work) and "invariant-bearing data" (where coordination is required) is the central design decision in any system that mixes the two.',
      ],
    },
  ],
};
