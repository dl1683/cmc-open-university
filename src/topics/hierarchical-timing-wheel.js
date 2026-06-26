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
  const wheelSize = 8;
  const timers = [
    { name: 'A', delay: 3 },
    { name: 'B', delay: 9 },
    { name: 'C', delay: 17 },
    { name: 'D', delay: 33 },
  ];

  yield {
    state: wheelFlow('A timer wheel is a circular array of buckets'),
    highlight: { active: ['timer', 'slot'], found: ['tick', 'fire'] },
    explanation: `A timing wheel stores timers in ${wheelSize} buckets by deadline tick. Each tick advances the hand to the next slot and expires the timers waiting there.`,
    invariant: `Insertion chooses a bucket by deadline mod ${wheelSize}; expiry scans only the current bucket.`,
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
    explanation: `A hashed ${wheelSize}-slot wheel can store far-future timers in the same slot with a rounds counter. Slot ${timers[1].delay % wheelSize} holds +${timers[1].delay}, +${timers[2].delay}, and +${timers[3].delay}, but each needs ${Math.floor(timers[1].delay / wheelSize)}, ${Math.floor(timers[2].delay / wheelSize)}, and ${Math.floor(timers[3].delay / wheelSize)} full rotations before firing.`,
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
    explanation: `A heap is precise and general. A ${wheelSize}-slot wheel is excellent for many approximate timeouts like these ${timers.length} timers, especially when cancellation and insertion must be O(1).`,
  };

  yield {
    state: wheelFlow('Timing wheels trade precision for throughput'),
    highlight: { active: ['tick', 'fire'], compare: ['slot'], found: ['list'] },
    explanation: `The tick duration is the precision contract across the ${wheelSize} slots. With a 100 ms tick, each of the ${timers.length} timers fires on a nearby tick boundary. That is fine for network timeouts and retries, but not for high-resolution scheduling.`,
  };
}

function* hierarchicalTimers() {
  const levels = 3;
  const ticksPerLevel = [1, 8, 64];
  const kafkaOps = ['produce ack', 'fetch wait', 'watch list', 'timeout'];

  yield {
    state: hierarchyFlow('Outer wheels handle far-future deadlines'),
    highlight: { active: ['near', 'mid', 'far'], found: ['cascade'] },
    explanation: `A ${levels}-level hierarchy uses wheels with coarser resolutions (${ticksPerLevel.join(', ')} ticks). Near timers go into L0. Far timers wait in outer wheels until time advances enough to cascade them inward.`,
    invariant: `The ${levels}-level hierarchy avoids huge round counters or a massive single wheel.`,
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
    explanation: `As each outer slot becomes current, its timers are redistributed into the lower level. With resolutions of ${ticksPerLevel.join(', ')} ticks across ${levels} levels, the cost is paid when deadlines become close enough to matter.`,
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
    explanation: `Kafka request purgatory combines ${kafkaOps.length} operation types (${kafkaOps.join(', ')}) with timeout timers across a ${levels}-level wheel. A delayed request can complete because its condition becomes true or because the wheel reaches its deadline.`,
  };

  yield {
    state: hierarchyFlow('Use wheels for timeout scale, not exact alarms'),
    highlight: { active: ['cascade', 'expire'], compare: ['far'], found: ['near'] },
    explanation: `The final design test: if timers are numerous, approximate, cancelable, and mostly timeouts, ${levels}-level wheels with resolutions ${ticksPerLevel.join('/')} shine. If every deadline needs strict ordering and exact precision, a heap or high-resolution timer path may be better.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the wheel as a circular array of time buckets. The hand is the current tick, and a timer goes into a bucket based on remaining ticks. A hierarchy keeps far-future timers in coarser buckets until they are near enough to refine.',
        {type: 'image', src: './assets/gifs/hierarchical-timing-wheel.gif', alt: 'Animated walkthrough of the hierarchical timing wheel visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Servers create timers for deadlines, retries, cache TTLs, sessions, and idle connections. Many timers tolerate firing on a nearby tick boundary. Timing wheels exist to make start, cancel, and expire cheap under high timer churn.',
        {type: 'callout', text: 'A timing wheel spends precision only near expiration: most timeout work becomes bucket movement instead of global sorting.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious structure is a min-heap keyed by exact deadline. It is precise and simple: insert and remove-min cost O(log n). That is often right for small timer sets or strict ordering.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Binary_Heap_with_Array_Implementation.JPG/500px-Binary_Heap_with_Array_Implementation.JPG', alt: 'Binary heap diagram with the corresponding array representation', caption: 'A deadline heap is the baseline timer scheduler that timing wheels often replace at very high churn. Source: Wikimedia Commons, Binary heap with array implementation.'},
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The heap wall is churn. Millions of starts and cancels per minute make O(log n) maintenance visible. A single wheel also has a range wall: far deadlines either need round counters or an enormous mostly empty wheel.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A timer due in d ticks maps to slot (now + d) mod W. Expiration becomes scanning the current bucket instead of sorting every deadline. Coarse outer wheels delay precision until the timer is close enough for precision to matter.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/75/RingNetwork.svg', alt: 'Ring network diagram with nodes connected in a circle', caption: 'A timing wheel is also a circular structure: the active cursor repeatedly visits buckets. Source: Wikimedia Commons, Ring network.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose a tick size and wheel size. Insert computes remaining ticks and links the timer into a bucket. Each tick advances the hand, scans that bucket, fires due timers, and cascades outer-wheel timers down when their coarse bucket becomes current.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is bucket eligibility. A timer is examined when its bucket becomes current at the resolution that represents it. If the deadline is due under the tick contract, it fires; otherwise it moves closer to a finer bucket.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insertion is O(1) for fixed wheel levels, and cancellation is O(1) with a handle. Tick cost is O(k + c), where k is timers in the active bucket and c is cascaded timers. Smaller ticks improve precision but increase tick overhead; larger ticks add jitter.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Timing wheels fit approximate, cancel-heavy timeouts in RPC systems, brokers, kernels, event loops, game servers, and cache systems. Kafka request purgatory and Netty HashedWheelTimer use this shape because cheap common-case timer maintenance matters.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt: 'State transition diagram for process states', caption: 'Timeouts and retries drive state transitions in systems that use high-volume timer schedulers. Source: Wikimedia Commons, Process states.'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A wheel is wrong for strict next-deadline ordering, very high precision, or tiny timer sets where a heap is simpler. It also fails under bucket storms: 100,000 timers in one bucket still means 100,000 callbacks to manage.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use an 8-slot wheel with 10 ms ticks and current slot 3. A timer due in 25 ms is 3 ticks away, so it maps to (3 + 3) mod 8 = slot 6 and fires around 30 ms. The tick contract explains the 5 ms lateness.',
        'A timer due in 95 ms is 10 ticks away. It maps to slot 5 with one full round remaining, or to an outer wheel until it gets close. Compared with a heap of 1,000,000 timers, the wheel avoids about log2(n)=20 comparisons on insert but accepts bucketed time.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Varghese and Lauck on hashed and hierarchical timing wheels, Kafka request purgatory notes, and Netty HashedWheelTimer documentation. Study binary heaps, ring buffers, linked lists, event loops, retries, jitter, and request deadlines next.',
      ],
    },
  ],
};
