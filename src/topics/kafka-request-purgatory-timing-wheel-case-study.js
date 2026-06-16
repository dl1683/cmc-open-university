// Kafka request purgatory: delayed operations wait on event watchers and
// timeout through a hierarchical timing wheel.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kafka-request-purgatory-timing-wheel-case-study',
  title: 'Kafka Request Purgatory Timing Wheel Case Study',
  category: 'Systems',
  summary: 'How Kafka delays produce/fetch work with watcher lists, timeout timers, hierarchical timing wheels, linked-list buckets, immediate deletion, and purgatory metrics.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['delayed request', 'timer wheel'], defaultValue: 'delayed request' },
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

function purgatoryGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.8, y: 4.0, note: 'client' },
      { id: 'try', label: 'try', x: 2.2, y: 4.0, note: 'check' },
      { id: 'purg', label: 'purg', x: 3.8, y: 4.0, note: 'wait' },
      { id: 'watch', label: 'watch', x: 5.4, y: 2.8, note: 'keys' },
      { id: 'timer', label: 'timer', x: 5.4, y: 5.2, note: 'ttl' },
      { id: 'done', label: 'done', x: 7.4, y: 3.2, note: 'ok' },
      { id: 'exp', label: 'expire', x: 7.4, y: 5.2, note: 'fail' },
      { id: 'resp', label: 'resp', x: 9.0, y: 4.0, note: 'client' },
    ],
    edges: [
      { id: 'e-req-try', from: 'req', to: 'try' },
      { id: 'e-try-purg', from: 'try', to: 'purg' },
      { id: 'e-purg-watch', from: 'purg', to: 'watch' },
      { id: 'e-purg-timer', from: 'purg', to: 'timer' },
      { id: 'e-watch-done', from: 'watch', to: 'done' },
      { id: 'e-timer-exp', from: 'timer', to: 'exp' },
      { id: 'e-done-resp', from: 'done', to: 'resp' },
      { id: 'e-exp-resp', from: 'exp', to: 'resp' },
    ],
  }, { title });
}

