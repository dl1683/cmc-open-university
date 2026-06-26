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
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the schema id, a small number that names one versioned data shape, not just the message. Active nodes are doing work for the current event, visited nodes have already made a decision, and the compare node is the Kafka topic waiting for bytes. The safe inference is that a consumer can decode a retained message only if the schema id in the header still names an immutable writer schema.',
        {type:'callout', text:'A registry makes schema identity a control-plane decision so producers can evolve events before unsafe bytes reach the log.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A stream topic is a shared API with memory. A Kafka topic can keep seven days of events, so today\'s consumer may read data written by three older producer versions. A schema is the declared shape of that data: field names, field types, defaults, and evolution rules.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a wiki page, a shared TypeScript type, or a generated class library. That works when one team deploys producer and consumer together and messages disappear quickly. It is a reasonable start because it makes the shape visible to humans.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is independent change over retained data. If producer v5 removes region at 09:00, consumer v4 may still expect region at 09:10 and may also read older v3 messages from yesterday. Documentation cannot prove at write time that every future reader can decode the bytes.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Put schema identity beside the payload and enforce compatibility before the payload enters the log. In the Confluent wire format, each value starts with one magic byte and a four-byte schema id, then the encoded data. The id is the handle that lets a consumer fetch the exact writer schema.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A producer serializer checks its local cache for the schema. On a miss, it registers the schema under a subject such as orders-value, the registry checks the compatibility mode, and the serializer writes the id plus encoded bytes. A consumer reads the id, fetches or caches the writer schema, and resolves it against its reader schema.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from two invariants. A schema id never changes meaning, and an unsafe schema version never receives an id under the subject policy. If every id in the topic passed the policy, a reader built for that policy can decide how to decode old and new messages instead of guessing from raw bytes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The per-message cost is small and concrete: five header bytes plus one schema-id lookup on a cold cache. At 100,000 messages per second, that is about 0.5 MB per second of header overhead, far less than embedding a 600-byte schema each time. The real cost is process: teams must own subjects, defaults, compatibility modes, and migrations.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Schema registries fit Kafka event backbones, Debezium change-data-capture streams, transactional outbox events, and analytics pipelines that infer tables from event schemas. They are useful when many consumers read the same retained stream and when a producer cannot coordinate a deploy with every reader.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A registry checks structure, not meaning. A field can keep type string while changing from HTTP status to business status, and the checker will pass it. Subject naming mistakes, compatibility mode NONE, and format-specific traps such as Protobuf field-number reuse can also create valid registry entries that are bad contracts.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with OrderPlaced v1, id 1001, with order_id and total_cents. In sprint 2, v2 adds currency with default USD and receives id 1034 because a v2 reader can read old v1 data by filling the default. In sprint 5, a proposed rename from total_cents to amount_cents is rejected because old messages do not contain the new required field.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Confluent Schema Registry, Confluent schema evolution and compatibility, Apache Avro schema resolution, Protobuf field-number evolution, and Kafka log retention. Then compare REST API versioning with event-stream versioning, because the stream keeps old requests as future inputs.',
      ],
    },
  ],
};
