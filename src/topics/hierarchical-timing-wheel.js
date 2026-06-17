// Hierarchical timing wheels: bucket timers by deadline ticks instead of
// keeping every timer in one ordered heap.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'hierarchical-timing-wheel',
  title: 'Hierarchical Timing Wheel',
  category: 'Systems',
  summary: 'A scalable timer data structure: put deadlines into circular buckets, advance one slot per tick, and use outer wheels for far-future timeouts.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['hashed wheel', 'hierarchical timers'], defaultValue: 'hashed wheel' },
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

  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function wheelFlow(title) {
  return graphState({
    nodes: [
      { id: 'timer', label: 'timer', x: 0.8, y: 3.2, note: 'deadline' },
      { id: 'slot', label: 'slot', x: 2.7, y: 3.2, note: 'bucket' },
      { id: 'list', label: 'list', x: 4.6, y: 3.2, note: 'same tick' },
      { id: 'tick', label: 'tick', x: 6.5, y: 3.2, note: 'advance' },
      { id: 'fire', label: 'fire', x: 8.4, y: 3.2, note: 'expired' },
    ],
    edges: [
      { id: 'e-timer-slot', from: 'timer', to: 'slot' },
      { id: 'e-slot-list', from: 'slot', to: 'list' },
      { id: 'e-list-tick', from: 'list', to: 'tick' },
      { id: 'e-tick-fire', from: 'tick', to: 'fire' },
    ],
  }, { title });
}

function hierarchyFlow(title) {
  return graphState({
    nodes: [
      { id: 'near', label: 'near', x: 0.8, y: 3.2, note: 'L0 wheel' },
      { id: 'mid', label: 'mid', x: 2.7, y: 3.2, note: 'L1 wheel' },
      { id: 'far', label: 'far', x: 4.6, y: 3.2, note: 'L2 wheel' },
      { id: 'cascade', label: 'cascade', x: 6.5, y: 3.2, note: 'move down' },
      { id: 'expire', label: 'expire', x: 8.4, y: 3.2, note: 'run task' },
    ],
    edges: [
      { id: 'e-near-mid', from: 'near', to: 'mid' },
      { id: 'e-mid-far', from: 'mid', to: 'far' },
      { id: 'e-far-cascade', from: 'far', to: 'cascade' },
      { id: 'e-cascade-expire', from: 'cascade', to: 'expire' },
    ],
  }, { title });
}

function* hashedWheel() {
  yield {
    state: wheelFlow('A timer wheel is a circular array of buckets'),
    highlight: { active: ['timer', 'slot'], found: ['tick', 'fire'] },
    explanation: 'A timing wheel stores timers in buckets by deadline tick. Each tick advances the hand to the next slot and expires the timers waiting there.',
    invariant: 'Insertion chooses a bucket by deadline; expiry scans only the current bucket.',
  };

  yield {
    state: labelMatrix(
      'Wheel size 8, now at slot 0',
      [
        { id: 'a', label: 'A +3' },
        { id: 'b', label: 'B +9' },
        { id: 'c', label: 'C +17' },
        { id: 'd', label: 'D +33' },
      ],
      [
        { id: 'slot', label: 'slot' },
        { id: 'rounds', label: 'rounds' },
      ],
      [
        ['3', '0'],
        ['1', '1'],
        ['1', '2'],
        ['1', '4'],
      ],
    ),
    highlight: { active: ['b:slot', 'c:slot', 'd:slot'], compare: ['b:rounds', 'c:rounds', 'd:rounds'] },
    explanation: 'A hashed wheel can store far-future timers in the same slot with a rounds counter. Slot 1 holds +9, +17, and +33, but each needs a different number of full rotations before firing.',
  };

  yield {
    state: labelMatrix(
      'Timer operations',
      [
        { id: 'start', label: 'start timer' },
        { id: 'cancel', label: 'cancel timer' },
        { id: 'tick', label: 'tick' },
        { id: 'expire', label: 'expire slot' },
      ],
      [
        { id: 'heap', label: 'binary heap' },
        { id: 'wheel', label: 'timing wheel' },
      ],
      [
        ['O(log n)', 'O(1) bucket'],
        ['find/remove handle', 'unlink handle'],
        ['peek min', 'advance hand'],
        ['pop until due', 'scan bucket'],
      ],
    ),
    highlight: { found: ['start:wheel', 'tick:wheel'], compare: ['start:heap', 'expire:heap'] },
    explanation: 'A heap is precise and general. A wheel is excellent for many approximate timeouts with bounded resolution, especially when cancellation and insertion must be cheap.',
  };

  yield {
    state: wheelFlow('Timing wheels trade precision for throughput'),
    highlight: { active: ['tick', 'fire'], compare: ['slot'], found: ['list'] },
    explanation: 'The tick duration is the precision contract. With a 100 ms tick, a timer fires on a nearby tick boundary. That is fine for network timeouts and retries, but not for high-resolution scheduling.',
  };
}

