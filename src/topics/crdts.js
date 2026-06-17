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
    explanation: `Merge is elementwise max. That keeps every replica's highest known contribution, so it neither drops a slot nor counts it twice. The live values show merge(A, B) = [${AB.join(', ')}] and merge(B, A) = [${BA.join(', ')}] - ${COMMUTES ? 'identical' : 'DIFFERENT'}. Folding in C gives [${FULL.join(', ')}], value ${value(FULL)}. Replaying B again changes nothing: ${IDEMPOTENT}.`,
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

const legacyArticle = {
  sections: [
    {
      heading: 'Why this matters',
      paragraphs: [
        'CRDTs exist for data that must keep accepting writes while replicas are disconnected. A shopping cart, presence count, note, or collaborative document should not stop working every time the network partitions. The price is that the data type itself must know how to merge concurrent histories.',
        'Conflict-free does not mean conflicts never happen. It means the state is designed so retry, reordering, duplicate delivery, and partial replication still converge without asking a central server to pick the next operation.',
      ],
    },
    {
      heading: 'Core idea',
      paragraphs: [
        'A CRDT chooses a state shape plus a merge function. For a G-counter, the state is a vector with one slot per replica. Replicas only increment their own slot, and merge keeps the maximum value per slot. That one design choice makes merge commutative, associative, and idempotent: order does not matter, sync topology does not matter, and duplicate delivery is harmless.',
        'More complex CRDTs use the same move. A PN-counter splits increments and decrements into two grow-only vectors. An OR-set gives every add a unique tag, then lets remove delete only tags it has observed. Sequence CRDTs give inserted characters stable identities so concurrent text edits can be ordered deterministically.',
        'The rule of thumb: if an operation would destroy merge safety, store more structure. Do not ask a bare integer, raw string, or plain JSON value to remember causal history it does not contain.',
      ],
    },
    {
      heading: 'Legacy visual note',
      paragraphs: [
        'In the counter view, start with the failed bare integer: it cannot know which replica contributed which update, so every naive merge loses or double-counts. Then watch the G-counter give each replica its own slot and use elementwise max as merge. The visual invariant is monotonic state: stored components only grow, so duplicate, reordered, or delayed sync cannot undo history.',
        'In the sets-and-laws view, read each structure by what it chooses to preserve. The LWW register preserves agreement by discarding one concurrent value. The OR-set preserves concurrent adds by tagging them and removing only observed tags. The laws table maps algebra to network failure: commutativity handles reordering, associativity handles different sync paths, and idempotence handles retries. The production toolbox marks the boundary: convergence is not the same as enforcing global business rules.',
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        'CRDTs are useful when availability and local responsiveness matter more than immediate global serialization: collaborative editors, offline-first apps, caches with mergeable values, distributed counters, shopping carts, tag sets, presence, and replica-local configuration.',
        'They pair naturally with Gossip Protocol and local-first sync engines. Gossip moves state around; CRDT merge makes repeated, reordered, partial delivery safe. Yjs, Automerge, Riak data types, Dynamo-style versioned values, and many presence systems all use this shape in different forms.',
      ],
    },
    {
      heading: 'Tradeoffs and failure modes',
      paragraphs: [
        'A CRDT guarantees agreement after the same updates arrive. It does not guarantee the agreed value is the one users wanted. Last-writer-wins may drop intent. Add-wins sets may keep an item a user thought they removed. Sequence CRDTs converge text but still need schema rules, rich-text merge semantics, undo, auth, and compaction.',
        'Global invariants are the hard boundary. Unique usernames, nonnegative bank balances, one-seat reservations, and quota limits cannot be enforced by independent concurrent acceptance alone. You need consensus, leases, escrow, reservations, or a central allocator for those parts. Many real systems mix CRDTs for mergeable data and stronger coordination for invariant-bearing data.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'Use CRDTs when the data can tolerate eventual convergence and has a clear merge policy. Prefer the simplest CRDT that matches user semantics: counters for counts, OR-sets for collections where observed remove is acceptable, registers only when losing a concurrent value is harmless, sequence CRDTs for collaborative ordering.',
        'Before shipping, write down the invariant the CRDT does not protect. Then design storage, anti-entropy, compaction, access control, and conflict UI around that boundary.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Shapiro, Preguica, Baquero, and Zawirski, "Conflict-Free Replicated Data Types" at https://inria.hal.science/hal-00932836v1/document, the 2018 CRDT overview at https://arxiv.org/abs/1805.06358, and the CRDT papers index at https://crdt.tech/papers.html. Study Clocks & Ordering: Lamport to TrueTime, Gossip Protocol, Delta-State CRDT Anti-Entropy Case Study, CAP Theorem, Sequence CRDTs for Collaborative Text, Peritext Rich-Text CRDT Case Study, and Raft Leader Election next.',
      ],
    },
  ],
};

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'CRDTs exist for replicated systems that need local writes, offline work, and eventual convergence without a central lock. If users edit on different devices or replicas while disconnected, the system needs a merge rule that makes all replicas arrive at the same value later.',
        'The hard part is not copying data. It is conflict. If two replicas both update a value, the system must merge those updates without depending on message order. CRDTs solve this by designing data types whose merge operations are mathematically safe.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is last-write-wins. Attach timestamps and keep the latest value. That is simple, but it can erase real work under clock skew or concurrent edits. It chooses a winner rather than preserving intent.',
        'Another approach is central coordination: send every write through one leader. That gives a clear order, but it fails offline and adds latency. CRDTs are for systems where local progress matters enough to pay for richer merge semantics.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A state-based CRDT uses a merge function that is associative, commutative, and idempotent. Associative means grouping does not matter. Commutative means order does not matter. Idempotent means receiving the same state twice does not change the result.',
        'Operation-based CRDTs send operations instead of whole state, but they still need rules that make concurrent operations converge. The common theme is that the data type is designed so replicas can accept updates independently and reconcile deterministically.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A grow-only counter can store one count per replica. Local increment increases only the local slot. Merge takes the maximum for every replica slot. The displayed value is the sum of slots. Concurrent increments survive because they happen in different components.',
        'A PN-counter uses two grow-only counters: one for increments and one for decrements. A grow-only set unions elements. An observed-remove set tracks add tags and remove evidence so a remove deletes only adds it has observed. Sequence CRDTs add identifiers that preserve order for collaborative text.',
        'Replication can be anti-entropy: replicas periodically exchange state or deltas. Because merge is idempotent and commutative, duplicate messages and out-of-order delivery are safe. The system still needs delivery eventually if replicas are expected to converge.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The counter view proves that concurrent local writes can both survive. Instead of two replicas racing to overwrite one number, each replica owns a component. Merge combines components with max, then the query function sums them.',
        'The set view proves that deletion is harder than addition. Adding can be a union. Removing needs evidence about which adds are being removed. Without that evidence, a concurrent add and remove can collapse into arbitrary last-writer behavior.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'CRDT convergence comes from algebra, not from timing luck. If every replica eventually receives the same set of updates or states, and merge is associative, commutative, and idempotent, then every merge order reaches the same result.',
        'The design also separates update and query. Internal metadata may be a vector, tag set, tombstone set, or causal context. The user-facing value is derived from that metadata. The extra structure is the price of deterministic conflict resolution.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'CRDTs spend metadata to avoid coordination. Counters store per-replica components. Sets may store tombstones or dots. Text CRDTs store position identifiers. That metadata can grow and may need compaction once causal stability is known.',
        'The tradeoff is semantic fit. Some merges are natural, such as unioning cart additions or taking a maximum version. Others are not. Bank transfers, inventory reservations, and uniqueness constraints often need coordination or escrow-style protocols rather than pure CRDT merge.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'CRDTs win in collaborative editing, offline-first apps, distributed presence, counters, likes, shopping carts, replicated metadata, edge caches, and systems where availability is more important than immediate global agreement.',
        'They also provide a vocabulary for product design. A conflict is not just a technical problem; it is a question about user intent. CRDTs are strongest when the product has a merge rule users would actually accept.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure is assuming every data type has a good CRDT. Some invariants are global. If two users cannot reserve the same seat, local independent writes can violate the constraint unless the system uses coordination, escrow, or partitioned rights.',
        'The second failure is unbounded metadata. Tombstones, operation logs, and position identifiers can grow forever without compaction. Safe compaction requires knowing that relevant replicas have seen the evidence, which brings causal tracking back into the design.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose replica A and replica B each increment a counter while offline. A stores [A: 1, B: 0]. B stores [A: 0, B: 1]. When they exchange state, merge takes the componentwise maximum and both replicas reach [A: 1, B: 1], whose displayed value is 2.',
        'The same shape explains why a plain integer counter fails. If both replicas start at 0 and set the value to 1, last-write-wins keeps one increment and loses the other. The CRDT representation stores enough causal structure to know both increments happened.',
        'For a set, adding is easy because union preserves concurrent adds. Removing is harder because a remove should not erase an add it never observed. Observed-remove sets solve this by tagging adds and removing the tags the replica has seen.',
      ],
    },
    {
      heading: 'Design checklist',
      paragraphs: [
        'Start by naming the user intent. Does a concurrent update mean union, maximum, addition, replacement, or a visible conflict? If the product answer is unclear, the CRDT cannot save the design.',
        'Then name the metadata needed to make that merge deterministic. Counters need replica slots. Removes need evidence. Text needs position identifiers. Compaction needs causal stability. Each piece of metadata should exist because it protects a merge rule.',
        'Finally, test every pair of operations in both orders and with duplicate delivery. If add then merge then remove gives a different result from remove then merge then add, the type may still be valid, but only if the causal explanation is intentional.',
      ],
    },
    {
      heading: 'How to choose it',
      paragraphs: [
        'Use a CRDT when local availability and eventual convergence are more important than immediate global invariants. Collaborative notes, counters, reactions, and replicated preferences often fit. Payments, seat assignment, and inventory caps often need coordination.',
        'The decision should be made at the product level, not only the storage level. Users must be able to understand the merge result. A shopping cart that preserves both additions is natural. A document that interleaves concurrent paragraphs may need UI support to remain understandable.',
        'CRDTs also pair well with causal metadata. Version vectors, dotted vectors, and anti-entropy protocols tell replicas what they have seen and what can be compacted. Without that layer, a CRDT can converge but still become too large or too hard to audit.',
        'For production systems, the synchronization layer matters as much as the data type. Peers need identity, authentication, replay protection, delta exchange, snapshot compaction, and a way to repair missed updates. The merge law gives convergence; the transport makes convergence happen.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Version Vectors and Dotted Version Vectors, Delta-State CRDT Anti-Entropy, Sequence CRDTs, Yjs Struct Store and Updates, CAP Theorem, Read Write Quorums, and Local-First Sync Engine. A useful exercise is to design a CRDT for likes, then explain why the same design fails for bank balances.',
        'Then build a two-replica simulation with duplicate, delayed, and reordered messages. If the final values converge every time, the merge law is doing real work. If they do not, inspect which algebraic property your design violated in practice.',
      ],
    },
  ],
};
