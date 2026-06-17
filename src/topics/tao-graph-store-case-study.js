// TAO case study: Facebook's read-optimized social graph store, framed as
// objects, associations, caches, follower refill, and geographically aware reads.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'tao-graph-store-case-study',
  title: 'TAO Graph Store Case Study',
  category: 'Papers',
  summary: 'Facebook TAO as the social-graph lesson: objects, associations, cache tiers, follower reads, and read-heavy graph APIs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['objects and associations', 'cache refill path'], defaultValue: 'objects and associations' },
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

function taoGraph(title) {
  return graphState({
    nodes: [
      { id: 'user', label: 'user:17', x: 1.0, y: 4.0, note: 'object' },
      { id: 'photo', label: 'photo:9', x: 3.2, y: 2.0, note: 'object' },
      { id: 'post', label: 'post:44', x: 3.2, y: 6.0, note: 'object' },
      { id: 'comment', label: 'comment:8', x: 5.4, y: 6.0, note: 'object' },
      { id: 'leader', label: 'leader cache', x: 6.4, y: 2.0, note: 'write region' },
      { id: 'follower', label: 'follower cache', x: 8.2, y: 4.0, note: 'near user' },
      { id: 'mysql', label: 'MySQL shard', x: 6.4, y: 7.0, note: 'source data' },
    ],
    edges: [
      { id: 'e-user-photo', from: 'user', to: 'photo', weight: 'uploaded' },
      { id: 'e-user-post', from: 'user', to: 'post', weight: 'authored' },
      { id: 'e-post-comment', from: 'post', to: 'comment', weight: 'has comment' },
      { id: 'e-leader-follower', from: 'leader', to: 'follower', weight: 'refill' },
      { id: 'e-leader-mysql', from: 'leader', to: 'mysql', weight: 'read/write' },
      { id: 'e-follower-user', from: 'follower', to: 'user', weight: 'serve read' },
    ],
  }, { title });
}

function* objectsAndAssociations() {
  yield {
    state: taoGraph('TAO exposes the social graph as objects and associations'),
    highlight: { active: ['user', 'photo', 'post'], found: ['e-user-photo', 'e-user-post'] },
    explanation: 'TAO models Facebook data as objects and typed associations between objects. The API matches the product shape: fetch nearby graph edges quickly, then apply ranking and privacy logic above.',
  };

  yield {
    state: labelMatrix(
      'Two primitive shapes',
      [
        { id: 'object', label: 'object' },
        { id: 'assoc', label: 'association' },
        { id: 'assoc_list', label: 'association list' },
        { id: 'count', label: 'count' },
      ],
      [
        { id: 'example', label: 'example' },
        { id: 'access', label: 'access pattern' },
      ],
      [
        ['photo, user, post', 'lookup by id'],
        ['user likes photo', 'edge lookup'],
        ['comments on post', 'range by time'],
        ['like count', 'cheap aggregate'],
      ],
    ),
    highlight: { found: ['assoc:example', 'assoc_list:access'], active: ['object:access'] },
    explanation: 'The paper is valuable because it starts with a narrow data model. TAO is not a general graph database. It is a read-optimized service for the graph operations Facebook needed constantly.',
    invariant: 'A simpler API lets the storage system optimize the hot path aggressively.',
  };

  yield {
    state: taoGraph('Application reads pull graph neighborhoods on demand'),
    highlight: { active: ['follower', 'user', 'post', 'comment', 'e-follower-user'], compare: ['mysql'] },
    explanation: 'Facebook pages assemble many personalized fragments at read time. TAO supports pulling graph neighborhoods quickly instead of precomputing every possible personalized page.',
  };

  yield {
    state: labelMatrix(
      'Why this is not just a key-value cache',
      [
        { id: 'kv', label: 'key-value cache' },
        { id: 'tao', label: 'TAO' },
        { id: 'sql', label: 'SQL database' },
        { id: 'search', label: 'search index' },
      ],
      [
        { id: 'unit', label: 'data unit' },
        { id: 'query', label: 'native query' },
      ],
      [
        ['blob', 'get key'],
        ['object + edge', 'neighbors and lists'],
        ['tables/rows', 'relational query'],
        ['documents/terms', 'ranked retrieval'],
      ],
    ),
    highlight: { found: ['tao:unit', 'tao:query'], compare: ['kv:query', 'sql:query'] },
    explanation: 'TAO sits between caches, databases, and graph APIs. It narrows the contract until the cache tier, invalidation, and refill behavior can be specialized.',
  };
}

