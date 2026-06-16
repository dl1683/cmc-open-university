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
      heading: 'What it is',
      paragraphs: [
        'PostgreSQL shared buffers are the database-level page cache. They store relation pages plus buffer descriptors with state such as tag, reference count, usage_count, dirty status, and lock state. Victim selection uses a clock-sweep style approximation rather than a perfect LRU list.',
        'The PostgreSQL pg_buffercache extension documents real-time inspection of shared buffer cache state: https://www.postgresql.org/docs/current/pgbuffercache.html. PostgreSQL source documentation for freelist.c describes the clock sweep hand and usage_count victim logic: https://doxygen.postgresql.org/freelist_8c_source.html.',
      ],
    },
    {
      heading: 'Core mental model',
      paragraphs: [
        'The data structure is a circular array of buffer descriptors. A backend pins a buffer while using it. The clock hand considers descriptors in order. Pinned pages cannot be reused. Pages with usage_count get another chance. A cold unpinned page becomes a victim.',
        'Dirty pages add a second dimension. Evicting a clean victim is cheap. Evicting a dirty victim requires writeback, and that writeback must respect WAL durability ordering.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'An OLTP database has a hot customer table and a reporting query that scans old orders. Hot customer pages keep getting pinned and refreshed. The scan needs many buffer slots. The clock hand skips pinned descriptors, decrements usage_count on recently used pages, and eventually reuses cold pages.',
        'If the scan collides with many dirty pages, background writer and checkpoint behavior determine whether foreground backends wait on disk writes. The buffer pool lesson is not just caching; it is eviction plus durability.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not describe shared_buffers as a simple hash map. The lookup table finds descriptors, but replacement depends on pin counts, usage_count, dirty state, and concurrent locks.',
        'Do not treat cache hits as free forever. A page can be hot for reads, dirty from writes, pinned by an active backend, or expensive to evict because WAL and writeback ordering matter.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL pg_buffercache at https://www.postgresql.org/docs/current/pgbuffercache.html, PostgreSQL resource consumption settings at https://www.postgresql.org/docs/current/runtime-config-resource.html, PostgreSQL freelist.c source documentation at https://doxygen.postgresql.org/freelist_8c_source.html, and PostgreSQL WAL configuration at https://www.postgresql.org/docs/current/wal-configuration.html.',
        'Study PostgreSQL WAL Checkpoint & Recovery, Readahead & Dirty Writeback, Linux Page Cache XArray, Write Caching, MVCC Internals & VACUUM, and Database Indexing next.',
      ],
    },
  ],
};
