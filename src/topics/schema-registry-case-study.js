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
        "Read the animation as the execution trace for Schema Registry Case Study. Event contracts for streaming systems: register versioned schemas, enforce compatibility, serialize by schema id, and evolve producers safely..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Event streams become shared APIs. Producers evolve fields, consumers deploy on different schedules, and old messages remain in logs. Without a contract control plane, one producer change can silently break many readers.`,
        `A schema registry stores versioned schemas, assigns schema ids, and enforces compatibility rules so producers and consumers can evolve messages without synchronized deploys.`,
        `The key shift is treating an event shape like an API contract rather than an implementation detail. A topic is not just a pipe of bytes. It is a promise about keys, fields, nullability, defaults, semantic meaning, and allowed evolution.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The obvious approach is to document JSON shapes or share generated classes. That works while one team controls both ends and messages disappear quickly.`,
        `The wall is independent evolution. A Kafka topic can retain old events for days or forever, and consumers may read old and new messages in the same run. The wire format needs to say which schema wrote each message, and the registry needs to reject unsafe changes before they hit the topic.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Separate schema identity from payload bytes. A serializer registers or looks up the schema, writes a compact schema id with encoded data, and consumers use that id to fetch or cache the writer schema.`,
        `Compatibility is checked at the subject boundary. Subjects create namespaces for evolution, versions create history, and compatibility modes define which producer and consumer upgrade orders are allowed.`,
        `The registry is a control plane, not the data plane. Producers and consumers still write and read Kafka messages directly. The registry supplies the schema ids, compatibility decisions, and contract history that make those messages safely decodable over time.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `In the write-path view, follow the producer record into the serializer. The serializer is the point where application data becomes bytes plus schema identity. It looks up or registers the schema, gets an id, and writes compact encoded data to Kafka. Consumers later use that id to decode with the correct writer schema.`,
        `In the evolution-safety view, the compatibility node is the gate. A new schema version is not accepted just because it is syntactically valid. It must satisfy the subject's upgrade policy. That is how the system prevents one producer deploy from breaking old consumers or old retained messages.`,
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        `A producer has a record and a schema. The serializer checks whether the schema is registered under a subject such as orders-value. If not, it attempts to register a new version. The registry checks compatibility. If the schema passes, the serializer writes schema id plus encoded bytes.`,
        `Consumers read the id, fetch or cache the writer schema, and decode. The registry is not on every field access, but it is on the contract path where unsafe evolution is blocked.`,
        `Subjects are the unit of policy. A common naming strategy uses topic-value for message values and topic-key for keys. Versions are the history under that subject. A global schema id can identify the exact writer schema in the wire payload while subject versions preserve the evolution story.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The registry works because readers can decode using the writer schema, and compatibility rules prevent changes that known reader upgrade orders cannot handle. Adding an optional field with a default is safe in many modes; renaming or changing types is not automatically safe.`,
        `This turns event evolution into a staged rollout. Add the new field, update readers, keep the old field during migration, then remove it only when compatibility policy and ownership allow it.`,
        `The system also works because the payload does not need to carry its whole schema. A compact id is enough if the registry can resolve that id to the exact schema. That keeps the hot path small while preserving decodability and auditability.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `An orders service publishes OrderPlaced with fields order_id and total_cents. Later it wants to add currency. If currency is optional or has a default, new consumers can read old events and old consumers can usually ignore the new field. The registry accepts the change under a compatible policy.`,
        `Now imagine the producer renames total_cents to amount without a migration. Old consumers looking for total_cents break, and old retained events do not match the new shape. A registry compatibility check should reject that direct change. The safer path is add amount, write both for a while, update consumers, then remove the old field only when policy allows.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `Schema registries add an operational dependency. Outages can affect producer startup, schema registration, or cold consumer caches depending on client behavior. Teams need caching, availability planning, compatibility policy, CI checks, and subject ownership.`,
        `Compatibility is format-specific. Avro, Protobuf, and JSON Schema have different evolution rules, and the registry only enforces the rules it can see.`,
        `The payoff is that failures move earlier. A bad event contract rejected in CI or at registration time is far cheaper than a bad payload retained in a topic and replayed into consumers for months.`,
      ],
    },
    {
      heading: 'How it works (3)',
      paragraphs: [
        `Put schema checks in CI before producers deploy. A registry that rejects bad schemas only at runtime is still useful, but a failed production deploy is a late place to learn that a field rename breaks backward compatibility. CI should test the proposed schema against the subject's real compatibility mode.`,
        `Assign subject ownership. Every subject should have a team, a compatibility policy, documentation for field meaning, and a migration path for deprecations. Without ownership, schemas become a pile of syntactically valid records whose business meaning drifts over time.`,
        `Decide cold-start behavior. Clients may cache schema ids, but a new process or new schema can still need the registry. Producers should fail closed when they cannot validate a new contract; consumers may need cached schemas to keep reading during a registry outage.`,
      ],
    },
    {
      heading: 'Testing the contract',
      paragraphs: [
        `Test old data with new readers and new data with old readers according to the selected compatibility mode. Include missing optional fields, default values, unknown fields, enum changes, nullability changes, and retained events from earlier versions.`,
        `Also test semantic migrations. A compatibility checker can say a field is still present, but it cannot prove that status values, currency units, time zones, or ID formats mean the same thing. Those cases need fixtures and consumer-level assertions.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Schema registries fit Kafka and CDC ecosystems where events are retained, replayed, and consumed by independent teams. They are especially useful with Debezium, transactional outbox streams, data contracts, and analytics pipelines.`,
        `They also reduce payload size by putting schema ids on the wire instead of repeating schema definitions in every message.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `A registry is not a data catalog by itself and not a replacement for documentation. It cannot know that a field named status changed business meaning for billing.`,
        `Optional fields can still be misused, compatibility settings can be weakened under pressure, and subject naming strategies can fragment contracts. The registry is plumbing; contract ownership is the operating model.`,
        `It also does not rescue badly chosen event boundaries. If one topic mixes unrelated event types without a clear subject strategy, compatibility becomes noisy and consumers receive contracts they do not actually own.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Official sources: Schema Registry overview at https://docs.confluent.io/platform/current/schema-registry/index.html, schema evolution and compatibility at https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html, and data contracts at https://docs.confluent.io/platform/current/schema-registry/fundamentals/data-contracts.html. Study Base-128 Varint & ZigZag Encoding, Protobuf Wire Format, Avro Binary Encoding & Schema Resolution, Kafka Log Case Study, Debezium CDC Case Study, Transactional Outbox, Idempotency, and Flink Checkpointing Case Study next.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Schema Registry Case Study moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};
