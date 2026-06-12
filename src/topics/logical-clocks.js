// Clocks in distributed systems: wall clocks LIE across machines, so
// either build order from causality (Lamport, vector clocks) or buy
// hardware truth and wait out its error bars (Spanner's TrueTime).

import { matrixState, graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'logical-clocks',
  title: 'Clocks & Ordering: Lamport to TrueTime',
  category: 'Systems',
  summary: 'Wall clocks lie across machines — order events by causality instead, or buy atomic truth and wait out its error bars.',
  controls: [
    { id: 'view', label: 'Order', type: 'select', options: ['why wall clocks lie', 'logical clocks & TrueTime'], defaultValue: 'why wall clocks lie' },
  ],
  run,
};

function* wallClocksLie() {
  yield {
    state: matrixState({
      title: 'The lost update: two servers, clocks 80ms apart',
      rows: [
        { id: 'r1', label: 'real order #1' },
        { id: 'r2', label: 'real order #2' },
        { id: 'lww', label: 'last-write-wins applies…' },
      ],
      columns: [{ id: 'event', label: 'event' }, { id: 'stamp', label: 'wall-clock stamp' }],
      values: [[1, 2], [3, 4], [5, 6]],
      format: (v) => ['', 'S1: user sets name = "Ana"', '10:00:00.100 (S1 clock, 80ms fast)', 'S2: user FIXES it to "Anna"', '10:00:00.050 (S2 clock, correct)', 'keeps the "later" stamp…', '"Ana" wins — the CORRECTION is silently dropped ⚠'][v],
    }),
    highlight: { removed: ['lww:stamp'] },
    explanation: 'The incident that teaches the lesson: a user saves their name on server S1, notices the typo, and fixes it two heartbeats later through server S2. But S1\'s clock runs 80ms fast, so the FIRST write carries the LATER timestamp — and a last-write-wins merge (common in replicated stores) silently discards the correction. Nobody crashed; nothing alarmed; the database is simply, confidently wrong. Every cross-machine ordering decision made by wall clock contains this landmine, because there is no such thing as two machines agreeing what time it is.',
    invariant: 'Wall-clock order across machines is not event order: clock skew can reverse any two events closer than the skew.',
  };

  yield {
    state: matrixState({
      title: 'How wrong are real clocks?',
      rows: [
        { id: 'quartz', label: 'quartz drift' },
        { id: 'ntp', label: 'NTP sync (typical)' },
        { id: 'vm', label: 'VM pauses / leap smears' },
        { id: 'moral', label: 'the moral' },
      ],
      columns: [{ id: 'num', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', '~10–50 ppm: seconds lost per day, unsynced', 'a few ms on a LAN; tens to hundreds of ms across the internet', 'a paused VM "stops time"; leap seconds get smeared over hours', 'any two events within the skew window are UNORDERABLE by timestamp'][v],
    }),
    highlight: { compare: ['ntp:num', 'vm:num'] },
    explanation: 'The numbers behind the landmine: quartz oscillators drift tens of parts per million (seconds per day, left alone); NTP disciplines them to within milliseconds on a friendly network and much worse across the internet; and even a perfect clock is read by software that can be paused mid-instruction by a hypervisor for 200ms. Google\'s engineers summarized a decade of pain in one sentence: assume each clock is an unreliable witness. Within one machine, timestamps order events fine. The instant a system spans two machines — every system in this Systems tour — "what time is it?" stops having one answer.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'a', label: 'A: write', x: 1.5, y: 5.5, note: 'P1' },
        { id: 'b', label: 'B: send msg', x: 4, y: 5.5, note: 'P1' },
        { id: 'c', label: 'C: unrelated write', x: 1.5, y: 1.3, note: 'P2' },
        { id: 'd', label: 'D: receive msg', x: 6.5, y: 1.3, note: 'P2' },
        { id: 'e', label: 'E: write', x: 8.8, y: 1.3, note: 'P2' },
      ],
      edges: [
        { id: 'ab', from: 'a', to: 'b' },
        { id: 'bd', from: 'b', to: 'd' },
        { id: 'cd', from: 'c', to: 'd' },
        { id: 'de', from: 'd', to: 'e' },
      ],
    }),
    highlight: { active: ['bd'], compare: ['a', 'c'] },
    explanation: 'Lamport\'s 1978 reframe, the foundation under everything since: forget time, track CAUSALITY. Event X happens-before Y when one of three things holds: same process, X earlier in its sequence (A → B); X is the sending of a message Y receives (B → D); or transitivity chains them (A → E). Follow the arrows: A happens-before E. But look at A and C — no arrow path connects them, in either direction. They are CONCURRENT: not "at the same time," but genuinely UNORDERED — no observer inside the system can ever know which came first, and crucially, no correctness can depend on it.',
    invariant: 'Happens-before is a partial order: events unreachable by arrows are concurrent — unordered in principle, not just in practice.',
  };
}

