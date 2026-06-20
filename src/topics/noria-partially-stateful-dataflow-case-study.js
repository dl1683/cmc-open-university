// Noria partially-stateful dataflow: web-application reads as maintained,
// query-shaped views with eviction, upqueries, and dynamic graph change.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'noria-partially-stateful-dataflow-case-study',
  title: 'Noria Partially Stateful Dataflow Case Study',
  category: 'Papers',
  summary: 'Noria as a web-systems lesson: compile parameterized SQL reads into a partially stateful dataflow graph that maintains hot view state and reconstructs cold state on demand.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['partial state', 'dynamic views'], defaultValue: 'partial state' },
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

function noriaGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'writes', label: 'writes', x: 0.7, y: 4.8, note: notes.writes ?? 'base rows' },
      { id: 'base', label: 'base tbl', x: 2.3, y: 4.8, note: notes.base ?? 'durable' },
      { id: 'join', label: 'join', x: 4.2, y: 3.0, note: notes.join ?? 'dataflow' },
      { id: 'agg', label: 'agg', x: 5.9, y: 3.0, note: notes.agg ?? 'maintain' },
      { id: 'view', label: 'view', x: 7.6, y: 3.0, note: notes.view ?? 'hot keys' },
      { id: 'read', label: 'read', x: 9.2, y: 3.0, note: notes.read ?? 'lookup' },
      { id: 'upquery', label: 'upquery', x: 5.9, y: 6.0, note: notes.upquery ?? 'rebuild key' },
      { id: 'evict', label: 'evict', x: 7.6, y: 1.2, note: notes.evict ?? 'cold' },
    ],
    edges: [
      { id: 'e-writes-base', from: 'writes', to: 'base', weight: 'insert/update' },
      { id: 'e-base-join', from: 'base', to: 'join', weight: 'diffs' },
      { id: 'e-join-agg', from: 'join', to: 'agg', weight: 'rows' },
      { id: 'e-agg-view', from: 'agg', to: 'view', weight: 'materialize' },
      { id: 'e-view-read', from: 'view', to: 'read', weight: 'answer' },
      { id: 'e-read-upquery', from: 'read', to: 'upquery', weight: 'miss' },
      { id: 'e-upquery-base', from: 'upquery', to: 'base', weight: 'lookup' },
      { id: 'e-view-evict', from: 'view', to: 'evict', weight: 'free' },
    ],
  }, { title });
}

function migrationGraph(title) {
  return graphState({
    nodes: [
      { id: 'sql', label: 'SQL reads', x: 0.7, y: 3.5, note: 'params' },
      { id: 'mir', label: 'MIR', x: 2.5, y: 3.5, note: 'graph' },
      { id: 'reuse', label: 'reuse', x: 4.3, y: 2.0, note: 'shared ops' },
      { id: 'mig', label: 'migrate', x: 4.3, y: 5.0, note: 'online' },
      { id: 'domains', label: 'domains', x: 6.4, y: 3.5, note: 'workers' },
      { id: 'views', label: 'views', x: 8.5, y: 3.5, note: 'lookups' },
    ],
    edges: [
      { id: 'e-sql-mir', from: 'sql', to: 'mir', weight: 'compile' },
      { id: 'e-mir-reuse', from: 'mir', to: 'reuse', weight: 'share' },
      { id: 'e-mir-mig', from: 'mir', to: 'mig', weight: 'change' },
      { id: 'e-reuse-domains', from: 'reuse', to: 'domains', weight: 'place' },
      { id: 'e-mig-domains', from: 'mig', to: 'domains', weight: 'update' },
      { id: 'e-domains-views', from: 'domains', to: 'views', weight: 'serve' },
    ],
  }, { title });
}

