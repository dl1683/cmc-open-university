// Redis sorted sets: one logical data type backed by two access paths.
// A dict gives member lookup; a skip list gives ordered score/rank queries.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'redis-zset-dict-skiplist-case-study',
  title: 'Redis Sorted Set Dict & Skiplist Case Study',
  category: 'Data Structures',
  summary: 'A production dual-index case study: Redis sorted sets combine member lookup, score order, rank spans, listpack encoding, and leaderboard/rate-limiter patterns.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['dual index internals', 'leaderboard windows'], defaultValue: 'dual index internals' },
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

function zsetGraph(title) {
  return graphState({
    nodes: [
      { id: 'cmd', label: 'cmd', x: 0.7, y: 4.0, note: 'ZADD' },
      { id: 'key', label: 'zset', x: 2.2, y: 4.0, note: 'players' },
      { id: 'dict', label: 'dict', x: 4.0, y: 2.6, note: 'member' },
      { id: 'skip', label: 'zsl', x: 4.0, y: 5.4, note: 'score' },
      { id: 'rank', label: 'rank', x: 6.0, y: 5.4, note: 'spans' },
      { id: 'range', label: 'range', x: 8.0, y: 5.4, note: 'ZRANGE' },
      { id: 'lookup', label: 'score', x: 8.0, y: 2.6, note: 'ZSCORE' },
    ],
    edges: [
      { id: 'e-cmd-key', from: 'cmd', to: 'key' },
      { id: 'e-key-dict', from: 'key', to: 'dict' },
      { id: 'e-key-skip', from: 'key', to: 'skip' },
      { id: 'e-dict-lookup', from: 'dict', to: 'lookup' },
      { id: 'e-skip-rank', from: 'skip', to: 'rank' },
      { id: 'e-rank-range', from: 'rank', to: 'range' },
    ],
  }, { title });
}

function skipTower(title) {
  return graphState({
    nodes: [
      { id: 'h2', label: 'H', x: 0.7, y: 1.4, note: 'L2' },
      { id: 'd2', label: 'dev', x: 4.7, y: 1.4, note: '410' },
      { id: 'h1', label: 'H', x: 0.7, y: 3.5, note: 'L1' },
      { id: 'cy1', label: 'cy', x: 2.7, y: 3.5, note: '380' },
      { id: 'd1', label: 'dev', x: 4.7, y: 3.5, note: '410' },
      { id: 'h0', label: 'H', x: 0.7, y: 5.8, note: 'L0' },
      { id: 'ada', label: 'ada', x: 1.7, y: 5.8, note: '340' },
      { id: 'cy0', label: 'cy', x: 2.7, y: 5.8, note: '380' },
      { id: 'bob', label: 'bob', x: 3.7, y: 5.8, note: '390' },
      { id: 'd0', label: 'dev', x: 4.7, y: 5.8, note: '410' },
      { id: 'eve', label: 'eve', x: 5.7, y: 5.8, note: '450' },
    ],
    edges: [
      { id: 'e-h2-d2', from: 'h2', to: 'd2', weight: '4' },
      { id: 'e-h1-cy1', from: 'h1', to: 'cy1', weight: '2' },
      { id: 'e-cy1-d1', from: 'cy1', to: 'd1', weight: '2' },
      { id: 'e-h0-ada', from: 'h0', to: 'ada', weight: '1' },
      { id: 'e-ada-cy0', from: 'ada', to: 'cy0', weight: '1' },
      { id: 'e-cy0-bob', from: 'cy0', to: 'bob', weight: '1' },
      { id: 'e-bob-d0', from: 'bob', to: 'd0', weight: '1' },
      { id: 'e-d0-eve', from: 'd0', to: 'eve', weight: '1' },
      { id: 'd-d2-d1', from: 'd2', to: 'd1' },
      { id: 'd-d1-d0', from: 'd1', to: 'd0' },
      { id: 'd-cy1-cy0', from: 'cy1', to: 'cy0' },
      { id: 'd-h2-h1', from: 'h2', to: 'h1' },
      { id: 'd-h1-h0', from: 'h1', to: 'h0' },
    ],
  }, { title });
}