function* logicalAndTrue() {
  yield {
    state: graphState({
      nodes: [
        { id: 'a', label: 'A (1)', x: 1.5, y: 5.5, note: 'P1: counter = 1' },
        { id: 'b', label: 'B (2)', x: 4, y: 5.5, note: 'P1: send, counter = 2' },
        { id: 'c', label: 'C (1)', x: 1.5, y: 1.3, note: 'P2: counter = 1' },
        { id: 'd', label: 'D (3)', x: 6.5, y: 1.3, note: 'P2: max(1, 2) + 1 = 3' },
        { id: 'e', label: 'E (4)', x: 8.8, y: 1.3, note: 'P2: counter = 4' },
      ],
      edges: [
        { id: 'ab', from: 'a', to: 'b' },
        { id: 'bd', from: 'b', to: 'd' },
        { id: 'cd', from: 'c', to: 'd' },
        { id: 'de', from: 'd', to: 'e' },
      ],
    }),
    highlight: { found: ['d'] },
    explanation: 'LAMPORT CLOCKS make causality countable with one integer per process and two rules: tick before every event; on receiving a message, jump to max(own, message\'s) + 1. Walk the diagram: P1 ticks A=1, B=2 and ships "2" inside the message; P2, sitting at 1, receives it and jumps to max(1,2)+1 = 3 for D, then E=4. The guarantee: if X happens-before Y, then clock(X) < clock(Y) — causal order is never violated by the numbers. The fine print: the CONVERSE fails. C has clock 1 and B has clock 2, yet C and B are concurrent — Lamport numbers order them arbitrarily. One integer cannot tell "before" apart from "unrelated."',
    invariant: 'Lamport: happens-before ⇒ smaller clock. The reverse implication does not hold — concurrency is invisible.',
  };

  yield {
    state: matrixState({
      title: 'Vector clocks: concurrency made visible',
      rows: [
        { id: 'v1', label: 'X stamped [2, 0]' },
        { id: 'v2', label: 'Y stamped [3, 1]' },
        { id: 'v3', label: 'Z stamped [0, 1]' },
      ],
      columns: [{ id: 'vsX', label: 'vs X?' }, { id: 'vsZ', label: 'vs Z?' }],
      values: [[0, 1], [2, 3], [4, 0]],
      format: (v) => ['—', 'CONCURRENT: [2,0] vs [0,1] — each wins one slot', 'X → Y: [2,0] ≤ [3,1] componentwise', 'Z → Y: [0,1] ≤ [3,1]', 'CONCURRENT (symmetric)'][v],
    }),
    highlight: { compare: ['v1:vsZ'], found: ['v2:vsX'] },
    explanation: 'VECTOR CLOCKS fix Lamport\'s blindness by keeping one counter PER PROCESS: each process ticks its own slot, and messages merge vectors slot-wise (take the max). Now comparison tells the whole truth: X → Y exactly when X\'s vector is ≤ Y\'s in every slot; if each vector beats the other somewhere — [2,0] versus [0,1] — the events are provably CONCURRENT. That verdict is operational gold: Dynamo-style databases stamp replicas with vector clocks, and "concurrent" is precisely the signal that two writes conflict and need merging (the sibling-resolution problem), rather than one silently overwriting the other like the lost "Anna". The price: vectors grow O(n) with participants, and n churns in real clusters.',
    invariant: 'Vector ≤ in every slot ⇔ happens-before; mutual non-domination ⇔ concurrent. Cost: one counter per participant.',
  };

  yield {
    state: matrixState({
      title: 'TrueTime: buy the truth, then WAIT out its error bars',
      rows: [
        { id: 'hw', label: 'the hardware' },
        { id: 'api', label: 'the API' },
        { id: 'wait', label: 'the trick: commit-wait' },
        { id: 'payoff', label: 'the payoff' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'GPS receivers + atomic clocks in every datacenter', 'now() returns an INTERVAL [earliest, latest], ε ≈ 1–7ms wide', 'hold each commit until its interval has fully passed (~ε)', 'timestamps become globally TRUE — snapshot reads need no coordination'][v],
    }),
    highlight: { active: ['wait:what'], found: ['payoff:what'] },
    explanation: 'Google\'s Spanner took the other road entirely: instead of abandoning wall time, ENGINEER it. GPS and atomic clocks in every datacenter keep uncertainty to single-digit milliseconds, and — the honest masterstroke — the TrueTime API refuses to pretend otherwise: it returns an interval [earliest, latest], never a point. Then the trick that makes global consistency fall out: COMMIT-WAIT. A transaction takes its timestamp, then deliberately stalls a few milliseconds until that timestamp\'s entire uncertainty interval is in the past — after which its stamp is unambiguously true everywhere on Earth. Result: any reader can pick a timestamp and get a consistent snapshot ACROSS ALL SHARDS (the cross-shard consistent read that Sharding & Partitioning said transactions lose, and the global version of Transaction Isolation Levels\' MVCC snapshots) with zero coordination. The cost is real money and a few ms of latency per write — physics, purchased.',
    invariant: 'Commit-wait spends ε milliseconds of latency to make a timestamp globally unambiguous: uncertainty waited out, not ignored.',
  };

  yield {
    state: matrixState({
      title: 'The ordering toolbox',
      rows: [
        { id: 'wall', label: 'wall clocks + NTP' },
        { id: 'lamport', label: 'Lamport clocks' },
        { id: 'vector', label: 'vector clocks' },
        { id: 'hlc', label: 'hybrid logical clocks' },
        { id: 'tt', label: 'TrueTime' },
      ],
      columns: [{ id: 'gives', label: 'gives you' }, { id: 'cost', label: 'costs you' }],
      values: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]],
      format: (v) => ['', 'human-readable stamps', 'silent reordering within the skew', 'causal total order', 'concurrency invisible', 'full causality + conflict detection', 'O(n) vectors, churn pain', 'causality + close-to-real time in 64 bits', 'still bounded by clock quality', 'globally true timestamps', 'atomic clocks + ε wait per commit'][v],
    }),
    highlight: { compare: ['lamport:gives', 'vector:gives'], found: ['hlc:gives'] },
    explanation: 'The toolbox, ordered by ambition. The quiet workhorse is the row most people meet last: HYBRID LOGICAL CLOCKS, which pack a Lamport-style counter into the low bits of a physical timestamp — causally correct like Lamport, roughly wall-time-meaningful for humans, constant size — the scheme CockroachDB and friends actually run when they cannot afford atomic clocks. The deep lesson spans the whole page: distributed systems replaced the question "WHEN did it happen?" with "WHAT could it have caused?" — and every consensus log you have studied (Raft Leader Election\'s terms are Lamport clocks wearing election clothes) is downstream of that substitution.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'why wall clocks lie') yield* wallClocksLie();
  else if (view === 'logical clocks & TrueTime') yield* logicalAndTrue();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Logical clocks solve a crisis: wall clocks across machines cannot be trusted to order events. A user saves a correction to their name on one server, but the first write carries a later timestamp because that server's clock runs 80 milliseconds fast — and last-write-wins silently drops the fix, confident and wrong. Every distributed system faces this. The fix is not to sync clocks harder; it is to stop relying on "when" and instead order by causality: if event A must cause event B, then A comes before B, period. Lamport clocks pack this rule into a single counter per process. Vector clocks add one counter per participant so that concurrent (truly unordered) events become visible and detectable. TrueTime takes the opposite path: engineer the hardware to make wall clocks trustworthy by buying atomic clocks and GPS receivers, then stall writes until the uncertainty window closes — converting physics into coordination-free globally consistent snapshots. All three replace the question "what time is it?" with "what could have caused what?"`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The foundation is the happens-before relation: event X happens before Y if (1) they occur on the same process and X runs earlier, (2) X is the sending of a message that Y receives, or (3) transitivity chains them. Events reachable by arrows are ordered; events unreachable in either direction are concurrent — genuinely unordered in principle, not just in practice. Lamport clocks make this countable: each process keeps one integer counter. Before every event, tick the counter up by one. When a process receives a message carrying a clock value, it jumps its own counter to max(own, received) + 1. Walk the diagram: P1 ticks to 1 then 2, sends "2" in the message; P2 is at 1, sees the 2, jumps to max(1,2)+1 = 3. The guarantee: if X happens-before Y, then clock(X) is smaller than clock(Y). Causal order is never broken. The blind spot: the reverse fails. Events C and B are concurrent, yet Lamport assigns them arbitrary numbers; concurrency becomes invisible.`,
        `Vector clocks fix this by keeping one counter per process. When comparing two events' stamps, use componentwise comparison: event X happens before Y exactly when X's vector is ≤ Y's in every slot. If each beats the other somewhere — [2, 0] versus [0, 1] — they are provably concurrent. That verdict is operational: Dynamo-style databases use vector clocks to detect sibling conflicts, where two writes occur without one knowing of the other, so neither silently overwrites the other as the lost "Anna" update did. The cost is that vectors grow O(n) with the number of participants, and in churning clusters that cost scales poorly.`,
        `TrueTime is a different bet: stop building logical structure and engineer the hardware to make timestamps true. GPS receivers and atomic clocks in every datacenter keep the uncertainty bound to 1–7 milliseconds. Instead of a point-in-time stamp, TrueTime returns an interval [earliest, latest] that brackets where the true time lies. The trick is commit-wait: when a transaction commits, it deliberately stalls until its timestamp's entire uncertainty interval has passed, after which the timestamp is unambiguously true everywhere on Earth. The payoff: any reader can pick a timestamp and grab a consistent snapshot across all shards with zero coordination — the cross-shard consistent read that Sharding & Partitioning said transactions lose, and the global version of Transaction Isolation Levels' MVCC snapshots. The cost is a few milliseconds of latency per write, but physics paid, so coordination is free.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Lamport clocks: O(1) space (one counter per process), O(1) per event (tick and one comparison on receive). No message overhead — the clock value travels inside existing messages. The trade-off is conceptual: you get a total order on all events, but the order is arbitrary for concurrent ones, and that arbitrariness is invisible — you cannot tell if a 2 and a 3 are ordered or concurrent just by looking at the numbers.`,
        `Vector clocks: O(n) space per event stamp, where n is the number of processes (or hypothetically unbounded in a dynamic system with churn). O(n) comparison cost. Messages bloat by n integers. In a stable 10-process cluster, vectors stay small; in a system where processes enter and leave constantly, vector timestamps can leak memory or require expensive pruning. Sharded systems with hundreds of independent streams can make vectors prohibitive.`,
        `TrueTime: O(ε) latency overhead per commit, where ε is 1–7 milliseconds (hardware cost). O(1) space and per-event CPU cost. The real cost is the upfront infrastructure: atomic clocks and GPS hardware in every datacenter, worth millions at large scale. For anyone without that hardware, TrueTime is inaccessible. Hybrid logical clocks split the difference: pack a Lamport-style counter into the low bits of a physical timestamp, achieving causality and nearly-real-time stamps in 64 bits, constant size. This is what CockroachDB runs when atomic clocks are not available.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Lamport clocks appear everywhere consensus logs and term-based leadership live. Raft Leader Election uses terms that work exactly like Lamport counters in election clothes: a term is a monotonic counter that ticks on each election, and higher term always beats lower, enforcing a causal order through leadership changes. State machines (like the ledgers in Raft) need to apply commands in a total order, and Raft's term + index combination achieves that.`,
        `Vector clocks are the core of Dynamo-style eventually consistent databases: when two replicas diverge (because they saw writes in different orders), vector clocks detect concurrency and flag the update as a conflict requiring merging, rather than silently losing one write. Many modern NoSQL databases use vector clocks or vector-like mechanisms (e.g., version vectors) to track causality across replicas without a global consensus log.`,
        `TrueTime is Google's secret weapon in Spanner. It enables globally consistent snapshots: any reader anywhere can pick a timestamp and read a snapshot of the entire database at that instant, without two-phase commit or a global lock. This is the "read-your-own-writes" consistency every web application silently expects, delivered across continents without coordination. It is also the foundation of distributed tracing with synchronized wall clocks: when TrueTime eliminates skew, a global timeline emerges, and request-causality tracing becomes simple.`,
        `Hybrid logical clocks (CockroachDB) reach for TrueTime's benefits — nearly causal, real-time-ish ordering — without the hardware; they trade a small window of skew tolerance and accept that some events within the skew are ordered arbitrarily. The result is the practical workhorse: CockroachDB offers "serializable" isolation, across shards, using HLCs and distributed consensus, avoiding both Dynamo's complexity (vector clocks + merging) and Spanner's cost (atomic clocks). When you cannot buy GPS hardware but need consistency stronger than eventual, HLCs are the answer.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first trap is thinking wall clocks are fine "in practice." The Anna update shows the danger: 80 milliseconds of skew is nothing by hardware standards, yet it reverses the order of two events the user could see back-to-back on the screen. Production systems routinely have 100+ milliseconds of skew across data centers and seconds across the wide area. Any system relying on wall-clock order is a silent data-loss bug waiting to be triggered by a network blip or a leap second.`,
        `The second misconception is that Lamport clocks "solve" ordering. They do not. They impose an arbitrary total order on concurrent events — the numbers lie as badly as wall clocks do in the reverse direction. Lamport clocks are brilliant not because they are true, but because causality does not actually depend on the order of concurrent events. By ordering them arbitrarily but consistently, the system avoids paradoxes. But looking at two Lamport numbers, you cannot tell if they are ordered because one caused the other or because they happened to be assigned consecutive values while running concurrently.`,
        `Vector clocks are not free. The O(n) space and the churn pain in dynamic systems are real. Many systems prefer Lamport clocks or logical timestamps + explicit message tracking because vectors scale poorly. Dynamo got away with vectors in early years; modern clusters are larger and more fluid, and most systems have moved away from full vector clocks.`,
        `The biggest TrueTime misconception is that it makes time "real." GPS and atomic clocks do not know about the network or the application — TrueTime is still an interval, still an approximation, and the commit-wait latency is a tax on every write. Also, TrueTime is coupled to Spanner's architecture; you cannot plug TrueTime alone into an existing database. The lesson is not "use TrueTime"; it is "if you buy enough hardware and accept the latency tax, wall-clock consistency becomes achievable globally."`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Raft Leader Election to see Lamport clocks in action: terms are logical clocks that enforce safety through total order. Then study Transaction Isolation Levels to understand how consistency is defined and how MVCC (multi-version concurrency control) pairs with causality to offer snapshots without locks. Move to Sharding & Partitioning to see the cross-shard consistency challenge that TrueTime solves — when you split a database across machines, how do you guarantee a read sees a consistent view? Dive into Distributed Tracing to understand how modern observability uses timestamps (including TrueTime in Google Cloud) to reconstruct the causal graph of a request. Finally, explore MVCC Internals & VACUUM to see how logical timestamps and versioning work inside a real transactional engine.`,
      ],
    },
  ],
};

