// Schema Registry case study: producers and consumers share versioned event
// contracts, compatibility checks, and schema ids on the Kafka hot path.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'schema-registry-case-study',
  title: 'Schema Registry Case Study',
  category: 'Systems',
  summary: 'Event contracts for streaming systems: register versioned schemas, enforce compatibility, serialize by schema id, and evolve producers safely.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['write path', 'evolution safety'], defaultValue: 'write path' },
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

function registryGraph(title) {
  return graphState({
    nodes: [
      { id: 'producer', label: 'producer', x: 0.8, y: 3.6, note: 'event writer' },
      { id: 'serializer', label: 'serializer', x: 2.7, y: 3.6, note: 'Avro/Proto/JSON' },
      { id: 'registry', label: 'registry', x: 4.8, y: 2.2, note: 'subjects + versions' },
      { id: 'compat', label: 'compat check', x: 4.8, y: 5.1, note: 'break guard' },
      { id: 'kafka', label: 'Kafka topic', x: 6.9, y: 3.6, note: 'schema id + bytes' },
      { id: 'consumer', label: 'consumer', x: 8.9, y: 3.6, note: 'reader schema' },
    ],
    edges: [
      { id: 'e-producer-serializer', from: 'producer', to: 'serializer', weight: 'record' },
      { id: 'e-serializer-registry', from: 'serializer', to: 'registry', weight: 'lookup/register' },
      { id: 'e-registry-compat', from: 'registry', to: 'compat', weight: 'new version' },
      { id: 'e-compat-registry', from: 'compat', to: 'registry', weight: 'allow/deny' },
      { id: 'e-serializer-kafka', from: 'serializer', to: 'kafka', weight: 'schema id' },
      { id: 'e-kafka-consumer', from: 'kafka', to: 'consumer', weight: 'decode' },
      { id: 'e-consumer-registry', from: 'consumer', to: 'registry', weight: 'fetch schema' },
    ],
  }, { title });
}

function* writePath() {
  yield {
    state: registryGraph('A producer serializes records with a registered schema'),
    highlight: { active: ['producer', 'serializer', 'registry', 'e-producer-serializer', 'e-serializer-registry'], compare: ['kafka'] },
    explanation: 'A schema registry turns event shape into an explicit contract. The producer serializer looks up or registers a schema before writing encoded bytes.',
  };

  yield {
    state: registryGraph('The wire payload carries a schema id plus encoded bytes'),
    highlight: { active: ['serializer', 'kafka', 'e-serializer-kafka'], found: ['registry'] },
    explanation: 'The message does not need to repeat the whole schema. It can carry a schema id, while consumers fetch the schema by id and decode the payload.',
    invariant: 'Consumers decode with an explicit writer schema instead of guessing field layout.',
  };

  yield {
    state: labelMatrix(
      'Registry concepts',
      [
        { id: 'subject', label: 'subject' },
        { id: 'version', label: 'version' },
        { id: 'id', label: 'schema id' },
        { id: 'format', label: 'format' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'example', label: 'example' },
      ],
      [
        ['evolution namespace', 'orders-value'],
        ['history entry', 'v7'],
        ['global lookup key', 'id 1520'],
        ['schema language', 'Avro, Protobuf, JSON Schema'],
      ],
    ),
    highlight: { active: ['subject:meaning', 'version:example'], found: ['id:meaning'] },
    explanation: 'Subjects and versions create a contract history. Schema ids make the hot path compact.',
  };

  yield {
    state: registryGraph('Consumers fetch schemas and apply reader compatibility rules'),
    highlight: { active: ['kafka', 'consumer', 'registry', 'e-kafka-consumer', 'e-consumer-registry'], found: ['serializer'] },
    explanation: 'A consumer can read older and newer events only if schema evolution preserved the compatibility mode promised by the subject.',
  };
}

