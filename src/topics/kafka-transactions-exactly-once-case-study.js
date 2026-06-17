// Kafka transactions: idempotent producers, transaction coordinator, read-process-write.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kafka-transactions-exactly-once-case-study',
  title: 'Kafka Transactions & Exactly-Once Case Study',
  category: 'Systems',
  summary: 'Kafka exactly-once processing for read-process-write loops: idempotent producers, transactional writes, offset commits, and read-committed consumers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['transaction flow', 'failure boundaries'], defaultValue: 'transaction flow' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function kafkaTxGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input topic', x: 0.8, y: 3.6, note: 'records + offsets' },
      { id: 'consumer', label: 'stream app', x: 2.7, y: 3.6, note: 'consume/process' },
      { id: 'producer', label: 'transactional producer', x: 4.7, y: 2.0, note: 'producer id + epoch' },
      { id: 'coord', label: 'transaction coordinator', x: 4.7, y: 5.2, note: 'transaction log' },
      { id: 'output', label: 'output topic', x: 7.0, y: 2.0, note: 'results' },
      { id: 'offsets', label: 'consumer offsets', x: 7.0, y: 5.2, note: 'sendOffsetsToTransaction' },
      { id: 'reader', label: 'read_committed consumer', x: 9.1, y: 3.6, note: 'sees committed only' },
    ],
    edges: [
      { id: 'e-input-consumer', from: 'input', to: 'consumer', weight: 'poll' },
      { id: 'e-consumer-producer', from: 'consumer', to: 'producer', weight: 'produce output' },
      { id: 'e-producer-output', from: 'producer', to: 'output', weight: 'write records' },
      { id: 'e-producer-coord', from: 'producer', to: 'coord', weight: 'begin/commit/abort' },
      { id: 'e-consumer-offsets', from: 'consumer', to: 'offsets', weight: 'send offsets' },
      { id: 'e-coord-offsets', from: 'coord', to: 'offsets', weight: 'atomic commit' },
      { id: 'e-output-reader', from: 'output', to: 'reader', weight: 'read committed' },
    ],
  }, { title });
}

function* transactionFlow() {
  yield {
    state: kafkaTxGraph('Exactly-once targets consume-transform-produce loops inside Kafka'),
    highlight: { active: ['input', 'consumer', 'producer', 'output', 'e-input-consumer', 'e-consumer-producer', 'e-producer-output'], compare: ['offsets'] },
    explanation: 'Kafka transactions are designed for a read-process-write pattern where consumed offsets and produced output records commit atomically.',
    invariant: 'The output records and input offsets are either both committed or both aborted.',
  };
  yield {
    state: labelMatrix(
      'Producer-side guarantees',
      [
        { id: 'pid', label: 'producer id' },
        { id: 'seq', label: 'sequence numbers' },
        { id: 'epoch', label: 'producer epoch' },
        { id: 'txn', label: 'transactional id' },
      ],
      [{ id: 'role' }, { id: 'failureHandled' }],
      [
        ['stable producer identity', 'dedupe retries'],
        ['per-partition order', 'detect duplicates'],
        ['fence old producer', 'zombie instance blocked'],
        ['names transaction owner', 'recover coordinator state'],
      ],
    ),
    highlight: { active: ['seq:failureHandled', 'epoch:failureHandled'], found: ['txn:role'] },
    explanation: 'Idempotent producers deduplicate retry sends. Transactions add a coordinator and fencing so old producer instances cannot continue writing after a replacement starts.',
  };
  yield {
    state: kafkaTxGraph('Offsets join the same transaction as output records'),
    highlight: { active: ['coord', 'offsets', 'producer', 'e-producer-coord', 'e-coord-offsets', 'e-consumer-offsets'], found: ['output'] },
    explanation: 'The application sends consumed offsets to the transaction before commit. This makes progress through the input topic atomic with output publication.',
  };
  yield {
    state: labelMatrix(
      'Consumer isolation',
      [
        { id: 'uncommitted', label: 'uncommitted output' },
        { id: 'committed', label: 'committed output' },
        { id: 'aborted', label: 'aborted transaction' },
        { id: 'lag', label: 'open transaction' },
      ],
      [{ id: 'read_committed' }, { id: 'effect' }],
      [
        ['hidden', 'downstream waits'],
        ['visible', 'normal processing'],
        ['skipped', 'no duplicate effects in Kafka'],
        ['holds last stable offset', 'latency tradeoff'],
      ],
    ),
    highlight: { found: ['committed:effect', 'aborted:effect'], compare: ['lag:effect'] },
    explanation: 'read_committed consumers see only committed transactional output. This is why long transactions can increase downstream latency.',
  };
}

