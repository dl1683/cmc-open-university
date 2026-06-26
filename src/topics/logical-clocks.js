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
        'Read events as actions on different machines and arrows as causal evidence. A same-process arrow means one event happened after another on the same machine; a message arrow means the receive could know about the send. Active highlights show the ordering fact being tested, not a physical timestamp.',
        {type: 'callout', text: "Distributed clocks are ordering evidence, not time decoration; use the clock whose guarantee matches the merge rule."},
        {type: 'image', src: './assets/gifs/logical-clocks.gif', alt: 'Animated walkthrough of the logical clocks visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed systems need to decide which write wins, which replica is stale, whether two updates conflict, and whether a read is allowed to see a transaction. On one machine, local order is often clear. Across machines, clock skew and network delay make wall-clock order unreliable.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Internet topology map with many connected paths', caption: 'Distributed events cross variable network paths, so timestamp order can diverge from causal order whenever skew and latency overlap. Source: Wikimedia Commons, The Opte Project, CC BY 2.5.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is last-write-wins by timestamp. Each server stamps its write with local wall time, replicas sort by timestamp, and the newest stamp wins. It is compact, easy to print, and easy to explain.',
        'NTP and clock synchronization make this approach tempting. They reduce error, but they do not remove it. Any two events closer together than the remaining uncertainty window cannot be safely ordered by wall time alone.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is skew. If server S1 is 80 ms fast, a write at real time 10:00:00.020 can receive timestamp 10:00:00.100. A later correction on S2 at real time 10:00:00.050 can receive timestamp 10:00:00.050 and lose under last-write-wins.',
        'The bug is silent because every timestamp looks valid. The merge rule trusted clock display more than causal evidence. A distributed clock must therefore encode what could have caused what, or expose physical-time uncertainty and wait it out.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Causality is a partial order. Event A happens before event B if A is earlier on the same process, A sends a message that B receives, or a chain of those facts connects them. If no path exists either way, the events are concurrent, which means unordered by evidence rather than simultaneous.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Vector_Clock.svg/500px-Vector_Clock.svg.png', alt: 'Vector clock diagram showing causes, effects, and independent events', caption: 'Vector clocks make partial order visible: dominated vectors carry causal history, while non-dominated vectors expose concurrency. Source: Wikimedia Commons, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Lamport clocks keep one integer per process. Increment for each local event, send the integer with messages, and on receive set local to max(local, received) + 1. If A caused B, then A has a smaller Lamport number than B, but a smaller number does not prove causality.',
        'Vector clocks keep one counter per participant. One vector is before another if every component is less than or equal and at least one is smaller. If each vector is larger in some component, the events are concurrent and the application needs a merge rule.',
        'TrueTime-style systems take the physical-clock path. They return an interval rather than a single instant and delay commit visibility until the uncertainty interval has passed. The system buys bounded clock uncertainty, then pays latency to make timestamps globally meaningful.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Logical clocks work because messages carry evidence. A receiver can know a send happened before the receive, so carrying clock metadata across messages preserves causal history. Local increments preserve same-process order.',
        'Vector-clock correctness comes from componentwise dominance. If vector X is less than or equal to vector Y in every slot, Y has seen at least the history X records. If neither dominates, neither history contains the other, so overwriting one with the other would invent an order.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lamport clocks are O(1) space and cheap to update, but they hide concurrency. Vector clocks are O(n) in participants, so metadata grows when replicas, clients, or shards grow. Hybrid logical clocks keep constant-size timestamps closer to wall time but still depend on clock assumptions.',
        'TrueTime-like designs cost hardware, monitoring, and commit-wait latency. If uncertainty epsilon is 7 ms, a write may wait about that long before it is externally visible. The cost buys a stronger timestamp contract, but only if the whole system respects the uncertainty bound.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Lamport-style numbers appear in leader terms, log sequence numbers, epochs, and protocols that need monotonic progress. Vector clocks and version vectors appear in eventually consistent stores, anti-entropy sync, and conflict detection. Hybrid logical clocks appear in databases that want causal-ish timestamps near wall time without atomic-clock infrastructure.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Causal order is a directed graph property: arrows justify before and after, while missing paths mean the application must decide how to merge. Source: Wikimedia Commons, David W., public domain.'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The common failure is using one timestamp kind for the wrong job. Wall time is useful for humans and retention, but unsafe as the only merge signal for close writes. Lamport clocks provide order for progress, but they cannot tell whether two writes are concurrent.',
        'Vector clocks fail operationally when metadata growth and membership churn are ignored. TrueTime-like systems fail if the clock uncertainty is not actually bounded or if the application cannot tolerate commit-wait. The clock guarantee must match the merge rule.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Two replicas store a name. At real time 0 ms, S1 writes Ana, but S1 clock is 80 ms fast, so the stamp is 80 ms. At real time 50 ms, S2 writes Anna with a correct clock, so the stamp is 50 ms. Last-write-wins keeps Ana because 80 is greater than 50, even though Anna was the correction.',
        'With vector clocks over S1 and S2, the first write has [1, 0] and the second independent write has [0, 1]. Neither vector dominates, so the system detects concurrency instead of silently choosing a winner. The application can then ask a user, merge fields, or apply a domain-specific rule.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Lamport, Time, Clocks, and the Ordering of Events in a Distributed System. Then read Spanner for TrueTime and a modern distributed database design that exposes physical-clock uncertainty instead of hiding it.',
        'Study consensus terms, CRDTs, transaction isolation, distributed tracing, hybrid logical clocks, and version vectors. The next exercise is to compare two vector stamps and state whether they are before, after, or concurrent.',
      ],
    },
  ],
};
