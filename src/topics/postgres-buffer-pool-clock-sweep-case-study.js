// PostgreSQL buffer pool: shared buffer descriptors, pins, usage_count, dirty
// pages, background writer/checkpointer pressure, and clock-sweep eviction.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'postgres-buffer-pool-clock-sweep-case-study',
  title: 'PostgreSQL Buffer Pool Clock Sweep',
  category: 'Systems',
  summary: 'How PostgreSQL shared buffers use buffer descriptors, pins, usage_count, dirty flags, clock-sweep victim selection, background writes, and checkpoints.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['clock sweep', 'dirty writeback'], defaultValue: 'clock sweep' },
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

function bufferGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.5, y: 4.2, note: notes.query ?? 'page read' },
      { id: 'map', label: 'tag map', x: 2.0, y: 5.4, note: notes.map ?? 'rel/block' },
      { id: 'desc', label: 'desc', x: 2.0, y: 3.0, note: notes.desc ?? 'metadata' },
      { id: 'pin', label: 'pin', x: 3.6, y: 5.4, note: notes.pin ?? 'refcount' },
      { id: 'usage', label: 'usage', x: 3.6, y: 3.0, note: notes.usage ?? 'count' },
      { id: 'clock', label: 'clock', x: 5.4, y: 4.2, note: notes.clock ?? 'hand' },
      { id: 'victim', label: 'victim', x: 7.0, y: 4.2, note: notes.victim ?? 'slot' },
      { id: 'dirty', label: 'dirty', x: 8.3, y: 5.4, note: notes.dirty ?? 'write?' },
      { id: 'disk', label: 'disk', x: 9.5, y: 4.2, note: notes.disk ?? 'page' },
    ],
    edges: [
      { id: 'e-query-map', from: 'query', to: 'map', weight: '' },
      { id: 'e-query-desc', from: 'query', to: 'desc', weight: '' },
      { id: 'e-map-pin', from: 'map', to: 'pin', weight: '' },
      { id: 'e-desc-usage', from: 'desc', to: 'usage', weight: '' },
      { id: 'e-pin-clock', from: 'pin', to: 'clock', weight: '' },
      { id: 'e-usage-clock', from: 'usage', to: 'clock', weight: '' },
      { id: 'e-clock-victim', from: 'clock', to: 'victim', weight: '' },
      { id: 'e-victim-dirty', from: 'victim', to: 'dirty', weight: '' },
      { id: 'e-dirty-disk', from: 'dirty', to: 'disk', weight: '' },
    ],
  }, { title });
}

function* clockSweep() {
  yield {
    state: bufferGraph('A page lookup first asks whether the block is already buffered'),
    highlight: { active: ['query', 'map', 'desc', 'e-query-map', 'e-query-desc'], compare: ['disk'] },
    explanation: 'A shared buffer cache is a table of page slots plus metadata. The lookup key is a buffer tag such as relation fork and block number. A hit pins the descriptor so it cannot be evicted while in use.',
    invariant: 'Pinned buffers are not eviction candidates.',
  };

  yield {
    state: bufferGraph('Hits increment or preserve usage_count as a recency signal', { usage: 'bump', pin: 'held' }),
    highlight: { active: ['pin', 'usage', 'e-map-pin', 'e-desc-usage'], compare: ['clock'] },
    explanation: 'PostgreSQL does not need a perfect LRU list for every access. A small usage_count on the descriptor is enough for the clock hand to approximate recency under concurrency.',
  };

  yield {
    state: bufferGraph('The clock hand skips pinned or recently used buffers', { clock: 'sweep', victim: 'skip' }),
    highlight: { active: ['clock', 'pin', 'usage', 'victim', 'e-clock-victim'], removed: ['dirty'] },
    explanation: 'When PostgreSQL needs a free slot, the clock hand scans descriptors. Pinned pages are skipped. Pages with positive usage_count get a second chance by decrementing the counter.',
  };

  yield {
    state: labelMatrix(
      'Victim test',
      [
        { id: 'pinned', label: 'pinned' },
        { id: 'hot', label: 'hot' },
        { id: 'cold', label: 'cold' },
        { id: 'dirty', label: 'dirty' },
      ],
      [
        { id: 'action' },
        { id: 'reason' },
      ],
      [
        ['skip', 'in use'],
        ['dec usage', 'recent'],
        ['evict', 'free slot'],
        ['write', 'durable'],
      ],
    ),
    highlight: { active: ['pinned:action', 'hot:action', 'cold:action'], compare: ['dirty:action'] },
    explanation: 'The eviction rule is a compact state machine over descriptor fields: refcount, usage_count, dirty bit, and lock state. That is the buffer-pool data structure.',
  };

  yield {
    state: bufferGraph('A cold unpinned slot becomes the victim for the incoming page', { usage: '0', pin: '0 refs', victim: 'chosen', disk: 'load new' }),
    highlight: { active: ['usage', 'pin', 'clock', 'victim', 'disk', 'e-clock-victim', 'e-dirty-disk'], found: ['query'] },
    explanation: 'The final victim is an unpinned page with low usage_count. If it is clean, it can be reused immediately; if dirty, it must be written safely before replacement.',
  };
}

