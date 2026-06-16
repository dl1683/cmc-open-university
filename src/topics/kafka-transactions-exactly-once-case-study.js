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
    { heading: 'What it is', paragraphs: [
      'Kafka transactions provide exactly-once processing semantics for Kafka read-process-write pipelines. The core ingredients are idempotent producers, producer fencing, a transaction coordinator, atomic output writes, atomic offset commits, and read_committed consumers.',
      'This topic refines Kafka Log Case Study, Idempotency & Exactly-Once Delivery, Transactional Outbox, Two-Phase Commit, and Flink Checkpointing Case Study. It focuses on the precise boundary where Kafka can and cannot help.',
      'The guarantee is not magic delivery of every side effect once. It is a coordinated protocol that makes Kafka output records and Kafka input offsets commit together.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A transactional producer begins a transaction, writes records to output partitions, sends consumed offsets into the transaction, then commits or aborts. The transaction coordinator records transaction state. Consumers using read_committed ignore aborted records and wait past open transactions.',
      'Idempotent producer sequence numbers deduplicate retries. Producer epochs fence old instances with the same transactional id, preventing a zombie producer from writing after a replacement has taken ownership.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Transactions add coordinator work, state, latency, and operational knobs. Long transactions can hold back read_committed consumers. Misconfigured transactional IDs can accidentally fence active producers or prevent recovery.',
      'The biggest conceptual cost is boundary discipline. Kafka can atomically commit Kafka records and Kafka offsets. If processing writes to an external database, object store, or payment system, the application still needs idempotent keys, external transactions, or an outbox pattern.',
      'Operationally, teams also need to watch transaction timeout, producer fencing errors, abort rates, and consumer lag behind the last stable offset. These signals distinguish a correct but slow transaction from a broken stream processor.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Kafka transactions are used in Kafka Streams applications, stream-table aggregations, deduplicated event transformations, exactly-once materialized Kafka outputs, and pipelines whose inputs and outputs both live in Kafka.',
      'A complete case study is revenue aggregation. The app consumes order events, updates aggregate output records, and commits input offsets in one Kafka transaction. After a crash, it either reprocesses uncommitted input or continues after committed offsets.',
      'A second case is repartitioning. The app consumes from one keyed topic, writes records to a differently keyed topic, and commits source offsets transactionally so downstream consumers never see a committed output without matching input progress.',
    ] },
    { heading: 'Pitfalls and misconceptions', paragraphs: [
      'Kafka exactly-once does not make emails, HTTP calls, or database side effects exactly once. It also does not remove the need for consumer isolation settings. Downstream consumers must read committed output if aborted transactional records should be hidden.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Apache Kafka documentation at https://kafka.apache.org/documentation/, Kafka design docs at https://kafka.apache.org/documentation/#design, and Confluent delivery semantics at https://docs.confluent.io/kafka/design/delivery-semantics.html. Study Kafka Log Case Study, Kafka Request Purgatory Timing Wheel Case Study, Idempotency & Exactly-Once Delivery, Transactional Outbox, Flink Checkpointing Case Study, and Two-Phase Commit next.',
    ] },
  ],
};
