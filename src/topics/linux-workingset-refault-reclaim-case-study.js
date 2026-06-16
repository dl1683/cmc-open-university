// Linux workingset reclaim: active/inactive page lists, shadow entries, refault
// distance, and the policy question of what belongs in memory under pressure.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'linux-workingset-refault-reclaim-case-study',
  title: 'Linux Workingset Refault & Reclaim',
  category: 'Systems',
  summary: 'How page reclaim uses active/inactive lists, shadow entries, refault distance, scan resistance, and working-set detection under memory pressure.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['refault path', 'pressure policy'], defaultValue: 'refault path' },
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

function reclaimGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'app', label: 'app', x: 0.7, y: 4.6, note: notes.app ?? 'file read' },
      { id: 'cache', label: 'cache', x: 2.2, y: 4.6, note: notes.cache ?? 'folio' },
      { id: 'inactive', label: 'inact', x: 3.8, y: 6.2, note: notes.inactive ?? 'cold list' },
      { id: 'active', label: 'active', x: 3.8, y: 2.8, note: notes.active ?? 'protected' },
      { id: 'shadow', label: 'shadow', x: 5.6, y: 6.2, note: notes.shadow ?? 'evicted id' },
      { id: 'disk', label: 'disk', x: 5.6, y: 3.0, note: notes.disk ?? 'backing' },
      { id: 'refault', label: 'refault', x: 7.2, y: 4.6, note: notes.refault ?? 'miss again' },
      { id: 'policy', label: 'policy', x: 8.8, y: 4.6, note: notes.policy ?? 'promote?' },
    ],
    edges: [
      { id: 'e-app-cache', from: 'app', to: 'cache', weight: '' },
      { id: 'e-cache-inactive', from: 'cache', to: 'inactive', weight: '' },
      { id: 'e-cache-active', from: 'cache', to: 'active', weight: '' },
      { id: 'e-inactive-shadow', from: 'inactive', to: 'shadow', weight: '' },
      { id: 'e-inactive-disk', from: 'inactive', to: 'disk', weight: '' },
      { id: 'e-disk-refault', from: 'disk', to: 'refault', weight: '' },
      { id: 'e-shadow-refault', from: 'shadow', to: 'refault', weight: '' },
      { id: 'e-refault-policy', from: 'refault', to: 'policy', weight: '' },
      { id: 'e-policy-active', from: 'policy', to: 'active', weight: '' },
    ],
  }, { title });
}

function* refaultPath() {
  yield {
    state: reclaimGraph('A file folio enters the inactive list first'),
    highlight: { active: ['app', 'cache', 'inactive', 'e-app-cache', 'e-cache-inactive'], compare: ['active'] },
    explanation: 'Linux cannot afford perfect LRU accounting on every access. A file folio usually starts on an inactive list. A later reference or refault is evidence it may belong to the working set.',
    invariant: 'Reclaim protects evidence of reuse, not every page ever touched.',
  };

  yield {
    state: reclaimGraph('Memory pressure scans inactive pages first', { inactive: 'scan tail', shadow: 'record', disk: 'clean drop' }),
    highlight: { active: ['inactive', 'shadow', 'disk', 'e-inactive-shadow', 'e-inactive-disk'], compare: ['active'] },
    explanation: 'Under pressure, reclaim prefers inactive pages. When a clean page is evicted, the kernel can leave a shadow entry behind instead of forgetting that the page ever existed.',
  };

  yield {
    state: reclaimGraph('A later miss finds the shadow entry and becomes a refault', { app: 'read again', disk: 'I/O', shadow: 'old slot', refault: 'distance' }),
    highlight: { active: ['app', 'disk', 'shadow', 'refault', 'e-disk-refault', 'e-shadow-refault'], found: ['inactive'] },
    explanation: 'If the same page is needed again, the cache miss is a refault. The shadow entry lets the kernel estimate how much cache turnover happened since eviction.',
  };

  yield {
    state: labelMatrix(
      'Refault decision',
      [
        { id: 'short', label: 'short dist' },
        { id: 'long', label: 'long dist' },
        { id: 'scan', label: 'one scan' },
        { id: 'hot', label: 'hot set' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'action', label: 'action' },
      ],
      [
        ['quick return', 'activate'],
        ['cold return', 'stay cold'],
        ['no reuse', 'evict'],
        ['reused', 'protect'],
      ],
    ),
    highlight: { active: ['short:action', 'hot:action'], compare: ['scan:action'] },
    explanation: 'Refault distance is a scan-resistance tool. A page that returns quickly after eviction looks like working-set data. A one-time streaming scan should not displace established hot pages.',
  };

  yield {
    state: reclaimGraph('The complete case is a hot index plus a cold backup scan', { app: 'backup', cache: 'mixed', inactive: 'stream pages', active: 'index pages', refault: 'index miss', policy: 'protect' }),
    highlight: { active: ['active', 'inactive', 'shadow', 'refault', 'policy', 'e-policy-active'], found: ['app'] },
    explanation: 'A backup process scans a huge file tree while a database index is hot. Shadow/refault evidence helps the kernel avoid letting the cold scan evict the index working set permanently.',
  };
}

