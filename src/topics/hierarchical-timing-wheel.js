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
      heading: 'What it is',
      paragraphs: [
        'A timing wheel is a data structure for managing many timers without keeping every deadline in one sorted priority queue. It uses a circular array of buckets. A timer is placed into the bucket corresponding to its future tick. On each tick, the hand advances and the current bucket is scanned for expired timers.',
        'A hierarchical timing wheel stacks several wheels at different resolutions. Near deadlines live in the fine wheel. Far deadlines live in coarser wheels and cascade downward as time advances. The structure is useful when millions of timeouts are approximate, cancelable, and mostly used as safety deadlines rather than exact alarms.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In a single hashed wheel of size W, a timer due in d ticks goes into slot (now + d) mod W. If d is larger than W, the timer can carry a rounds counter. Each time that slot is visited, the counter decreases; when it reaches zero, the timer expires. The bucket is usually a linked list so insertion and cancellation through a handle are cheap.',
        'Hierarchy avoids very large round counters and huge wheels. A deadline too far for the inner wheel is placed in an outer wheel. When the outer wheel reaches that bucket, timers are reinserted into the lower level at a more precise position. This is similar to carrying digits in a clock: seconds, minutes, hours, each with its own wheel.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Timer insertion can be O(1), cancellation can be O(1) with a direct handle, and each tick scans only the current bucket plus any cascaded timers. Expiry work is proportional to the timers that actually become due or need to move down. The tradeoff is resolution: a 100 ms tick cannot promise microsecond precision. Bad bucket sizing can also create bursts when too many timers land in the same slot.',
      ],
    },
    {
      heading: 'Complete case studies',
      paragraphs: [
        'Kafka Request Purgatory Timing Wheel Case Study is the canonical systems example. Produce and fetch requests can wait for conditions such as replica acknowledgments or enough bytes becoming available. They need event watchers for early completion and timeouts for forced completion. Hierarchical timing wheels made large numbers of delayed operations cheaper than a DelayQueue-style approach.',
        'Netty exposes HashedWheelTimer for approximate I/O timeout scheduling. Linux timer-wheel discussions separate ordinary timeout timers from high-resolution timers: wheels fit common timeout workloads, while precision-sensitive timers use a different path. The lesson is architectural: timer data structure choice depends on deadline precision, timer count, cancellation rate, and expiry burst tolerance.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A timing wheel is not automatically better than a Binary Heap. Heaps give exact next-deadline ordering and are simple for moderate timer counts. Wheels win when constant-time insertion/cancellation and coarse timeout precision matter more. Another mistake is hiding too much behind one shared wheel; timer callbacks must still be bounded, or expiry processing can stall the tick loop.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Varghese and Lauck timing wheel paper at https://www.cs.columbia.edu/~nahum/w6998/papers/sosp87-timing-wheels.pdf, Confluent Kafka purgatory writeup at https://www.confluent.io/blog/apache-kafka-purgatory-hierarchical-timing-wheels/, Netty HashedWheelTimer docs at https://netty.io/4.0/api/io/netty/util/HashedWheelTimer.html, and Linux timer-wheel discussion at https://lwn.net/Articles/646950/. Study Kafka Request Purgatory Timing Wheel Case Study, Ring Buffer, Linked List, Binary Heap, The Event Loop, Retries, Backoff & Jitter, Circuit Breakers & Deadlines, and MillWheel Streaming Case Study next.',
      ],
    },
  ],
};
