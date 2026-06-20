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
      heading: 'Why this exists',
      paragraphs: [
        `Serverless platforms are excellent at running stateless request handlers, but many useful applications need a small piece of state that must be updated in one place. A chat room needs one current member list. A multiplayer match needs one turn order. A rate limiter needs one counter for a key. A seat map needs one truth about which seats are already reserved. If every request handler is stateless, the usual answer is to push all coordination into a database, cache, or lock service.`,
        `That answer works, but it creates friction for small, hot coordination problems. Stateless functions may race on the same database row. A distributed lock adds failure modes and timeout reasoning. A globally replicated database may be too broad when the real transaction boundary is one room, one account, one document, or one game. Cloudflare Durable Objects are a different cut: make one globally addressable object own one state island, route requests for that object to it, and attach private durable storage to the same abstraction.`,
        `The important idea is not "serverless with a variable." It is a named serialization boundary. Instead of hoping many workers update one logical entity correctly through external coordination, the platform gives that entity a single durable actor-like home. The design moves the hard question from "how do all handlers coordinate?" to "what should the object key be?"`,
        {type:'callout', text:'Durable Objects make one named entity the serialization boundary so coordination, memory, and durable state live behind the same key.'},
      ],
    },
    {
      heading: 'The naive approach and its wall',
      paragraphs: [
        `Imagine implementing a ticket reservation system with ordinary stateless Workers and one shared database table. Two buyers request the same seat at nearly the same time. Each handler reads the row, sees the seat as open, and tries to write a reservation. You can fix this with database transactions, uniqueness constraints, retries, and idempotency keys. That is a valid design. But as the workflow grows to include WebSocket notifications, hold expiration, payment state, and live seat-map updates, the logic becomes spread across stateless handlers and database invariants.`,
        `The next naive answer is a distributed lock per seat map. That introduces a different problem: the application now has to reason about lock ownership, lease expiry, slow handlers, retries after partial work, and what happens when the lock service is available but the database write fails. The lock protects a critical section, but it does not give the application a natural place for hot in-memory state, connected clients, timers, or local recovery logic.`,
        `Durable Objects collapse those pieces for workloads whose natural boundary is a single named entity. All requests for ` + "`show:123`" + ` can go to the same object. That object can hold the active seat map in memory, persist committed reservations in storage, schedule or process alarms, and notify connected clients. You still need careful application logic, but the coordination surface is smaller and easier to inspect.`,
      ],
    },
    {
      heading: 'Core insight and mechanism',
      paragraphs: [
        `A Durable Object class is bound in a Worker. The Worker derives an object ID, often from a user-facing name such as a room ID or document ID, obtains a stub from the namespace, and sends requests to that stub. Cloudflare routes those requests to the Durable Object instance responsible for that ID. The object has code, in-memory state while active, and attached storage that is private to that object.`,
        `The official model gives each object a globally unique identity and single-threaded execution in the Workers runtime. That does not mean every application-level race disappears. JavaScript still has asynchronous turns, and code that awaits I/O must be designed with the runtime's concurrency rules in mind. The deeper point is that requests for one object are no longer sprayed across unrelated stateless instances. The object is the owner of that key's state and protocol.`,
        `Modern Durable Objects can use SQLite-backed storage. Cloudflare documents this storage as transactional and strongly consistent, private to the unique object instance, with SQL and key-value style APIs depending on the storage backend. In-memory state is a cache and coordination workspace; durable storage is the restart boundary. If the object acknowledges an operation that must survive eviction, deployment, or migration, the important state must be committed to storage before the acknowledgement is meaningful.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The first view follows two clients through a Worker to a Durable Object ID. The Worker is not the owner of the room or counter; it is the routing front end. The ID is the address of the logical state island. Requests that name the same object are routed to the same object instance, where application code can update local memory and private storage under one per-object protocol.`,
        `The memory and storage nodes are intentionally separate. Memory is where a hot object keeps fast state: connected WebSockets, a counter cached from storage, a debounce timer, a pending queue, or the last computed room snapshot. Storage is where durable truth lives. A restart can erase memory. Correct code reconstructs important state from storage and treats memory as an optimization unless the state is explicitly ephemeral.`,
        `The second view is about recovery and design boundaries. A single object is strong when one key is the right serialization unit. Many objects scale by partitioning the problem across many names. Cross-object workflows are no longer inside one automatic transaction boundary. If a purchase touches a user object, a seat-map object, a payment object, and an audit object, the application needs an explicit protocol: idempotency, compensation, a durable event log, or a database layer whose transaction model matches the workflow.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The design works because it aligns logical contention with placement. If all updates to one game room conflict with one another, then sending them to one object is not a weakness; it is the simplest correct serialization strategy. The object can apply changes in order, reject invalid transitions, and publish one consistent stream of updates to clients. The state machine is local to the owner instead of reconstructed from scattered requests.`,
        `It also works because most applications have many independent coordination islands. One chat room may be busy, but most rooms are independent. One document has its own collaboration stream. One customer account has its own rate-limit bucket. By choosing object names carefully, the system can scale out across millions of objects while keeping each object's reasoning local. This is the same partitioning instinct behind sharding, actor systems, entity groups, and per-key stream processors.`,
        `The pattern is especially useful when low-latency coordination and live connections matter. A database can store the truth, but it is not naturally a WebSocket hub. A cache can hold hot values, but it is not usually the owner of a state-transition protocol. A Durable Object can be the meeting point: requests, connected clients, timers, memory, and durable storage all attach to the same named object.`,
      ],
    },
    {
      heading: 'Tradeoffs and failure modes',
      paragraphs: [
        `The first tradeoff is throughput per hot object. A single object is a serialization point. That is exactly why it prevents double booking inside one seat map, but it also means one extremely hot key can become the bottleneck. If the object key is "all users" or "global counter," the design has created a hot row in a different form. Good Durable Object design chooses keys that isolate contention: one room, one document, one match, one tenant shard, or one bucketed counter segment.`,
        `The second tradeoff is boundary discipline. Durable Objects are not a replacement for every database. They do not automatically provide ad hoc querying across all objects, global secondary indexes, analytical scans, or multi-object serializable transactions. If the product needs to ask "show me all unpaid invoices across every customer" or "atomically update these twenty accounts," a separate database, queue, or table format may be the correct system of record. Durable Objects can participate, but they should not be stretched into a global relational engine by accident.`,
        `The third tradeoff is operational reasoning. Placement is managed by the platform, and objects can be moved, evicted, or restarted. That is the point of using the service, but it means applications must handle reconstruction from storage, idempotent retries, duplicate client messages, and versioned protocol changes. A hot in-memory map that is not persisted is a cache. A response sent before durable commit is an application promise that may not survive failure.`,
      ],
    },
    {
      heading: 'Concrete examples',
      paragraphs: [
        `For a chat room, the object key is the room ID. The object tracks connected clients in memory and stores durable room metadata or recent message pointers. Incoming messages route to the room object, which orders them, applies moderation or membership checks, persists what must survive, and broadcasts to WebSocket clients. The database no longer has to be the only coordination point for live fanout.`,
        `For a seat map, the object key is the show ID. Every reservation attempt reaches the same object. It checks whether the requested seats are open, writes the reservation in a transaction, and only then confirms to the buyer. If the object restarts, it reloads committed reservations from storage. If demand is too high for one show object, that is a real product-level contention signal; the designer may shard by section, add a queue, or move the critical transaction into a database with the right capacity.`,
        `For a rate limiter, the key may be an account plus a time bucket. The object owns one counter window, applies increments, schedules expiration, and returns allow or deny. This avoids making every request handler race on the same external counter, while still allowing the keyspace to scale across many independent objects.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Cloudflare's Durable Objects overview at https://developers.cloudflare.com/durable-objects/, the "What are Durable Objects?" concept page at https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/, rules and design notes at https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/, storage access notes at https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/, and the SQLite storage API at https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/. Product behavior changes, so check the current docs before relying on limits or backend details.`,
        `Next, study Distributed Locks to understand the alternative coordination model, Hot Rows for the bottleneck Durable Objects often replace, Actor Model systems such as Orleans or Erlang for the broader programming pattern, SQLite B-Tree Pager for local transactional storage, Transactional Outbox for cross-system handoff, Idempotency Keys for retry safety, and Consistent Hashing or sharding topics for choosing object names that spread load without destroying the natural serialization boundary.`,
      ],
    },
  ],
};