function* dualIndexInternals() {
  yield {
    state: zsetGraph('A sorted set keeps two access paths'),
    highlight: { active: ['dict', 'skip', 'e-key-dict', 'e-key-skip'], found: ['lookup', 'range'] },
    explanation: 'A Redis sorted set is not only a skip list. In the large encoding, it stores a dictionary from member to score for direct lookup and a skip list ordered by score plus member for rank and range operations.',
    invariant: 'One logical update must keep both indexes consistent.',
  };

  yield {
    state: labelMatrix(
      'Member index',
      [
        { id: 'ada', label: 'ada' },
        { id: 'cy', label: 'cy' },
        { id: 'bob', label: 'bob' },
        { id: 'dev', label: 'dev' },
        { id: 'eve', label: 'eve' },
      ],
      [
        { id: 'score', label: 'score' },
        { id: 'node', label: 'node' },
      ],
      [
        ['340', 'n1'],
        ['380', 'n2'],
        ['390', 'n3'],
        ['410', 'n4'],
        ['450', 'n5'],
      ],
    ),
    highlight: { active: ['bob:score'], found: ['bob:node'] },
    explanation: 'The dictionary side answers member-oriented questions: does this member exist, what is its score, and which skip-list node needs to move if the score changes.',
  };

  yield {
    state: skipTower('Skip-list spans make rank cheap'),
    highlight: { active: ['h2', 'd2', 'e-h2-d2'], found: ['d0'], compare: ['bob'] },
    explanation: 'The skip list keeps score order. Redis skip-list levels also store spans: how many bottom-level nodes a forward pointer skips. Those spans let rank queries count positions while walking the tower.',
  };

  yield {
    state: labelMatrix(
      'ZADD score update',
      [
        { id: 'hit', label: 'lookup' },
        { id: 'same', label: 'same' },
        { id: 'move', label: 'move' },
        { id: 'new', label: 'new' },
      ],
      [
        { id: 'dict', label: 'dict' },
        { id: 'zsl', label: 'zsl' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['find', 'node', 'O(1)'],
        ['score', 'touch', 'cheap'],
        ['set', 'relink', 'logN'],
        ['insert', 'tower', 'logN'],
      ],
    ),
    highlight: { active: ['hit:dict', 'move:zsl'], found: ['new:cost'] },
    explanation: 'A score update is a dual-index transaction inside Redis. Find the member through the dictionary, then either update in place when ordering is safe or delete and reinsert the skip-list node.',
  };

  yield {
    state: labelMatrix(
      'Encoding choice',
      [
        { id: 'small', label: 'small' },
        { id: 'large', label: 'large' },
        { id: 'lookup', label: 'lookup' },
        { id: 'range', label: 'range' },
      ],
      [
        { id: 'repr', label: 'repr' },
        { id: 'fit', label: 'fit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['listpack', 'tiny', 'scan'],
        ['dict+zsl', 'fast', 'memory'],
        ['dict', 'O(1)', 'hash'],
        ['zsl', 'ordered', 'hot key'],
      ],
    ),
    highlight: { found: ['small:repr', 'large:repr'], active: ['lookup:fit', 'range:fit'] },
    explanation: 'Redis uses compact listpack encoding for small sorted sets and upgrades to the dictionary plus skip-list representation as the set grows or entries exceed compact thresholds.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'result M', min: 0, max: 1000 }, y: { label: 'work', min: 0, max: 1000 } },
      series: [
        { id: 'seek', label: 'seek', points: [{ x: 1, y: 20 }, { x: 100, y: 25 }, { x: 500, y: 30 }, { x: 1000, y: 35 }] },
        { id: 'emit', label: 'emit', points: [{ x: 1, y: 1 }, { x: 100, y: 100 }, { x: 500, y: 500 }, { x: 1000, y: 1000 }] },
      ],
      markers: [{ id: 'wide', x: 800, y: 800, label: 'wide' }],
    }),
    highlight: { active: ['seek', 'emit'], compare: ['wide'] },
    explanation: 'Range commands have two costs: seek into the ordered structure, then emit M results. A perfect index still cannot make returning 100,000 leaderboard rows cheap.',
  };
}

