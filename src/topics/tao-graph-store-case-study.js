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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the left side as product graph data and the right side as the serving path. Objects are typed nodes such as users, posts, photos, and comments, while associations are typed directed edges such as authored, uploaded, liked, or has comment.',
        'The safe inference rule is that TAO can optimize a narrow set of graph-neighborhood reads because the API exposes objects, associations, association lists, and counts directly. The cache nodes show where latency rises when a local follower miss escalates to a leader or MySQL shard.',
        {type:'callout', text:'TAO wins by narrowing the graph API until caching, refill, and consistency become workload-specific mechanisms.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/0/05/Sna_large.png', alt:'Social network graph with dense and sparse clusters of connected nodes.', caption:'Social network graph as a visual proxy for TAO object-association neighborhoods. Image: DarwinPeacock/GUESS, Wikimedia Commons, CC BY 3.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Facebook needed low-latency reads over a huge social graph. Product pages repeatedly needed nearby facts such as this user authored this post, this post has these comments, this photo has these likes, and this page has these followers.',
        'TAO exists because plain databases plus ad hoc caches made too much of that behavior live in product code. The system narrows the storage API so caching, refill, invalidation, and geographic reads can be engineered around the actual workload.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is MySQL plus memcache. Store normalized rows in MySQL, cache hot objects and lists, and let application services assemble graph neighborhoods on demand.',
        'Another obvious approach is a general graph database. That sounds natural because the data is a graph, and it promises more flexible traversals than hand-built storage paths.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Client-managed caching makes every product team reason about invalidation, list transfer, stale reads, thundering herds, and schema coordination. A small association update can invalidate a large cached list even when the next request needs only the first page.',
        'A general graph database is too broad for the hot path. Facebook mostly needed bounded object and association reads at extreme volume, not arbitrary graph algorithms on every user request.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make the dominant product access pattern the storage abstraction. TAO stores objects and associations, then exposes operations for object lookup, association lookup, ordered association-list reads, and counts.',
        'A narrow API is a performance tool. Once the service knows that a request is for a typed edge list or count, it can specialize cache keys, refill paths, shard placement, and consistency behavior around that shape.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An object might be user:17, post:44, photo:9, or comment:8. An association might say user:17 authored post:44 or post:44 has comment:8, and an association list groups edges by origin, type, and order such as time.',
        'Reads go first to a nearby follower cache. On a follower miss, the follower asks a leader cache for the shard; on a leader miss, the leader reads the MySQL shard and refills the cache path.',
        'Writes are coordinated through the leader side so persistent storage and cached graph facts can be updated or invalidated in a controlled order. Product ranking, privacy, and viewer policy remain above TAO rather than inside the storage primitive.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'TAO works because the workload and API match. The system does not need to plan arbitrary joins or graph traversals, so it can optimize the few operations the product performs constantly.',
        'The cache hierarchy works because misses have structure. A follower miss escalates to a leader that can coordinate refill instead of letting every application server stampede the database.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'TAO trades generality for a custom distributed service. The cost includes shard placement, follower lag, leader routing, cache invalidation, geographic replication, hot-object handling, failure recovery, and operational tooling.',
        'Cost behaves like a queue of escalations. A follower hit is cheap, a follower miss adds leader latency, a leader miss adds database work, and a hot object can concentrate load even when the average cache hit rate looks healthy.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The TAO pattern fits read-heavy relationship products: feeds, comments, likes, follows, pages, events, permission-adjacent metadata, recommendation features, and entity neighborhoods. The important access pattern is bounded graph-neighborhood lookup, not unbounded graph search.',
        'The broader systems use is organizational. A storage service can own cache refill and consistency mechanics while product services use graph-shaped primitives instead of hand-assembling MySQL and memcache behavior.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'TAO is the wrong tool for shortest paths, graph analytics, multi-hop pattern matching, full-text search, ad hoc SQL, or transactions outside its object-association model. Forcing those workloads into TAO creates brittle client-side workarounds.',
        'It is also not authorization. A fast edge lookup may help a policy engine, but it does not prove that the current viewer is allowed to see the target object.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a post page needs one post object, one author object, the first 25 comments, a like count, and two viewer-specific associations. If all six reads hit the follower cache, page assembly avoids leader and MySQL latency.',
        'If the comment association list misses locally, the follower asks the leader. If the leader also misses, the leader reads the MySQL shard and refills the path, so the same logical page now pays cross-cache and database cost; a new comment then has to update durable state and keep cached lists from serving stale neighborhoods.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the USENIX ATC 2013 TAO paper page at https://www.usenix.org/conference/atc13/technical-sessions/presentation/bronson, the PDF at https://www.usenix.org/system/files/conference/atc13/atc13-bronson.pdf, and Meta Engineering at https://engineering.fb.com/2013/06/25/core-infra/tao-the-power-of-the-graph/. Study graph BFS, cache invalidation, sharding, database indexing, Dynamo, memcache, and Zanzibar-style authorization next.',
      ],
    },
  ],
};