function* dirtyWriteback() {
  yield {
    state: bufferGraph('Writes dirty buffers, but WAL owns the durability order', { query: 'UPDATE', desc: 'dirty bit', dirty: 'set', disk: 'later' }),
    highlight: { active: ['query', 'desc', 'dirty', 'e-query-desc', 'e-victim-dirty'], compare: ['disk'] },
    explanation: 'A modified page in shared buffers is dirty. It can be written later, but the WAL rule must be satisfied before that dirty page is trusted on disk.',
    invariant: 'Dirty writeback is performance work; WAL is the durability promise.',
  };

  yield {
    state: bufferGraph('Background writing reduces foreground eviction stalls', { clock: 'pressure', dirty: 'prewrite', victim: 'cleaner' }),
    highlight: { active: ['clock', 'victim', 'dirty', 'disk', 'e-victim-dirty', 'e-dirty-disk'], compare: ['query'] },
    explanation: 'If many buffers are dirty, a backend that needs a victim may have to write before it can read the new page. Background writing and checkpoints reduce that surprise latency.',
  };

  yield {
    state: labelMatrix(
      'Write paths',
      [
        { id: 'backend', label: 'backend' },
        { id: 'bgwriter', label: 'bgwriter' },
        { id: 'ckpt', label: 'checkpt' },
        { id: 'evict', label: 'evict' },
      ],
      [
        { id: 'writes' },
        { id: 'risk' },
      ],
      [
        ['on demand', 'stall'],
        ['smooth', 'too little'],
        ['bound WAL', 'bursts'],
        ['victim', 'dirty wait'],
      ],
    ),
    highlight: { active: ['bgwriter:writes', 'ckpt:writes', 'backend:risk'], compare: ['evict:risk'] },
    explanation: 'Different writers serve different goals. Backends write when forced. The background writer smooths replacement. The checkpointer advances recovery boundaries.',
  };

  yield {
    state: bufferGraph('pg_buffercache can reveal usage_count and dirty distribution', { map: 'pg_buffercache', usage: 'histogram', dirty: 'dirty count' }),
    highlight: { active: ['map', 'usage', 'dirty', 'e-desc-usage'], compare: ['clock'] },
    explanation: 'Inspection tools turn the invisible cache into a distribution: how many buffers are pinned, how usage_count is spread, and whether dirty pages are building up.',
  };

  yield {
    state: bufferGraph('The complete case study is a report query colliding with OLTP writes', { query: 'mixed load', usage: 'hot set', clock: 'sweep', dirty: 'writeback', disk: 'bounded' }),
    highlight: { active: ['query', 'map', 'desc', 'usage', 'clock', 'victim', 'dirty', 'disk'], found: ['pin'] },
    explanation: 'A dashboard scan competes with hot OLTP pages. Pins protect active pages. usage_count gives hot pages second chances. Dirty writeback prevents the scan from turning every eviction into foreground write latency.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'clock sweep') yield* clockSweep();
  else if (view === 'dirty writeback') yield* dirtyWriteback();
  else throw new InputError('Pick a PostgreSQL buffer-pool view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for PostgreSQL Buffer Pool Clock Sweep. How PostgreSQL shared buffers use buffer descriptors, pins, usage_count, dirty flags, clock-sweep victim selection, background writes, and checkpoints..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
        {type:"callout", text:"Clock sweep separates lookup from replacement: tags find cached pages, descriptors decide whether each frame is pinned, dirty, protected, or cold enough to reuse."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'PostgreSQL stores tables and indexes as pages on disk, but query execution wants those pages in memory. The shared buffer pool is the database-owned cache of those pages. It lets backends reuse hot pages, coordinate access to dirty pages, and enforce write-ahead logging rules before pages are replaced or flushed.',
        'This is more than a simple cache. A page can be pinned by a backend, dirtied by a transaction, protected by locks, referenced by relation and block identity, and subject to recovery rules. Replacement has to respect all of that while many backends are reading and writing concurrently.',
        'The central question is practical: when memory is full and a new page is needed, which existing buffer can be reused without breaking correctness or causing unnecessary stalls?',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious cache policy is exact LRU: every access moves the page to the front of a list, and eviction removes the least-recently used page. It is easy to explain and often good in small caches.',
        'The wall is concurrency and bookkeeping. A busy database cannot afford a highly contended global list mutation on every page access. It also cannot evict a page merely because it is old. If a backend has pinned the page, the page is in active use. If the page is dirty, replacement may require writeback, and writeback is constrained by WAL ordering.',
        'Clock sweep is the compromise: approximate recency with a small counter on each buffer descriptor and scan for a safe victim when replacement is needed.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The data structure is a pool of fixed-size page frames plus buffer descriptors. A descriptor records which relation block is in the slot, whether it is dirty, how many backends have it pinned, and a small usage_count that acts as a recency signal.',
        'A tag map answers the lookup question: is relation R, fork F, block B already in shared buffers? The clock sweep answers the replacement question: if it is not, which slot can be reused?',
        'The clock hand walks the descriptor array. Pinned buffers are skipped. Buffers with positive usage_count receive a second chance by decrementing the count. An unpinned buffer with usage_count zero is a candidate victim. If it is dirty, it must be written before reuse.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In the clock-sweep view, follow the distinction between lookup and replacement. The tag map finds a page if it is already cached. The descriptor fields decide whether a cached page can be kept, skipped, decremented, or replaced.',
        'When the clock hand reaches a pinned buffer, the animation skips it because a backend still depends on that memory slot. When it reaches a buffer with usage_count, the hand decrements the counter rather than evicting immediately. When it reaches a cold unpinned buffer, the victim choice becomes possible.',
        'In the dirty-writeback view, watch the dirty bit and disk edge. A clean victim can be reused quickly. A dirty victim connects replacement to WAL safety, background writing, checkpoints, and foreground latency.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'A backend requests a page by buffer tag, roughly relation identity plus fork and block number. If the tag is present, the backend pins the buffer and can use the page. The pin protects the page from eviction while the backend reads or modifies it.',
        'If the tag is absent, the buffer manager needs a free or reusable slot. The clock hand scans descriptors. Pinned buffers are not candidates. Recently used buffers have usage_count decremented. Eventually the hand finds a cold unpinned slot. That slot can hold the incoming page after any required dirty writeback.',
        'Dirty buffers are pages that differ from disk. A transaction may have modified them, but the database does not immediately write every page to disk. WAL records protect recovery first; page writeback can happen later through backends, background writer, or checkpoint activity.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Clock sweep works because the buffer pool does not need exact recency to make useful decisions. A page touched repeatedly accumulates second chances. A one-time scan page receives little protection and eventually becomes replaceable.',
        'The policy is cheap enough for concurrent work. Instead of updating a global LRU structure on every page hit, PostgreSQL uses local descriptor state and scans when replacement is needed. That moves some work from every access to the less frequent victim-selection path.',
        'Pins preserve correctness. They turn "recently useful" and "currently in use" into separate concepts. A page can be cold but still pinned; replacement must wait.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine an OLTP workload repeatedly touching customer account pages while a dashboard query scans historical orders. The customer pages keep getting pinned and their usage_count remains positive. The dashboard scan brings in many pages that may be read once and never reused.',
        'As the clock hand moves, it skips active customer pages, decrements pages that recently proved useful, and eventually reuses cold scan pages. The policy is not perfect, but it usually protects the hot set without maintaining a precise global recency list.',
        'Now add writes. If many candidate victims are dirty, a foreground backend may have to write one before it can read the next page. That is where background writer and checkpoint tuning affect tail latency.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost of the policy is scanning and occasional extra passes when many buffers are pinned or have positive usage_count. In normal operation that is cheaper than exact LRU bookkeeping on every page access.',
        'The expensive moments are dirty victim writeback and checkpoint pressure. A clean victim is simple. A dirty victim may force I/O. If dirty pages pile up, the database can move from smooth background work to visible stalls.',
        'shared_buffers sizing, storage speed, checkpoint configuration, workload shape, and long-running transactions all change the observed behavior. The same clock-sweep algorithm can feel fast or painful depending on those surrounding conditions.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Clock sweep wins in a concurrent database because it gives a compact, low-contention approximation of cache value. It is good enough to protect pages with repeated use and simple enough to operate under heavy backend concurrency.',
        'It is especially useful in mixed workloads: hot indexes, hot account rows, occasional scans, background maintenance, and write traffic all sharing one finite memory budget.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It cannot defeat a working set that is much larger than memory. If the hot set does not fit, the clock hand will churn. It also cannot make slow storage fast when dirty writeback lands on the foreground path.',
        'Long pins can make replacement harder. Large scans can still disturb cache residency. Undersized shared_buffers can push too much work to the operating system cache. Oversized shared_buffers can make checkpoints and memory pressure harder to manage.',
        'Do not describe shared buffers as a hash map. The map is only the lookup structure. The real lesson is the combination of descriptors, pins, usage_count, dirty state, WAL ordering, and background writeback.',
      ],
    },
    {
      heading: 'Worked example (2)',
      paragraphs: [
        'An OLTP database has a hot customer table and a reporting query that scans old orders. Hot customer pages keep getting pinned and refreshed. The scan needs many buffer slots. The clock hand skips pinned descriptors, decrements usage_count on recently used pages, and eventually reuses cold pages.',
        'If the scan collides with many dirty pages, background writer and checkpoint behavior determine whether foreground backends wait on disk writes. The buffer pool lesson is not just caching; it is eviction plus durability.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: PostgreSQL pg_buffercache at https://www.postgresql.org/docs/current/pgbuffercache.html, PostgreSQL resource consumption settings at https://www.postgresql.org/docs/current/runtime-config-resource.html, PostgreSQL freelist.c source documentation at https://doxygen.postgresql.org/freelist_8c_source.html, and PostgreSQL WAL configuration at https://www.postgresql.org/docs/current/wal-configuration.html.',
        'Study PostgreSQL WAL Checkpoint & Recovery, Readahead & Dirty Writeback, Linux Page Cache XArray, Write Caching, MVCC Internals & VACUUM, and Database Indexing next.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
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
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why PostgreSQL Buffer Pool Clock Sweep moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