function* hierarchicalTimers() {
  yield {
    state: hierarchyFlow('Outer wheels handle far-future deadlines'),
    highlight: { active: ['near', 'mid', 'far'], found: ['cascade'] },
    explanation: 'A hierarchy uses several wheels with coarser resolutions. Near timers go into the inner wheel. Far timers wait in outer wheels until time advances enough to cascade them inward.',
    invariant: 'Hierarchy avoids huge round counters or a massive single wheel.',
  };

  yield {
    state: labelMatrix(
      'Hierarchy example',
      [
        { id: 'l0', label: 'L0' },
        { id: 'l1', label: 'L1' },
        { id: 'l2', label: 'L2' },
        { id: 'due', label: 'due soon' },
      ],
      [
        { id: 'resolution', label: 'resolution' },
        { id: 'stores', label: 'stores' },
      ],
      [
        ['1 tick', 'next seconds'],
        ['8 ticks', 'next minute'],
        ['64 ticks', 'later'],
        ['cascade down', 'inner wheel'],
      ],
    ),
    highlight: { active: ['l1:stores', 'l2:stores'], found: ['due:stores'] },
    explanation: 'As each outer slot becomes current, its timers are redistributed into the lower level. The cost is paid when deadlines become close enough to matter.',
  };

  yield {
    state: labelMatrix(
      'Kafka purgatory shape',
      [
        { id: 'produce', label: 'produce ack' },
        { id: 'fetch', label: 'fetch wait' },
        { id: 'watch', label: 'watch list' },
        { id: 'timeout', label: 'timeout' },
      ],
      [
        { id: 'waits for', label: 'waits for' },
        { id: 'wheel role', label: 'wheel role' },
      ],
      [
        ['replica acks', 'deadline'],
        ['enough bytes', 'deadline'],
        ['event trigger', 'complete early'],
        ['time passes', 'force complete'],
      ],
    ),
    highlight: { found: ['produce:wheel role', 'fetch:wheel role', 'timeout:wheel role'], active: ['watch:wheel role'] },
    explanation: 'Kafka request purgatory combines event-driven watchers with timeout timers. A delayed request can complete because its condition becomes true or because the wheel reaches its deadline.',
  };

  yield {
    state: hierarchyFlow('Use wheels for timeout scale, not exact alarms'),
    highlight: { active: ['cascade', 'expire'], compare: ['far'], found: ['near'] },
    explanation: 'The final design test: if timers are numerous, approximate, cancelable, and mostly timeouts, wheels shine. If every deadline needs strict ordering and exact precision, a heap or high-resolution timer path may be better.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'hashed wheel') yield* hashedWheel();
  else if (view === 'hierarchical timers') yield* hierarchicalTimers();
  else throw new InputError('Pick a timing-wheel view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large systems manage huge numbers of timers: network request deadlines, retry delays, session expiry, delayed operations, idle connection cleanup, cache TTLs, and safety timeouts. Most of those timers do not need nanosecond precision. They need to fire close enough to a deadline and be cheap to start, cancel, and expire.',
        'A binary heap gives exact next-deadline ordering, but every insert costs O(log n), and cancellation needs handles or lazy deletion. That is often fine for small timer sets. It becomes expensive when a server creates and cancels millions of approximate timeouts per minute.',
        'A timing wheel trades exact global ordering for bucketed time. Timers go into slots of a circular array. Each tick advances a hand and scans the current bucket. A hierarchy adds coarser wheels so far-future timers do not force one enormous wheel or long round counters.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious structure is a binary heap keyed by deadline. It is precise, simple, and often correct. It becomes less attractive when the workload has huge timer counts, frequent cancellation, and tolerance for firing on a nearby tick boundary.',
        'The opposite mistake is assuming a wheel is always better. If every timer needs strict ordering or high-resolution precision, the wheel tax shows up as rounding, bucket bursts, and more complicated expiry logic.',
        'Another naive approach is one OS timer per logical timeout. That gives the kernel too much bookkeeping and the application too little control over batching, cancellation, and callback pacing. Timing wheels are usually application-level data structures built to manage many logical timers behind a smaller scheduling mechanism.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'For a wheel of size W, a timer due in d ticks maps to slot (now + d) mod W. If the deadline is farther than the inner wheel can represent, the timer either carries a rounds counter or waits in an outer wheel until it cascades inward.',
        'The invariant is bucket eligibility: a timer is only examined when its slot becomes current or when a coarser bucket cascades down. Insertion can be O(1), cancellation can be O(1) with a handle, and tick work is proportional to the timers in the active bucket plus cascades. The price is resolution and possible burstiness.',
        'The deeper idea is that many timeout systems care about scale more than exact ordering. If a request timeout can fire anywhere in the next tick interval, then sorting it precisely among thousands of neighboring deadlines is wasted work. Bucketed time turns that tolerance into cheaper operations.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A hashed wheel has an array of buckets and a current slot. To start a timer, compute how many ticks remain until its deadline, map that delay to a bucket, and insert the timer into that bucket’s list. If the wheel uses rounds counters, a timer several rotations away stores how many full cycles must pass before it is eligible.',
        'On each tick, the wheel advances the current slot. It scans that bucket, decrements or checks rounds counters, and fires timers whose deadline is due. Cancellation is usually handled by a timer handle pointing into a bucket list, making removal cheap when the implementation keeps enough bookkeeping.',
        'A hierarchical wheel adds multiple wheels with coarser resolutions. Near timers go into the inner wheel. Far timers go into outer wheels. When an outer slot becomes current, its timers cascade down to a lower level where their deadlines can be represented more precisely.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The hashed-wheel view proves that expiry is local to the current bucket. The data structure does not search the whole timer set on every tick. It advances one slot and handles the timers assigned there. That is the core throughput win.',
        'The slot table proves how far-future timers can share buckets. A timer due in 9 ticks and one due in 17 ticks may map to the same slot on an 8-slot wheel, but a rounds counter or hierarchy distinguishes which rotation should fire it.',
        'The hierarchy view proves why multiple wheels help. Far deadlines wait in coarse buckets until time advances enough to justify refining them. The cascade is not incidental; it is the mechanism that avoids paying near-deadline precision cost for timers that are still far away.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because timeout workloads are often approximate, bursty, and cancellation-heavy. A network timeout firing a few milliseconds late is usually acceptable. A retry scheduled for the next tick boundary is usually fine. What matters more is that starting and canceling timers does not become the bottleneck.',
        'It also works because deadlines naturally cluster. Many requests use the same timeout values: 100 ms, 1 second, 30 seconds, 5 minutes. Buckets exploit that clustering. The system can group timers with similar deadlines rather than maintaining a total order among them.',
        'The hierarchical version works because most timers are not near expiry at insertion time. Coarse placement is enough until the timer becomes closer. Refinement is delayed until it can matter.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Insertion is often O(1), cancellation can be O(1) with handles, and each tick scans only the current bucket plus any cascaded timers. But the worst case can still be ugly if too many timers land in one bucket or a cascade dumps a large batch at once.',
        'The tick duration is a contract. A 100 ms tick means timers fire on nearby 100 ms boundaries. Smaller ticks improve precision but increase tick overhead and may create more scheduler pressure. Larger ticks improve throughput but add latency jitter.',
        'Callbacks are outside the data-structure cost. If the current bucket expires ten thousand heavy callbacks, the event loop or timer thread can stall. Production systems often batch, cap work per tick, or dispatch callbacks onto worker pools to prevent expiry storms from blocking timer maintenance.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Timing wheels fit numerous, approximate, cancelable timeouts: network I/O deadlines, retry timers, request purgatories, session expiry, cache TTLs, and systems where a timeout is a safety fallback rather than a precise alarm.',
        'Kafka request purgatory is the systems example. A delayed request can complete early when its condition becomes true or complete later when the wheel reaches its timeout. Netty uses a hashed wheel for approximate I/O timeout scheduling for the same reason: cheap common-case timer management matters more than microsecond exactness.',
        'The design also appears in kernels, brokers, RPC runtimes, and game servers. Anywhere the system has many future events with bounded precision needs, a wheel is worth considering.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A timing wheel is the wrong tool for strict next-deadline ordering, high-resolution timers, small timer sets where a heap is simpler, or workloads where many timers fall into one bucket and create expiry bursts.',
        'Callbacks still need bounds. If one current bucket triggers thousands of heavy callbacks, the tick loop stalls even though timer insertion was cheap. The data structure manages deadlines; it does not make the work behind them free.',
        'Another failure is hidden clock assumptions. Tick drift, pauses, scheduler delays, VM suspension, and long stop-the-world events can all make many timers appear due at once. A robust implementation must decide whether to catch up aggressively, coalesce, shed, or preserve approximate spacing after a pause.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Varghese and Lauck timing wheel paper at https://www.cs.columbia.edu/~nahum/w6998/papers/sosp87-timing-wheels.pdf, Confluent Kafka purgatory writeup at https://www.confluent.io/blog/apache-kafka-purgatory-hierarchical-timing-wheels/, Netty HashedWheelTimer docs at https://netty.io/4.0/api/io/netty/util/HashedWheelTimer.html, and Linux timer-wheel discussion at https://lwn.net/Articles/646950/. Study Kafka Request Purgatory Timing Wheel Case Study, Ring Buffer, Linked List, Binary Heap, The Event Loop, Retries, Backoff & Jitter, Circuit Breakers & Deadlines, and MillWheel Streaming Case Study next.',
        'A good exercise is to simulate one heap and one timing wheel under the same workload: many starts, many cancels, and a small set of common timeout values. Measure insertion cost, cancellation cost, expiry burst size, and timer lateness. That makes the tradeoff concrete.',
      ],
    },
  ],
};
