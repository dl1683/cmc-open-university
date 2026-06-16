// Cloudflare Durable Objects: named single-threaded coordination with colocated storage.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'cloudflare-durable-objects-case-study',
  title: 'Cloudflare Durable Objects Case Study',
  category: 'Systems',
  summary: 'A serverless coordination primitive: route all requests for one named object to a single instance with private, strongly consistent storage.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['single object', 'storage restart'], defaultValue: 'single object' },
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

function durableGraph(title) {
  return graphState({
    nodes: [
      { id: 'clientA', label: 'client A', x: 0.8, y: 2.0, note: 'global request' },
      { id: 'clientB', label: 'client B', x: 0.8, y: 5.0, note: 'global request' },
      { id: 'worker', label: 'Worker', x: 2.7, y: 3.5, note: 'gets stub by name' },
      { id: 'id', label: 'Durable Object ID', x: 4.7, y: 3.5, note: 'room:123' },
      { id: 'object', label: 'single object instance', x: 6.8, y: 3.5, note: 'serialized coordination' },
      { id: 'memory', label: 'in-memory state', x: 8.7, y: 2.0, note: 'hot cache' },
      { id: 'storage', label: 'private storage', x: 8.7, y: 5.0, note: 'transactional durable state' },
    ],
    edges: [
      { id: 'e-a-worker', from: 'clientA', to: 'worker', weight: 'fetch' },
      { id: 'e-b-worker', from: 'clientB', to: 'worker', weight: 'fetch' },
      { id: 'e-worker-id', from: 'worker', to: 'id', weight: 'namespace.idFromName' },
      { id: 'e-id-object', from: 'id', to: 'object', weight: 'route to instance' },
      { id: 'e-object-memory', from: 'object', to: 'memory', weight: 'fast state' },
      { id: 'e-object-storage', from: 'object', to: 'storage', weight: 'persist' },
    ],
  }, { title });
}

function* singleObject() {
  yield {
    state: durableGraph('All requests for one name route to one Durable Object'),
    highlight: { active: ['clientA', 'clientB', 'worker', 'id', 'object', 'e-worker-id', 'e-id-object'], compare: ['storage'] },
    explanation: 'A Durable Object has a globally unique name or id. Requests from anywhere can be routed to the same object instance, giving one coordination point for that name.',
    invariant: 'One object id owns one private state island.',
  };
  yield {
    state: labelMatrix(
      'What the object gives you',
      [
        { id: 'identity', label: 'identity' },
        { id: 'ordering', label: 'single-threaded turn' },
        { id: 'storage', label: 'private storage' },
        { id: 'location', label: 'placement' },
      ],
      [{ id: 'meaning' }, { id: 'systemUse' }],
      [
        ['globally named object', 'route by room/user/key'],
        ['one instance handles requests', 'coordination without external lock'],
        ['attached durable data', 'survive eviction/restart'],
        ['platform chosen', 'close to traffic when possible'],
      ],
    ),
    highlight: { found: ['ordering:systemUse', 'storage:systemUse'], active: ['identity:meaning'] },
    explanation: 'Durable Objects combine routing, compute, and storage for one logical object. That is different from stateless serverless functions that must coordinate through a separate database.',
  };
  yield {
    state: durableGraph('In-memory state is fast but storage is the source of durability'),
    highlight: { active: ['object', 'memory', 'storage', 'e-object-memory', 'e-object-storage'], compare: ['clientA'] },
    explanation: 'A hot object can keep state in memory between requests, but the platform may evict or restart it. Durable state must be written to attached storage.',
  };
  yield {
    state: labelMatrix(
      'Coordination use cases',
      [
        { id: 'chat', label: 'chat room' },
        { id: 'counter', label: 'global counter' },
        { id: 'booking', label: 'seat booking' },
        { id: 'game', label: 'multiplayer room' },
      ],
      [{ id: 'whyObject' }, { id: 'state' }],
      [
        ['one room object', 'members and messages'],
        ['one key owner', 'increment serialization'],
        ['one seat map owner', 'prevent double booking'],
        ['one match owner', 'positions and turns'],
      ],
    ),
    highlight: { found: ['booking:whyObject', 'game:whyObject'], compare: ['counter:state'] },
    explanation: 'The pattern is one logical coordination entity per Durable Object. Pick names so contention is isolated at the right granularity.',
  };
}