function* delayedRequest() {
  yield {
    state: purgatoryGraph('A delayed request waits on both event and time'),
    highlight: { active: ['req', 'try', 'purg'], found: ['watch', 'timer'], compare: ['done', 'exp'] },
    explanation: 'Kafka puts a request in purgatory when the broker cannot answer it yet but expects either a cluster event or a timeout to settle it. The request is watched by keys and also placed on a timer.',
    invariant: 'A delayed operation completes once: by condition, timeout, or cancellation.',
  };

  yield {
    state: labelMatrix(
      'Purgatory parts',
      [
        { id: 'op', label: 'op' },
        { id: 'keys', label: 'keys' },
        { id: 'watch', label: 'watch' },
        { id: 'timer', label: 'timer' },
        { id: 'metric', label: 'metric' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'role', label: 'role' },
      ],
      [
        ['req', 'pending'],
        ['tp/id', 'wake'],
        ['lists', 'event'],
        ['wheel', 'ttl'],
        ['size', 'alert'],
      ],
    ),
    highlight: { active: ['watch:role', 'timer:role'], found: ['metric:role'], compare: ['op:role'] },
    explanation: 'The structure combines a hash map of watcher lists for event-driven completion with a timer for deadline-driven completion. Metrics expose how many requests are parked there.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'prod', label: 'produce', x: 0.8, y: 4.0, note: 'acks=all' },
        { id: 'log', label: 'append', x: 2.6, y: 4.0, note: 'leader' },
        { id: 'isr', label: 'ISR', x: 4.2, y: 4.0, note: 'wait' },
        { id: 'watch', label: 'watch', x: 5.9, y: 3.0, note: 'part' },
        { id: 'ack', label: 'ack', x: 7.6, y: 3.0, note: 'replica' },
        { id: 'done', label: 'done', x: 9.0, y: 4.0, note: 'send' },
        { id: 'timeout', label: 'ttl', x: 7.6, y: 5.0, note: 'fail' },
      ],
      edges: [
        { id: 'e-prod-log', from: 'prod', to: 'log' },
        { id: 'e-log-isr', from: 'log', to: 'isr' },
        { id: 'e-isr-watch', from: 'isr', to: 'watch' },
        { id: 'e-watch-ack', from: 'watch', to: 'ack' },
        { id: 'e-ack-done', from: 'ack', to: 'done' },
        { id: 'e-isr-timeout', from: 'isr', to: 'timeout' },
        { id: 'e-timeout-done', from: 'timeout', to: 'done' },
      ],
    }, { title: 'Produce waits for replication when acks=all' }),
    highlight: { active: ['prod', 'log', 'isr', 'watch'], found: ['ack', 'done'], compare: ['timeout'] },
    explanation: 'A produce request with all-replica acknowledgments can wait until follower replicas catch up. Partition progress wakes watcher lists; the timer protects the client from waiting forever.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'fetch', label: 'fetch', x: 0.8, y: 4.0, note: 'minB' },
        { id: 'check', label: 'check', x: 2.4, y: 4.0, note: 'bytes' },
        { id: 'watch', label: 'watch', x: 4.1, y: 3.0, note: 'part' },
        { id: 'append', label: 'append', x: 5.8, y: 3.0, note: 'data' },
        { id: 'reply', label: 'reply', x: 7.5, y: 3.0, note: 'enough' },
        { id: 'wait', label: 'wait', x: 4.1, y: 5.0, note: 'ttl' },
        { id: 'empty', label: 'reply', x: 7.5, y: 5.0, note: 'timeout' },
      ],
      edges: [
        { id: 'e-fetch-check', from: 'fetch', to: 'check' },
        { id: 'e-check-watch', from: 'check', to: 'watch' },
        { id: 'e-watch-append', from: 'watch', to: 'append' },
        { id: 'e-append-reply', from: 'append', to: 'reply' },
        { id: 'e-check-wait', from: 'check', to: 'wait' },
        { id: 'e-wait-empty', from: 'wait', to: 'empty' },
      ],
    }, { title: 'Fetch waits for enough data or max wait' }),
    highlight: { active: ['fetch', 'check', 'watch'], found: ['append', 'reply'], compare: ['wait', 'empty'] },
    explanation: 'A fetch can wait until enough bytes are available for the requested partitions. New appends wake the relevant watchers; fetch.wait.max.ms bounds the long poll.',
  };

  yield {
    state: labelMatrix(
      'Completion paths',
      [
        { id: 'cond', label: 'cond' },
        { id: 'time', label: 'time' },
        { id: 'cancel', label: 'cancel' },
        { id: 'purge', label: 'purge' },
      ],
      [
        { id: 'cause', label: 'cause' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['ack', 'done'],
        ['ttl', 'expire'],
        ['close', 'remove'],
        ['clean', 'trim'],
      ],
    ),
    highlight: { active: ['cond:effect', 'time:effect'], found: ['cancel:effect'], compare: ['purge:effect'] },
    explanation: 'The same delayed operation must be safe under multiple completion paths. The implementation needs an atomic completed flag and removal from timer and watcher structures without double response.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'purg size', min: 0, max: 100 }, y: { label: 'latency', min: 0, max: 100 } },
      series: [
        { id: 'healthy', label: 'ok', points: [{ x: 0, y: 5 }, { x: 30, y: 12 }, { x: 60, y: 22 }, { x: 100, y: 38 }] },
        { id: 'stuck', label: 'stuck', points: [{ x: 0, y: 5 }, { x: 30, y: 30 }, { x: 60, y: 65 }, { x: 100, y: 96 }] },
      ],
      markers: [{ id: 'alert', x: 72, y: 70, label: 'alert' }],
    }),
    highlight: { active: ['stuck', 'alert'], compare: ['healthy'] },
    explanation: 'Purgatory size is a symptom, not a verdict. Large fetch purgatory can be normal long polling; growing produce purgatory can point to replication lag, under-min-ISR partitions, or slow followers.',
  };
}

