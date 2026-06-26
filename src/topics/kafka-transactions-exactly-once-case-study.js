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
    { heading: 'How to read the animation', paragraphs: [
      'Read transaction flow as a read-process-write loop. The app consumes input, writes output through a transactional producer, and sends consumed offsets into the same transaction. The failure view names retry, crash, and zombie-producer windows.',
      {type:`callout`, text:`Exactly-once inside Kafka means output records and consumed offsets share one transaction, while external side effects still need their own idempotency boundary.`}
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Kafka stream apps often consume records, compute results, write output records, and commit offsets. Output and offsets are separate pieces of state. A crash between them creates either duplicate output or lost output.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is at-least-once processing: write output, then commit offsets. A crash before the offset commit retries the input, which avoids loss but can duplicate output. Committing offsets first avoids duplicates but can lose output after a crash.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is atomic progress. Output publication and input progress must become one decision. Producer retries and stale app instances add more failure windows, so Kafka also needs sequence numbers and fencing epochs.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Treat consumed offsets as data inside the transaction. The app writes output records and the offsets those records cover, then commits or aborts both together. Idempotent producers handle retry duplicates, and producer epochs fence old instances.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A transactional producer starts with a transactional id. It begins a transaction, writes output records, sends consumed offsets to the transaction, and commits through the transaction coordinator. Commit markers make records visible to read_committed consumers; abort markers make them skipped.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The retry invariant is per-producer sequence order, so a retried send does not become a second logical append. The crash invariant is atomic visibility of records and offsets. The ownership invariant is fencing: a new producer epoch rejects writes from an old zombie producer.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Transactions add coordinator work, markers, timeouts, and visibility delay. If a transaction covers 100 records and commit overhead is 8 ms, the commit tax is 0.08 ms per record. If every record commits alone, the same 8 ms dominates latency.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Kafka transactions win for Kafka-in, Kafka-out stream processing: aggregations, repartitioning, enrichment, dedupe, and Kafka Streams topologies. They are strongest when downstream consumers use read_committed and the important output is written back to Kafka.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Kafka transactions do not make external systems exactly-once. Sending email, charging a card, or writing to an unrelated database still needs idempotency keys, a transactional outbox, conditional writes, or another coordination pattern. read_uncommitted consumers can also observe records the app intended to hide.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'An app consumes order offsets 100 through 149 and writes revenue updates. It sends offset 150 into the same transaction and commits. If it crashes before commit, read_committed consumers skip the output and offset 150 is not committed; if it crashes after commit, both output and offset 150 are durable.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Kafka design docs at https://kafka.apache.org/43/design/design/, producer configs at https://kafka.apache.org/documentation/#producerconfigs, consumer isolation docs at https://kafka.apache.org/documentation/#consumerconfigs_isolation.level, and KIP-98 at https://cwiki.apache.org/confluence/display/KAFKA/KIP-98+-+Exactly+Once+Delivery+and+Transactional+Messaging. Study Kafka Log, Idempotency, Transactional Outbox, Two-Phase Commit, Flink Checkpointing, WAL, and Zombie Writer Fencing next.',
    ] },
  ],
};
