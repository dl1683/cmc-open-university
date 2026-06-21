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
  const r2 = (v) => Math.round(v * 100) / 100;
  const skewMs = 80;
  const nEvents = 3;
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
      format: (v) => ['', 'S1: user sets name = "Ana"', '10:00:00.100 (S1 clock, 80ms fast)', 'S2: user FIXES it to "Anna"', '10:00:00.050 (S2 clock, correct)', 'keeps the "later" stamp…', '"Ana" wins — the CORRECTION is silently dropped âš '][v],
    }),
    highlight: { removed: ['lww:stamp'] },
    explanation: `Read the ${nEvents} events in real order: "Ana" is written, then the user corrects it to "Anna." Now read the timestamps: S1 is ${skewMs}ms fast, so last-write-wins keeps the older value. The bug is not a crash or a lost packet; it is a merge rule trusting clocks more than causality — ${skewMs}ms of skew silently dropped a correct user action.`,
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
    explanation: `This step puts a size on the risk. Ordinary clocks drift at ~${r2(10)}–${r2(50)} ppm, NTP only narrows the error window to a few ms on a LAN, and virtual machines or leap-smear behavior can pause time from the application's point of view. If two writes are closer together than the ${skewMs}ms skew window, a timestamp cannot safely say which user action came first.`,
  };

  const hbNodes = ['A', 'B', 'C', 'D', 'E'];
  const hbEdges = 4;
  const nProcesses = 2;
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
    explanation: `The graph shows ${hbNodes.length} events across ${nProcesses} processes connected by ${hbEdges} arrows. Same-process arrows, message arrows, and transitive chains create happens-before order: ${hbNodes[0]} can be known to precede ${hbNodes[4]} because there is an arrow path. ${hbNodes[0]} and ${hbNodes[2]} have no path either way, so they are concurrent. A correct distributed algorithm must not depend on choosing a real first event between them.`,
    invariant: 'Happens-before is a partial order: events unreachable by arrows are concurrent — unordered in principle, not just in practice.',
  };
}

