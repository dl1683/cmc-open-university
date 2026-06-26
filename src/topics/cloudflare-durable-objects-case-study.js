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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the first view as request routing by name. Two clients reach a Worker, the Worker derives a Durable Object ID, and all requests for that ID land at one object instance. Active marks show the path that turns a global request into local coordination.',
        'Read memory and storage as different promises. Memory is fast state that can disappear on eviction or restart. Durable storage is the private committed state the object can reload, so found storage means restart-safe truth.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Serverless functions are usually stateless. That is good for scale, but many applications need one small piece of state to be updated in one place: a chat room membership list, a multiplayer turn order, a document cursor set, or a seat map. Durable Objects exist to give one named entity a single coordination home with private durable storage.',
        'A zero-background reader can think of a Durable Object as an actor with an address. An actor owns state and receives messages; here the address is the object ID. The platform routes requests with the same ID to the same logical object, so the application can reason locally about that entity.',
        {type:'callout', text:'Durable Objects make one named entity the serialization boundary so coordination, memory, and durable state live behind the same key.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a stateless Worker plus a shared database row. Each request reads the row, decides what to change, writes back, and maybe sends WebSocket notifications through another service. This is a normal design and works when conflicts are rare.',
        'Another obvious approach is a distributed lock around that database row. A lock can protect a critical section, but it adds lease timeouts, partial failure, retry logic, and another system to operate. It also does not give the workflow a natural place for hot in-memory clients and timers.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is scattered coordination. A seat booking can involve row locks, cache invalidation, WebSocket fanout, hold expiration, payment state, and audit logs. If those pieces live in separate stateless handlers, the correctness argument is spread across retries and external invariants.',
        'A concrete race shows the problem. Buyer A and buyer B both read seat 12 as open at 10:00:00.000, then both try to reserve it by 10:00:00.050. A database uniqueness constraint can reject one write, but the application still has to repair notifications, holds, and user-visible state after the conflict.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Choose the natural conflict key and make it the object key. For a room, use room id; for a seat map, use show id; for a document, use document id; for a rate-limit bucket, use account plus time bucket. Requests that can conflict should meet at the same object.',
        'The invariant is that one object owns one state island. Inside that island, code can check current state, apply a transition, persist what must survive, and notify connected clients. The hard design question becomes key choice, because too broad a key creates a hot object and too narrow a key loses the coordination benefit.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Worker receives a request and derives an object ID from a name or key. It gets a stub from the Durable Object namespace and sends the request through that stub. Cloudflare routes the request to the object instance responsible for that ID.',
        'The object can keep hot state in memory while active. It can also use attached storage for durable state, including SQLite-backed storage in current Durable Objects. A correct object treats memory as a cache or coordination workspace and commits important transitions before acknowledging success.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is serialization at the right boundary. If all requests that can change one seat map are handled by the seat-map object, then the object can reject invalid transitions using its own current state. The application no longer reconstructs the same state machine across many stateless handlers.',
        'Durability completes the argument only for committed state. If the object sends success before writing the reservation, a restart can erase the promise. If it writes first and replies after commit, recovery can rebuild memory from storage and preserve the user-visible outcome.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost follows contention. One quiet room object is cheap because it wakes on demand and stores a small state island. One global counter object is expensive because every increment queues behind the same name. When traffic doubles for independent room IDs, capacity can spread; when traffic doubles for one ID, that object is the bottleneck.',
        'The complexity cost is boundary design. Cross-object transactions are not the primitive. If one purchase touches a user object, seat-map object, payment object, and audit object, the application needs idempotency, a durable event protocol, or a database transaction outside Durable Objects.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Durable Objects fit live collaboration rooms, chat rooms, multiplayer matches, per-account rate limits, shopping carts, queues, and seat maps. In each case, many clients interact with one logical entity and the entity has a small amount of hot state. The object gives that entity a local protocol.',
        'They also fit WebSocket fanout because connected clients can attach to the object that owns the room. A database can store messages, but it is not naturally the owner of live connection sets. The object can bridge committed storage and active clients.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the object key is too hot. A single global object for all users is just a hot row with a different name. Shard counters by bucket, split seat maps by section if the product allows it, or move the critical operation to a database designed for that write rate.',
        'It also fails when the workload needs broad ad hoc queries across all objects. Durable Objects are not a global analytical database or a general distributed SQL engine. Use them for per-entity coordination, then export or mirror facts to the system that owns broad querying.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A theater has 900 seats and expects 300 reservation attempts in the first minute after sales open. With a stateless design, many handlers race on the same rows and then repair rejected writes. With a Durable Object keyed by show:123, the 300 attempts enter one ordered protocol for that seat map.',
        'If each check-and-commit takes 4 ms of object CPU time, the object can process about 250 such transitions per second before queueing becomes visible. If demand is 5,000 attempts per second for one show, the key is too hot and the design must shard by section or add a queue. The cost tells the product where contention really lives.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Cloudflare Durable Objects concepts, rules of Durable Objects, storage access guidance, and SQLite storage API documentation. These pages define object identity, private storage, lifecycle, and current storage behavior.',
        'Study next by role. Read actor systems for the programming model, distributed locks for the alternative, idempotency keys for retry safety, transactional outbox for cross-system handoff, and sharding for key design under hot-spot pressure.',
      ],
    },
  ],
};
