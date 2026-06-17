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
      heading: 'Why this exists',
      paragraphs: [
        'A Redis sorted set stores unique members ordered by numeric scores. The public API looks simple: add a member with a score, fetch a member score, ask for a rank, scan a score window, remove old entries, or return the top N. The interesting lesson is that one logical data type has to serve two very different access patterns.',
        'A leaderboard needs ordered reads. A rate limiter needs timestamp windows. A scheduler may need the earliest due job. At the same time, updates usually arrive by member: this player scored again, this request id is new, this job should be removed. A single access path does not cover both sides cleanly.',
        'Redis sorted sets exist as a production compromise: give the user one abstraction, but maintain the internal structures needed for member lookup and ordered traversal. In the large representation, that means a dictionary plus a skip list. The API hides the composition; performance depends on it.',
      ],
    },
    {
      heading: 'The baseline and the wall',
      paragraphs: [
        'Start with a hash table. It maps member to score, so `ZSCORE` and membership checks are expected O(1). Updating a known member is easy. But a hash table has no order. Asking for the top 100 means scanning every entry and sorting or maintaining a second structure somewhere else.',
        'Start with only an ordered tree or skip list instead. Range queries become natural, but member updates are still awkward. To update `bob`, the system must find the old node, know the old score, remove it if the order changes, and reinsert it. Searching only by score is not enough because scores are not unique.',
        'That is the wall: member-oriented commands and score-oriented commands both need to be first-class. Redis solves it with a dual index for large sorted sets. Small sorted sets can use compact listpack encoding because a tiny packed scan may be cheaper than pointer-heavy indexing. Once the set grows, the full representation pays memory for predictable command behavior.',
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        'The invariant is consistency between indexes. Every member in the dictionary must have one logical score. Every node in the ordered structure must represent the same member and score. A logical update is not complete until both access paths agree.',
        'The skip list orders by score and then by member bytes as the tie breaker. That deterministic secondary order matters. Equal scores are common in leaderboards, queues, and timestamps. The structure needs a total order so rank, range, insertion, and deletion are well-defined.',
        'Redis skip-list levels also store spans. A span says how many bottom-level nodes a forward pointer skips. Spans turn rank into an accumulated count while traversing the tower. Without spans, the structure could still find score ranges, but rank-by-position operations would be weaker.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        '`ZADD` starts on the dictionary side. If the member is absent, Redis adds the member and score to the dictionary and inserts a node into the skip list. The node receives a random height. Higher levels skip more nodes, which gives the expected logarithmic search behavior.',
        'If the member already exists and the score is unchanged, little ordered work is needed. If the score changes and the member must move in sorted order, Redis removes the old skip-list node and inserts a new one in the right position. The dictionary is updated to the new score. The command behaves like one logical mutation even though two indexes are touched.',
        'Range commands ride the ordered side. A score range seeks into the skip list and then walks bottom-level links while scores remain inside the requested interval. A rank range uses spans to seek to a position. A member score lookup uses the dictionary. The command name is often the clue to which path is hot.',
        'Representation switching is part of the mechanism. Compact listpack encoding saves memory for small sorted sets. The dictionary plus skip-list form costs more per entry but avoids linear scans as the structure grows. A systems engineer should treat that threshold as a memory-latency tradeoff, not as an implementation footnote.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The dictionary solves identity. Given a member, it can answer whether the member exists and what score it has. That is what makes updates practical. The skip list solves order. Given a score, rank, or endpoint, it can walk members in sorted order without sorting the whole set.',
        'Correctness depends on making those paths represent the same logical set. If a member appears in the dictionary but not the skip list, range queries are wrong. If a skip-list node survives after dictionary removal, ordered reads return deleted data. If the score differs between paths, every command becomes suspect.',
        'The span idea explains why this is more than a normal skip list. Range-by-score needs order. Rank-by-position needs counts. By storing spans on forward pointers, Redis can move through the tower and accumulate how many bottom-level nodes have been crossed. That turns position queries into indexed ordered traversal.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the dual-index view, the split between dictionary and skip list is the whole lesson. The dictionary side should make you think member, direct lookup, old score, and update. The skip-list side should make you think order, score range, rank, top N, and spans.',
        'In the tower view, the upper levels are shortcuts and the bottom level is the full sorted order. The span labels are counts, not weights in the product sense. They explain how the structure can skip across several members while still knowing how many ranks it crossed.',
        'In the leaderboard and limiter views, connect data structure work back to product behavior. Top-N is seek then emit. A sliding-window limiter is add, trim, count, decide, and expire. The ordered index makes the window cheap to find; it does not make unbounded output or unbounded retention cheap.',
      ],
    },
    {
      heading: 'Costs and complexity',
      paragraphs: [
        'The useful mental model is O(log n) to seek or update the ordered structure plus O(m) to return m results. The second term is real. Returning 100,000 members costs time even with a perfect index because the server still has to walk, allocate, serialize, and send those rows.',
        'Dictionary lookup is expected O(1). Ordered inserts, deletes, rank seeks, and score-range seeks are expected O(log n). Score ranges and rank ranges add output size. Removals by range add the number of removed members. This is why command complexity lines often include both a logarithmic seek and a linear result term.',
        'Memory is the price of the dual index. The member string, score, dictionary entry, skip-list node, levels, spans, and pointers all add overhead. Listpack saves memory for small values. The full representation buys speed and richer operations at the cost of more heap objects.',
        'Operationally, a single hot key can become the bottleneck. A global leaderboard, global rate limiter, or global trending feed concentrates reads and writes on one Redis key. Sharding by tenant, game, region, time bucket, or score band is often more important than micro-optimizing the skip-list operation.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Redis sorted sets win when the product needs a live ordered index with unique members. Leaderboards are the clean example: update one player, read a top range, fetch a player rank, or show neighbors around a player. The member identity and score order are both core to the feature.',
        'They also fit exact sliding windows. Store request identifiers or timestamps as members and timestamps as scores. Remove entries older than the window, count the remainder, and decide whether to allow the request. The ordered score path makes old entries easy to trim.',
        'Delayed work queues can also fit when the main operation is due-time order. Store job ids as members and due times as scores. Workers fetch ready jobs with the lowest scores and remove them atomically. This is not the same as a full event log, but it is a useful live scheduling index.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A sorted set is not a durable relational index. Redis persistence, replication, failover, eviction policy, and deployment topology define the durability story. If the product needs relational constraints, historical audit, complex joins, or long-term storage, a database index or event log belongs nearby.',
        'It is also a poor fit for append-only replay. Redis Streams or a log system are better when every event must be consumed, acknowledged, retried, and retained. A sorted set stores the latest membership by member identity and score. That is different from event history.',
        'Global rankings fail when they cannot be sharded or bounded. One massive hot ZSET can concentrate memory and CPU. Wide `ZRANGE` calls can dominate latency. Scores with many ties can surprise teams that forgot the member tie breaker. Stale entries can grow forever without explicit retention.',
      ],
    },
    {
      heading: 'Concrete cases',
      paragraphs: [
        'Leaderboard: store player id as member and score as value. After a match, `ZADD` updates the score. `ZRANGE` with reverse ordering reads the top N. `ZRANK` or reverse rank reads a player position. This is the ideal shape because the product needs both member updates and ordered reads.',
        'Sliding-window limiter: store request ids as members and request timestamps as scores. On each request, remove scores older than the window, add the new request, count remaining requests, and reject if count exceeds the budget. This must be atomic, usually by Lua or another single server-side operation, or concurrent requests can pass incorrectly.',
        'Due-job scheduler: store job id as member and due timestamp as score. A worker reads jobs with score less than or equal to now, claims them, and removes them. This can work well for modest scheduling needs. If jobs require replay, consumer groups, visibility timeouts, and audit, use a queue or stream design instead.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Start by naming the hot command shape. If the feature mostly asks for member scores, the dictionary path matters. If it asks for top ranges, rank ranges, or score windows, the skip-list path matters. If it returns wide ranges, output size will dominate the index cost.',
        'Make retention explicit. Rate limiters should trim old entries. Leaderboards should decide whether scores reset by season, shard by cohort, or archive to another store. Schedulers should remove completed jobs. Without retention, a sorted set can become a slow memory leak with a nice API.',
        'Make atomicity explicit. Multi-step patterns such as limiter decisions and job claims should not be spread across separate client commands when concurrent clients can race. Use Lua, transactions with care, or a design that makes each state transition a single server-side mutation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Redis sorted-set data type documentation at https://redis.io/docs/latest/develop/data-types/sorted-sets/, ZADD command docs at https://redis.io/docs/latest/commands/zadd/, ZRANGE command docs at https://redis.io/docs/latest/commands/zrange/, Redis memory optimization docs for compact encodings at https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/memory-optimization/, and Redis source files server.h and t_zset.c at https://github.com/redis/redis/blob/unstable/src/server.h and https://github.com/redis/redis/blob/unstable/src/t_zset.c.',
        'Study Skip List first for the tower search idea, then Hash Table for the member index. Continue with Rate Limiter, Sliding Window, Redis Streams, Message Queues, Database Indexing, and LRU Cache. The goal is to know when a sorted set is the right live ordered index and when another storage shape should own durability, replay, or global scale.',
      ],
    },
  ],
};