function* partialState() {
  yield {
    state: noriaGraph('Noria materializes read queries as a dataflow graph'),
    highlight: { active: ['writes', 'base', 'join', 'agg', 'view', 'e-base-join', 'e-agg-view'], found: ['read'] },
    explanation: 'Noria compiles parameterized SQL reads into a dataflow graph. Writes update base tables, flow through operators, and maintain view state so reads become fast lookups.',
    invariant: 'The view is query-shaped state, not an unrelated cache key invented by application code.',
  };

  yield {
    state: labelMatrix(
      'Partial state ledger',
      [
        { id: 'hot', label: 'hot' },
        { id: 'cold', label: 'cold' },
        { id: 'miss', label: 'miss' },
        { id: 'fan', label: 'fanout' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'action', label: 'action' },
      ],
      [
        ['kept', 'hit'],
        ['evict', 'mem'],
        ['miss', 'upq'],
        ['wide', 'full'],
      ],
    ),
    highlight: { active: ['hot:action', 'cold:action'], found: ['miss:action'], compare: ['fan:action'] },
    explanation: 'Partial state means the system can keep only hot keys in memory. A miss sends an upquery upstream to reconstruct the missing key instead of forcing all state to stay resident forever.',
  };

  yield {
    state: noriaGraph('Upqueries reconstruct evicted state on demand', { view: 'miss', upquery: 'key=story42', read: 'wait' }),
    highlight: { active: ['read', 'upquery', 'base', 'e-read-upquery', 'e-upquery-base'], found: ['view'] },
    explanation: 'If a read asks for an evicted key, Noria traces dependencies upstream through indexes and reconstructs the needed state. This is the core difference from a naive cache miss.',
  };

  yield {
    state: labelMatrix(
      'When partial state is unsafe',
      [
        { id: 'idx', label: 'index' },
        { id: 'topk', label: 'top-k' },
        { id: 'desc', label: 'desc' },
        { id: 'scan', label: 'scan' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'result', label: 'result' },
      ],
      [
        ['index', 'part'],
        ['rank', 'full'],
        ['child', 'safe'],
        ['scan', 'off'],
      ],
    ),
    highlight: { active: ['idx:result'], compare: ['topk:result', 'scan:result'], found: ['desc:need'] },
    explanation: 'Partial state works only when the system can answer upqueries efficiently. If reconstruction requires scanning all upstream state, the operator needs fuller materialization.',
  };
}

