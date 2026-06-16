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
    explanation: 'Start with the trap. A like-counter lives on three replicas; the network partitions (the reality CAP Theorem says you must plan for) and 2 likes land on A while 1 lands on B. Now reconcile two plain integers: take the max and B\'s like vanishes; let one side win and the other\'s likes vanish; ADD them and you get 3 — but every future re-sync adds again, double-counting forever, because addition is not idempotent and Gossip Protocol-style replication re-delivers constantly. A single integer simply does not carry enough information to merge. The fix is not a smarter merge — it is a smarter STRUCTURE.',
    invariant: 'A merged state must lose no update and count none twice — a bare integer cannot satisfy both.',
  };

  yield {
    state: counterMatrix('G-counter: one slot per replica, increment YOUR slot only', [
      ['a', 'replica A (+2 locally)', SA],
      ['b', 'replica B (+1 locally)', SB],
      ['c', 'replica C (+3 locally)', SC],
    ]),
    highlight: { active: ['a:sa', 'b:sb', 'c:sc'] },
    explanation: 'The G-counter (grow-only counter) gives each replica its OWN slot — a vector, one entry per replica, exactly the shape of the vector clocks from Clocks & Ordering: Lamport to TrueTime, and not by coincidence. The rule: a replica increments only its own slot, and the counter\'s value is the SUM of all slots. During the partition, A records its 2 likes as [2,0,0], B its 1 as [0,1,0], C its 3 as [0,0,3] — all computed live on this page. No replica ever touches another\'s slot, so concurrent increments can never collide: they live in different coordinates by construction.',
    invariant: 'Each replica writes only its own slot: concurrent increments occupy disjoint coordinates and cannot conflict.',
  };

  yield {
    state: counterMatrix('Merge = elementwise max, in both orders', [
      ['ab', 'merge(A, B)', AB],
      ['ba', 'merge(B, A)', BA],
      ['full', 'merge(that, C)', FULL],
    ]),
    highlight: { found: ['full:val'], compare: ['ab:sa', 'ba:sa'] },
    explanation: `Merging two G-counters is elementwise MAX: each slot keeps the highest count anyone has seen for that replica. Max never loses an increment (the bigger number includes the smaller's history — slots only grow) and never double-counts (max of a number with itself is itself). Run it live: merge(A, B) = [${AB.join(', ')}] and merge(B, A) = [${BA.join(', ')}] — ${COMMUTES ? 'identical' : 'DIFFERENT'}, so order doesn't matter. Fold in C and every replica converges to [${FULL.join(', ')}]: value ${value(FULL)}, exactly the ${value(FULL)} likes that were clicked. Re-deliver B's stale state afterwards and nothing changes (verified: ${IDEMPOTENT}) — duplicates are harmless.`,
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
    explanation: 'One catch: max only works because slots never shrink — the G in G-counter means GROW-only, so decrements are illegal. The fix is beautifully cheap: a PN-counter is just TWO G-counters, P counting increments and N counting decrements, value = sum(P) − sum(N). Each half keeps the pristine max-merge algebra; subtraction happens only at read time. This pair-of-grow-only-structures trick is the standard CRDT move: when an operation breaks the algebra, don\'t fix the merge — split the state until every piece grows monotonically again.',
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
    explanation: 'Not every CRDT is a good idea. An LWW-register (last-writer-wins) stores a value plus a timestamp; merge keeps whichever has the larger stamp. That IS commutative, associative, and idempotent — a legal CRDT — but it converges by THROWING AWAY one of the concurrent writes, and Clocks & Ordering: Lamport to TrueTime showed exactly this incident: an 80ms-fast clock silently dropped the real correction. Convergence is not the same as correctness. LWW is the right tool only when "either value is fine, just agree" — Cassandra uses it per cell for exactly that reason, and its documentation warns you about exactly this.',
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
    explanation: 'Sets have a real concurrent conflict: A adds "milk" while B removes it. Who wins? The OR-set (observed-remove set) answers with bookkeeping instead of clocks: every add creates a globally UNIQUE tag, and a remove deletes only the tags the remover had actually OBSERVED. B\'s remove tombstones tag a1 — the add it saw — but A\'s concurrent re-add carries a brand-new tag a7 that no remove has ever mentioned, so after merging, milk is in the set. Adds win concurrent races by construction: you cannot remove what you have not seen. That matches the intuition of a shopping cart, which is why Riak ships OR-sets and why Amazon\'s original Dynamo cart leaned the same way.',
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
    explanation: 'The general recipe behind every example on this page: states form a JOIN SEMILATTICE — a partial order where any two states have a least upper bound, and merge computes it. Each algebraic law neutralizes one entire category of distributed failure: commutativity absorbs reordering, associativity absorbs topology (who synced through whom), idempotence absorbs duplication. Satisfy all three and convergence is a THEOREM (Shapiro et al., 2011 — strong eventual consistency), not a hope: replicas that have seen the same updates are in the same state, no matter how the network delivered them. Compare the cost of agreement elsewhere: Raft Leader Election buys it with quorums and round-trips; a CRDT buys it with algebra, for free, at merge time.',
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
    explanation: 'The toolbox. The crown jewels are sequence CRDTs — RGA, Yjs, Automerge — which give every character in a document a stable identity between its neighbors so that concurrent typing merges cleanly: that is how Figma multiplayer, Apple Notes, and the Zed editor let users edit offline and converge on reconnect, no central lock, no operational-transform server. The honest last row matters just as much: CRDTs guarantee convergence, not global invariants. "Every replica eventually agrees on the cart" is CRDT territory; "no two users ever hold the same username" fundamentally is not — enforcing a global invariant requires turning concurrent operations into ordered ones, and that is consensus work, not merge work.',
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
      heading: `What it is`,
      paragraphs: [
        `A CRDT is a data structure designed to be replicated across multiple computers that can update concurrently without ever stopping to ask a central authority what the correct value is. Replicas merge their changes in any order and always converge to the same result — not by magic, but by mathematics. Every operation is commutative, associative, and idempotent, the three laws that make any merge order, any topology, any duplicate delivery produce the same final state. The name itself reveals the trick: Conflict-Free does not mean "no two edits happen at once" (they always do in a partition); it means "the conflicts are resolved by the structure, not by a human choosing which write wins."`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The live demo on this page shows the core idea in a single epiphany: a naive integer counter cannot merge because an integer carries no history. When a partition splits three replicas and 2 likes land on A, 1 on B, 3 on C, taking the max loses B's increment; adding them triple-counts on re-sync. The G-counter (grow-only counter) fixes this by giving each replica its own slot — a vector of length equal to the number of replicas, exactly the shape of "Clocks & Ordering: Lamport to TrueTime". Replica A increments slot 0 only, B increments slot 1, C increments slot 2. The counter's value is the sum of all slots. Now, when the partition heals, merge is elementwise max: for each slot, keep the highest count anyone has seen. A merged state is [2, 1, 3], value 6 — precisely correct. Verify the commutativity of merge on the page: merge(A, B) and merge(B, A) produce identical states, so reordering changes nothing. Verify idempotence: merging B's old stale state after it is already in the merged whole changes the value not at all.`,
        `Subtraction breaks the grow-only property, so a PN-counter is two G-counters: P counts increments, N counts decrements, value = sum(P) − sum(N). This pair-of-grow-vectors technique — split the state until every component monotonically grows — is the standard CRDT recipe: when an operation breaks the algebra, do not fix the merge, split the structure.`,
        `Sets present a real conflict: if A adds an item and B concurrently removes it, who wins? The OR-set (observed-remove set) answers with unique tags: every add generates a globally unique tag, and a remove deletes only the tags it actually observed. A's concurrent re-add carries a fresh tag no remove has touched, so it survives every merge. Adds win by construction. An LWW-register (last-writer-wins) is technically a CRDT — merge keeps the value with the largest timestamp — but it discards the other concurrent write, and "Clocks & Ordering: Lamport to TrueTime" showed exactly when this fails: an 80ms-fast clock silently erased the real correction. Convergence is not correctness; use LWW only when either value is acceptable.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `A G-counter requires one slot per replica, so storage grows linearly with the number of replicas in the system. Merge is elementwise comparison across all slots, O(replica count). On a modern machine, this is instant; with thousands of replicas, storage becomes noticeable but still manageable. Sequence CRDTs — the crown jewels that power text collaboration in Figma, Apple Notes, and the Zed editor — must assign every character a stable identity in the document, a cost that grows with text size. The payoff is synchronization without round-trips: replicas merge concurrently, every user edits offline, and on reconnect the edits converge to the same final text. Compare this to the cost of consensus: "Raft Leader Election" uses quorums and log replication, adding latency and availability constraints; a CRDT pays only the algebra, up front, for free at merge time.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `"Gossip Protocol" is how replicas discover each other and exchange state. CRDTs are what those replicas exchange: counters in presence systems (how many users are editing right now?), LWW-registers for cell values in Cassandra and DynamoDB, OR-sets for shopping carts and tag lists in Riak (Amazon's original Dynamo used the same principle — adds win). Sequence CRDTs are the silent engine of every online collaborative editor: when you and a teammate type in the same doc and the network hiccups, your changes do not collide, because every keystroke has a unique identity in the merge algebra. Figma's multiplayer, Apple Notes' cross-device sync, and the Zed editor's real-time collaboration all rely on sequence CRDTs (RGA, Yjs, Automerge) to converge edits without asking a server "is this keystroke legal?" every time.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `A CRDT guarantees that replicas agree on the state — not that the state is correct. An LWW-register will silently drop a write if a clock is fast; a PN-counter will produce a negative balance if the network partition is long enough. CRDTs converge, but they do not enforce global invariants. That distinction matters: "every replica eventually has the same cart contents" is CRDT territory; "no two users ever hold the same username" is not. Username uniqueness requires ordering: if A and B both try to register "bob" concurrently, a central authority must pick one, not both. That is consensus work ("Raft Leader Election"), not merge work. Many systems use CRDTs for the parts that can be eventually consistent and consensus for the parts that cannot.`,
        `Another trap: the three laws (commutativity, associativity, idempotence) are necessary but not always intuitive. An integer counter is not idempotent under addition, but a vector counter is idempotent under max. The structure must be designed for the operation.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `For collaborative editing specifically, compare Sequence CRDTs for Collaborative Text with Operational Transformation Collaborative Editing Case Study. They solve the same convergence problem with different data-structure choices: CRDTs attach stable identities to sequence elements, while OT keeps position-based operations and rewrites them through a revision protocol.`,
        `Primary sources: Shapiro, Preguica, Baquero, and Zawirski, "Conflict-Free Replicated Data Types" at https://inria.hal.science/hal-00932836v1/document, the 2018 CRDT overview at https://arxiv.org/abs/1805.06358, and the CRDT papers index at https://crdt.tech/papers.html. Study "Clocks & Ordering: Lamport to TrueTime" to understand why vector clocks have the same shape as G-counter slots, and what causal ordering really means. Read "Gossip Protocol" to see how replicas discover each other and exchange these states continuously. Delta-State CRDT Anti-Entropy Case Study shows how to avoid shipping whole CRDT states after every edit while keeping idempotent merge semantics. Understand "CAP Theorem" to learn why CRDTs exist: the partition tolerance guarantee that CAP demands means you cannot always have consistency, so you choose availability + eventual consistency instead. Then follow Sequence CRDTs for Collaborative Text and Peritext Rich-Text CRDT Case Study to see how the same algebra becomes real editor infrastructure. Explore "Raft Leader Election" to see the opposite trade-off: consensus systems sacrifice availability in a partition to preserve strict consistency. Together, CRDTs and Raft represent the two poles of distributed systems design. Finally, revisit the live demo on this page and watch the merge operation converge no matter the order — that visual is the entire story.`,
      ],
    },
  ],
};