function* timerWheel() {
  yield {
    state: graphState({
      nodes: [
        { id: 'task', label: 'task', x: 0.8, y: 4.0, note: 'ttl' },
        { id: 'slot', label: 'slot', x: 2.5, y: 4.0, note: 'bucket' },
        { id: 'list', label: 'list', x: 4.2, y: 4.0, note: 'dll' },
        { id: 'over', label: 'over', x: 4.2, y: 2.4, note: 'coarse' },
        { id: 'tick', label: 'tick', x: 6.0, y: 4.0, note: 'advance' },
        { id: 'run', label: 'run', x: 7.8, y: 4.0, note: 'expire' },
      ],
      edges: [
        { id: 'e-task-slot', from: 'task', to: 'slot' },
        { id: 'e-slot-list', from: 'slot', to: 'list' },
        { id: 'e-slot-over', from: 'slot', to: 'over' },
        { id: 'e-over-slot', from: 'over', to: 'slot' },
        { id: 'e-list-tick', from: 'list', to: 'tick' },
        { id: 'e-tick-run', from: 'tick', to: 'run' },
      ],
    }, { title: 'Hierarchical wheel buckets deadlines' }),
    highlight: { active: ['task', 'slot', 'list'], found: ['tick', 'run'], compare: ['over'] },
    explanation: 'A timing wheel rounds deadlines into buckets. Near deadlines live in the fine wheel; far deadlines overflow into coarser wheels and later cascade down.',
    invariant: 'Timer precision is bucket precision; deletion must not scan the whole wheel.',
  };

  yield {
    state: labelMatrix(
      'Timer costs',
      [
        { id: 'delayq', label: 'heap' },
        { id: 'wheel', label: 'wheel' },
        { id: 'bucket', label: 'bucket' },
        { id: 'over', label: 'over' },
      ],
      [
        { id: 'ins', label: 'ins' },
        { id: 'del', label: 'del' },
      ],
      [
        ['logN', 'hard'],
        ['O(m)', 'O(1)'],
        ['O(1)', 'link'],
        ['rare', 'move'],
      ],
    ),
    highlight: { active: ['wheel:ins', 'wheel:del', 'bucket:del'], compare: ['delayq:del'] },
    explanation: 'Kafka switched away from a priority-queue style timer because random deletion is painful. A wheel plus linked-list buckets gives cheap insertion and O(1) deletion when the task stores its list cell.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'op', label: 'op', x: 0.8, y: 4.0, note: 'state' },
        { id: 'cell', label: 'cell', x: 2.5, y: 3.0, note: 'timer' },
        { id: 'watch', label: 'watch', x: 2.5, y: 5.0, note: 'key' },
        { id: 'done', label: 'done', x: 4.5, y: 4.0, note: 'flag' },
        { id: 'unlink', label: 'unlink', x: 6.3, y: 3.0, note: 'O(1)' },
        { id: 'trim', label: 'trim', x: 6.3, y: 5.0, note: 'list' },
      ],
      edges: [
        { id: 'e-op-cell', from: 'op', to: 'cell' },
        { id: 'e-op-watch', from: 'op', to: 'watch' },
        { id: 'e-op-done', from: 'op', to: 'done' },
        { id: 'e-done-unlink', from: 'done', to: 'unlink' },
        { id: 'e-done-trim', from: 'done', to: 'trim' },
      ],
    }, { title: 'Cross references make deletion cheap' }),
    highlight: { active: ['op', 'cell', 'watch'], found: ['done', 'unlink'], compare: ['trim'] },
    explanation: 'The delayed operation points to its timer entry and watcher registrations. When it completes, the timer entry can be removed immediately instead of waiting for a future full scan.',
  };

  yield {
    state: labelMatrix(
      'Old vs new',
      [
        { id: 'timer', label: 'timer' },
        { id: 'delete', label: 'delete' },
        { id: 'scan', label: 'scan' },
        { id: 'mem', label: 'mem' },
      ],
      [
        { id: 'old', label: 'old' },
        { id: 'new', label: 'new' },
      ],
      [
        ['DelayQ', 'wheel'],
        ['lazy', 'now'],
        ['often', 'rare'],
        ['leak', 'bound'],
      ],
    ),
    highlight: { active: ['delete:new', 'timer:new'], compare: ['scan:old', 'mem:old'] },
    explanation: 'The old shape relied on lazy deletion and periodic purging. The wheel design removes completed timer tasks immediately and reduces expensive global cleanup work.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'reqs', min: 0, max: 100 }, y: { label: 'CPU', min: 0, max: 100 } },
      series: [
        { id: 'old', label: 'scan', points: [{ x: 0, y: 5 }, { x: 25, y: 30 }, { x: 50, y: 58 }, { x: 75, y: 84 }, { x: 100, y: 98 }] },
        { id: 'new', label: 'wheel', points: [{ x: 0, y: 5 }, { x: 25, y: 11 }, { x: 50, y: 18 }, { x: 75, y: 26 }, { x: 100, y: 35 }] },
      ],
      markers: [{ id: 'purge', x: 65, y: 72, label: 'purge' }],
    }),
    highlight: { active: ['new'], compare: ['old', 'purge'] },
    explanation: 'A purge-heavy design gets worse as outstanding requests grow. The timing-wheel design keeps the ordinary completion path cheap and reserves cleanup for exceptional drift.',
  };

  yield {
    state: labelMatrix(
      'Debug signals',
      [
        { id: 'fetch', label: 'fetch' },
        { id: 'prod', label: 'prod' },
        { id: 'remote', label: 'remote' },
        { id: 'isr', label: 'ISR' },
        { id: 'idle', label: 'idle' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'hint', label: 'hint' },
      ],
      [
        ['purg', 'poll'],
        ['purg', 'replag'],
        ['Remote', 'acks'],
        ['shrink', 'repl'],
        ['hand', 'CPU'],
      ],
    ),
    highlight: { active: ['prod:hint', 'isr:hint'], found: ['fetch:hint'], compare: ['idle:hint'] },
    explanation: 'Purgatory metrics need context. Pair Fetch and Produce purgatory size with request timing, ISR shrink/expand rates, follower lag, and request-handler idle time before blaming one subsystem.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'delayed request') yield* delayedRequest();
  else if (view === 'timer wheel') yield* timerWheel();
  else throw new InputError('Pick a Kafka purgatory view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Kafka request purgatory is the broker-side holding area for requests that are not immediately satisfiable but may complete soon. Produce requests can wait for replication acknowledgments. Fetch requests can wait for enough data. Each delayed operation has both event-driven wakeups and a timeout.',
        'The data-structure shape is a hash map of watcher lists plus a hierarchical timing wheel. Watcher keys say which partition or request event should recheck the operation. The timing wheel says when the operation must expire if the condition never becomes true.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When a request arrives, Kafka first checks whether it can complete immediately. If not, it records the delayed operation, attaches it to watcher lists keyed by relevant partitions or coordinator keys, and schedules a timeout task. Later, a partition append, replica progress event, coordinator change, or timer expiration rechecks and completes the operation.',
        'The timing wheel avoids the deletion problem of priority-queue timers. A task stores a link to its timer-list cell, so completion can unlink it cheaply. Far deadlines sit in coarser overflow wheels and cascade down as time advances. Hierarchical Timing Wheel explains the general structure; this topic shows why Kafka needed it.',
      ],
    },
    {
      heading: 'Data structures and complexity',
      paragraphs: [
        'The key structures are delayed operation objects, watcher lists, watcher-key maps, timer tasks, doubly linked timer buckets, overflow wheels, completion flags, and purgatory-size metrics. Hash Table explains the watcher map. Linked List explains why bucket deletion is cheap when the node has a direct cell reference.',
        'The old DelayQueue-style approach made random deletion hard and relied on purging completed requests later. That could turn memory and scan cost into a broker problem. The wheel design keeps ordinary insert/delete work near O(1), with overflow cost depending on a small number of wheel levels rather than the total number of waiting requests.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A producer sends to a partition with acks=all. The leader appends the record, but the request cannot return success until the in-sync replicas have replicated far enough. Kafka parks the delayed produce operation, watches the partition state, and arms a timeout. If replicas catch up, the watcher completes the request; if not, the timer expires it.',
        'A consumer fetch has a different condition. If not enough bytes are available to satisfy fetch.min.bytes, the broker can hold the fetch until new data arrives or fetch.wait.max.ms expires. That is why fetch purgatory size can be normal under long polling, while produce purgatory growth can point to replication health.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Purgatory is not a generic delayed-message feature for applications. It is broker internals for delayed broker responses. Application-level delayed delivery needs a different design. Do not confuse a large fetch purgatory with an outage without checking consumer long-poll settings, traffic shape, and request timing.',
        'The implementation hazard is stale references. A completed operation must not stay reachable forever through timer buckets or watcher lists. Kafka issues such as watcher-list cleanup show why empty watcher lists, purge thresholds, and metrics matter in addition to the primary timing-wheel algorithm.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Confluent engineering writeup on Kafka purgatory and hierarchical timing wheels at https://www.confluent.io/blog/apache-kafka-purgatory-hierarchical-timing-wheels/, Apache Kafka monitoring docs for DelayedOperationPurgatory metrics at https://kafka.apache.org/0101/operations/monitoring/, Apache Kafka TimingWheel source at https://github.com/apache/kafka/blob/trunk/server-common/src/main/java/org/apache/kafka/server/util/timer/TimingWheel.java, ReplicaManager delayed operation imports at https://github.com/apache/kafka/blob/trunk/core/src/main/scala/kafka/server/ReplicaManager.scala, and KAFKA-2160 watcher-list cleanup issue at https://issues.apache.org/jira/browse/KAFKA-2160.',
        'Study Kafka Log Case Study, Kafka Transactions Exactly-Once Case Study, Hierarchical Timing Wheel, Message Queue, Hash Table, Linked List, Backpressure, Tail Latency, and Distributed Tracing next.',
      ],
    },
  ],
};
