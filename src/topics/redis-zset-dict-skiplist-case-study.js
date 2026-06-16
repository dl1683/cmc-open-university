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
      heading: 'What it is',
      paragraphs: [
        'A Redis sorted set stores unique members ordered by floating-point scores. The public API looks simple: add a member with a score, ask for a rank, ask for a score range, remove old entries. The interesting data-structure lesson is that one logical type needs more than one internal access path.',
        'For larger sorted sets, Redis uses a dictionary and a skip list together. The dictionary maps member to score for direct lookup. The skip list stores score/member order for ranges and ranks. Small sorted sets can use compact listpack encoding instead, because scanning a tiny packed representation can be cheaper than maintaining full pointer-heavy indexes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'ZADD first checks whether the member already exists. If it is new, Redis adds it to the dictionary and inserts it into the skip list with a random height. If it already exists and the score changes, Redis updates both representations. When the score movement changes order, the skip-list node must be removed and reinserted in the correct place.',
        'The skip-list side carries more than forward pointers. Redis skip-list levels include spans: counts of bottom-level nodes skipped by a forward pointer. Those spans let rank and range-by-rank commands compute positions while walking the tower instead of counting every bottom-level node.',
        'The representation choice matters. A compact listpack reduces memory overhead for small values and small sets. Once the set grows past configured thresholds, the full dictionary plus skip-list representation pays more memory to get fast member lookup and ordered operations.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The usual mental model is O(log n) for seek/update plus O(m) for returning m results. That second term dominates wide ranges: an index can seek quickly, but it still has to serialize every returned member. Dictionary lookup is expected O(1), while ordered/rank operations use the skip list.',
        'Operationally, the single key is often the bottleneck. A global leaderboard, global rate limiter, or trending feed can become one hot Redis key. Production systems shard by game, region, tenant, time bucket, or score band; trim stale entries; and use Lua or transactions when multiple sorted-set commands must form one atomic decision.',
      ],
    },
    {
      heading: 'Complete case studies',
      paragraphs: [
        'Leaderboard: a game stores player id as member and score as value. ZADD updates the score after a match. ZREVRANGE or ZRANGE with REV reads the top N. ZRANK or ZREVRANK reads a player position. This is the clean fit because the product shape is exactly ordered unique members with frequent rank reads.',
        'Sliding-window limiter: an API stores request ids or timestamps in a sorted set, using timestamp as score. On each request, remove scores older than the window, count remaining requests, add the new timestamp, and reject if the count is above the limit. This gives exact moving-window behavior, but it needs atomic execution and trimming or the set grows with traffic.',
        'Delayed work and time wheels are related but not identical. A sorted set can schedule jobs by due time, using ZPOPMIN or range queries for ready jobs. Redis Streams are better when every event needs replay, pending tracking, and consumer groups. A sorted set is better when ordering by score and finding/removing ready members is the primary operation.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not teach Redis sorted sets as just a skip list. The dictionary side is what makes member updates and score lookup practical. Do not teach them as a durable database index either: Redis persistence, replication, and failover settings define the failure model, and one hot key can still bottleneck a cluster.',
        'The common product mistakes are returning huge ranges, forgetting that equal scores are ordered by member bytes, using non-atomic multi-command limiter logic, and letting old entries accumulate forever. The correct question is not "is ZSET fast?" but "which access path does this command use, how large is m, and how hot is this key?"',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Redis sorted-set data type documentation at https://redis.io/docs/latest/develop/data-types/sorted-sets/, ZADD command docs at https://redis.io/docs/latest/commands/zadd/, ZRANGE command docs at https://redis.io/docs/latest/commands/zrange/, Redis memory optimization docs for compact encodings at https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/memory-optimization/, and Redis source files server.h and t_zset.c at https://github.com/redis/redis/blob/unstable/src/server.h and https://github.com/redis/redis/blob/unstable/src/t_zset.c.',
        'Study Skip List first for the tower search idea, then Hash Table for the member index. Link this topic to Rate Limiter, Sliding Window, Redis Streams, LRU Cache, Message Queues, and Database Indexing to see when Redis sorted sets are the right live-index tool and when another storage shape is better.',
      ],
    },
  ],
};
