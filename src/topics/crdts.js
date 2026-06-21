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
        'The counter view starts with the broken design: a bare replicated integer that cannot merge safely. Watch why max, overwrite, and add all fail. Then the G-counter reshapes state into one slot per replica, and elementwise max becomes a safe merge. Active markers highlight which replica owns which slot. The invariant to track: stored components only grow, so no delivery order can undo history.',
        {
          type: 'callout',
          text: 'CRDTs move conflict resolution into the data type so replicas can merge by law instead of by coordination.',
        },
        'The sets-and-laws view contrasts three CRDT families by what they sacrifice. The LWW-register converges by discarding a concurrent value. The OR-set converges by tagging adds and removing only observed tags. The laws table maps each algebraic property to the network failure it absorbs. Read each row as a contract: if this law holds, that class of failure is harmless.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed systems replicate data for availability, latency, and offline access. Replication creates a coordination problem: when two replicas accept writes concurrently, the system must reconcile them later. Traditional approaches use a leader or consensus protocol to serialize writes, but that blocks during partitions and adds round-trip latency.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Vector_Clock.svg/500px-Vector_Clock.svg.png',
          alt: 'Vector clock diagram with causal past, causal future, and independent events',
          caption: 'Vector clocks show why replicated data needs causal structure, not only wall-clock time. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Vector_Clock.svg/500px-Vector_Clock.svg.png',
        },
        'CRDTs solve this by embedding the merge rule into the data type itself. The term was introduced by Shapiro, Preguica, Baquero, and Zawirski in their 2011 INRIA technical report "Conflict-Free Replicated Data Types." Their key contribution was showing that if a replicated data type satisfies certain algebraic properties, all replicas converge to the same state once they have received the same updates, regardless of delivery order, duplication, or network topology.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is last-writer-wins: attach a timestamp to each write and keep whichever value has the larger timestamp. This is simple, and it does produce agreement. But it achieves agreement by silently discarding one concurrent update. Under clock skew, the "last" writer may not be the one the user expects. For a profile field where any value is acceptable, that is fine. For a shopping cart, a shared document, or a counter, silently dropping a concurrent edit is data loss.',
        'The second attempt is central coordination: route every write through a single leader that serializes operations. This gives a total order and prevents conflicts entirely. But it fails offline, it adds latency proportional to the round-trip to the leader, and during network partitions the system must either reject writes or risk split-brain. CRDTs exist for the space where local writes, offline progress, and partition tolerance matter more than a total order.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the merge function. A bare integer counter cannot be merged safely because the number alone does not record who contributed which increment. If replica A has count 2 and replica B has count 1, taking the max gives 2 (losing B\'s increment), taking the sum gives 3 (correct once, but double-counts when gossip retries the same state), and overwriting gives whichever arrived last (losing the other). The state shape lacks the causal structure needed to merge without loss or duplication.',
        'The same wall appears in sets. If replica A adds "milk" and replica B concurrently removes "milk," the merge result depends on whether the system saw the add or the remove last. Without tracking which specific add the remove was responding to, the outcome is arbitrary. The fundamental problem is the same in both cases: the data structure does not carry enough history to resolve concurrent operations deterministically.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Shapiro et al. identified two families. A state-based CRDT (CvRDT) ships its full state between replicas and merges with a function that must be commutative, associative, and idempotent. These three properties make the merge a join operation on a join-semilattice: a partially ordered set where every pair of elements has a least upper bound. The least upper bound is the merged state, and because it is unique, all replicas that have seen the same updates converge regardless of merge order.',
        'An operation-based CRDT (CmRDT) ships operations instead of state. The delivery layer must guarantee causal delivery (operations from the same source arrive in order), but concurrent operations must commute. The two families are equivalent in expressiveness: any CvRDT can be expressed as a CmRDT and vice versa, though they differ in bandwidth and delivery requirements.',
        'The practical move is always the same: if a naive operation would break merge safety, store more structure. A counter becomes a vector. A set becomes a tagged set with tombstones. A register becomes a timestamped pair. The extra metadata is the price of coordination-free convergence.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A G-Counter (grow-only counter) assigns one slot per replica in a vector. Replica i increments only slot i. The value is the sum of all slots. Merge takes the componentwise maximum. Because each slot is monotonically nondecreasing and only one replica writes to it, concurrent increments land in disjoint coordinates and survive every merge. This is the simplest useful state-based CRDT.',
        'A PN-Counter (positive-negative counter) supports decrements by maintaining two G-Counters: P for increments and N for decrements. Each half merges independently with componentwise max. The displayed value is sum(P) minus sum(N). Subtraction never touches the stored vectors; it exists only in the query. Every stored component still grows monotonically, preserving the semilattice property.',
        'An LWW-Register (last-writer-wins register) stores a value paired with a timestamp. Merge keeps whichever pair has the larger timestamp. This is a valid CRDT because the max-timestamp rule is commutative, associative, and idempotent. It converges, but it converges by discarding the concurrent value with the smaller timestamp. Use it only when losing a concurrent write is acceptable.',
        'An OR-Set (observed-remove set) gives every add operation a globally unique tag. Remove does not delete the element; it tombstones only the tags it has observed. A concurrent add creates a fresh tag that the remove has never seen, so the fresh tag survives. This produces add-wins semantics: if any replica adds an element concurrently with a remove, the element remains in the merged set.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Convergence is a theorem, not a hope. For state-based CRDTs, the proof rests on the join-semilattice structure. If the set of possible states forms a join-semilattice under the merge function, and every local update moves the state upward in the partial order (monotonic), then after any two replicas exchange state, both reach the same least upper bound. The three laws each absorb a specific network failure: commutativity handles message reordering, associativity handles different sync topologies (A syncs with B then C, or A syncs with C then B), and idempotence handles duplicate delivery from gossip retries.',
        'For operation-based CRDTs, the proof requires that the delivery layer preserves causal order and that concurrent operations commute. Given those guarantees, every replica applies the same set of operations and arrives at the same state. The causal delivery requirement is stronger than what state-based CRDTs need, but the bandwidth is lower because only operations travel, not full state.',
        'Shapiro et al. call the resulting guarantee Strong Eventual Consistency (SEC): any two replicas that have received the same set of updates are in the same state, with no rollbacks or conflict resolution needed.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'G-Counter and PN-Counter metadata scales linearly with the number of replicas: one slot per replica per counter. For a system with 5 replicas, each counter is a 5-element vector (or two 5-element vectors for PN). This is negligible for small replica sets but becomes expensive when every client is a "replica" -- mobile-first systems with millions of devices need techniques like replica-id compaction or hierarchical counters.',
        'OR-Set metadata can grow without bound. Every add creates a tag, and every remove creates a tombstone. Without compaction, the tombstone set grows forever. Safe compaction requires causal stability: knowing that all replicas have observed the tombstoned tags, so the tombstones can be garbage-collected. This brings version vectors or similar causal metadata back into the system.',
        'State-based sync bandwidth is proportional to state size: the full vector ships on every exchange. Delta-state CRDTs (Almeida, Shoker, Baquero, 2018) reduce this by shipping only the state that changed since the last sync, while preserving the semilattice merge contract. Operation-based CRDTs ship only operations but require reliable causal broadcast, which has its own cost.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Riak (now Riak KV) was the first major database to ship built-in CRDT data types: counters, sets, registers, maps, and flags. Riak\'s implementation follows the Shapiro et al. specifications directly, using state-based CRDTs with dotted version vectors for accurate causal tracking and tombstone compaction.',
        'Redis added CRDT support through the Redis Enterprise Active-Active feature, which uses CRDTs to replicate data across geographically distributed clusters. Each Redis Enterprise cluster can accept writes locally, and CRDT merge rules reconcile conflicts automatically across regions. Counters, sets, sorted sets, strings, and streams all have CRDT merge semantics.',
        'Yjs and Automerge are the two dominant open-source CRDT libraries for collaborative editing. Yjs uses a sequence CRDT based on YATA (Yet Another Transformation Approach) to handle concurrent text insertions with unique position identifiers. Automerge uses a similar approach with an operation-based CRDT backend. Both power real-time collaborative editors: Yjs underlies collaborative features in ProseMirror, Tiptap, BlockSuite, and several Google-internal tools. Automerge powers local-first applications where documents sync peer-to-peer without a central server.',
        'Figma uses a custom CRDT for its multiplayer design tool, handling concurrent edits to the same canvas objects. Apple Notes uses CRDTs for cross-device sync. Phoenix Presence (Elixir) uses a CRDT-based presence tracker for real-time user lists. Soundcloud used CRDTs for distributed counters. The pattern appears wherever the system needs local writes, partition tolerance, and eventual convergence.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'CRDTs guarantee that replicas agree on state. They do not guarantee the agreed state satisfies global invariants. If two users cannot reserve the same airline seat, local independent acceptance of both reservations violates the constraint. Unique usernames, nonnegative account balances, inventory caps, and quota limits all require coordination, escrow, or partitioned authority. CRDTs are the wrong tool for these problems.',
        'Unbounded metadata is the second failure. Tombstones, operation logs, and position identifiers grow forever without compaction. Compaction requires knowing that all relevant replicas have seen the evidence being garbage-collected, which reintroduces coordination at the compaction layer. Production systems must design a compaction protocol alongside the CRDT.',
        'Semantic surprise is the third failure. An OR-set with add-wins semantics may keep an item a user thought they removed, because a concurrent add on another replica created a fresh tag. An LWW-register may discard a careful correction in favor of a typo with a faster clock. The merge rule is mathematically correct but may not match user intent. Product design must account for the merge semantics the CRDT actually provides.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Two replicas, A and B, track a like counter using a G-Counter with two slots. Both start at [0, 0]. While partitioned, A receives two likes: A increments its own slot twice, reaching state [2, 0]. B receives one like and increments its own slot, reaching [0, 1]. Neither replica has seen the other\'s updates.',
        'When connectivity returns, A sends its state [2, 0] to B, and B sends [0, 1] to A. Both compute merge([2, 0], [0, 1]) = [max(2,0), max(0,1)] = [2, 1]. The displayed value is 2 + 1 = 3. All three likes are preserved. No coordination was needed.',
        'Now suppose B sends its state to A again (a retry). A computes merge([2, 1], [0, 1]) = [max(2,0), max(1,1)] = [2, 1]. The state is unchanged. Idempotence absorbed the duplicate. Suppose a third replica C had received B\'s state first and then A\'s. C would compute merge(merge([0,0], [0,1]), [2,0]) = merge([0,1], [2,0]) = [2,1]. Associativity and commutativity ensure the same result regardless of sync path.',
        'Contrast this with a plain integer counter. A has count 2, B has count 1. Taking max gives 2 (lost B\'s like). Taking sum gives 3 now, but if B sends again, sum gives 4 (double-count). The integer lacks the per-replica structure that makes merge safe.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational paper is Shapiro, Preguica, Baquero, and Zawirski, "A Comprehensive Study of Convergent and Commutative Replicated Data Types" (INRIA TR 7506, 2011), available at https://inria.hal.science/hal-00932836v1/document. It defines CvRDTs, CmRDTs, proves their equivalence, and catalogs G-Counter, PN-Counter, G-Set, 2P-Set, LWW-Register, OR-Set, and sequence CRDTs with full specifications. The 2018 survey by Preguica, Baquero, and Shapiro at https://arxiv.org/abs/1805.06358 covers delta-state CRDTs and production experience. The community index at https://crdt.tech/papers.html tracks the full literature.',
        'Prerequisite: study Clocks and Ordering (Lamport to TrueTime) to understand the causal metadata CRDTs rely on, and CAP Theorem to understand the availability-consistency tradeoff that motivates CRDTs. Extension: study Delta-State CRDT Anti-Entropy to see how production systems reduce sync bandwidth. Study Sequence CRDTs for Collaborative Text and the Peritext Rich-Text CRDT Case Study for the harder problem of concurrent text editing. Contrast with Raft Leader Election to see the consensus-based alternative for problems where global invariants are required.',
        'A useful exercise: design a CRDT for a shopping cart, then explain why the same design fails for a bank account balance that must stay nonnegative. The boundary between "mergeable data" and "invariant-bearing data" is the central design decision in any system that mixes CRDTs with coordination.',
      ],
    },
  ],
};
