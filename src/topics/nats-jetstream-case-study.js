// NATS JetStream: streams, consumers, retention, acks, and replay.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'nats-jetstream-case-study',
  title: 'NATS JetStream Case Study',
  category: 'Systems',
  summary: 'JetStream adds persistence to NATS: streams store subject-matched messages, consumers track delivery and acknowledgments, and retention bounds replay history.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['streams consumers', 'retention replay'], defaultValue: 'streams consumers' },
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

function jetGraph(title) {
  return graphState({
    nodes: [
      { id: 'publisher', label: 'publisher', x: 0.8, y: 3.6, note: 'subject events.orders' },
      { id: 'stream', label: 'stream', x: 2.8, y: 3.6, note: 'message store' },
      { id: 'storage', label: 'file/memory storage', x: 4.7, y: 2.0, note: 'limits and replicas' },
      { id: 'retention', label: 'retention policy', x: 4.7, y: 5.2, note: 'limits/work/interest' },
      { id: 'consumerA', label: 'durable consumer', x: 7.0, y: 2.0, note: 'ack state' },
      { id: 'consumerB', label: 'pull consumer', x: 7.0, y: 5.2, note: 'fetch batches' },
      { id: 'worker', label: 'application worker', x: 9.0, y: 3.6, note: 'process and ack' },
    ],
    edges: [
      { id: 'e-pub-stream', from: 'publisher', to: 'stream', weight: 'publish ack' },
      { id: 'e-stream-storage', from: 'stream', to: 'storage', weight: 'persist' },
      { id: 'e-stream-retention', from: 'stream', to: 'retention', weight: 'expire' },
      { id: 'e-stream-a', from: 'stream', to: 'consumerA', weight: 'deliver view' },
      { id: 'e-stream-b', from: 'stream', to: 'consumerB', weight: 'deliver view' },
      { id: 'e-a-worker', from: 'consumerA', to: 'worker', weight: 'messages' },
      { id: 'e-b-worker', from: 'consumerB', to: 'worker', weight: 'fetch' },
    ],
  }, { title });
}

function* streamsConsumers() {
  yield {
    state: jetGraph('JetStream stores selected NATS subjects in streams'),
    highlight: { active: ['publisher', 'stream', 'storage', 'e-pub-stream', 'e-stream-storage'], compare: ['consumerA'] },
    explanation: 'JetStream is the persistence layer for NATS. A stream captures messages on configured subjects, stores them, and acknowledges durable publication to the producer.',
  };

  yield {
    state: labelMatrix(
      'Stream configuration knobs',
      [
        { id: 'subjects', label: 'subjects' },
        { id: 'storage', label: 'storage' },
        { id: 'replicas', label: 'replicas' },
        { id: 'limits', label: 'limits' },
      ],
      [
        { id: 'example', label: 'example' },
        { id: 'effect' },
      ],
      [
        ['events.orders.*', 'captures matching publishes'],
        ['file or memory', 'durability versus latency'],
        ['1, 3, 5', 'availability and quorum cost'],
        ['age/bytes/messages', 'bounds history'],
      ],
    ),
    highlight: { found: ['subjects:effect', 'limits:effect'], active: ['replicas:effect'] },
    explanation: 'A stream is not just a topic name. It defines what subjects are captured, where messages live, how much history is retained, and how many replicas protect it.',
    invariant: 'Consumers are views over stream data; they do not own the stream itself.',
  };

  yield {
    state: jetGraph('Consumers track delivery and acknowledgments'),
    highlight: { active: ['consumerA', 'consumerB', 'worker', 'e-a-worker', 'e-b-worker'], found: ['stream'] },
    explanation: 'Consumers are durable or ephemeral views on a stream. They track delivery policy, acknowledgment policy, pending messages, redelivery, and filtering.',
  };

  yield {
    state: labelMatrix(
      'Consumer choices',
      [
        { id: 'push', label: 'push' },
        { id: 'pull', label: 'pull' },
        { id: 'durable', label: 'durable' },
        { id: 'ordered', label: 'ordered' },
      ],
      [
        { id: 'delivery', label: 'delivery' },
        { id: 'fit' },
      ],
      [
        ['server pushes', 'low-latency subscription'],
        ['client fetches', 'worker-controlled backpressure'],
        ['state survives reconnect', 'service processing'],
        ['gap detection', 'replay/read-only use'],
      ],
    ),
    highlight: { active: ['pull:fit', 'durable:fit'], compare: ['push:delivery'] },
    explanation: 'A worker pool usually wants pull or durable consumers so processing rate and redelivery behavior are explicit instead of hidden in subscriber callbacks.',
  };
}