function* storageRestart() {
  yield {
    state: labelMatrix(
      'SQLite-backed storage',
      [
        { id: 'sql', label: 'SQL API' },
        { id: 'kv', label: 'KV API' },
        { id: 'txn', label: 'implicit transactions' },
        { id: 'pitr', label: 'point-in-time recovery' },
      ],
      [{ id: 'capability' }, { id: 'use' }],
      [
        ['tables and queries', 'structured state'],
        ['key-value methods', 'simple state'],
        ['atomic isolated operations', 'multi-key consistency'],
        ['restore recent state', 'operator safety net'],
      ],
    ),
    highlight: { active: ['sql:capability', 'txn:capability'], found: ['pitr:use'] },
    explanation: 'Modern Durable Objects can use SQLite-backed storage with transactional, strongly consistent access private to that object.',
  };
  yield {
    state: durableGraph('Restart drops memory but reloads durable storage'),
    highlight: { active: ['object', 'memory', 'storage'], removed: ['memory'], found: ['storage'] },
    explanation: 'In-memory state is a cache. After eviction, deployment, or restart, the object must reconstruct important state from storage.',
    invariant: 'If state must survive restart, write it to storage before acknowledging success.',
  };
  yield {
    state: labelMatrix(
      'Design boundaries',
      [
        { id: 'oneObject', label: 'one object' },
        { id: 'manyObjects', label: 'many objects' },
        { id: 'crossObject', label: 'cross-object transaction' },
        { id: 'database', label: 'database layer' },
      ],
      [{ id: 'goodAt' }, { id: 'limit' }],
      [
        ['serial coordination', 'single hot key can bottleneck'],
        ['shard by name', 'coordination is partitioned'],
        ['not the primitive', 'needs app protocol'],
        ['query across many entities', 'use separate system if needed'],
      ],
    ),
    highlight: { found: ['oneObject:goodAt', 'manyObjects:goodAt'], compare: ['crossObject:limit'] },
    explanation: 'Durable Objects are strongest when one name is the natural serialization boundary. They are not a general distributed SQL database across all names.',
  };
  yield {
    state: labelMatrix(
      'Complete booking case study',
      [
        { id: 'route', label: 'route show:seatmap' },
        { id: 'check', label: 'check seat' },
        { id: 'write', label: 'write reservation' },
        { id: 'notify', label: 'notify client' },
      ],
      [{ id: 'objectMove' }, { id: 'lesson' }],
      [
        ['one object by show id', 'all seat requests serialize'],
        ['read private storage', 'consistent local truth'],
        ['transactional update', 'no double booking inside object'],
        ['reply after commit', 'restart-safe acknowledgment'],
      ],
    ),
    highlight: { found: ['route:lesson', 'write:lesson'], active: ['check:objectMove'] },
    explanation: 'A seat map is a natural Durable Object: one named owner, highly coordinated writes, private transactional state, and real-time clients.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'single object') yield* singleObject();
  else if (view === 'storage restart') yield* storageRestart();
  else throw new InputError('Pick a Cloudflare Durable Objects view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: [
      'Cloudflare Durable Objects are named, stateful serverless objects. Requests for a given object id are routed to the same logical object, which has in-memory state while active and private durable storage attached.',
      'They are a coordination primitive. Instead of every stateless function racing through a shared database row, one object can own the serialization boundary for a chat room, game room, booking map, counter, or collaborative document shard.',
      'This topic connects Distributed Locks, Hot Rows, Transactional Outbox, SQLite B-Tree & Pager Case Study, and Cloudflare-style edge systems. It is a different answer to the problem of coordinating state.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A Worker obtains a Durable Object id or stub from a namespace, usually from a name such as a room id. Requests sent through the stub route to that object. The object code handles requests and can read or write attached storage.',
      'SQLite-backed Durable Object storage provides transactional and strongly consistent storage private to the object. In-memory state can cache hot data, but durable storage is what survives eviction, restart, and deployment.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'A single object serializes coordination for one name, which is exactly the point and also the bottleneck. Bad sharding can turn one hot Durable Object into a throughput limit. Good design chooses object names that isolate contention naturally.',
      'Durable Objects do not make cross-object transactions automatic. If one business action spans multiple object ids, the application needs a protocol, idempotency, or a separate database with the right transaction boundary.',
      'Placement is also part of the model. The platform routes requests to the object, but a globally popular object can still concentrate traffic. The right design often shards by room, account, document, or seat map rather than by an entire product.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Durable Objects are used for chat rooms, multiplayer rooms, collaborative editing sessions, WebSocket hubs, rate limiters, counters, seat maps, per-customer coordinators, alarms, and edge-local state machines.',
      'A complete case study is seat booking. Every request for one show routes to the show object. The object checks seat state in private storage, commits a reservation transaction, then replies. Concurrent requests serialize at the object.',
      'Another case is a collaborative document room. One object owns the active WebSocket set and operation order for that document, while durable storage keeps the committed revision history needed after restart.',
    ] },
    { heading: 'Pitfalls and misconceptions', paragraphs: [
      'In-memory state is not permanent. It may disappear when the object is evicted or restarted. Also, a Durable Object is not a global relational database; it is a per-object coordination and storage island.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Durable Objects overview at https://developers.cloudflare.com/durable-objects/, rules at https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/, and SQLite storage API at https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/. Study Distributed Locks, Hot Rows, SQLite B-Tree & Pager Case Study, Transactional Outbox, and Idempotency next.',
    ] },
  ],
};
