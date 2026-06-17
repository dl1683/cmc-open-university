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
      heading: 'The problem',
      paragraphs: [
        'Linux uses spare RAM as cache because a page already in memory is much faster than a page that must be read from storage. Under pressure, that same cache becomes a battlefield: file cache, anonymous memory, dirty pages, mapped files, and cgroups all compete for one memory budget.',
        'The hard part is not evicting something. The hard part is evicting the right thing. A backup job may stream through millions of pages once. A database index may reuse a smaller set constantly. A policy that treats both as equally valuable turns one cold scan into a performance outage.',
      ],
    },
    {
      heading: 'Context',
      paragraphs: [
        'The page cache stores file-backed memory in units the kernel now often calls folios. Clean file-backed folios are cheap to reclaim because the backing store already has their contents. Dirty file pages need writeback first. Anonymous memory may need swap or may not be reclaimable at the moment.',
        'Classic reclaim separates active and inactive lists, and also separates file-backed from anonymous memory. Inactive pages are the first candidates. Active pages have earned protection through evidence of reuse. Newer reclaim designs such as Multi-Gen LRU refine the accounting, but the central question remains the same: which pages are part of the working set?',
      ],
    },
    {
      heading: 'The tempting bug',
      paragraphs: [
        'Least-recently-used is the obvious answer: keep what was touched recently and evict what was touched long ago. The bug is that a one-pass scan also looks recent while it is running. A tar, backup, analytics export, or crawler can drag cold pages through the cache and push useful pages out.',
        'Perfect LRU would also be too expensive on a hot kernel path. The kernel needs cheap evidence, not a timestamp update and global ordering decision on every memory access.',
      ],
    },
    {
      heading: 'Core insight and mechanism',
      paragraphs: [
        'Reclaim begins with candidates, usually from inactive lists. If a clean file-backed folio looks cold, the kernel can drop it and keep only enough metadata to recognize a later return. That metadata is a shadow entry.',
        'If the same page is touched again after eviction, the miss is a refault. The shadow entry lets the kernel estimate refault distance: roughly, how much cache turnover happened between eviction and return. A short distance means the page came back before the system had enough room to hold the real working set.',
        'That refault evidence can activate or protect the page. A page from a one-time scan should age out without a quick refault. A page from a hot index that returns immediately after eviction should be treated as evidence that reclaim cut too deep.',
      ],
    },
    {
      heading: 'Why shadows matter',
      paragraphs: [
        'Without a shadow entry, eviction erases history. A later miss would look like any other cold first access. The kernel would know that I/O happened, but not that the same page had just been evicted under pressure.',
        'A shadow entry is cheaper than keeping the page itself. It is a compact memory of absence: the page is gone, but the system can still recognize that it was here recently and measure the distance to its return.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a host running a database and a nightly backup. The database repeatedly reads a file-backed index. The backup streams a large directory tree once. Both create page-cache activity, but only the index has repeated value.',
        'As the backup runs, scan pages enter the inactive file list. Under pressure, many of them should be dropped cleanly. If they never refault quickly, the policy has no reason to protect them.',
        'If database index pages are evicted and then fault back in almost immediately, their shadow entries produce short refault distances. That is evidence that those pages belonged to the working set and should get more protection than the backup stream.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the refault-path view, follow a single file folio. It enters cache, sits on the inactive side, is evicted under pressure, leaves a shadow entry, and later returns as a refault. The policy decision at the end is about whether that return happened soon enough to prove working-set membership.',
        'In the pressure-policy view, compare clean file pages, dirty pages, anonymous pages, and active pages. They do not have the same reclaim cost. The matrix frames reclaim as a budget decision, not a simple cache-hit trick.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The method works because reuse after eviction is stronger evidence than mere recent access during a scan. A streaming workload can make pages recent, but it usually cannot make them refault quickly after they are dropped.',
        'The policy is also cheap enough to run continuously. It uses list placement, scanned distance, shadow metadata, and refault observations instead of maintaining a perfect global LRU order.',
        'The result is scan resistance. Cold one-pass data can pass through memory, while pages that demonstrate short-distance reuse can fight their way back into protection.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'The cost is bookkeeping in a path that already runs under pressure. Lists, generations, shadow entries, writeback state, and reclaim scanning all consume CPU and memory. Too little accounting misses the working set. Too much accounting steals time from applications.',
        'File and anonymous memory also compete differently. Dropping a clean file page is cheap. Reclaiming dirty file pages can require writeback. Reclaiming anonymous pages may require swap, migration, or waiting. The policy has to balance these costs rather than treating all pages as identical cache entries.',
        'Cgroups add another layer. A workload can thrash inside its own memory limit even when the machine has free memory elsewhere. The relevant working set is often per lruvec or memory domain, not just system-wide.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Look for refaults together with major faults, read I/O, reclaim CPU, and pressure stall information. A rising cache-miss graph alone is not enough; the story changes depending on whether pages return quickly, block on disk, or force kswapd to burn CPU.',
        'Kernel counters such as workingset refault and activation counters can show churn in the page cache. Application latency tells whether that churn matters. A backup that causes refault storms in a database has crossed from harmless scan traffic into working-set damage.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure mode is simple undersizing. If the true working set is larger than RAM or a cgroup limit, the kernel can identify the pain but cannot make the data fit. Refaults stay frequent because every good choice still evicts another needed page.',
        'The second failure mode is dirty or writeback-heavy pressure. Clean file pages are cheap to drop. Dirty pages can block on storage. A reclaim policy cannot make slow writeback free.',
        'The third failure mode is treating cache dropping as a fix. `drop_caches` can reset a demo, but production health comes from sizing, isolation, scan scheduling, writeback control, and access-pattern changes.',
      ],
    },
    {
      heading: 'Practical use',
      paragraphs: [
        'For production systems, start by naming the working set that must fit: a database index, model files, hot media chunks, package metadata, or a search shard. Then identify scan workloads that should not be allowed to evict it: backups, crawlers, compactions, analytics exports, or large sequential reads.',
        'Mitigations include more memory, smaller working sets, cgroup isolation, scan throttling, scheduling scans away from peak traffic, using access hints where appropriate, and monitoring refaults alongside latency. The kernel policy helps, but it is not a substitute for workload design.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Linux Multi-Gen LRU docs at https://docs.kernel.org/mm/multigen_lru.html, VM sysctl docs at https://docs.kernel.org/admin-guide/sysctl/vm.html, and Linux `mm/workingset.c` source at https://github.com/torvalds/linux/blob/master/mm/workingset.c.',
        'Then study Linux Page Cache XArray, Readahead & Dirty Writeback, LRU Cache, W-TinyLFU Cache Admission, Tail Latency & p99 Thinking, PostgreSQL Buffer Pool Clock Sweep, and Cache Invalidation & Versioning. Workingset reclaim is where cache theory meets storage, scheduling, and production latency.',
      ],
    },
  ],
};
