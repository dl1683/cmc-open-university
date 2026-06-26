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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation follows Linux memory reclaim, which is the process of freeing memory under pressure. A working set is the data a workload will reuse soon enough that evicting it causes painful misses, and a refault is a page fault for data that was recently evicted. Active nodes show the current reclaim decision; found nodes show evidence that a page came back quickly after eviction.',
        {type: 'callout', text: 'Workingset reclaim protects data that proves reuse after eviction, not data that only looked recent during a scan.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/88/Lruexample.png', alt: 'Diagram of LRU cache replacement steps across a short access sequence', caption: 'LRU cache example showing eviction by recent use; Linux refault logic adds shadow evidence to resist one-pass scans. Advaitjavadekar, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Linux uses spare RAM as cache, but that cache must shrink when applications need memory. The kernel must choose between clean file pages, dirty file pages, anonymous memory, and mapped data under one budget. Workingset refault logic exists because recent access alone is weak evidence when a one-pass scan can make cold data look hot.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is least-recently-used, usually shortened to LRU. Keep recently touched pages and evict older pages. This is reasonable because many programs reuse data soon after touching it, and old untouched data is often safe to drop.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is scan pollution. A backup, crawler, or analytics export can stream through millions of pages once and make them all look recent while it runs. If the cache follows raw recency, that scan evicts a smaller database index that is reused constantly.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to keep evidence of absence. When a clean file-backed folio is evicted, the kernel can leave a compact shadow entry that remembers enough to recognize a quick return. If the same data refaults after little cache turnover, that short distance is evidence that reclaim cut into the true working set.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Reclaim scans candidate folios from inactive lists and drops clean file-backed folios when they look cold. Instead of forgetting them completely, it records a shadow entry with eviction-time information. On a later page-cache miss, the kernel checks whether the miss matches a shadow entry and estimates how much memory pressure occurred between eviction and return.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is not that refault logic predicts the future perfectly. It preserves a better invariant: a page earns protection from observed reuse after eviction, not from passing through memory once. One-pass scans usually do not refault quickly, while a hot index that was evicted too aggressively returns soon enough to trigger activation or protection.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is extra bookkeeping on a path that already runs during memory pressure. Shadow entries use less memory than resident folios, but they still consume metadata, and reclaim scans still burn CPU. Doubling the scan workload can double pressure on inactive lists, while a true working set larger than RAM keeps refaults high no matter how good the policy is.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This matters on database hosts, build machines, search nodes, media servers, and container platforms where useful hot data competes with large scans. It helps separate a nightly backup from a working index, or a one-time grep from repeatedly mapped libraries. The pattern is also visible in cache admission policies: do not protect data until it proves reuse.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Workingset refault logic cannot make too little memory behave like enough memory. If the active database index is 200 GB and the cgroup limit is 80 GB, every policy will evict useful data. It also struggles when dirty writeback is the bottleneck, because identifying a victim does not make storage flush faster.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A host has 64 GB of RAM, a database index with a 20 GB hot file-backed working set, and a backup that scans 200 GB once. During the scan, inactive backup pages enter cache and then get dropped; most never refault, so they do not earn protection. If 2 GB of index pages are evicted and refault after only 4 GB of cache turnover, that short distance says the system was missing about 2 GB of room for useful data.',
        'The operational consequence is concrete. If database p99 latency rises from 20 ms to 180 ms during the backup while workingset refault counters spike, the backup is damaging the cache budget. The fix may be more memory, a lower cgroup limit for the backup, scan scheduling, access hints, or storage isolation, not a call to drop caches.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Linux mm/workingset.c, Linux Multi-Gen LRU documentation, and Linux VM sysctl documentation. Then study page cache XArray, dirty writeback, LRU cache, W-TinyLFU admission, pressure stall information, cgroup memory control, PostgreSQL buffer-pool eviction, and tail latency. The useful exercise is to correlate refault counters with major faults, read I/O, reclaim CPU, and application p99 latency.',
      ],
    },
  ],
};