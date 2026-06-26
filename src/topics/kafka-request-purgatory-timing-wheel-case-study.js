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
    { heading: 'How to read the animation', paragraphs: [
      'Read delayed request as one broker request that cannot finish yet. A watcher list wakes it when a relevant event happens, and a timing wheel expires it when its deadline arrives. The key rule is single completion: condition, timeout, or cancellation can win, but only one response may be sent.',
      {type:'callout', text:'Request purgatory is a pair of indexes: watcher lists for useful events and timer buckets for deadlines, with one idempotent completion path.'},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Kafka brokers receive valid requests that are not answerable yet. A produce request with acks=all may wait for replicas, and a fetch request may wait for enough bytes. Purgatory lets the broker park those requests without dedicating one thread to each wait.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is blocking the request thread until the condition or timeout. That collapses when thousands of fetches long-poll or many produces wait for replication. A simple deadline heap helps timeouts but makes arbitrary early deletion expensive.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is early completion. Most delayed operations should finish before their timeout when data arrives or followers catch up. If their timer entries remain until deadline, normal success traffic becomes memory pressure and purge work.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Index the same delayed operation by event and by time. Watcher lists answer which operations might complete because this partition changed. Timer buckets answer which operations reached a deadline. A completed flag makes every path idempotent.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The broker first tries the request immediately. If it cannot complete, it registers a delayed operation on watcher keys and inserts a timer task into a hierarchical timing wheel. When an event or timer fires, the operation rechecks its real condition before responding.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'Correctness is the single-completion invariant. Before completion, several indexes may point to the operation. After completion, later paths see the completed flag and do not send another response. Efficiency comes from scanning only the watcher list or timer bucket touched by the event.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Watcher lookup is O(1) for the key plus the list length. Timing-wheel insertion and deletion are O(1) in the common case when the operation stores its list cell. If 50000 fetches wait and 90 percent complete after 40 ms, immediate timer deletion avoids carrying 45000 stale deadlines to their timeout bucket.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Produce purgatory waits for replication conditions. Fetch purgatory implements long polling with minimum bytes and max wait. The same waiter-plus-timer pattern appears in lock managers, schedulers, stream processors, RPC frameworks, and databases.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Purgatory is not a durable delayed-message scheduler for applications. It is broker memory for broker requests. Large fetch purgatory can be healthy long polling, while large produce purgatory may indicate slow followers, ISR trouble, disk pressure, network delay, or remote-log latency.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A producer sends acks=all with timeout 30000 ms. The leader appends at offset 5000, but a follower is at 4980, so the request watches the partition and enters the timer wheel. If the follower reaches 5000 after 18 ms, the watcher path sends success and removes the timer; otherwise the timer path expires once at 30000 ms.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Confluent purgatory and timing wheels at https://www.confluent.io/blog/apache-kafka-purgatory-hierarchical-timing-wheels/, Kafka source at https://github.com/apache/kafka, Kafka monitoring docs at https://kafka.apache.org/documentation/#monitoring, and KAFKA-2160 at https://issues.apache.org/jira/browse/KAFKA-2160. Study Timing Wheels, Hash Tables, Linked Lists, Priority Queues, Backpressure, Tail Latency, Kafka Replication, and Distributed Tracing next.',
    ] },
  ],
};