function* leaderboardWindows() {
  yield {
    state: labelMatrix(
      'Leaderboard',
      [
        { id: 'r1', label: '#1' },
        { id: 'r2', label: '#2' },
        { id: 'r3', label: '#3' },
        { id: 'r4', label: '#4' },
        { id: 'r5', label: '#5' },
      ],
      [
        { id: 'member', label: 'member' },
        { id: 'score', label: 'score' },
      ],
      [
        ['eve', '450'],
        ['dev', '410'],
        ['bob', '390'],
        ['cy', '380'],
        ['ada', '340'],
      ],
    ),
    highlight: { found: ['r1:member', 'r2:member', 'r3:member'], active: ['r3:score'] },
    explanation: 'Leaderboards are the obvious sorted-set use case: update one member score, ask for top N, ask for a member rank, or scan a score window.',
    invariant: 'Scores order first; member bytes break ties deterministically.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'cmd', label: 'cmd', x: 0.8, y: 4.0, note: 'TOP3' },
        { id: 'tail', label: 'tail', x: 2.6, y: 4.0, note: 'max' },
        { id: 'eve', label: 'eve', x: 4.2, y: 2.8, note: '450' },
        { id: 'dev', label: 'dev', x: 5.7, y: 4.0, note: '410' },
        { id: 'bob', label: 'bob', x: 7.2, y: 5.2, note: '390' },
        { id: 'out', label: 'out', x: 8.8, y: 4.0, note: '3 rows' },
      ],
      edges: [
        { id: 'e-cmd-tail', from: 'cmd', to: 'tail' },
        { id: 'e-tail-eve', from: 'tail', to: 'eve' },
        { id: 'e-eve-dev', from: 'eve', to: 'dev' },
        { id: 'e-dev-bob', from: 'dev', to: 'bob' },
        { id: 'e-bob-out', from: 'bob', to: 'out' },
      ],
    }, { title: 'Top-N is seek then walk' }),
    highlight: { active: ['tail', 'eve', 'dev', 'bob'], found: ['out'] },
    explanation: 'A top-N read is not a full sort. The ordered structure already has the rank order; the command seeks to one end and walks the requested number of nodes.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'req', label: 'req', x: 0.8, y: 4.0, note: 'now' },
        { id: 'add', label: 'ZADD', x: 2.3, y: 4.0, note: 'ts' },
        { id: 'trim', label: 'trim', x: 3.9, y: 2.7, note: 'old' },
        { id: 'count', label: 'count', x: 3.9, y: 5.3, note: 'ZCARD' },
        { id: 'allow', label: 'allow?', x: 5.8, y: 4.0, note: '< limit' },
        { id: 'ttl', label: 'expire', x: 7.7, y: 4.0, note: 'idle' },
      ],
      edges: [
        { id: 'e-req-add', from: 'req', to: 'add' },
        { id: 'e-add-trim', from: 'add', to: 'trim' },
        { id: 'e-add-count', from: 'add', to: 'count' },
        { id: 'e-trim-allow', from: 'trim', to: 'allow' },
        { id: 'e-count-allow', from: 'count', to: 'allow' },
        { id: 'e-allow-ttl', from: 'allow', to: 'ttl' },
      ],
    }, { title: 'Sliding-window limiter with timestamps' }),
    highlight: { active: ['add', 'trim', 'count'], found: ['allow'], compare: ['ttl'] },
    explanation: 'A sorted set can implement a sliding-window limiter: add the current request timestamp, remove scores older than the window, count the remaining entries, and reject if the count exceeds the budget.',
  };

  yield {
    state: labelMatrix(
      'Command roles',
      [
        { id: 'zadd', label: 'ZADD' },
        { id: 'range', label: 'ZRANGE' },
        { id: 'rank', label: 'ZRANK' },
        { id: 'count', label: 'ZCOUNT' },
        { id: 'rem', label: 'ZREM' },
      ],
      [
        { id: 'path', label: 'path' },
        { id: 'shape', label: 'shape' },
      ],
      [
        ['dict+zsl', 'write'],
        ['zsl', 'ranked'],
        ['spans', 'position'],
        ['zsl', 'window'],
        ['dict+zsl', 'delete'],
      ],
    ),
    highlight: { active: ['zadd:path', 'rank:path'], found: ['range:shape', 'count:shape'] },
    explanation: 'The command table is the data-structure map. Member operations hit the dictionary; ordered operations ride the skip list; rank operations rely on spans.',
  };

  yield {
    state: labelMatrix(
      'Production traps',
      [
        { id: 'wide', label: 'wide' },
        { id: 'hot', label: 'hot' },
        { id: 'ties', label: 'ties' },
        { id: 'mem', label: 'mem' },
        { id: 'atomic', label: 'atom' },
      ],
      [
        { id: 'trap', label: 'trap' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['hugeM', 'page'],
        ['key', 'shard'],
        ['equal', 'tie'],
        ['many', 'trim'],
        ['multi', 'Lua'],
      ],
    ),
    highlight: { active: ['wide:fix', 'hot:fix', 'atomic:fix'], compare: ['mem:trap'] },
    explanation: 'Sorted sets are powerful, but the mistakes are predictable: returning too many rows, creating one global hot key, forgetting tie behavior, letting stale entries grow, or splitting one logical update across non-atomic commands.',
  };

  yield {
    state: labelMatrix(
      'Choose structure',
      [
        { id: 'zset', label: 'ZSET' },
        { id: 'sql', label: 'SQL idx' },
        { id: 'heap', label: 'heap' },
        { id: 'stream', label: 'stream' },
        { id: 'cache', label: 'cache' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['live ranks', 'hot key'],
        ['durable', 'latency'],
        ['top only', 'lookup'],
        ['events', 'rank'],
        ['fast read', 'stale'],
      ],
    ),
    highlight: { found: ['zset:fit'], active: ['sql:fit', 'stream:fit'], compare: ['zset:watch'] },
    explanation: 'The complete case study ends with fit. Redis sorted sets are excellent for live ranking and score windows, but they are not durable SQL indexes, event logs, or free global leaderboards without sharding and retention policy.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'dual index internals') yield* dualIndexInternals();
  else if (view === 'leaderboard windows') yield* leaderboardWindows();
  else throw new InputError('Pick a Redis sorted-set view.');
}


export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The dual-index view shows one logical sorted set backed by two access paths. Active means a command is touching either the dictionary or skip list, visited means an index entry has already been checked or updated, and found means both structures agree on the member and score.',
        'The tower view shows the skip list as ordered shortcuts over a full bottom-level list. The safe inference is that a higher-level pointer skips a known count of bottom-level nodes, so rank work can accumulate spans instead of counting one node at a time.',
        {type:'callout', text:'A Redis sorted set is one abstraction backed by two synchronized access paths: a dictionary for identity and a skip list for order.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/8/86/Skip_list.svg', alt:'Skip list diagram with linked nodes at multiple levels.', caption:'Sample skip list with four levels; Wojciech Mula, public domain, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A Redis sorted set stores unique members ordered by numeric scores. Real features need both direct member lookup and ordered score traversal.',
        'A leaderboard updates one player by member and then reads the top range by score. A rate limiter adds a request by ID, trims old timestamps by score, and counts the remaining window.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious first structure is a hash table from member to score. ZSCORE and membership checks are expected O(1), and updating a known member is straightforward.',
        'The other obvious structure is an ordered tree or skip list by score. Score ranges and top-N reads become natural, and the structure can walk neighbors without sorting the whole set.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The hash table has no order. Reading the top 100 from one million members requires scanning the full table or maintaining a second structure.',
        'The ordered structure has weak identity lookup. Scores are not unique, so updating bob requires finding the old member-score pair, removing it from order, and reinserting it if the score changed.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Redis uses one abstraction with two synchronized internal indexes. The dictionary answers member questions, and the skip list answers order, range, and rank questions.',
        'The invariant is agreement. Every member in the dictionary must have exactly the same score as the corresponding ordered node, and every ordered node must represent a live dictionary member.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'ZADD first checks the dictionary. If the member is new, Redis stores the score under the member and inserts a skip-list node ordered by score and then member bytes.',
        'If the member exists and the score changes, Redis removes the old ordered node and inserts a new one at the correct position. The command is one logical mutation even though two structures are touched.',
        'Range commands use the ordered side. Score ranges seek into the skip list and walk bottom-level links, while rank ranges use spans to skip over counted groups of nodes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The dictionary solves identity because it maps a member to its current score. The skip list solves order because it maintains a total order over score and member bytes.',
        'Spans make rank efficient. When traversal follows a forward pointer, the stored span tells how many bottom-level nodes were crossed, so the algorithm can accumulate position without walking every skipped member.',
        'Correctness depends on atomic update order inside Redis command execution. A client never observes the dictionary after update while the skip list still contains the old node.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The mental model is O(log n) to seek or update the ordered structure, expected O(1) for dictionary lookup, and O(m) to return m results. The output term matters because sending 50,000 members is real work.',
        'Memory is the tax. Each member carries string storage, score storage, dictionary overhead, skip-list node fields, forward pointers, backward pointers, and spans.',
        'For one million members, a top-100 query still walks and returns 100 members after the logarithmic seek. A top-100,000 query is dominated by walking and serializing 100,000 results, not by finding the first node.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Sorted sets fit leaderboards where the product needs update-by-player and read-by-rank. They also fit exact sliding-window rate limits where timestamps are scores and request IDs are members.',
        'They are useful for modest due-time schedulers. Store job IDs as members, due timestamps as scores, read the lowest ready scores, and remove claimed jobs with a server-side atomic step.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A sorted set is not an append-only event history. Redis Streams or a log system is better when every event must be consumed, acknowledged, replayed, and retained.',
        'It also fails as an unbounded global hot key. One worldwide leaderboard or limiter can concentrate CPU, memory, and network output on a single Redis key.',
        'Atomicity is another trap. A sliding-window limiter built from separate trim, add, count, and decide commands can race unless it runs as Lua, a transaction with care, or another single server-side operation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A rate limiter allows 100 requests per user per 60 seconds. For user 7, each request adds member req-123 with score 1,719,000,000.250, then removes scores below 1,718,999,940.250.',
        'If 89 members remain after trim, the request is allowed and the set now has 90 members. If 100 members remain before adding, the request is rejected or the new member is removed, depending on the exact policy.',
        'The score-range trim finds the oldest timestamp boundary in O(log n), then removes k expired entries. If 40 old entries expired at once, the operation cost includes those 40 removals.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Redis sorted sets at https://redis.io/docs/latest/develop/data-types/sorted-sets/, ZADD at https://redis.io/docs/latest/commands/zadd/, ZRANGE at https://redis.io/docs/latest/commands/zrange/, Redis memory optimization at https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/memory-optimization/, and Redis source files server.h and t_zset.c. These define the API, complexity, compact encodings, and skip-list implementation.',
        'Study Skip List for tower search, Hash Table for member lookup, Rate Limiter for sliding windows, Redis Streams for replayable logs, Message Queues for delivery state, Database Indexing for ordered access paths, and LRU Cache for memory pressure.',
      ],
    },
  ],
};