function* retentionReplay() {
  yield {
    state: labelMatrix(
      'Retention policies',
      [
        { id: 'limits', label: 'limits' },
        { id: 'interest', label: 'interest' },
        { id: 'workqueue', label: 'work queue' },
        { id: 'discard', label: 'discard policy' },
      ],
      [
        { id: 'keeps', label: 'keeps' },
        { id: 'risk' },
      ],
      [
        ['until size/age/count limit', 'slow consumers can miss old data'],
        ['while consumers need it', 'consumer state matters'],
        ['until one worker acks', 'load distribution semantics'],
        ['old or new messages', 'backpressure decision'],
      ],
    ),
    highlight: { found: ['limits:keeps', 'workqueue:keeps'], compare: ['discard:risk'] },
    explanation: 'Retention chooses what replay means. A stream can behave like a bounded event log, interest-retained feed, or work queue depending on policy.',
  };

  yield {
    state: jetGraph('Replay depends on stream history and consumer cursor'),
    highlight: { active: ['stream', 'retention', 'consumerA', 'worker', 'e-stream-retention', 'e-a-worker'], compare: ['publisher'] },
    explanation: 'A durable consumer can resume from its stored position as long as the stream still retains the needed messages. Retention and consumer lag must be monitored together.',
    invariant: 'Acknowledgment confirms processing to the consumer; retention determines whether old messages remain replayable.',
  };

  yield {
    state: labelMatrix(
      'Failure handling',
      [
        { id: 'publish', label: 'publish ack lost' },
        { id: 'worker', label: 'worker crash' },
        { id: 'redeliver', label: 'redelivery' },
        { id: 'dedupe', label: 'dedupe/idempotency' },
      ],
      [
        { id: 'mechanism', label: 'mechanism' },
        { id: 'lesson' },
      ],
      [
        ['producer may retry', 'use message IDs if needed'],
        ['message remains pending', 'ack after side effect'],
        ['consumer policy', 'duplicates possible'],
        ['application key', 'exact business effect needs design'],
      ],
    ),
    highlight: { active: ['worker:lesson', 'redeliver:lesson'], found: ['dedupe:lesson'] },
    explanation: 'JetStream gives persistence and redelivery tools, but the final business operation still needs idempotency or deduplication when retries happen.',
  };

  yield {
    state: labelMatrix(
      'Complete IoT telemetry case study',
      [
        { id: 'sensor', label: 'sensor publish' },
        { id: 'stream', label: 'telemetry stream' },
        { id: 'consumer', label: 'analytics consumer' },
        { id: 'archive', label: 'archive worker' },
      ],
      [
        { id: 'jetMove', label: 'JetStream move' },
        { id: 'lesson' },
      ],
      [
        ['subject telemetry.site.device', 'subject capture'],
        ['file storage plus age limit', 'bounded replay'],
        ['pull batches', 'backpressure controlled'],
        ['separate durable consumer', 'fan-out from one stream'],
      ],
    ),
    highlight: { found: ['stream:lesson', 'consumer:lesson', 'archive:lesson'], compare: ['sensor:jetMove'] },
    explanation: 'A single stream can support multiple consumer views: one real-time processor, one archiver, and one troubleshooting replay path.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'streams consumers') yield* streamsConsumers();
  else if (view === 'retention replay') yield* retentionReplay();
  else throw new InputError('Pick a NATS JetStream view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Streams consumers" traces the publish-store-deliver pipeline: a publisher sends to a subject, the stream captures and persists the message, and consumers present delivery views to application workers. "Retention replay" shows how retention policy, failure handling, and consumer cursor interact to determine what replay actually means.',
        {type:'callout', text:'JetStream works by separating subject routing, stored stream history, consumer cursors, and business side effects into different ownership layers.'},
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current decision point: a publisher sending, a stream persisting, or a consumer delivering.',
            'Compare marks show related participants whose state matters but who are not the focus of the current step.',
            'Found marks are durable artifacts: stored messages, configured retention bounds, and acknowledged consumer positions.',
          ],
        },
        {
          type: 'note',
          text: 'Safe inference rule: if a consumer cursor is at sequence N and the stream retains messages from sequence M where M <= N, the consumer can resume. If M > N, the consumer has lost messages to retention and must handle a gap.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'NATS has always been about simplicity and performance. JetStream was built to add persistence and streaming to NATS without losing those qualities.',
          attribution: 'Derek Collison, creator of NATS, Synadia blog',
        },
        'Core NATS is a subject-based messaging system optimized for speed. A publisher sends to a subject like orders.created, subscribers on that subject receive the message in microseconds, and the server forgets it. No disk write, no replay, no cursor. This makes NATS one of the fastest messaging systems available -- sub-millisecond publish-to-subscribe latency with a single Go binary that uses under 20 MB of RAM.',
        'But speed without memory is not enough for most production systems. A payment service that crashes for 30 seconds loses every order event published during the outage. A fleet of workers processing jobs cannot share work fairly if the server pushes messages at the rate it receives them rather than the rate workers can handle. An engineer debugging a production incident at 3 AM cannot replay the last hour of events because the server never stored them.',
        {
          type: 'table',
          headers: ['Core NATS', 'What it gives', 'What it lacks'],
          rows: [
            ['Publish/subscribe', 'Sub-millisecond fan-out to live subscribers', 'No delivery to offline subscribers'],
            ['Request/reply', 'Synchronous RPC-style messaging', 'No retry if the responder crashes mid-work'],
            ['Queue groups', 'Load distribution across subscriber instances', 'No redelivery if the chosen worker fails after receiving'],
            ['Subject hierarchy', 'Flexible routing via dot-separated tokens and wildcards', 'No stored history for any subject'],
          ],
        },
        'JetStream adds persistence, replay, durable cursors, acknowledgment tracking, retention policies, and backpressure to NATS without replacing the core protocol. A JetStream-enabled server still handles plain pub/sub at full speed. Streams and consumers are layered on top, activated per subject pattern when an operator configures them.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first obvious approach is to treat live pub/sub as sufficient. A publisher emits an event, subscribers receive it, processing happens. This works when every subscriber is online, fast enough, and can tolerate losing messages during its own downtime. Many internal notification systems start here and stay here for months until the first outage reveals the gap.',
        {
          type: 'diagram',
          text: 'Live pub/sub (no persistence):\n\n  Publisher --> NATS server --> Subscriber A (online, receives msg)\n                            --> Subscriber B (online, receives msg)\n                            --> Subscriber C (offline, LOSES msg)\n                            --> [message forgotten by server]\n\n  30 seconds later:\n  Subscriber C reconnects.\n  Asks "what did I miss?"\n  Server: "I have no idea."',
          label: 'The gap in fire-and-forget pub/sub',
        },
        'The second obvious approach is to bolt persistence onto the side. Teams add a database table as an outbox, write events to both the table and pub/sub, and have recovering consumers query the table. This works for simple cases but forces the team to reinvent ordering, cursor management, retention limits, redelivery timers, backpressure, and dead-letter handling -- all concerns that a persistent messaging layer already names and solves.',
        {
          type: 'code',
          language: 'javascript',
          text: '// DIY outbox: works, but you are now maintaining a message broker.\nasync function publishWithOutbox(db, nats, subject, payload) {\n  const id = uuid();\n  // 1. Write to outbox table (your persistence layer)\n  await db.query(\n    "INSERT INTO outbox (id, subject, payload, status) VALUES ($1,$2,$3,$4)",\n    [id, subject, JSON.stringify(payload), "pending"]\n  );\n  // 2. Publish to NATS (fire-and-forget, may fail silently)\n  nats.publish(subject, JSON.stringify(payload));\n  // 3. Now you need: a poller for stuck "pending" rows,\n  //    a cursor per consumer, retention cleanup, ordering\n  //    guarantees, redelivery logic, backpressure...\n}',
        },
        'The third obvious approach is to skip NATS and use Kafka or another heavy log system. Kafka provides persistence, replay, and consumer groups, but it also brings ZooKeeper or KRaft, partition management, broker configuration complexity, and a resource footprint that may dwarf the services it connects. For teams already running NATS for its speed and simplicity, switching to Kafka for persistence means losing both.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that persistence is not one feature. It is a family of semantics that interact with each other and with failure.',
        {
          type: 'table',
          headers: ['Semantic question', 'If you get it wrong'],
          rows: [
            ['How long are messages retained?', 'Consumers lose replay when retention expires before they catch up'],
            ['Should messages vanish after one ack or persist for all consumers?', 'Work-queue behavior when you wanted event log, or unbounded storage when you wanted a queue'],
            ['Should the server push or should workers pull?', 'Push overwhelms slow workers; pull without fetch limits underutilizes fast ones'],
            ['What happens when a worker crashes after receiving but before acking?', 'Silent data loss (if acked early) or duplicate processing (if redelivered)'],
            ['How are producer retries deduplicated?', 'The same order gets processed twice because the publish-ack was lost in transit'],
          ],
        },
        'The second wall is the failure timing problem. A worker receives a message, writes to a database, and crashes before sending the ack. JetStream redelivers the message to another worker. That worker writes to the database again. The order is now processed twice. JetStream cannot know whether the database side effect happened because the ack boundary and the business-effect boundary are different things.',
        {
          type: 'diagram',
          text: 'The ack timing problem:\n\n  Time -->  t1          t2          t3          t4\n            |           |           |           |\n  Worker:   receive     db.write    CRASH       (dead)\n  Server:   deliver     waiting     timeout     redeliver to Worker B\n  DB:       --          row exists  row exists  DUPLICATE row\n\n  The message was processed. The ack was not sent.\n  JetStream has no way to distinguish "crashed before work"\n  from "crashed after work." Only idempotency keys fix this.',
          label: 'Why ack != exactly-once business effect',
        },
        'The third wall is the retention-lag interaction. A durable consumer can resume from its stored cursor position, but only if the stream still holds the messages at that position. A stream with max_age: 1h and a consumer that falls behind for 90 minutes has a cursor pointing at messages that no longer exist. The consumer "resumes" but skips everything it missed. Retention and consumer lag must be monitored together or replay is an illusion.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'JetStream separates four concerns that other systems often conflate: message address (the subject), stored history (the stream), delivery view (the consumer), and business effect (the application).',
        {
          type: 'diagram',
          text: 'The four-layer separation:\n\n  Layer 1: SUBJECT (address)\n  orders.created, telemetry.site42.line7, events.>\n  "Where does the message go?"\n           |\n  Layer 2: STREAM (stored history)\n  Captures subjects matching a pattern.\n  Owns storage type, replicas, retention, limits.\n  "How long does the message exist?"\n           |\n  Layer 3: CONSUMER (delivery view)\n  Durable or ephemeral. Push or pull.\n  Owns cursor position, ack policy, redelivery, filter.\n  "Who is reading, and where are they?"\n           |\n  Layer 4: APPLICATION (business effect)\n  Database write, API call, file export.\n  Owns idempotency, exactly-once semantics.\n  "What actually happened because of this message?"',
          label: 'The four layers that must not be confused',
        },
        'A stream owns what is stored. A consumer owns where a reader is in that stored history. The stream decides retention; the consumer decides delivery. One stream can serve a real-time alerting consumer, a batch archive consumer, and a temporary debugging replay consumer simultaneously. Each has its own cursor, ack state, and filter -- none duplicates the underlying message data.',
        {
          type: 'note',
          text: 'The most common JetStream design mistake is confusing layers. Treating a consumer as if it owns messages (it does not -- the stream does). Treating an ack as proof of business completion (it is not -- it is proof of message receipt). Treating retention as infinite (it is bounded, and the bound is a product decision).',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A stream is created with a configuration that specifies which subjects to capture, where to store messages, and how long to keep them.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Creating a stream via the NATS.js client library.\nconst jsm = await nc.jetstreamManager();\nawait jsm.streams.add({\n  name: "ORDERS",\n  subjects: ["orders.>"],           // capture all order subjects\n  storage: StorageType.File,        // persist to disk (vs. Memory)\n  num_replicas: 3,                  // R=3 for fault tolerance\n  retention: RetentionPolicy.Limits, // keep until limits hit\n  max_age: nanos(7 * 24 * 3600),   // 7-day retention\n  max_bytes: 10 * 1024 * 1024 * 1024, // 10 GB cap\n  max_msgs: -1,                     // no message count limit\n  discard: DiscardPolicy.Old,       // drop oldest when full\n  duplicate_window: nanos(120),     // 2-minute dedup window\n});',
        },
        'When a publisher sends to orders.created, the NATS server matches the subject against configured streams. The ORDERS stream captures it, persists it to file storage, replicates it to two followers via the Raft-based replication protocol built into JetStream, and returns a publish acknowledgment containing the stream name and the message sequence number. The publisher knows the message is durable.',
        'Consumers are then created as views over the stream.',
        {
          type: 'code',
          language: 'javascript',
          text: '// A durable pull consumer for order processing workers.\nawait jsm.consumers.add("ORDERS", {\n  durable_name: "order-processor",\n  deliver_policy: DeliverPolicy.All,    // start from first available\n  ack_policy: AckPolicy.Explicit,       // worker must ack each message\n  max_deliver: 5,                       // redeliver up to 5 times\n  ack_wait: nanos(30),                  // 30s ack deadline\n  filter_subject: "orders.created",     // only this subject\n});\n\n// Workers fetch messages at their own pace.\nconst js = nc.jetstream();\nconst consumer = await js.consumers.get("ORDERS", "order-processor");\nconst messages = await consumer.fetch({ max_messages: 10 });\nfor await (const msg of messages) {\n  await processOrder(msg.json());\n  msg.ack();  // ack AFTER the side effect is safe\n}',
        },
        'The pull consumer lets workers control their own throughput. Each fetch requests a batch of up to N messages. The server delivers at most N, and the worker processes and acks them before fetching more. Backpressure is explicit: the server never pushes faster than the worker requests.',
        {
          type: 'table',
          headers: ['Consumer type', 'Delivery', 'State persistence', 'Best fit'],
          rows: [
            ['Durable pull', 'Worker fetches batches', 'Survives restarts', 'Worker pools with explicit backpressure'],
            ['Durable push', 'Server delivers to subscriber', 'Survives restarts', 'Low-latency event handlers'],
            ['Ephemeral pull', 'Worker fetches batches', 'Lost on disconnect', 'Short-lived batch jobs'],
            ['Ordered', 'Server delivers in sequence order', 'Recreated on gap detection', 'Read-only replay and debugging'],
          ],
        },
        'Acknowledgment policy controls what the server considers processed. Explicit acks require the worker to call msg.ack() after completing its work. If the worker crashes before acking, the ack_wait timer expires, and the server redelivers to another worker (up to max_deliver times). This is the redelivery safety net -- but it means the application must handle receiving the same message more than once.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'JetStream preserves the speed and simplicity of NATS subjects while adding durable state through three interlocking guarantees.',
        {
          type: 'bullets',
          items: [
            'Stream persistence guarantee: every message captured by a stream is written to the configured storage backend (file or memory) and, if replicated, acknowledged by a Raft quorum before the publish-ack returns. The publisher knows the message is durable.',
            'Consumer cursor guarantee: a durable consumer tracks its delivered position, pending messages, and ack state independently of other consumers and independently of the stream retention clock. Restarting the consumer resumes from the stored position.',
            'Retention boundary guarantee: the stream enforces its configured limits (max_age, max_bytes, max_msgs) and discard policy continuously. Messages that exceed any limit are removed regardless of consumer state. This means retention is a hard contract, not a suggestion.',
          ],
        },
        'The system works because these three guarantees compose cleanly. The stream handles durability and history. The consumer handles delivery position. The application handles business correctness. No layer tries to do another layer\'s job.',
        {
          type: 'note',
          text: 'JetStream uses Raft consensus internally for stream replication (R > 1) and for consumer state in clustered mode. Each stream with replicas forms its own Raft group. This gives strong consistency per stream but means cluster-wide operations (like listing all streams) are eventually consistent across Raft groups.',
        },
        'Backpressure works because pull consumers invert the control flow. Instead of the server deciding when to deliver, the worker decides when to fetch. A worker processing 10 messages per second fetches 10 at a time. A worker processing 1,000 per second fetches larger batches. The server never needs to guess the right delivery rate.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost axis', 'What you pay', 'What drives growth'],
          rows: [
            ['Publish latency', 'File fsync + Raft quorum ack (R > 1)', 'Disk speed and network RTT to replicas'],
            ['Storage', 'Every captured message persisted until retention evicts it', 'Message rate * average size * retention window'],
            ['Consumer state', 'Cursor, pending set, redelivery timers per consumer', 'Number of consumers * pending message volume'],
            ['Replication', 'Raft group per replicated stream', 'R replicas * message throughput * stream count'],
            ['Recovery time', 'Stream replay from disk + consumer state rebuild', 'Stream size on disk + pending ack set'],
          ],
        },
        'The dominant operational cost is storage. A stream capturing 1,000 messages per second at 1 KB each with a 7-day retention window stores roughly 600 GB. With R=3, that becomes 1.8 TB across the cluster. Storage planning must account for message rate, message size, retention window, and replica factor -- all four multiply together.',
        'The second cost is slow-consumer drift. A consumer that falls behind risks losing its replay window when stream retention expires the messages it has not yet processed. Monitoring must track consumer_lag (the gap between the stream\'s last sequence and the consumer\'s delivered sequence), num_pending (unacknowledged messages), and num_redelivered (messages sent more than once).',
        {
          type: 'code',
          language: 'text',
          text: 'Key monitoring metrics for a JetStream deployment:\n\n  Stream level:\n    messages         total stored messages\n    bytes            total stored bytes\n    consumer_count   consumers attached to this stream\n    first_seq        oldest retained sequence number\n    last_seq         newest sequence number\n\n  Consumer level:\n    num_pending      messages delivered but not yet acked\n    num_ack_pending  messages awaiting ack (same as pending in most modes)\n    num_redelivered  messages sent more than once\n    ack_floor        highest contiguous acked sequence\n    delivered.stream_seq   last sequence delivered to this consumer\n\n  Alert thresholds:\n    consumer_lag > retention_window * 0.8   --> consumer will lose replay\n    num_redelivered / num_delivered > 0.05  --> worker crash rate too high\n    bytes > max_bytes * 0.9                 --> stream approaching discard',
        },
        'Duplicate delivery is a normal operational fact, not a bug. When a worker crashes after processing but before acking, the server redelivers. When a publisher retries after a lost publish-ack, the stream may store two copies unless the duplicate_window catches it. JetStream provides a deduplication window (based on the Nats-Msg-Id header) for publisher retries, but application-level idempotency is still required for consumer-side duplicates.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An IoT telemetry platform ingests sensor readings from factory equipment. Devices publish to subjects like telemetry.factory42.line7.temperature. The platform needs three consumers with different semantics over the same data.',
        {
          type: 'table',
          headers: ['Step', 'Component', 'JetStream action', 'Configuration choice'],
          rows: [
            ['1', 'Stream creation', 'nats stream add TELEMETRY --subjects "telemetry.>"', 'File storage, R=3, max_age=7d, max_bytes=500GB'],
            ['2', 'Alerting consumer', 'Durable pull consumer "alerter"', 'filter: telemetry.*.*.temperature, ack_wait=10s, max_deliver=3'],
            ['3', 'Archive consumer', 'Durable pull consumer "archiver"', 'filter: telemetry.>, ack_wait=60s, max_deliver=5'],
            ['4', 'Debug consumer', 'Ordered consumer (temporary)', 'deliver_policy=by_start_time, opt_start_time=1h ago'],
            ['5', 'Sensor publishes', 'nats pub telemetry.factory42.line7.temperature "{"celsius":87.3}"', 'Nats-Msg-Id header for dedup'],
            ['6', 'Stream stores', 'Message persisted at seq 4,829,001', 'Replicated to 2 followers via Raft'],
            ['7', 'Alerter fetches', 'consumer.fetch({max_messages: 100})', 'Worker checks threshold, acks after alert sent'],
            ['8', 'Archiver fetches', 'consumer.fetch({max_messages: 1000})', 'Worker batches to S3, acks after upload confirmed'],
            ['9', 'Debug replays', 'Ordered consumer delivers from 1h ago', 'Engineer reads, no ack needed, consumer auto-cleans'],
          ],
        },
        'All three consumers read from the same stream. The alerter is fast and narrow (only temperature readings). The archiver is slow and wide (all telemetry). The debug consumer is temporary and stateless. Each has its own cursor and ack policy. None interferes with the others.',
        {
          type: 'diagram',
          text: 'One stream, three consumer views:\n\n  Stream: TELEMETRY  [seq 4,828,500 ... 4,829,001]\n  Retention: 7 days  |  Storage: 142 GB / 500 GB\n\n  Consumer: alerter\n    cursor: 4,829,000  |  pending: 1  |  lag: 1\n    filter: telemetry.*.*.temperature\n\n  Consumer: archiver\n    cursor: 4,827,200  |  pending: 200  |  lag: 1,801\n    filter: telemetry.>\n    (behind, but within 7-day retention -- safe)\n\n  Consumer: debug-session-x9f2\n    cursor: 4,825,000  |  ephemeral  |  ordered replay\n    (engineer browsing historical data, will disconnect soon)',
          label: 'Three consumers at different positions in the same stream',
        },
        'The critical monitoring question: is the archiver\'s lag growing faster than retention can sustain? At 1,000 messages/second and a cursor 1,801 messages behind, the archiver is about 2 seconds behind -- safe. But if the archiver stalls for 7 days and the stream enforces max_age=7d, messages will be deleted before the archiver reaches them. The consumer\'s cursor becomes a pointer to nothing.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Use case', 'Why JetStream fits', 'Key configuration choice'],
          rows: [
            ['IoT edge telemetry', 'Leaf nodes run lightweight NATS servers; JetStream replicates to hub', 'Leaf node streams with sourcing to central cluster'],
            ['Microservice event bus', 'Services publish domain events; consumers process at their own pace', 'Work-queue retention for task distribution; limits retention for event replay'],
            ['Order processing pipeline', 'Orders flow through stages; each stage acks after its work', 'Durable pull consumers with explicit ack and max_deliver for retry safety'],
            ['Log aggregation', 'Applications publish structured logs to subjects by service and level', 'Limits retention with max_age to bound storage; archiver consumer exports to cold storage'],
            ['Configuration distribution', 'Control plane publishes config updates; edge nodes consume', 'Interest retention so messages persist while consumers need them'],
            ['CI/CD job dispatch', 'Build triggers published as messages; runners pull and ack', 'Work-queue retention so each job is processed exactly once (at the message level)'],
          ],
        },
        'JetStream is strongest when teams already use NATS for its speed and subject routing and need to add persistence without changing the messaging model. The same subject namespace, the same client libraries, the same cluster -- just with streams configured on the subjects that need durability.',
        'It is also strong at the edge. A NATS leaf node can run JetStream locally, buffer messages during network partitions, and forward them to a hub cluster when connectivity returns. This store-and-forward pattern is difficult to retrofit onto systems that assume always-connected brokers.',
        {
          type: 'note',
          text: 'JetStream supports cross-stream sourcing and mirroring. A stream in one cluster can source messages from a stream in another cluster, enabling geographic distribution without application-level replication logic. This is how multi-region telemetry aggregation works in practice.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'No exactly-once business semantics: JetStream provides at-least-once delivery. The ack proves the consumer received the message, not that the database write, API call, or email send completed exactly once. Application-level idempotency is mandatory for safe retries.',
            'Not a data lake: streams with multi-terabyte retention and complex query patterns are better served by Kafka, Pulsar, or object-storage pipelines with schema registries and columnar formats.',
            'Partition ordering is per-stream, not per-subject: unlike Kafka where each partition has strict ordering, a JetStream stream orders all captured subjects into a single sequence. Parallel processing across subjects requires application-level coordination or separate streams.',
            'Ecosystem maturity gap: Kafka has Connect, Schema Registry, ksqlDB, and a decade of third-party tooling. JetStream is younger. Teams that need rich stream processing, exactly-once Kafka transactions, or a large connector ecosystem may find the tooling insufficient.',
            'Cluster sizing pressure: each replicated stream creates a Raft group. Hundreds of streams with R=3 means hundreds of Raft groups, each with election timers, heartbeats, and log replication. This can stress a small cluster.',
          ],
        },
        {
          type: 'table',
          headers: ['Comparison', 'JetStream advantage', 'Alternative advantage'],
          rows: [
            ['vs. Kafka', 'Single binary, sub-ms core latency, simpler ops', 'Mature ecosystem, exactly-once transactions, partition-level parallelism'],
            ['vs. Redis Streams', 'Built-in replication and retention policies', 'Redis doubles as cache; simpler for small stream workloads'],
            ['vs. RabbitMQ', 'Subject-based routing without exchange/binding boilerplate', 'Richer routing patterns (headers, topic, fanout exchanges)'],
            ['vs. SQS/SNS', 'Self-hosted, no per-message cost, lower latency', 'Zero ops, auto-scaling, deep AWS integration'],
            ['vs. Pulsar', 'Lower operational complexity', 'Tiered storage, multi-tenancy, geo-replication built in'],
          ],
        },
        'The most dangerous misconception is that "durable consumer" means "nothing can be lost." A durable consumer survives restarts, but if the stream\'s retention policy deletes messages before the consumer processes them, those messages are gone. Durability of the consumer cursor does not extend the stream\'s retention window.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['https://docs.nats.io/nats-concepts/jetstream', 'Official JetStream overview: architecture, streams, consumers, clustering'],
            ['https://docs.nats.io/nats-concepts/jetstream/streams', 'Stream configuration reference: subjects, storage, retention, replicas, limits'],
            ['https://docs.nats.io/nats-concepts/jetstream/consumers', 'Consumer configuration reference: pull/push, ack policy, redelivery, filters'],
            ['https://nats.io/blog/jetstream-java-client-05-pull-subscribe/', 'Pull subscribe patterns and backpressure walkthrough'],
            ['https://github.com/nats-io/nats-server', 'NATS server source code including JetStream implementation'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Message Queues -- the producer-consumer pattern and delivery guarantees that JetStream builds on.',
            'Prerequisite: Backpressure -- why pull-based consumption matters and how flow control prevents overload.',
            'Extension: Kafka Log Case Study -- a heavier distributed log with partitions, consumer groups, and exactly-once transactions.',
            'Extension: Idempotency -- the application-level guarantee that JetStream intentionally does not provide.',
            'Adjacent pattern: Transactional Outbox -- an alternative approach to reliable event publishing using database transactions.',
            'Contrast: Redis Streams Case Study -- a lighter stream primitive with different retention and consumer group semantics.',
          ],
        },
      ],
    },
  ],
};