function* cacheRefillPath() {
  yield {
    state: taoGraph('Follower caches serve local reads; leaders coordinate refill'),
    highlight: { active: ['follower', 'leader', 'e-leader-follower'], found: ['e-follower-user'] },
    explanation: 'TAO uses geographically distributed cache tiers. Followers serve reads near users; leaders coordinate cache miss refill and writes for a shard.',
  };

  yield {
    state: labelMatrix(
      'Read miss path',
      [
        { id: 'follower_hit', label: 'follower hit' },
        { id: 'follower_miss', label: 'follower miss' },
        { id: 'leader_hit', label: 'leader hit' },
        { id: 'leader_miss', label: 'leader miss' },
      ],
      [
        { id: 'answer', label: 'answer path' },
        { id: 'latency', label: 'latency pressure' },
      ],
      [
        ['serve locally', 'low'],
        ['ask leader', 'cross-region maybe'],
        ['refill follower', 'medium'],
        ['read MySQL', 'highest'],
      ],
    ),
    highlight: { found: ['follower_hit:answer'], active: ['leader_hit:answer'], compare: ['leader_miss:latency'] },
    explanation: 'The hot path is a local cache hit. The architecture exists to make misses recoverable without forcing every read back to the database.',
  };

  yield {
    state: labelMatrix(
      'Consistency tradeoffs',
      [
        { id: 'read', label: 'read-heavy graph' },
        { id: 'write', label: 'writes' },
        { id: 'replication', label: 'geo replication' },
        { id: 'privacy', label: 'privacy checks' },
      ],
      [
        { id: 'choice', label: 'TAO choice' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['optimize cache hits', 'latency dominates'],
        ['route through leader', 'control invalidation'],
        ['followers may lag', 'freshness is a product tradeoff'],
        ['checked above TAO', 'storage is not authorization'],
      ],
    ),
    highlight: { active: ['read:choice', 'write:choice'], compare: ['replication:lesson', 'privacy:lesson'] },
    explanation: 'TAO does not solve every application concern inside the storage layer. It gives a fast graph substrate; product services still own privacy, ranking, and freshness policy.',
  };

  yield {
    state: labelMatrix(
      'What to copy from TAO',
      [
        { id: 'model', label: 'model the workload' },
        { id: 'api', label: 'constrain the API' },
        { id: 'cache', label: 'make cache explicit' },
        { id: 'geo', label: 'design for geography' },
      ],
      [
        { id: 'principle', label: 'principle' },
        { id: 'neighbor', label: 'study link' },
      ],
      [
        ['objects and associations', 'Graph BFS'],
        ['few hot graph operations', 'Database Indexing'],
        ['hit/miss/refill contract', 'Cache Invalidation'],
        ['local reads, leader refill', 'Dynamo Case Study'],
      ],
    ),
    highlight: { found: ['model:principle', 'api:principle', 'cache:principle'], active: ['geo:neighbor'] },
    explanation: 'The reusable lesson is not "build Facebook TAO." It is: a production data store gets much simpler when its API matches the real workload tightly.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'objects and associations') yield* objectsAndAssociations();
  else if (view === 'cache refill path') yield* cacheRefillPath();
  else throw new InputError('Pick a TAO view.');
}

export const article = {
  sections: [
    {
      heading: 'What TAO was built to solve',
      paragraphs: [
        'TAO is Facebook\'s published distributed data store for the social graph. The 2013 USENIX paper describes a system built for a workload with enormous read volume, graph-shaped data, geographic distribution, and a fixed set of product-facing queries.',
        'The problem was not "store a graph" in the abstract. Product code needed fast access to nearby graph facts: this user authored this post, this post has these comments, this photo has these likes, this page has these followers. Those reads had to be low-latency and predictable at Facebook scale.',
        'TAO matters because it shows a production system shaped around a narrow data model. It is not general SQL, not a full graph query language, and not just a cache. It is a storage service whose API matches the hot read paths.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A reasonable first design is MySQL plus memcache. Store normalized records in MySQL, cache hot objects and edge lists in memcache, and let product services assemble pages from those pieces.',
        'That design works for a while. It uses mature storage, keeps reads fast when the cache hits, and gives engineers flexible tables for evolving products.',
        'Another tempting design is a general graph database. That sounds natural because the product data is a graph. The problem is that Facebook did not need arbitrary graph algorithms on every request. It needed a small set of extremely hot object and association operations.',
      ],
    },
    {
      heading: 'Where the naive approach breaks',
      paragraphs: [
        'Client-managed memcache makes product engineers understand too much of the storage internals. The Meta engineering write-up calls out bugs, user-visible inconsistencies, performance issues, schema coordination, inefficient list transfers, hard cache consistency, and thundering-herd pressure.',
        'Edge lists are the killer case. A small update to one association list can invalidate a whole cached list. A request might need only the first few comments or likes, but a simple cache blob can force the full list across the network.',
        'A general graph database is too broad for this hot path. TAO wins by constraining the API until caching, refill, sharding, and invalidation become tractable engineering problems.',
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        'Represent the social graph as objects and associations, then make that model the storage API. Objects are typed nodes with fields. Associations are typed directed edges between objects. Association lists group edges by origin, type, and ordering such as time.',
        'Put a distributed cache service in front of sharded MySQL, but make the cache aware of object and association semantics. Follower caches serve reads near users. Leader caches coordinate writes, cache refill, and consistency work for a shard.',
        'The reusable idea is specialization. A narrow API is not a limitation if it matches the dominant workload. It gives the system fewer operations to optimize and fewer consistency cases to reason about.',
      ],
    },
    {
      heading: 'How the data model works',
      paragraphs: [
        'An object might be user:17, photo:9, post:44, or comment:8. The object has typed fields. An association might say user:17 uploaded photo:9, user:17 authored post:44, or post:44 has comment:8.',
        'The important operation is often not a global traversal. It is a bounded neighborhood read: fetch an object by ID, fetch an association by ID pair and type, fetch a time-ordered association list, or fetch a count.',
        'That is why TAO sits between a key-value cache and a graph database. A key-value cache knows blobs. A graph database may expose broad query shapes. TAO exposes the graph operations that the product path needed constantly.',
      ],
    },
    {
      heading: 'How reads and writes move',
      paragraphs: [
        'A read first goes to a nearby follower cache. A follower hit is the cheap path: local cache state answers the request without touching the leader or MySQL.',
        'On a follower miss, the follower asks the leader for the shard. A leader hit refills the follower. A leader miss goes to the underlying MySQL shard, then fills the cache hierarchy. The whole design tries to make the miss path recoverable without making every read a database read.',
        'Writes are coordinated through the leader side so the system has a controlled point for updating persistent storage and invalidating or refilling cached graph facts. That control plane is what plain client-side memcache lacked.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A user opens a post page. The application needs the post object, the author object, the first page of comments, maybe a like count, and several viewer-specific facts. TAO is built for these small graph slices.',
        'If the nearby follower cache has the post and comment association list, the page assembly path is fast. If the comment list is missing, the follower asks the leader. If the leader has it, the follower is refilled. If not, the leader reads the MySQL shard and then fills the cache path.',
        'Now a new comment is added. The write must update the persistent association and make cached association lists stop lying. The hard part is not adding one edge. The hard part is keeping many read-optimized cached views useful without serving obviously wrong graph neighborhoods.',
      ],
    },
    {
      heading: 'How to read the visualization',
      paragraphs: [
        'In the objects-and-associations view, treat the left side as the product graph and the right side as the serving path. The user, photo, post, and comment nodes are not random examples; they show the narrow data model TAO exposes.',
        'The association edges are the API surface. When uploaded, authored, or has comment is highlighted, the important fact is that product reads can ask for typed edges and ordered edge lists instead of fetching generic cache blobs.',
        'In the cache-refill view, the follower cache is the low-latency read point. The leader cache is the coordination point. The MySQL shard is durable storage. Each transition from follower to leader to MySQL is a latency and load escalation.',
        'Read the consistency matrix as a set of boundaries. TAO gives fast graph storage and controlled cache behavior. Ranking, privacy, and product policy still live above it.',
      ],
    },
    {
      heading: 'Why the design works',
      paragraphs: [
        'TAO works because the API and workload agree. The system does not need to optimize arbitrary joins or arbitrary graph traversals. It can optimize a fixed set of object, association, association-list, and count operations.',
        'The cache hierarchy works because refill has structure. A follower miss does not become a stampede of application servers all computing their own database path. The follower asks a leader that can coordinate refill and enforce the service contract.',
        'The sharding model works because objects and associations can be assigned to shards, and the service can use collocation to reduce communication for common graph neighborhoods. Hot objects still remain a problem, but the model gives operators a place to manage them.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'TAO trades generality for speed and operational control. The cost is a custom distributed service with cache consistency, leader routing, follower lag, shard placement, hot-object handling, geographic replication, and failure recovery.',
        'The read path is fast when the follower cache hits. The miss path is more expensive: follower to leader, maybe leader to MySQL, then refill. As the working set grows or locality worsens, the system pays more cross-cluster and database pressure.',
        'The API cost is also real. If a product needs arbitrary graph search, complex joins, graph algorithms, or transaction shapes outside TAO primitives, forcing that workload into TAO can create brittle application logic.',
      ],
    },
    {
      heading: 'Where the pattern wins',
      paragraphs: [
        'The TAO pattern wins when products need fast, repeated, bounded graph-neighborhood reads: social feeds, comments, likes, follows, pages, events, entity relationships, recommendation features, and permission-adjacent metadata.',
        'It also wins when the organization needs a safer abstraction than "every product engineer manually combines MySQL and memcache." The storage service can own cache refill and consistency mechanics while product code uses graph-shaped primitives.',
        'The broader systems lesson applies outside social networks: model the actual workload, constrain the API, make the cache hierarchy explicit, and put coordination where misses and writes can be controlled.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'TAO is not a universal graph engine. If the main workload is shortest paths, multi-hop traversal, ad hoc analytics, graph pattern matching, or full-text search, a different system should own that path.',
        'It is also not a replacement for authorization. Graph edges can feed policy decisions, but privacy checks and viewer-specific access rules live above the store. A fast edge lookup does not mean the viewer is allowed to see the target.',
        'Small systems should be careful copying TAO. A relational database plus ordinary caching may be simpler, cheaper, and more reliable until the workload proves that a specialized graph store is worth operating.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Cache invalidation is the central failure mode. A stale association list can make a user see missing comments, old counts, or relationships that have changed. Over-invalidating fixes correctness at the cost of hit rate.',
        'Hot objects and celebrity nodes can concentrate load on a small set of shards or cache entries. Geographic followers reduce read latency, but they introduce lag and refill paths that product teams must understand.',
        'API mismatch is the quiet failure. Once a product starts needing operations outside the narrow object-association model, it may build expensive client-side workarounds that erase the benefits of the specialized service.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the USENIX ATC 2013 paper page at https://www.usenix.org/conference/atc13/technical-sessions/presentation/bronson; the paper PDF at https://www.usenix.org/system/files/conference/atc13/atc13-bronson.pdf; and Meta Engineering, TAO: The power of the graph, at https://engineering.fb.com/2013/06/25/core-infra/tao-the-power-of-the-graph/.',
        'Study Graph BFS for graph-neighborhood basics, Cache Invalidation & Versioning for the hard cache problem, Sharding & Partitioning for placement, Database Indexing for ordered access paths, Dynamo Case Study for distributed key-value tradeoffs, and Zanzibar Authorization Case Study for the separate problem of permission checks over relationships.',
      ],
    },
  ],
};
