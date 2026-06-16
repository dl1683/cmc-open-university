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
      heading: 'What it is',
      paragraphs: [
        'TAO is Facebook/Meta\'s distributed data store for the social graph. It exposes objects and associations, then optimizes heavily for read-dominated graph access at very large scale.',
        'The case study matters because it shows a production system shaped by product semantics. The API is not general SQL and not arbitrary graph traversal; it is the narrow graph access pattern Facebook needed constantly.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Objects represent entities such as users, posts, comments, and photos. Associations represent typed edges, often queried as ordered lists. TAO layers cache tiers over sharded MySQL storage, with leader caches coordinating writes and refill while follower caches serve local reads.',
        'The design emphasizes low-latency reads, predictable APIs, cache refill, invalidation, and geographic locality. Application services still handle ranking, privacy checks, and product-specific policy.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'TAO trades generality for speed. It must manage cache consistency, read misses, follower lag, leader routing, hot objects, and operational complexity across regions. Its data model is powerful for social-graph neighborhoods but intentionally narrower than a general graph database.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The pattern appears anywhere products need fast graph-shaped reads: social feeds, comments, likes, follows, entity relationships, recommendation inputs, and permission-adjacent metadata. It connects graph data structures to sharding, cache invalidation, and read-path architecture.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not confuse TAO with a universal graph query engine. Its strength comes from constraining operations. Also, storage is not the same as authorization: graph edges may inform privacy, but policy decisions live above the store.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: USENIX paper PDF at https://www.usenix.org/system/files/conference/atc13/atc13-bronson.pdf, Meta Research page at https://research.facebook.com/publications/tao-facebooks-distributed-data-store-for-the-social-graph/, and Meta engineering post at https://engineering.fb.com/2013/06/25/core-infra/tao-the-power-of-the-graph/. Study Graph BFS, Cache Invalidation & Versioning, Sharding & Partitioning, Database Indexing, Dynamo Case Study, and Zanzibar Authorization Case Study next.',
      ],
    },
  ],
};
