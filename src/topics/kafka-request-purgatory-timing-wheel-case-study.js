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
        'Kafka request purgatory is the broker-side structure for requests that cannot be answered now but may become answerable soon. A produce request with acks=all may have appended to the leader log but still be waiting for in-sync replicas. A fetch request may have found the partition but not enough bytes to satisfy the consumer minimum. The broker should not block a request-handler thread for each wait, and it should not force clients to spin.',
        'The structure combines two ideas. Watcher lists wake delayed operations when relevant partition or coordinator state changes. A timer path expires them if the condition never becomes true. Kafka calls these delayed operations purgatory because they are neither done nor lost; they are parked with enough information to recheck completion later.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is one waiting thread per delayed request. That model is easy to explain but impossible to scale in a broker. Many consumers use long polling. Many producers wait for replication. Holding threads, stacks, locks, and scheduler slots for every wait would turn normal traffic into resource exhaustion.',
        'The next obvious approach is a single priority queue of deadlines plus a map of conditions. It works until cancellation and early completion dominate. Most delayed operations should finish before timeout when data arrives or replicas catch up. If completed operations remain in a timer heap until their deadline, memory grows and the broker needs expensive purge scans. The wall is not only finding the next timeout; it is deleting completed timers and watcher references cheaply.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A delayed request needs two independent ways to finish. It can complete by condition, such as enough replicated bytes or enough fetch data. It can also complete by time, such as request timeout or max wait. The operation object therefore has to be registered in event-driven watcher lists and in a deadline data structure at the same time.',
        'The key insight is to make completion idempotent and deletion handle-based. A delayed operation carries a completed flag and references to the structures that can wake it. When one path wins, the others must become harmless. A condition wakeup should unlink the timer entry. A timeout should prevent a later watcher from sending a second response. This is a data-structure problem about cross references, not just a scheduling problem.',
      ],
    },
    {
      heading: 'Data structures and mechanism',
      paragraphs: [
        'The watcher side is a hash map from watch keys to lists of delayed operations. A key might be a topic partition, coordinator key, or other broker-internal event source. When the partition advances, Kafka looks up the watcher list and tries the delayed operations that might now complete. The list does not prove completion; it only narrows which operations deserve another check.',
        'The time side is a hierarchical timing wheel. Deadlines are bucketed by time rather than kept in one globally sorted heap. A timer task sits in a bucket list and stores enough linkage for immediate removal. Far deadlines can sit in coarser wheels and cascade down as time advances. This gives cheap insertion and cheap cancellation for the common case where operations complete before timeout.',
        'The operation object is the bridge. It knows how to test its condition, complete the request, expire the request, and remove itself from auxiliary structures. The broker must guard this with synchronization because partition progress, timeout, cancellation, and connection close can race. The response must be produced once, and every index that points to the operation must eventually stop retaining it.',
        'The watcher key is deliberately broader than a single request. Many produce or fetch operations can wait on the same partition. One partition progress event can therefore trigger a batch of rechecks. Some rechecks still fail, but they fail cheaply because no unrelated partitions were scanned.',
      ],
    },
    {
      heading: 'Worked cases',
      paragraphs: [
        'For produce with acks=all, the leader can append the batch locally before it is safe to answer success. The request waits until the in-sync replicas have replicated far enough to satisfy the acknowledgement rule. The delayed produce operation watches the partition state and also has a timeout. If followers catch up, the condition path completes it. If they do not, the timer path returns the appropriate timeout or not-enough-replicas result.',
        'For fetch, the condition is different. A consumer may ask the broker to wait until at least fetch.min.bytes are available or until fetch.wait.max.ms expires. That long-poll behavior is healthy when traffic is sparse; it avoids empty responses and reduces client churn. The same purgatory mechanism parks the fetch, wakes it when new data arrives, or expires it with whatever result is allowed at the deadline.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Purgatory works because it separates waiting from blocking. The broker does not dedicate a thread to each outstanding condition. It stores a small operation object in structures that can be reached by the events that matter. When state changes, only related operations are rechecked, and when time advances, only the current timer bucket is processed.',
        'The timing wheel fits because Kafka timeouts are approximate request deadlines, not high-resolution alarms. The broker needs to manage huge numbers of cancelable timers with good common-case deletion. Bucketed time plus linked-list cells is a better match than a heap when early completion and cancellation are common.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'This pattern is useful whenever a server response depends on future state but should not tie up an execution context. Long polling, quorum acknowledgement, delayed coordination, leader state changes, and bounded waits all have the same shape: register interest in a condition, set a deadline, and complete once.',
        'The same lesson appears outside Kafka. Distributed systems often need a table of waiters keyed by resource plus a timer structure for deadlines. Lock managers, stream processors, RPC frameworks, and schedulers all face the same question: how do we wake the right waiters without scanning all waiters, and how do we expire them without leaving stale references?',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Purgatory is not an application-level delayed-message queue. It holds broker requests waiting for broker conditions. If an application wants to deliver messages at a future wall-clock time, it needs a different design with durable scheduling semantics, replay, ownership, and recovery. Purgatory is internal control flow, not a product feature.',
        'It also fails when metrics are read without context. Large fetch purgatory can be normal under long polling and low traffic. Large produce purgatory is more suspicious because it may point to slow followers, ISR shrinkage, under-min-ISR partitions, disk pressure, network issues, or remote storage delays. The structure tells you requests are waiting; the surrounding broker signals tell you why.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Watch delayed-operation purgatory size by operation type, request latency, request timeout rate, follower lag, ISR shrink and expand rates, produce error counts, request-handler idle percentage, network processor utilization, and disk or remote-log latency. A rising purgatory with healthy idle time points to external conditions such as replication or data availability. A rising purgatory with low idle time may mean the broker is overloaded and cannot drain rechecks quickly.',
        'Memory and cleanup signals matter too. Empty watcher lists, completed operations retained too long, high purge activity, and timer bucket bursts indicate data-structure pressure. The broker should remove completed timer tasks promptly, avoid global scans in the common path, and keep watcher lists from becoming long-lived garbage.',
        'Interpret the metric by request class. Fetch purgatory often follows consumer long-poll configuration and sparse traffic. Produce purgatory is closer to a durability signal because acks=all depends on follower progress and ISR health.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Primary sources include the Confluent engineering writeup on Kafka purgatory and hierarchical timing wheels at https://www.confluent.io/blog/apache-kafka-purgatory-hierarchical-timing-wheels/, Apache Kafka DelayedOperationPurgatory metrics in the monitoring docs at https://kafka.apache.org/0101/operations/monitoring/, the Kafka TimingWheel source at https://github.com/apache/kafka/blob/trunk/server-common/src/main/java/org/apache/kafka/server/util/timer/TimingWheel.java, and KAFKA-2160 at https://issues.apache.org/jira/browse/KAFKA-2160.',
        'Study Kafka Log Case Study for the append path, Kafka Transactions Exactly-Once Case Study for broker coordination, Hierarchical Timing Wheel for timer mechanics, Message Queue for waiter queues, Hash Table for watcher lookup, Linked List for O(1) deletion with handles, Backpressure for finite capacity, Tail Latency for timeout interpretation, and Distributed Tracing for following a delayed request through the broker.',
      ],
    },
  ],
};