function* failureBoundaries() {
  yield {
    state: labelMatrix(
      'Failure windows',
      [
        { id: 'retry', label: 'producer retry' },
        { id: 'crashBefore', label: 'crash before commit' },
        { id: 'crashAfter', label: 'crash after commit' },
        { id: 'zombie', label: 'old app instance' },
      ],
      [{ id: 'KafkaMove' }, { id: 'result' }],
      [
        ['sequence dedupe', 'no duplicate record append'],
        ['transaction abort/retry', 'offset not advanced'],
        ['offset and output committed', 'restart continues after offsets'],
        ['epoch fencing', 'stale producer rejected'],
      ],
    ),
    highlight: { active: ['retry:result', 'crashBefore:result', 'zombie:result'], found: ['crashAfter:result'] },
    explanation: 'Exactly-once is achieved by making the retry and crash windows explicit in Kafka metadata, not by hoping failures do not happen.',
  };
  yield {
    state: kafkaTxGraph('The guarantee boundary is Kafka plus compatible clients'),
    highlight: { active: ['input', 'output', 'offsets', 'coord'], compare: ['reader'] },
    explanation: 'Kafka transactions cover Kafka topic writes and Kafka offset commits. External databases, emails, payments, and object stores need their own idempotency or transaction pattern.',
    invariant: 'Kafka EOS does not make arbitrary external side effects exactly once.',
  };
  yield {
    state: labelMatrix(
      'External side effects',
      [
        { id: 'db', label: 'database write' },
        { id: 'email', label: 'send email' },
        { id: 's3', label: 'write object' },
        { id: 'outbox', label: 'transactional outbox' },
      ],
      [{ id: 'risk' }, { id: 'mitigation' }],
      [
        ['commit outside Kafka', 'idempotent key or DB transaction'],
        ['irreversible duplicate', 'dedupe business event'],
        ['retry writes', 'conditional object key/version'],
        ['DB row plus event', 'publish after commit'],
      ],
    ),
    highlight: { found: ['outbox:mitigation', 'db:mitigation'], compare: ['email:risk'] },
    explanation: 'This is the practical boundary: exactly-once stream processing inside Kafka still needs Idempotency and Transactional Outbox for external systems.',
  };
  yield {
    state: labelMatrix(
      'Complete stream-processing case study',
      [
        { id: 'consume', label: 'consume orders' },
        { id: 'aggregate', label: 'aggregate revenue' },
        { id: 'produce', label: 'produce totals' },
        { id: 'commit', label: 'commit offsets' },
      ],
      [{ id: 'txMove' }, { id: 'lesson' }],
      [
        ['read input offsets', 'progress is data'],
        ['state update in app/Kafka Streams', 'replay-safe'],
        ['write output topic', 'transactional records'],
        ['sendOffsetsToTransaction', 'atomic with output'],
      ],
    ),
    highlight: { found: ['produce:lesson', 'commit:lesson'], active: ['consume:txMove'] },
    explanation: 'The clean Kafka EOS use case is consume, transform, produce back to Kafka, and commit the consumed offsets in the same transaction.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'transaction flow') yield* transactionFlow();
  else if (view === 'failure boundaries') yield* failureBoundaries();
  else throw new InputError('Pick a Kafka-transactions view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `Kafka is often used for read-process-write pipelines. An application consumes records from an input topic, computes derived records, writes those records to an output topic, and advances its consumer offsets so it does not process the same input again. The hard part is that the output write and the offset commit are two different pieces of state.`,
        `If the app writes output and crashes before committing offsets, it will process the same input again after restart and may write duplicate output. If it commits offsets first and crashes before writing output, it can lose the result. If a producer retries after a broker timeout, the same batch can be appended more than once unless Kafka can recognize the retry as a duplicate. If an old app instance keeps running after a replacement starts, both can write as if they own the same task.`,
        `Kafka transactions exist to close those windows for pipelines whose input offsets and output records live in Kafka. The guarantee is not magic exactly-once delivery to every system in the world. It is a protocol that makes Kafka output records and Kafka consumer offsets commit together, while read_committed consumers see only committed transactional output.`
      ],
    },
    {
      heading: 'The reasonable first attempt',
      paragraphs: [
        `The first design is at-least-once processing. Consume a batch, produce derived records, then commit offsets. This is popular because it is simple and safe against data loss. If the app crashes before committing offsets, Kafka will deliver the same input again and the application can retry the work.`,
        `The wall is duplicate effects. Retrying input is safe only when the output operation is idempotent or downstream consumers can deduplicate. Many event transformations are not naturally idempotent. A revenue aggregate can be incremented twice. A notification event can be sent twice. A repartitioned stream can contain duplicate records that downstream systems treat as independent facts.`,
        `The second design commits offsets before processing to avoid duplicates. That trades one failure for another. A crash after the offset commit but before output publication loses the result. The system has recorded progress through the input without recording the corresponding output. The right answer must commit progress and output as one unit.`
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `There are three failure windows to close. Producer retry can duplicate an append if the broker accepted a record but the acknowledgment was lost. Application crash can separate output publication from offset advancement. Zombie producers can continue writing after a rebalance or restart if an old process does not realize it lost ownership.`,
        `A normal database transaction would put all affected tables under one transaction manager. Kafka has a different shape. The consumer and producer are separate clients, partitions are distributed logs, and offsets are themselves stored as Kafka-managed state. Kafka exactly-once processing works by making the producer transactional and allowing it to include output records and consumed offsets in the same transaction.`,
        `The boundary matters. Kafka can coordinate writes to Kafka topics and offset commits for Kafka consumer groups. It cannot by itself make an external email service, payment gateway, object store, or unrelated database participate in the same atomic commit. Those systems need idempotency keys, their own transactions, or an outbox pattern.`
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is to treat progress as data. The application should not merely write derived records and then separately remember that it has consumed input. It should write the derived records and the consumed offsets into one Kafka transaction. Commit publishes both. Abort publishes neither.`,
        `Idempotent production handles retry duplicates inside a producer session by using producer identity and per-partition sequence numbers. Transactions add a transaction coordinator, a transactional id, producer epochs for fencing old instances, transaction markers, and offset commits inside the transaction. These pieces turn the invisible failure windows into explicit Kafka metadata.`,
        `Consumer isolation completes the story. A downstream consumer using read_committed does not treat every physical append as visible application data. It skips aborted transactional records and waits behind open transactions when needed. That is why the protocol separates writing records from making records visible.`
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A transactional application initializes a producer with a transactional id. The transactional id gives Kafka a stable name for the producer across restarts. The producer begins a transaction, the consumer polls input records, and the application computes output records. The producer sends those output records to one or more output partitions while the transaction is open.`,
        `Before committing, the application sends the consumed offsets to the transaction. In the Java producer API this is the role of sendOffsetsToTransaction. The offsets are not just an afterthought. They are the statement that input up to these positions has been reflected in the output records of this transaction. The transaction coordinator records the transaction state and drives commit or abort markers so brokers and consumers can interpret the records correctly.`,
        `If the transaction commits, the output records become visible to read_committed consumers and the offsets advance atomically with that output. If the transaction aborts, the output records are skipped by read_committed consumers and the offsets do not advance as successful progress. On restart, the application either reprocesses uncommitted input or continues after offsets that were committed with their output.`
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The retry invariant is sequence order per producer and partition. If a send is retried after an ambiguous failure, Kafka can identify whether the broker has already accepted that sequence. A retry does not need to create a second logical record. This is the idempotent producer part of the system.`,
        `The crash invariant is atomic visibility of output and offsets. A transaction is either committed or aborted. There is no successful state where downstream consumers see the output but the input offsets remain uncommitted, and no successful state where offsets advance while the output is absent. That is the read-process-write property most stream applications want.`,
        `The ownership invariant is fencing. A producer epoch lets Kafka reject an older producer instance when a newer producer with the same transactional id takes over. Without fencing, a paused process could wake up after a rebalance and continue writing stale output. Exactly-once processing needs to defend against old owners, not only against crashes.`
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Consider an orders topic and a revenue-by-store output topic. The app consumes orders at offsets 100 through 149 from one input partition. It computes updated revenue records and writes them to the output topic. Then it sends offset 150 to the same transaction and commits. A read_committed dashboard consumer sees the revenue updates only after the transaction commits, and the input offset advances with those updates.`,
        `If the app crashes before commit, the transaction is aborted or times out. The output records may exist physically in the log, but read_committed consumers skip them. The input offset did not commit as completed progress, so the restarted app consumes offsets 100 through 149 again. That retry is safe because the first attempt did not become visible as committed output.`,
        `If the app crashes after commit, both facts are durable: output records are visible and offset 150 is committed. The restarted app begins after the committed offset and does not repeat the output. The failure window that caused either duplicates or loss in the naive designs is now represented as commit or abort metadata.`
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        `The transaction-flow view follows the consume-transform-produce path. Input records enter the stream app, output records go through a transactional producer, offsets join the transaction, and a read_committed consumer sees only committed output. The key visual is that offsets are part of the transaction, not a separate cleanup step.`,
        `The failure-boundaries view names the cases the protocol must survive: producer retry, crash before commit, crash after commit, and zombie producer. The external-side-effects matrix marks the boundary. Kafka can coordinate Kafka records and Kafka offsets. A database write, email, payment, or object-store write needs a second pattern outside this guarantee.`
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Transactions add latency because output is not fully visible until commit. Long transactions can hold back read_committed consumers behind the last stable offset. They also add coordinator work, transaction state, commit markers, abort markers, timeout handling, and operational configuration. A high abort rate can become a real throughput and observability problem.`,
        `The application must manage transactional ids carefully. Too many ids create state overhead. Reusing ids incorrectly can fence active producers. Rebalances need careful integration so a process does not keep processing partitions it no longer owns. Kafka documentation recommends patterns such as one producer per consumer instance for direct producer-consumer transactional use because clever sharing schemes add complexity.`,
        `The biggest conceptual tax is boundary discipline. Teams often hear "exactly once" and assume all side effects are covered. Kafka does not make a remote payment API transactional with Kafka. For external side effects, use idempotent business keys, conditional writes, transactional outbox, Kafka Connect support where applicable, or a database transaction that owns the side effect record.`
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Kafka transactions win for Kafka-in, Kafka-out stream processing. Kafka Streams aggregations, repartitioning jobs, enrichment pipelines, deduplicated transformations, and materialized output topics all fit the model when the important output is written back to Kafka and downstream consumers use read_committed isolation.`,
        `They also win when replay is normal. Stream processors should be able to restart, rebalance, and retry. Transactions let a replay of uncommitted input avoid duplicate committed output. The protocol turns crash recovery into a deterministic choice: either the previous transaction committed and offsets moved, or it did not and the input is processed again.`
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Kafka transactions fail as a universal side-effect protocol. Sending an email inside the transaction does not unsend the email if the Kafka transaction aborts. Writing to an external database outside a coordinated transaction can still create duplicates or mismatches. Updating an in-memory cache does not become durable because Kafka committed.`,
        `The mechanism is also a poor fit for very low-latency single-record paths where commit overhead dominates, for pipelines whose output system cannot deduplicate, or for teams unwilling to configure transactional ids, isolation levels, timeouts, and monitoring. At-least-once plus idempotent output may be simpler and more reliable for many workloads.`
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `A common failure mode is a downstream consumer running with read_uncommitted isolation and accidentally observing aborted transactional records. Another is transaction timeout: the app does useful work for too long, the transaction aborts, and the input is retried. A third is zombie work after rebalance, where a stale instance keeps processing without realizing it has lost partition ownership.`,
        `Operational signals include transaction commit latency, abort rate, producer fencing errors, coordinator errors, timeout errors, and consumer lag behind the last stable offset. Those metrics tell different stories. High consumer lag may mean long open transactions rather than slow consumers. Fencing errors may mean the system is correctly rejecting stale producers or incorrectly reusing transactional ids.`
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Apache Kafka design documentation at https://kafka.apache.org/43/design/design/, Apache Kafka producer configuration docs at https://kafka.apache.org/41/configuration/producer-configs/, and Kafka Streams core concepts at https://kafka.apache.org/43/streams/core-concepts/.`,
        `Study Kafka Log Case Study for append-only partition mechanics, Idempotency and Exactly-Once Delivery for the general duplicate-control problem, Transactional Outbox for external database integration, Two-Phase Commit for the classic atomic-commit model, Flink Checkpointing Case Study for a different stream-processing fault-tolerance design, and Schema Registry Case Study for compatibility control on the records being transactionally published.`
      ],
    },
  ],
};