function* dynamicViews() {
  yield {
    state: migrationGraph('Parameterized reads become an evolving dataflow program'),
    highlight: { active: ['sql', 'mir', 'reuse', 'domains', 'e-sql-mir', 'e-mir-reuse'], found: ['views'] },
    explanation: 'Noria maps application read queries into an internal dataflow graph. Related queries can share operators and state instead of each building a private cache pipeline.',
  };

  yield {
    state: labelMatrix(
      'Cache versus Noria',
      [
        { id: 'redis', label: 'cache' },
        { id: 'mv', label: 'matview' },
        { id: 'noria', label: 'Noria' },
        { id: 'diff', label: 'DiffDF' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'hard', label: 'hard part' },
      ],
      [
        ['keys', 'invalid'],
        ['full', 'refresh'],
        ['partial', 'upq'],
        ['traces', 'front'],
      ],
    ),
    highlight: { active: ['noria:state', 'noria:hard'], compare: ['redis:hard'], found: ['diff:state'] },
    explanation: 'Noria sits between manual caches and fully maintained dataflow. It keeps query-shaped view state but can evict and reconstruct pieces to avoid state explosion.',
  };

  yield {
    state: migrationGraph('Online graph change is part of the system design'),
    highlight: { active: ['mir', 'mig', 'domains', 'e-mir-mig', 'e-mig-domains'], compare: ['reuse'], found: ['views'] },
    explanation: 'Web applications change queries over time. Noria treats query addition and graph migration as a first-class runtime operation instead of a full offline rebuild.',
    invariant: 'A long-lived serving graph needs a migration protocol, not only a fast steady state.',
  };

  yield {
    state: labelMatrix(
      'Complete web-read case study',
      [
        { id: 'story', label: 'story' },
        { id: 'votes', label: 'votes' },
        { id: 'front', label: 'frontpg' },
        { id: 'user', label: 'user' },
      ],
      [
        { id: 'query', label: 'query' },
        { id: 'state', label: 'state' },
      ],
      [
        ['id', 'hot'],
        ['story', 'part'],
        ['top', 'full'],
        ['prof', 'look'],
      ],
    ),
    highlight: { active: ['story:state', 'votes:state', 'user:state'], compare: ['front:state'] },
    explanation: 'A Lobsters-like site has story pages, vote counts, user profiles, and front-page rankings. Some views are naturally keyed and partial; global ranked lists are harder.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'partial state') yield* partialState();
  else if (view === 'dynamic views') yield* dynamicViews();
  else throw new InputError('Pick a Noria view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The partial-state view shows the central memory decision in Noria. Each node in the dataflow graph is either hot (state resident, reads hit), cold (state evicted, memory freed), or in a miss state (a read arrived for an evicted key). The upquery node lights up when a miss triggers backward traversal through indexed operators to reconstruct the missing answer.',
        {
          type: 'diagram',
          text: [
            'Dataflow path (write direction -->):',
            '',
            '  writes --> base tbl --> join --> agg --> view --> read',
            '                                           |        |',
            '                                         evict    miss',
            '                                                    |',
            '                                                 upquery',
            '                                                    |',
            '                                              base tbl (index lookup)',
          ].join('\n'),
          label: 'Writes flow forward; upqueries flow backward through the same dependency edges',
        },
        'The partial-state ledger matrix maps each memory state to its runtime behavior. "hot/hit" is the fast path. "cold/mem" means the system freed memory. "miss/upq" is the reconstruction path that makes partial state different from a naive cache eviction. "wide/full" marks operators where partial state is unsafe because reconstruction would require a full scan.',
        'The dynamic-views view shows Noria as a program that evolves while serving reads. SQL reads compile into MIR (mid-level intermediate representation), operators are shared across queries when possible, and migration adds new view endpoints without rebuilding the entire graph. Active edges show the compile and share path; the migration edge shows the online-change protocol.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Read-heavy web applications repeat the same derived computation millions of times. A story page on a news site joins the story row, author row, comment count, vote tally, tags, and viewer-specific flags. Every page load re-derives the same answer from the same base tables. With 10,000 requests per second for popular stories, re-running that join-and-aggregate query every time wastes most of the database server.',
        {
          type: 'quote',
          text: 'The dominant cost in read-heavy web applications is not the write itself but the redundant re-derivation of the same read result from unchanged base data.',
          attribution: 'Gjengset et al., Noria: dynamic, partially-stateful data-flow for high-performance web applications, OSDI 2018',
        },
        'The standard engineering response is a cache layer -- Memcached or Redis keyed by query parameters. This works until a single write to the votes table invalidates a story page, a user karma total, a front-page ranking, and a personalized feed. The application programmer must enumerate every downstream cache key affected by every upstream write. That invalidation logic becomes a second, shadow schema that drifts from the actual queries.',
        'Noria exists to eliminate that shadow schema. It compiles application read queries into a dataflow graph that maintains query-shaped views automatically. Writes propagate through operators that understand the dependency structure. The unusual contribution is partial state: the system can keep only the hot fraction of derived state, evict cold state to bound memory, and reconstruct missing state on demand through upqueries -- backward traversals through the same dependency graph.',
        {
          type: 'note',
          text: 'The primary source is the OSDI 2018 paper by Jon Gjengset, Malte Schwarzkopf, Jonathan Behrens, Lara Timbro Kloot, Eddie Kohler, M. Frans Kaashoek, and Robert Morris at MIT CSAIL. The system was evaluated against a Lobsters-like workload (lobste.rs) and compared against MySQL with hand-tuned caching. The Rust reimplementation, readyset-data/readyset on GitHub, is the most active descendant.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Three reasonable approaches exist, and each makes a different sacrifice.',
        {
          type: 'table',
          headers: ['Approach', 'Fast reads', 'Correct on writes', 'Bounded memory', 'Hard part'],
          rows: [
            ['Manual cache (Redis/Memcached)', 'Yes -- lookup by key', 'Only if invalidation code is perfect', 'Yes -- TTL or LRU', 'Maintaining the invalidation mapping by hand'],
            ['Fully materialized views', 'Yes -- pre-joined answer', 'Yes -- database maintains it', 'No -- every key for every view', 'State explosion on large key spaces'],
            ['Recompute on every read', 'No -- full query each time', 'Yes -- always fresh', 'Yes -- no derived state', 'Redundant work under skewed read load'],
          ],
        },
        'Manual caching is the industry default. A team at Lobsters, Hacker News, or Reddit maintains a mapping from "vote inserted" to "invalidate story:{id}, user:{uid}, frontpage" in application code. When the product adds tags, moderation flags, or bookmarks, every invalidation path must be audited. Facebook published a TAO paper (USENIX ATC 2013) documenting the scale of this problem: thousands of cache-invalidation rules maintained by hand across hundreds of entity types.',
        'Fully materialized views solve correctness but consume memory proportional to the cross product of all keys and all views. A Lobsters-like site with 500,000 stories, 50,000 users, and 10 parameterized views can maintain 5 million view entries, most of which are never read. The memory cost is proportional to the key space, not the working set.',
        'Recomputation avoids both problems but repeats identical joins and aggregations across requests. With a 50:1 read-to-write ratio (typical for news sites), the same derived answer is recomputed 50 times between changes. Under heavy read load, the database becomes the bottleneck.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The three approaches reveal a trilemma. The application wants fast reads, correct invalidation, and bounded memory. Each pair is achievable; all three together require a new mechanism.',
        {
          type: 'diagram',
          text: [
            '                 Fast Reads',
            '                /           \\',
            '           Cache             Materialized View',
            '          (manual             (full state,',
            '         invalidation)       unbounded memory)',
            '              \\               /',
            '            Correct Invalidation',
            '                    |',
            '               Recompute',
            '           (slow reads,',
            '           bounded memory)',
          ].join('\n'),
          label: 'The read-serving trilemma: each edge sacrifices the opposite vertex',
        },
        'The second wall is query evolution. A production web application does not have a fixed set of reads. A new feature adds a "trending tags" page; a redesign changes the story-list query; an A/B test adds a personalization join. A static dataflow graph compiled once at deploy is not enough. The system needs online migration: adding operators, reusing shared subexpressions, and moving state while continuing to serve existing views.',
        'The third and most subtle wall is reconstructability. Saying "evict cold state" is easy. The hard question is: when a future read asks for an evicted key, can the system reconstruct exactly that key from upstream data without scanning the entire upstream relation? If reconstruction requires a full table scan or knowledge of global ordering, partial state converts a memory optimization into a latency disaster. The system must distinguish operators where keyed reconstruction is cheap (index lookup, single-key aggregation) from operators where it is not (top-k, range scan, global sort).',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Noria treats application read queries as a long-lived dataflow program. Each parameterized SQL query compiles into a path: base tables feed operators (join, filter, project, aggregate), and the final node is a view keyed by the query parameters. A write is not a cache-invalidation event written by the programmer; it is a delta that flows through the operators that depend on the changed base rows.',
        {
          type: 'quote',
          text: 'Partial state turns the memory question from "keep all or keep none" into "keep the working set and reconstruct on demand." The upquery is the mechanism that makes reconstruction safe: it follows the same dependency edges that forward propagation uses, but in reverse.',
          attribution: 'Noria design principle',
        },
        'The core insight is the upquery. When a read misses because the key was evicted, the system does not fall back to recomputing the full query from scratch. Instead, it sends a backward message -- the upquery -- along the dependency edges of the dataflow graph. Each operator on the path uses its indexes to fetch exactly the rows needed to reconstruct the missing key. The reconstructed state is inserted into the view and served to the reader.',
        'This makes memory a working-set decision. Popular stories stay hot. Old stories get evicted. When a reader opens an old story, the upquery reconstructs it in milliseconds using indexed lookups, not full table scans. The graph owns the dependency structure, so the application never writes invalidation code.',
        {
          type: 'code',
          language: 'text',
          text: [
            '-- Application registers this parameterized read:',
            'SELECT s.title, s.body, u.name, COUNT(v.id) AS votes',
            'FROM stories s',
            'JOIN users u ON s.author_id = u.id',
            'LEFT JOIN votes v ON v.story_id = s.id',
            'WHERE s.id = ?',
            'GROUP BY s.id;',
            '',
            '-- Noria compiles it into:',
            '-- base(stories) --join(users)--> agg(votes) --> view(story_id)',
            '-- A write to votes propagates a +1/-1 delta through agg to the view.',
            '-- An evicted story_id=42 triggers: upquery(42) --> agg --> join --> base.',
          ].join('\n'),
          label: 'The SQL read becomes a dataflow path; writes are deltas, misses are upqueries',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Noria has four subsystems: the query compiler, the forward dataflow engine, the upquery protocol, and the migration controller.',
        {
          type: 'bullets',
          items: [
            'Query compiler: parses parameterized SQL reads, lowers them to a mid-level intermediate representation (MIR), identifies shared subexpressions across queries, and emits a dataflow graph with operator nodes and materialized view endpoints.',
            'Forward dataflow: when a write enters a base table, the system computes a delta (inserted rows, deleted rows, or updated rows) and propagates it through every downstream operator. Each operator applies its relational logic (join matching, filter predicate, aggregate update) and forwards the result. If the downstream view has the affected key materialized, it updates in place.',
            'Upquery protocol: when a read misses at a view, the system sends an upquery backward through the graph. Each operator on the reverse path uses its index to look up the rows needed for the missing key. At the base table, the upquery becomes a point lookup. The results flow forward through the operators again, and the reconstructed state is inserted into the view.',
            'Migration controller: when a new query arrives, the compiler checks for reusable operators in the existing graph. Shared joins, filters, or aggregations are reused rather than duplicated. New operators are added, state is migrated (partially -- only hot keys may be pre-populated), and the new view becomes available for reads.',
          ],
        },
        {
          type: 'diagram',
          text: [
            'Forward path (write):',
            '  INSERT INTO votes (story_id, user_id) VALUES (42, 7)',
            '    |',
            '    v',
            '  base(votes) --delta(+1)--> agg(COUNT, key=story_id)',
            '    --delta(votes:42, count=old+1)--> view(story_id=42) [update in place]',
            '',
            'Backward path (upquery):',
            '  read(story_id=99) --> view(99) [MISS]',
            '    --> upquery(key=99) --> agg(lookup 99) --> join(lookup 99)',
            '    --> base(stories WHERE id=99) + base(users WHERE id=author)',
            '    --> base(votes WHERE story_id=99)',
            '    --> forward through join, agg --> view(99) [INSERT, now hot]',
          ].join('\n'),
          label: 'Forward deltas maintain hot state; upqueries reconstruct cold state through the same operators',
        },
        'Eviction is controlled by a memory budget. When a view or operator exceeds its allocation, the system evicts the least-recently-used keys. But eviction is only safe at operators where the upquery contract holds: a future miss must be reconstructable via indexed point lookups, not full scans. The system tracks this property per operator during compilation.',
        {
          type: 'table',
          headers: ['Operator type', 'Partial-safe?', 'Upquery mechanism', 'Failure mode if forced partial'],
          rows: [
            ['Filter (WHERE col = ?)', 'Yes', 'Index lookup on filter column', 'None -- point lookup is cheap'],
            ['Equi-join (a.id = b.fk)', 'Yes', 'Index lookup on join key', 'None -- keyed join is O(matching rows)'],
            ['COUNT/SUM grouped by key', 'Yes', 'Re-aggregate from upstream rows for that key', 'None -- bounded by group size'],
            ['Top-k (ORDER BY score LIMIT k)', 'No', 'Would require scanning all candidates to find rank', 'Latency spike proportional to total row count'],
            ['DISTINCT over high-cardinality column', 'Depends', 'Needs full upstream scan if no covering index', 'Silent incorrectness if partial set is returned as complete'],
          ],
        },
        'This table is the reason the animation explicitly marks "scan: off" for operators that cannot be safely made partial. The system must either keep those operators fully materialized, change the query plan, or accept degraded latency.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is: for every key k materialized in a view V, V[k] equals the result of executing the corresponding SQL query over the current base tables. Forward propagation preserves this invariant for resident keys by applying deltas incrementally. Upqueries restore the invariant for evicted keys by recomputing from base data through the same operator chain.',
        {
          type: 'note',
          text: 'The invariant holds per-key, not globally. A partially-stateful view may be missing keys entirely (those keys are evicted, not stale). A present key is always consistent with current base data. This is different from a TTL cache, where a present key may be stale.',
        },
        'The graph makes invalidation structural. When a vote is cast on story 42, the delta flows from base(votes) through agg(COUNT, key=story_id) to view(story_id=42). The application programmer never writes "if vote inserted, invalidate story:42 and frontpage and user:{voter}." The dataflow graph encodes those dependencies at compile time.',
        'Partial state works because web workloads exhibit extreme skew. In the Lobsters dataset used for evaluation, the top 1% of stories receive over 50% of reads. Keeping all 500,000 story views wastes memory on 495,000 cold entries. Keeping only the hot 5,000 entries and reconstructing on demand matches the access distribution while using roughly 1% of the memory.',
        'The limit is structural, not heuristic. An operator can be made partial only if its upquery path has bounded cost. A join on an indexed foreign key is O(matching rows). A top-k sort over the entire table is O(n). Noria does not guess; the compiler analyzes the operator graph and marks each node as partial-safe or full-only. This analysis is the contract that makes eviction safe.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a Lobsters-like news site with three tables: stories (500K rows), users (50K rows), votes (5M rows). The application registers four parameterized reads:',
        {
          type: 'code',
          language: 'text',
          text: [
            'Q1: story page     -- SELECT ... WHERE story_id = ?',
            'Q2: user profile   -- SELECT ... WHERE user_id = ?',
            'Q3: front page     -- SELECT ... ORDER BY score DESC LIMIT 25',
            'Q4: recent stories -- SELECT ... WHERE created > NOW() - INTERVAL 24 HOUR',
          ].join('\n'),
          label: 'Four read queries with different partial-state fitness',
        },
        {
          type: 'table',
          headers: ['Query', 'Key', 'Partial-safe?', 'Working set', 'Reason'],
          rows: [
            ['Q1: story page', 'story_id', 'Yes', '~5K hot stories', 'Equi-join on indexed PK; upquery is a point lookup'],
            ['Q2: user profile', 'user_id', 'Yes', '~2K active users', 'Same structure as Q1; keyed by user PK'],
            ['Q3: front page', 'None (global)', 'No', 'Full (25 rows but ranks all stories)', 'Top-k requires scanning all candidates to determine rank'],
            ['Q4: recent stories', 'time range', 'Partial', 'Sliding window', 'Safe if index on created exists; range must be bounded'],
          ],
        },
        'Q1 and Q2 are ideal for partial state. Story 42 is hot because readers are visiting it. Story 999 was posted three years ago and has had no reads in months. Noria keeps story 42 in the view and evicts story 999. When someone finally opens story 999, the upquery reconstructs it: look up story 999 in base(stories), join with its author from base(users), count votes from base(votes) WHERE story_id=999, and insert the result into the view.',
        'Q3 is the hard case. The front page is a global top-25 ranking. A single vote on any story can change the ranking. Reconstructing the front page from a partial view would require scanning all story scores to determine the top 25 -- that is a full table scan, not a point lookup. Noria must keep Q3 fully materialized.',
        'Manual caching of this workload would require the programmer to maintain invalidation mappings: "vote inserted -> invalidate story:{story_id}, user:{voter_id}, frontpage, recent-if-new." That is four invalidation rules for one write, and the list grows with every new query. In Noria, the programmer registers the four SQL reads; the graph handles propagation.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Cost', 'What drives it'],
          rows: [
            ['Read (hot key)', 'O(1) -- hash lookup in view', 'View is a hash map keyed by query parameters'],
            ['Read (cold key, upquery)', 'O(join fan-out) -- index lookups through the graph', 'Number of operators on the path and rows per join key'],
            ['Write (forward propagation)', 'O(downstream operators * fan-out)', 'Depth of the dataflow graph and number of affected views'],
            ['Eviction', 'O(1) -- LRU removal', 'Memory budget per operator/view'],
            ['Migration (add new query)', 'O(shared ops + new ops)', 'Reuse reduces cost; pre-populating hot keys adds startup work'],
          ],
        },
        'Read cost on a hit is a hash-map lookup -- sub-microsecond. The OSDI 2018 evaluation reports Noria serving 10x more requests per second than a MySQL+Memcached setup on the Lobsters workload, with tail latency below 10ms at the 99th percentile.',
        'Write cost is higher than a plain database INSERT because each write must propagate deltas through all downstream operators. A vote insertion touches the votes base table, then propagates through the aggregation operator and into every view that depends on that aggregation. With N dependent views, write cost scales linearly in N. This is the price of maintaining derived state.',
        'Memory cost is the central knob. The paper reports that full materialization of the Lobsters workload consumes roughly 65GB of derived state. Partial state with a 1GB memory budget achieves 95% hit rate because of access skew. The remaining 5% of reads pay upquery latency (typically under 5ms for keyed reconstructions).',
        {
          type: 'note',
          text: 'Miss latency is the tax on partial state. If the eviction policy is too aggressive, reads frequently pay reconstruction cost and the system behaves worse than full materialization. If eviction is too conservative, memory approaches the full-materialization baseline and partial state adds complexity without saving memory. The useful operating point depends on workload skew -- the more skewed, the more partial state saves.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Noria is a research system, but its ideas have production descendants and analogues.',
        {
          type: 'bullets',
          items: [
            'ReadySet (readyset-data/readyset on GitHub): a Rust reimplementation of Noria designed as a drop-in MySQL/PostgreSQL wire-compatible caching layer. Applications connect to ReadySet instead of the database; it maintains views for registered queries and falls through to the database for unregistered ones.',
            'Materialize (materializeinc/materialize): a streaming SQL database that maintains incrementally updated materialized views. It uses differential dataflow (Naiad heritage) rather than Noria-style upqueries, but solves the same core problem: read-heavy workloads where derived state should be maintained, not recomputed.',
            'Facebook TAO: a geographically distributed cache for the social graph. TAO maintains derived objects (associations, counts) with a subscription model rather than dataflow, but faces the same invalidation problem at a much larger scale.',
            'Any application using Redis/Memcached with hand-written invalidation logic is solving the problem Noria automates. The difference is whether the invalidation mapping is maintained by the programmer or derived from the query structure.',
          ],
        },
        'The pattern fits any application where reads dominate writes (10:1 or higher ratio), queries are parameterized by a natural key (user ID, story ID, product ID), access is skewed (a small fraction of keys receives most reads), and the development team spends significant time maintaining cache-invalidation logic.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'table',
          headers: ['Failure condition', 'Why Noria is the wrong tool', 'Better alternative'],
          rows: [
            ['Reads are one-off (analytics, ad hoc queries)', 'No reuse to amortize graph maintenance cost', 'Column-store or query engine (DuckDB, Presto)'],
            ['Views require global order (top-k, full-text search)', 'Upqueries degenerate to full scans', 'Dedicated search index (Elasticsearch) or fully materialized ranking'],
            ['Write-heavy workload (>50% writes)', 'Forward propagation cost dominates; views churn', 'Write-optimized store (LSM-tree) with async read indexing'],
            ['Very low latency tolerance (<100us p99)', 'Upquery reconstruction adds variable latency on misses', 'Fully materialized views or pre-warmed cache'],
            ['Simple single-table lookups', 'Dataflow graph adds complexity without benefit', 'Database index or simple key-value cache'],
          ],
        },
        'The most dangerous failure mode is thrashing. If the memory budget is too small relative to the working set, the system evicts keys that are soon requested again. Each request pays upquery cost, the reconstructed key is immediately evicted for the next cold key, and the cycle repeats. Throughput drops below what a simple database query would deliver, and tail latency spikes.',
        'Operational complexity is real. The system requires monitoring of upquery rates (a spike means the working set exceeds the memory budget), eviction churn (high churn means the budget is wrong or access patterns shifted), write propagation delay (if deltas back up, views serve stale state temporarily), and per-operator state size (to identify operators that cannot be made partial and dominate memory).',
        {
          type: 'quote',
          text: 'Partial state is a contract, not a label. Evicting a value is safe only if the reconstruction path is bounded, indexed, and faster than the reader is willing to wait.',
          attribution: 'Design constraint from the Noria OSDI 2018 paper',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: Jon Gjengset et al., "Noria: dynamic, partially-stateful data-flow for high-performance web applications," OSDI 2018. https://www.usenix.org/conference/osdi18/presentation/gjengset',
            'Implementation: readyset-data/readyset on GitHub -- the production-oriented Rust reimplementation.',
            'Jon Gjengset, "Partial State in Dataflow-Based Materialized Views," PhD dissertation, MIT, 2021. Provides deeper treatment of upquery correctness and multi-key partial state.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Database Indexing', 'Upqueries require indexed point lookups; without understanding indexes, the partial-state contract is unclear'],
            ['Prerequisite', 'Streaming Watermarks', 'Dataflow progress tracking underlies how Noria knows when a forwarded delta is complete'],
            ['Extension', 'Differential Dataflow Incremental View Case Study', 'The alternative approach to incremental maintenance -- traces instead of upqueries'],
            ['Contrast', 'LRU Cache', 'Pure eviction without reconstruction; shows what partial state adds beyond a cache'],
            ['Production case', 'Flink Checkpointing Case Study', 'State recovery in a production streaming dataflow system; different failure model, same state-management concerns'],
          ],
        },
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'State the correctness invariant in one sentence. (Answer: every materialized key in a view equals the result of the corresponding SQL query over current base data.)',
            'Trace what happens when a vote is cast on an evicted story. Name each node the delta touches and each node the upquery skips. (The delta updates the aggregation operator but does not flow to the evicted view entry; only a subsequent read triggers the upquery.)',
            'Name one operator type where partial state is unsafe and explain why in one line. (Top-k: reconstruction requires scanning all candidates because rank depends on global order, not a single key.)',
            'Transfer the upquery mechanism to a different domain. (A CDN edge cache that, on miss, fetches from origin by key is the same pattern -- but without the structural dependency graph that makes Noria\'s reconstruction cheaper than a full origin query.)',
          ],
        },
      ],
    },
  ],
};