function* evolutionSafety() {
  yield {
    state: labelMatrix(
      'Compatibility modes',
      [
        { id: 'backward', label: 'backward' },
        { id: 'forward', label: 'forward' },
        { id: 'full', label: 'full' },
        { id: 'none', label: 'none' },
      ],
      [
        { id: 'protects', label: 'protects' },
        { id: 'risk', label: 'risk if wrong' },
      ],
      [
        ['new readers read old data', 'old data breaks deploy'],
        ['old readers read new data', 'new producer breaks consumers'],
        ['both directions', 'harder evolution rules'],
        ['nothing', 'runtime decode failures'],
      ],
    ),
    highlight: { active: ['backward:protects', 'forward:protects', 'full:protects'], compare: ['none:risk'] },
    explanation: 'Compatibility mode is a release policy. It decides which producers and consumers can be upgraded independently.',
  };

  yield {
    state: registryGraph('Incompatible schema versions are rejected before production writes'),
    highlight: { active: ['registry', 'compat', 'e-registry-compat', 'e-compat-registry'], compare: ['kafka'] },
    explanation: 'The registry is a control plane. It can reject a schema change before bad bytes enter Kafka and before consumers start failing in production.',
  };

  yield {
    state: labelMatrix(
      'Common evolution moves',
      [
        { id: 'add', label: 'add optional field' },
        { id: 'rename', label: 'rename field' },
        { id: 'remove', label: 'remove field' },
        { id: 'type', label: 'change type' },
      ],
      [
        { id: 'usually', label: 'usually' },
        { id: 'safe path', label: 'safer path' },
      ],
      [
        ['safe with default/null', 'document default meaning'],
        ['breaking', 'add new, deprecate old'],
        ['risky', 'wait until readers stop using it'],
        ['breaking', 'new field or new subject'],
      ],
    ),
    highlight: { found: ['add:usually', 'rename:safe path'], active: ['type:usually'] },
    explanation: 'Schema evolution is mostly about boring compatibility. Additive changes are easier than renames and type changes.',
  };

  yield {
    state: labelMatrix(
      'Operational checklist',
      [
        { id: 'owner', label: 'owner' },
        { id: 'ci', label: 'CI check' },
        { id: 'docs', label: 'field docs' },
        { id: 'rollback', label: 'rollback' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure', label: 'failure if missing' },
      ],
      [
        ['who owns subject?', 'orphaned contract'],
        ['does schema pass?', 'bad deploy reaches prod'],
        ['what does field mean?', 'semantic drift'],
        ['can old readers survive?', 'irreversible producer change'],
      ],
    ),
    highlight: { active: ['ci:question', 'rollback:failure'], found: ['docs:failure'] },
    explanation: 'A registry enforces shape, not meaning. Owners, docs, CI, and rollout rules turn schema ids into a real data contract.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'write path') yield* writePath();
  else if (view === 'evolution safety') yield* evolutionSafety();
  else throw new InputError('Pick a Schema Registry view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A schema registry is a control plane for event contracts. Producers and consumers agree on schemas for messages, the registry stores versioned schema history, serializers put schema ids on the wire, and compatibility rules prevent unsafe evolution. In Kafka ecosystems this is commonly associated with Avro, Protobuf, and JSON Schema.',
        'Confluent Schema Registry documentation says it supports Avro, JSON Schema, and Protobuf serializers and deserializers: https://docs.confluent.io/platform/current/schema-registry/index.html. The schema evolution docs describe compatibility types and note that the default compatibility type is BACKWARD: https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A producer has a record and a schema. The serializer checks whether the schema is registered under a subject such as orders-value. If not, it attempts to register a new version. The registry checks compatibility for that subject. If the schema passes, the serializer writes a compact payload containing a schema id and encoded bytes. Consumers read the id, fetch or cache the writer schema, and decode.',
        'The registry is not on every field access, but it is on the contract path. It prevents a producer from silently changing bytes in a way that breaks readers. Subjects create namespaces for evolution. Versions create history. Compatibility modes define which upgrade order is allowed.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Schema registries add operational dependencies, but they remove a worse failure mode: ungoverned message shape. A registry outage can affect producer startup, schema registration, or cold consumer caches depending on client behavior. Teams need caching, availability planning, compatibility policy, CI checks, and ownership for subjects.',
        'Compatibility is format-specific and semantic discipline still matters. A field can be technically compatible but semantically broken if its meaning changes. A registry can reject missing defaults or incompatible types; it cannot know that status now means something different to billing.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A Debezium pipeline publishes OrderPlaced events to Kafka. Version 1 has order_id, customer_id, and total_cents. A new fraud model needs risk_score. If the subject uses backward compatibility, the producer can add an optional field with a default or nullable value so new consumers read old events. Old consumers ignore the field. A rename from total_cents to amount would be riskier; the safer path is add amount, keep total_cents during migration, and remove only after readers stop depending on it.',
        'This turns event evolution into a staged rollout instead of a synchronized deploy across every producer and consumer.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A schema registry is not a data catalog by itself and not a replacement for documentation. It also does not guarantee business compatibility. Optional fields can still be misused. Compatibility settings can be weakened under pressure. Subject naming strategies can fragment contracts if teams do not agree on conventions. The registry is necessary plumbing, but contract ownership is the real operating model.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Official sources: Schema Registry overview at https://docs.confluent.io/platform/current/schema-registry/index.html, schema evolution and compatibility at https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html, and data contracts at https://docs.confluent.io/platform/current/schema-registry/fundamentals/data-contracts.html. Study Base-128 Varint & ZigZag Encoding, Protobuf Wire Format, Avro Binary Encoding & Schema Resolution, Kafka Log Case Study, Debezium CDC Case Study, Transactional Outbox, Idempotency, and Flink Checkpointing Case Study next.',
      ],
    },
  ],
};
