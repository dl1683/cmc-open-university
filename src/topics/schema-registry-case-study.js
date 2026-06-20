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
        'The write-path view traces one record from producer through serializer, registry, Kafka, and consumer. Active nodes are the components handling data right now. Found nodes are components whose work is done for this message. Compare nodes show the Kafka topic waiting to receive bytes.',
        'The evolution-safety view focuses on the compatibility gate. Active nodes are the registry and compatibility checker deciding whether a new schema version is safe. Compare nodes show the Kafka topic that would receive unsafe data if the gate were absent.',
        {
          type: 'note',
          text: 'Each frame answers one question: who owns the schema identity at this moment? Follow the schema id as it moves from registry to wire to consumer cache. That transfer of identity is the mechanism that makes independent evolution possible.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Event streams become shared APIs. A Kafka topic with seven-day retention holds messages written by last week\'s producer code and read by today\'s consumer code. The producer team shipped a field rename on Tuesday. The consumer team has not deployed since Monday. Old messages with the old field name sit next to new messages with the new field name, and neither side coordinated the change.',
        'Without a contract layer, the consumer discovers the mismatch at 2 AM when deserialization throws a NullPointerException on a field it expected to exist. The on-call engineer has no way to know which producer version wrote which message or whether the change was intentional.',
        {
          type: 'quote',
          text: 'Schemas are the API of your data pipeline. If you do not version and enforce them, you have an API with no contract -- every consumer is guessing.',
          attribution: 'Confluent Schema Registry documentation, "Why Use Schema Registry"',
        },
        'A schema registry solves this by making event shape an explicit, versioned, enforced contract. Every schema gets a global id. Every message carries that id. Every evolution is checked against a compatibility policy before it reaches the topic. The result: producers and consumers evolve independently without synchronized deploys, and breaking changes are caught before they corrupt retained data.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is always informal documentation. Teams write a wiki page describing the JSON shape, or they share a generated class (a POJO, a Protobuf stub, a TypeScript interface) in a shared library. Producers and consumers import the same version of the library, and as long as everyone upgrades together, the shapes match.',
        'This works when one team owns both ends, messages are consumed within minutes, and deploys happen in lockstep. Many internal systems run this way for years without incident.',
        {
          type: 'table',
          headers: ['Approach', 'Works when', 'Breaks when'],
          rows: [
            ['Wiki page with JSON examples', 'One team, ephemeral messages', 'Multiple consumers, retained events'],
            ['Shared library with generated classes', 'Coordinated deploys', 'Independent release cycles'],
            ['Self-describing payloads (full schema in every message)', 'Low throughput', 'High volume (bandwidth and parse cost)'],
            ['Manual code review of schema changes', 'Small team, low change rate', 'Dozens of subjects, multiple teams'],
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The informal approach breaks at the intersection of three forces: retention, independent deploys, and multi-consumer fan-out.',
        'Retention means old messages survive. A Kafka topic with compaction or seven-day retention holds messages written by schema versions that no longer exist in any running producer. A consumer must decode all of them, not just the latest.',
        'Independent deploys mean producer and consumer code change at different times. The producer ships v5 of the schema on Monday. Consumer A upgrades Tuesday. Consumer B upgrades next month. During that gap, Consumer B reads v5 messages with a v4 reader. If v5 removed a field that v4 depends on, Consumer B fails.',
        'Multi-consumer fan-out means one producer change can break many readers. A single topic may feed an analytics pipeline, a search indexer, a fraud detector, and an audit log. The producer team cannot coordinate with all of them for every field change.',
        {
          type: 'diagram',
          text: 'Timeline of an uncoordinated schema change:\n\n  Mon 09:00  Producer deploys v5 (removes field "region")\n  Mon 09:01  New messages in topic lack "region"\n  Mon 09:02  Consumer A (v4 reader) crashes: NullPointerException on "region"\n  Mon 09:15  On-call rolls back producer to v4\n  Mon 09:16  Topic now has a mix of v4 and v5 messages\n  Mon 09:17  Consumer A recovers but skips v5 messages it cannot parse\n  Mon 10:00  Data loss: v5 messages are silently dropped or dead-lettered',
          label: 'Without a compatibility gate, a single field removal cascades into runtime failures, data loss, and rollback confusion',
        },
        'The wall is that no amount of documentation or code review can enforce compatibility at the speed and scale of independent deploys. The enforcement must be automated, versioned, and checked before bytes enter the topic.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate schema identity from payload bytes, and check compatibility before bytes enter the topic.',
        'The Confluent wire format (used by the Schema Registry serializers) prepends a 5-byte header to every Kafka message: one magic byte (0x00) followed by a 4-byte big-endian schema id. The remaining bytes are the encoded payload (Avro binary, Protobuf, or JSON). The consumer reads the id, fetches the corresponding schema from the registry, and decodes with the exact writer schema.',
        {
          type: 'code',
          language: 'text',
          text: 'Confluent wire format (every Kafka message value):\n\n  Byte 0:       0x00            (magic byte)\n  Bytes 1-4:    schema id       (big-endian int32, e.g., 0x000005F0 = 1520)\n  Bytes 5+:     encoded payload  (Avro binary, Protobuf, or JSON)\n\nTotal overhead per message: 5 bytes\nSchema lookup: one HTTP GET to /schemas/ids/1520 (cached after first fetch)',
        },
        'Compatibility is checked at registration time, not at read time. When a serializer attempts to register a new schema version under a subject, the registry checks it against the subject\'s compatibility policy. If the new version violates the policy (e.g., removes a required field under BACKWARD mode), the registry returns HTTP 409 and the serializer throws an exception. The bad schema never gets an id, and no message with that shape reaches the topic.',
        {
          type: 'note',
          text: 'The registry is a control plane, not the data plane. Producers and consumers still write and read Kafka directly. The registry is on the schema registration path (infrequent, cacheable) and the schema fetch path (cached by id). It is not on the per-message hot path after the first lookup.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The write path has five steps. The producer creates a record. The serializer fingerprints the record\'s schema and checks a local cache. On a cache miss, it calls the registry\'s POST /subjects/{subject}/versions endpoint. The registry checks compatibility, assigns a global schema id, and returns it. The serializer writes the 5-byte header plus encoded bytes to Kafka.',
        {
          type: 'diagram',
          text: 'Write path (producer side):\n\n  1. Producer creates record with schema S\n  2. Serializer computes fingerprint of S\n  3. Cache hit?  --> Use cached schema id, skip to step 6\n  4. Cache miss? --> POST /subjects/orders-value/versions {schema: S}\n  5. Registry checks compatibility, assigns id 1520, returns it\n  6. Serializer writes: [0x00][0x000005F0][Avro bytes] to Kafka\n\nRead path (consumer side):\n\n  1. Consumer reads message from Kafka\n  2. Deserializer reads bytes 0-4: magic=0x00, id=1520\n  3. Cache hit?  --> Use cached schema for id 1520\n  4. Cache miss? --> GET /schemas/ids/1520\n  5. Deserializer decodes bytes 5+ using writer schema 1520\n  6. Avro schema resolution merges writer schema with reader schema',
          label: 'Both paths cache aggressively. The registry is only hit on cold start or new schema versions.',
        },
        'The read path mirrors this. The consumer deserializer reads the 4-byte schema id from the message header, fetches or cache-looks-up the writer schema, and decodes the payload. In Avro, the deserializer also applies schema resolution: it merges the writer schema (from the registry) with the reader schema (compiled into the consumer) to handle added fields with defaults, removed fields, and type promotions.',
        {
          type: 'table',
          headers: ['Registry concept', 'What it is', 'Example'],
          rows: [
            ['Subject', 'A namespace for schema evolution; one per contract', 'orders-value, payments-key'],
            ['Version', 'A sequential number within a subject; each new compatible schema gets the next version', 'v1, v2, v7'],
            ['Schema id', 'A globally unique integer assigned when a schema is first registered anywhere', 'id 1520'],
            ['Compatibility mode', 'The policy that governs which changes a subject allows', 'BACKWARD, FORWARD, FULL, NONE'],
            ['Fingerprint', 'A hash of the normalized schema text; used for deduplication and cache lookup', 'MD5 or SHA-256 of canonical form'],
          ],
        },
        'Subjects are the unit of policy. The default naming strategy is TopicNameStrategy: a topic called "orders" gets subjects "orders-value" and "orders-key". Alternative strategies (RecordNameStrategy, TopicRecordNameStrategy) allow multiple event types per topic, each with its own evolution history.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The system is correct because of two properties: schema identity is immutable, and compatibility is checked before registration.',
        'Schema id immutability means that once id 1520 is assigned to a specific schema, it never changes. Every message in every topic that carries id 1520 can be decoded with exactly one schema, forever. There is no ambiguity about which fields exist, which types they have, or which defaults apply. This is the foundation that makes retained-message decoding reliable.',
        'Pre-registration compatibility checking means that unsafe changes are rejected before any message with the new shape enters a topic. The invariant is: every schema id in a topic satisfies the subject\'s compatibility policy relative to all previous versions. Consumers can trust that if they handle the declared compatibility mode, they can decode every message in the topic.',
        {
          type: 'table',
          headers: ['Compatibility mode', 'What it guarantees', 'Allowed changes', 'Forbidden changes'],
          rows: [
            ['BACKWARD', 'New code reads old data', 'Add optional field with default, delete field', 'Add required field, change type'],
            ['FORWARD', 'Old code reads new data', 'Delete optional field, add field', 'Delete required field, change type'],
            ['FULL', 'Both directions', 'Add/delete optional fields with defaults', 'Any required field change, type change'],
            ['NONE', 'Nothing', 'Anything', 'Nothing forbidden (runtime failures possible)'],
            ['BACKWARD_TRANSITIVE', 'New code reads ALL old data', 'Same as BACKWARD, checked against all versions', 'Same as BACKWARD'],
            ['FULL_TRANSITIVE', 'Both directions against all versions', 'Same as FULL, checked against all versions', 'Same as FULL'],
          ],
        },
        'The transitive variants matter for long-lived topics. Non-transitive BACKWARD only checks the new schema against the immediately previous version. Transitive BACKWARD checks against every version ever registered. Without transitivity, a series of individually compatible changes can accumulate into incompatibility between v1 and v5.',
        {
          type: 'note',
          text: 'Avro schema resolution is the mechanism that makes BACKWARD compatibility concrete. When a reader encounters a writer field it does not know, it ignores it. When it expects a field the writer did not include, it uses the default from the reader schema. This is why "add optional field with default" is the canonical safe change.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An orders service publishes OrderPlaced events under subject orders-value with BACKWARD compatibility. The initial schema (v1, id 1001) has two fields:',
        {
          type: 'code',
          language: 'json',
          text: '{\n  "type": "record",\n  "name": "OrderPlaced",\n  "fields": [\n    {"name": "order_id", "type": "string"},\n    {"name": "total_cents", "type": "long"}\n  ]\n}',
        },
        'Sprint 2: the team wants to add a currency field. They register v2 (id 1034) with currency as an optional field defaulting to "USD":',
        {
          type: 'code',
          language: 'json',
          text: '{\n  "type": "record",\n  "name": "OrderPlaced",\n  "fields": [\n    {"name": "order_id", "type": "string"},\n    {"name": "total_cents", "type": "long"},\n    {"name": "currency", "type": "string", "default": "USD"}\n  ]\n}',
        },
        'The registry checks v2 against v1 under BACKWARD mode. A new reader (v2 schema) reading old data (v1 messages) will not find a "currency" field, but the default "USD" fills in. The check passes. Id 1034 is assigned.',
        'Sprint 5: a developer tries to rename total_cents to amount_cents. They submit a schema with "amount_cents" instead of "total_cents":',
        {
          type: 'code',
          language: 'text',
          text: 'POST /subjects/orders-value/versions\n\nResponse: 409 Conflict\n{\n  "error_code": 409,\n  "message": "Schema being registered is incompatible with an earlier schema"\n}',
        },
        'The registry rejects this because a v3 reader expecting "amount_cents" cannot read v1 or v2 messages that have "total_cents". Under BACKWARD mode, new readers must handle old data. A field rename is a simultaneous add-and-remove that breaks this guarantee.',
        {
          type: 'diagram',
          text: 'Safe migration path for a field rename:\n\n  v2: Add "amount_cents" (optional, default=null)     [BACKWARD-safe]\n  --> Deploy consumers that read both fields\n  --> Deploy producers that write both fields\n  v3: Mark "total_cents" as deprecated in docs         [no schema change]\n  --> Wait until no consumer reads "total_cents"\n  v4: Remove "total_cents"                              [BACKWARD-safe: readers no longer need it]\n\nTotal migration time: 2-4 sprint cycles\nMessages in topic during migration: mix of v2 and v3 payloads, all decodable',
          label: 'A rename that would take one commit in a monolith takes four schema versions in a streaming system',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The registry adds one operational dependency, one cache layer, and one CI integration. The costs are real but bounded.',
        {
          type: 'table',
          headers: ['Cost dimension', 'Magnitude', 'Mitigation'],
          rows: [
            ['Latency per message', 'Zero after cache warm (5-byte header parse only)', 'Schema id cached locally after first fetch'],
            ['Latency on cold start', '1 HTTP GET per unique schema id in the partition', 'Pre-warm cache on consumer startup'],
            ['Bandwidth overhead', '5 bytes per message (vs. embedding full schema)', 'Negligible; an Avro schema can be 500+ bytes'],
            ['Registry availability', 'Outage blocks new schema registration and cold consumers', 'Run 3-node cluster; cache survives short outages'],
            ['Schema storage', 'One row per unique schema version', 'Typically hundreds to low thousands of schemas'],
            ['CI integration', 'One compatibility check per schema change in the build', 'maven-schema-registry-plugin or gradle equivalent'],
            ['Evolution velocity', 'Field renames/type changes require multi-step migration', 'Enforced by design; prevents silent breakage'],
          ],
        },
        'The dominant operational cost is not performance but process. Teams must own subjects, choose compatibility modes, document field semantics, and plan migrations. The registry enforces shape; it cannot enforce meaning. A field called "status" that silently changes from HTTP status codes to business status strings passes every compatibility check and breaks every consumer.',
        {
          type: 'note',
          text: 'Confluent Schema Registry stores schemas in a compacted Kafka topic (_schemas) as its backing store. This means the registry itself benefits from Kafka replication and durability. A 3-node registry cluster with Kafka replication factor 3 tolerates single-node failures without data loss.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['System', 'How schema registry fits', 'Why it matters there'],
          rows: [
            ['Kafka event backbone', 'Every topic value and key has a registered schema', 'Decouples 10+ consumer teams from producer release cycles'],
            ['Debezium CDC', 'Database row changes serialized with Avro schemas matching the table DDL', 'Table ALTER propagates as a new schema version; consumers adapt without recompile'],
            ['Transactional outbox', 'Outbox events carry schema ids so downstream consumers decode without coupling to the source DB', 'Schema registry replaces the source database as the contract authority'],
            ['Analytics pipelines', 'Schema registry feeds schema metadata to Hive/Spark/Flink for automatic table evolution', 'New fields appear in data lake tables without manual DDL'],
            ['Data contracts', 'Schema rules and metadata annotations enforce quality constraints beyond shape', 'Confluent data contracts layer business rules on top of structural compatibility'],
          ],
        },
        'The registry also reduces payload size. An Avro schema for a 15-field event is 400-800 bytes. Sending the schema in every message on a topic producing 100,000 messages per second would add 40-80 MB/s of redundant bandwidth. The 5-byte id replaces all of that.',
        'At LinkedIn (where Kafka and the schema registry originated), the internal registry manages tens of thousands of schema versions across thousands of topics. At scale, the registry becomes the source of truth for what data exists, what shape it has, and how it has changed over time.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A schema registry enforces structural compatibility, not semantic compatibility. It catches removed fields, type changes, and missing defaults. It cannot catch:',
        {
          type: 'bullets',
          items: [
            'A field whose meaning changes (status goes from HTTP codes to business codes)',
            'A field whose unit changes (amount in cents becomes amount in dollars)',
            'An enum value whose business logic changes (PENDING now means "awaiting manual review" instead of "queued for processing")',
            'A timestamp field that switches from UTC to local time without changing its Avro type',
            'A field that remains structurally present but is no longer populated by any producer',
          ],
        },
        'Compatibility mode NONE exists and teams under deadline pressure will switch to it. Once a subject is set to NONE, any schema is accepted and the registry becomes a lookup service without a gate. The damage is not immediate; it accumulates as incompatible messages pile up in the topic and consumers fail one by one.',
        'Subject naming strategy mismatches cause silent contract fragmentation. If Producer A uses TopicNameStrategy (subject: orders-value) and Producer B uses RecordNameStrategy (subject: com.acme.OrderPlaced), they register schemas under different subjects with independent compatibility histories. The registry cannot warn about this because both strategies are valid.',
        {
          type: 'note',
          text: 'The registry also cannot rescue badly chosen event boundaries. If a topic mixes OrderPlaced, OrderShipped, and OrderCancelled events without a union type or per-record subject strategy, the compatibility checker evaluates all three event types as one evolution sequence. An innocent change to OrderCancelled can be rejected because it is incompatible with OrderPlaced v1.',
        },
        'Format-specific blind spots matter. Avro has rich schema resolution rules (defaults, field reordering, type promotions). Protobuf uses field numbers and is backward-compatible by default but has its own traps (changing field number, reusing a deleted field number). JSON Schema has the weakest evolution guarantees because JSON has no canonical binary encoding and field presence is implicit. The registry checks what the format rules allow, not what is safe in practice.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'note',
          text: 'Primary sources: Confluent Schema Registry documentation (https://docs.confluent.io/platform/current/schema-registry/index.html), Schema Evolution and Compatibility (https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html), Data Contracts (https://docs.confluent.io/platform/current/schema-registry/fundamentals/data-contracts.html), and the Apache Avro specification for schema resolution rules (https://avro.apache.org/docs/current/specification/).',
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Avro Binary Encoding and Schema Resolution', 'Understand the serialization format and resolution rules the registry enforces'],
            ['Prerequisite', 'Kafka Log Case Study', 'Understand the append-only, retained-message model that makes schema evolution necessary'],
            ['Prerequisite', 'Protobuf Wire Format', 'Understand field-number-based encoding and its different evolution model'],
            ['Extension', 'Debezium CDC Case Study', 'See how schema registry integrates with change data capture from databases'],
            ['Extension', 'Transactional Outbox', 'See how outbox events use schema ids to decouple from the source database'],
            ['Extension', 'Data Contracts', 'See how business rules layer on top of structural compatibility'],
            ['Contrast', 'OpenAPI / REST versioning', 'Compare request-response API versioning with event-stream schema evolution'],
            ['Related encoding', 'Base-128 Varint and ZigZag Encoding', 'Understand the variable-length integer encoding used by Protobuf on the wire'],
          ],
        },
      ],
    },
  ],
};