function* pressurePolicy() {
  yield {
    state: labelMatrix(
      'LRU families',
      [
        { id: 'fileAct', label: 'file act' },
        { id: 'fileIn', label: 'file inact' },
        { id: 'anonAct', label: 'anon act' },
        { id: 'anonIn', label: 'anon inact' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'pressure', label: 'pressure' },
      ],
      [
        ['hot file', 'protect'],
        ['cold file', 'scan'],
        ['hot anon', 'protect'],
        ['cold anon', 'swap?'],
      ],
    ),
    highlight: { active: ['fileIn:pressure', 'anonIn:pressure'], found: ['fileAct:pressure'] },
    explanation: 'Classic reclaim separates file-backed and anonymous pages, and separates active from inactive. The split lets the kernel scan colder candidates before challenging protected working-set pages.',
    invariant: 'The page cache competes with anonymous memory under one memory budget.',
  };

  yield {
    state: reclaimGraph('Clean file pages are the cheapest reclaim target', { cache: 'clean folio', inactive: 'candidate', disk: 'already same', policy: 'drop ok' }),
    highlight: { active: ['cache', 'inactive', 'disk', 'policy', 'e-cache-inactive', 'e-inactive-disk'], compare: ['active'] },
    explanation: 'Clean page-cache folios can be discarded because the disk already has their contents. Dirty pages require writeback first; anonymous pages may require swap or cannot be reclaimed immediately.',
  };

  yield {
    state: reclaimGraph('A scan workload should die in inactive, not poison active', { app: 'tar scan', cache: 'new pages', inactive: 'age out', shadow: 'no quick refault', policy: 'do not promote' }),
    highlight: { active: ['app', 'cache', 'inactive', 'shadow', 'policy'], removed: ['active'] },
    explanation: 'The desirable behavior for a one-pass scan is boring: pages enter inactive, are read once, and disappear. If they never refault quickly, they should not evict genuinely reused data.',
  };

  yield {
    state: reclaimGraph('A working set larger than memory will thrash', { active: 'too small', inactive: 'cycling', shadow: 'many shadows', refault: 'frequent', policy: 'pressure' }),
    highlight: { active: ['active', 'inactive', 'shadow', 'refault', 'policy'], compare: ['disk'] },
    explanation: 'If the working set is bigger than RAM or cgroup memory, refaults become frequent. The policy can identify thrash, but it cannot make insufficient memory disappear.',
  };

  yield {
    state: labelMatrix(
      'Operational signals',
      [
        { id: 'refaults', label: 'refaults' },
        { id: 'majflt', label: 'maj faults' },
        { id: 'kswapd', label: 'kswapd' },
        { id: 'io', label: 'read I/O' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['cache churn', 'more RAM'],
        ['disk waits', 'reduce set'],
        ['reclaim CPU', 'limit scans'],
        ['miss storm', 'prefetch/cache'],
      ],
    ),
    highlight: { active: ['refaults:means', 'majflt:fix'], compare: ['kswapd:means'] },
    explanation: 'The complete production read is not just cache hit rate. Refaults, major faults, kswapd CPU, and read I/O together show when the cache is too small or the access pattern is too scan-heavy.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'refault path') yield* refaultPath();
  else if (view === 'pressure policy') yield* pressurePolicy();
  else throw new InputError('Pick a workingset view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Linux reclaim decides which memory stays hot and which cached pages can be evicted. For file pages, shadow entries and refault distance help distinguish a true working set from a one-pass scan.',
        'The Multi-Gen LRU documentation summarizes the importance of reclaim: it directly affects cache policy, overcommit behavior, kswapd CPU usage, and RAM efficiency: https://docs.kernel.org/mm/multigen_lru.html.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'Classic reclaim uses active and inactive LRU-style lists for file-backed and anonymous pages. Inactive pages are cheaper candidates. Active pages are protected until evidence says they should be challenged.',
        'A shadow entry is a nonresident memory of an evicted page-cache entry. If the page refaults, the kernel can estimate refault distance and decide whether the page was evicted despite belonging to the working set.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A database uses a hot file-backed index while a backup job performs a one-pass scan over cold files. The scan should pass through inactive lists and vanish. If hot index pages refault quickly, shadow entries reveal that they were wrongly evicted and should be promoted/protected.',
        'When the working set exceeds the memory budget, refaults become frequent no matter how smart the policy is. The operational answer is smaller working sets, different scan scheduling, a larger cache budget, or workload isolation.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The page cache is not plain LRU. Dirty state, active/inactive protection, file versus anonymous memory, cgroups, writeback, shadow entries, and newer multi-generation policies all shape reclaim.',
        'Dropping caches can make demos look clean, but it is not a production fix for memory pressure. The right question is which working set should fit and which scans should be isolated or throttled.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux Multi-Gen LRU docs at https://docs.kernel.org/mm/multigen_lru.html, VM sysctl docs at https://docs.kernel.org/admin-guide/sysctl/vm.html, and Linux mm/workingset.c source at https://github.com/torvalds/linux/blob/master/mm/workingset.c. Study Linux Page Cache XArray, Readahead & Dirty Writeback, LRU Cache, W-TinyLFU Cache Admission, Tail Latency, PostgreSQL Buffer Pool Clock Sweep, and Cache Invalidation & Versioning next.',
      ],
    },
  ],
};