function* logicalAndTrue() {
  const lamportClocks = [1, 2, 1, 3, 4]; // A, B, C, D, E
  const bClock = lamportClocks[1];
  const dClock = lamportClocks[3];
  const vecX = [2, 0];
  const vecY = [3, 1];
  const vecZ = [0, 1];
  const epsilonRange = [1, 7];
  const nTools = 5;
  const hlcBits = 64;
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
    explanation: `Lamport clocks make the arrows countable. Tick for local events, and on receive jump to max(local, message) + 1. In the diagram, B carries ${bClock} to P2, so D becomes ${dClock} (= max(${lamportClocks[2]}, ${bClock}) + 1). The guarantee is one-way: causally earlier means a smaller clock. The reverse is false; a larger number may be causal order or just an arbitrary tie-break over concurrent work.`,
    invariant: 'Lamport: happens-before â‡’ smaller clock. The reverse implication does not hold — concurrency is invisible.',
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
      format: (v) => ['—', 'CONCURRENT: [2,0] vs [0,1] — each wins one slot', 'X â†’ Y: [2,0] â‰¤ [3,1] componentwise', 'Z â†’ Y: [0,1] â‰¤ [3,1]', 'CONCURRENT (symmetric)'][v],
    }),
    highlight: { compare: ['v1:vsZ'], found: ['v2:vsX'] },
    explanation: `Vector clocks keep one counter per participant, so comparison can distinguish "before" from "unrelated." If every slot in X is less than or equal to Y, X happened before Y. If each vector wins in some slot, as [${vecX}] and [${vecZ}] do, the writes are concurrent and need an application merge instead of a silent overwrite. X happened before Y because [${vecX}] is componentwise ≤ [${vecY}].`,
    invariant: 'Vector â‰¤ in every slot â‡” happens-before; mutual non-domination â‡” concurrent. Cost: one counter per participant.',
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
      format: (v) => ['', 'GPS receivers + atomic clocks in every datacenter', 'now() returns an INTERVAL [earliest, latest], ε â‰ˆ 1–7ms wide', 'hold each commit until its interval has fully passed (~ε)', 'timestamps become globally TRUE — snapshot reads need no coordination'][v],
    }),
    highlight: { active: ['wait:what'], found: ['payoff:what'] },
    explanation: `TrueTime is the expensive alternative: keep a bounded uncertainty interval (epsilon ≈ ${epsilonRange[0]}–${epsilonRange[1]}ms) and wait until it has passed before exposing a commit. The animation highlights commit-wait because that is the trick. Spanner does not pretend clocks are perfect; it pays hardware and ~${epsilonRange[1]}ms of latency so a timestamp becomes globally unambiguous after the wait.`,
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
    explanation: `The ${nTools} rows are a design menu. Wall clocks are readable but unsafe near skew. Lamport clocks are tiny but hide concurrency. Vector clocks expose conflicts but grow with participants (O(n) per stamp). Hybrid logical clocks are the common compromise: close to wall time, causally safe enough for many databases, and constant size (${hlcBits} bits). TrueTime buys a stronger contract with hardware and ~${epsilonRange[1]}ms write latency.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Clocks & Ordering: Lamport to TrueTime. Wall clocks lie across machines — order events by causality instead, or buy atomic truth and wait out its error bars..",
        {type: 'callout', text: "Distributed clocks are ordering evidence, not time decoration; use the clock whose guarantee matches the merge rule."},
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/logical-clocks.gif', alt: 'Animated walkthrough of the logical clocks visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed systems constantly need to answer ordering questions: which write wins, which log entry is newer, which replica has missed an update, whether two changes conflict, and whether a read is allowed to see a write. On one machine, a local clock and a local sequence number often feel enough. Across machines, they are not.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Internet topology map with many connected paths', caption: 'Distributed events cross variable network paths, so timestamp order can diverge from causal order whenever skew and latency overlap. Source: Wikimedia Commons, The Opte Project, CC BY 2.5.'},
        'Wall-clock timestamps are tempting because they are easy to print and sort, but they are not reliable evidence across machines. Small skew is enough to drop a real user correction under last-write-wins. The system may keep the value with the later timestamp even though the human action happened earlier.',
        'Logical clocks exist to replace "what time did this happen?" with "what could this event have known or caused?" That is the question databases, CRDTs, gossip protocols, consensus terms, anti-entropy sync, and distributed traces actually need. The clock is not for telling time. It is for carrying ordering evidence.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is last-write-wins by wall-clock timestamp. Each server stamps its write, replicas sort by timestamp, and the newest value wins. It is simple, compact, and easy to explain. It also silently loses correct user actions when clocks are skewed.',
        'NTP narrows the problem but does not remove it. Clocks drift, virtual machines pause, leap seconds get smeared, networks delay messages, and clock synchronization always leaves an uncertainty window. Any two events closer than that window cannot be safely ordered by wall time alone.',
        'Another shortcut is to invent a total order for every event. That may be necessary for a log or a consensus protocol, but it can be wrong for collaborative or eventually consistent data. If two writes are truly concurrent, the application may need to merge them rather than pretend one caused or superseded the other.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that causality is a partial order. An event can be known to happen before another event if it occurs earlier on the same process, sends a message that the other event receives, or is connected by a chain of those facts. Events with no causal path between them are concurrent.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Vector_Clock.svg/500px-Vector_Clock.svg.png', alt: 'Vector clock diagram showing causes, effects, and independent events', caption: 'Vector clocks make partial order visible: dominated vectors carry causal history, while non-dominated vectors expose concurrency. Source: Wikimedia Commons, CC BY-SA 3.0.'},
        'Concurrent does not mean simultaneous. It means the system has no causal evidence that one event should come before the other. That distinction matters because a merge policy, conflict detector, database timestamp, or trace analysis tool should not invent evidence it does not have.',
        'Different clocks preserve different amounts of this partial order. Lamport clocks preserve causal precedence in one direction. Vector clocks preserve enough metadata to detect concurrency. Hybrid logical clocks combine logical causality with approximate physical time. TrueTime keeps physical time but exposes uncertainty and waits before making timestamps globally meaningful.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Lamport clocks use one integer per process. Increment it for local events. When sending a message, include the current value. When receiving a message, set the local clock to max(local, received) + 1. If event A causally happens before event B, A will have a smaller Lamport clock than B.',
        'The reverse is not guaranteed. A smaller Lamport timestamp does not prove causality, because concurrent events also receive arbitrary numbers. Lamport clocks are good for compact monotonic progress and deterministic tie-breaking, but they do not reveal conflicts.',
        'Vector clocks keep one counter per participant. Each process increments its own slot and carries the vector with messages. One vector is before another if every component is less than or equal and at least one is smaller. If each vector is larger in some slot, the events are concurrent. That makes conflict detection possible, at the cost of metadata that grows with participants.',
        'TrueTime takes a different path. It uses clock infrastructure to return a bounded interval rather than a single exact instant. Spanner-style commit-wait delays visibility until the uncertainty interval has passed, making commit timestamps globally meaningful after the wait. The system does not ignore uncertainty; it pays latency to wait it out.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'The wall-clock view proves that timestamp order and real event order can diverge. The correction loses because the first server is fast. The bug is not a crash or packet loss. It is a merge rule trusting clock time more than causality.',
        'The happens-before graph proves the replacement invariant: arrows create defensible order; no arrow means concurrency. If A sends a message that eventually affects E, A happens before E. If A and C have no path between them, neither should be treated as causally first without an application rule.',
        'The Lamport view proves that one integer can count causal arrows but cannot expose concurrency. The vector-clock table proves why componentwise comparison matters. The TrueTime table proves the physical-clock alternative: expose uncertainty, then wait long enough that a timestamp becomes safe to use as a global ordering point.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Logical clocks work because messages are evidence. If one process sends information to another, the receiver can know that the send happened before the receive. By propagating counters with messages, the system turns causal structure into metadata that survives across machines.',
        'Vector clocks work because they keep each participant\'s contribution separate. Componentwise comparison can tell whether one event includes all the causal history of another. If neither vector dominates, the histories are independent enough that a merge or conflict resolution rule is needed.',
        'TrueTime works by making clock uncertainty explicit. Instead of pretending a physical timestamp is exact, it returns an interval. Commit-wait then ensures that once a transaction is visible, no other transaction can later claim an earlier real-time position that violates the timestamp order.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Lamport clocks are compact and cheap, but they hide concurrency. If you use them to pick a winner for concurrent writes, you may drop a conflict users expected to merge. They are best when monotonic progress or deterministic ordering matters more than conflict visibility.',
        'Vector clocks expose concurrency, but the stamp grows with participants and needs pruning rules for churn, replicas that disappear, and dynamic membership. Version vectors and dotted version vectors exist because production systems need more careful metadata management than a classroom vector.',
        'Hybrid logical clocks are a practical compromise: close to wall time, compact, and causally safer than raw timestamps for many database designs. TrueTime-like systems offer a stronger contract but require clock infrastructure, uncertainty monitoring, and commit-wait latency.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Lamport-style counters appear in consensus terms, leader epochs, idempotency tokens, log sequence numbers, and any protocol that needs monotonic progress without trusting wall time.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Causal order is a directed graph property: arrows justify before and after, while missing paths mean the application must decide how to merge. Source: Wikimedia Commons, David W., public domain.'},
        'Vector clocks and version vectors appear in eventually consistent storage, conflict detection, anti-entropy, and CRDT sync. They are useful when concurrent edits should be surfaced or merged instead of silently overwritten.',
        'Hybrid logical clocks show up in distributed SQL systems that want timestamps close to real time without Spanner-grade clock hardware. TrueTime matters when the product needs globally consistent timestamp reads across shards and is willing to pay for clock infrastructure plus write latency.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The common failure mode is overclaiming what a timestamp means. A timestamp can be a display hint, a causal token, a conflict detector, or a serialization point. Treating one kind as another is how systems lose writes while all checks pass.',
        'Wall clocks fail when used as the only correctness signal for concurrent writes. Lamport clocks fail when teams assume a total order means causal truth. Vector clocks fail operationally when metadata growth and membership churn are ignored. TrueTime-like designs fail when the system cannot actually bound uncertainty or tolerate commit-wait.',
        'A practical rule: use wall-clock timestamps for humans and retention policies, not as the only merge signal. Use Lamport-style numbers for monotonic progress. Use vector metadata when conflicts must be detected. Use physical-time guarantees only when the whole architecture measures and respects clock uncertainty.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Raft Leader Election for Lamport-like terms, CRDTs for merge rules that use causal metadata, Transaction Isolation Levels for snapshot semantics, Sharding & Partitioning for cross-shard read problems, and Distributed Tracing for the difference between timestamp order and request causality.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Clocks & Ordering: Lamport to TrueTime moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

