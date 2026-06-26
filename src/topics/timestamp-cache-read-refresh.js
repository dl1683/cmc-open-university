// Timestamp cache and read refresh: the optimistic serializability machinery
// around HLC/MVCC timestamps in CockroachDB-style transaction layers.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'timestamp-cache-read-refresh',
  title: 'Timestamp Cache & Read Refresh',
  category: 'Systems',
  summary: 'A CockroachDB-style serializability data structure: cache read high-water marks, push conflicting writes forward, and refresh read spans before committing at a later timestamp.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['timestamp cache', 'read refresh'], defaultValue: 'timestamp cache' },
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

function cacheGraph(title) {
  return graphState({
    nodes: [
      { id: 'reader', label: 'reader', x: 0.8, y: 3.6, note: 'read @50' },
      { id: 'span', label: 'span', x: 2.8, y: 2.0, note: 'key/range' },
      { id: 'cache', label: 'cache', x: 2.8, y: 5.2, note: 'high water' },
      { id: 'writer', label: 'writer', x: 5.0, y: 2.0, note: 'write @40' },
      { id: 'push', label: 'push', x: 6.8, y: 2.0, note: 'to >50' },
      { id: 'refresh', label: 'refresh', x: 6.8, y: 5.2, note: 'read set' },
      { id: 'commit', label: 'commit', x: 8.8, y: 3.6, note: 'or retry' },
    ],
    edges: [
      { id: 'e-reader-span', from: 'reader', to: 'span', weight: 'read' },
      { id: 'e-span-cache', from: 'span', to: 'cache', weight: 'record' },
      { id: 'e-writer-span', from: 'writer', to: 'span', weight: 'touches' },
      { id: 'e-cache-push', from: 'cache', to: 'push', weight: 'floor' },
      { id: 'e-push-commit', from: 'push', to: 'commit', weight: 'later ts' },
      { id: 'e-cache-refresh', from: 'cache', to: 'refresh', weight: 'spans' },
      { id: 'e-refresh-commit', from: 'refresh', to: 'commit', weight: 'valid?' },
    ],
  }, { title });
}

function* timestampCache() {
  const readTs = 50;
  const writeTs = 40;
  const rangeReadTs = 80;
  const txnCount = 2;
  const entryTypes = ['point', 'range', 'low water', 'eviction'];

  yield {
    state: cacheGraph('A read leaves a high-water mark in the timestamp cache'),
    highlight: { active: ['reader', 'span', 'cache', 'e-reader-span', 'e-span-cache'], compare: ['writer'] },
    explanation: `When a transaction reads a key or span at timestamp ${readTs}, the leaseholder records that timestamp in a cache. Later writers touching that span must be ordered after ts ${readTs}.`,
    invariant: `A read at ts ${readTs} is not only a returned value; it is a constraint on every future write to that span.`,
  };

  yield {
    state: labelMatrix(
      'Cache entries are high-water marks',
      [
        { id: 'point', label: 'key /users/7' },
        { id: 'range', label: 'span /acct/10..20' },
        { id: 'low', label: 'low water' },
        { id: 'evict', label: 'eviction' },
      ],
      [
        { id: 'stored', label: 'stored' },
        { id: 'effect' },
      ],
      [
        ['read at 50', 'writers below 50 pushed'],
        ['read at 80', 'range writes pushed'],
        ['oldest retained', 'safe conservative floor'],
        ['old entries drop', 'cache stays bounded'],
      ],
    ),
    highlight: { found: ['point:effect', 'range:effect'], compare: ['evict:effect'] },
    explanation: `The cache tracks ${entryTypes.length} entry types. A point read at ts ${readTs} pushes writers below ${readTs}; a range read at ts ${rangeReadTs} pushes range writes below ${rangeReadTs}. Old entries are evicted to keep the cache bounded.`,
  };

  yield {
    state: cacheGraph('A writer below the read high-water mark is pushed forward'),
    highlight: { active: ['writer', 'cache', 'push', 'e-writer-span', 'e-cache-push'], found: ['commit'] },
    explanation: `If a writer wants to write at timestamp ${writeTs} but the cache says that span was read at ${readTs}, the writer cannot commit at ${writeTs}. It is pushed to a timestamp after ${readTs}, preserving serial order.`,
    invariant: `Read at ts ${readTs} before write at ts ${writeTs} becomes: write timestamp must exceed ${readTs}.`,
  };

  yield {
    state: labelMatrix(
      'Why this prevents write skew',
      [
        { id: 't1', label: 'T1 reads doctors' },
        { id: 't2', label: 'T2 reads doctors' },
        { id: 'w1', label: 'T1 writes off-call' },
        { id: 'w2', label: 'T2 writes off-call' },
      ],
      [
        { id: 'cache', label: 'cache role' },
        { id: 'result' },
      ],
      [
        ['records span read', 'future writes ordered'],
        ['records span read', 'future writes ordered'],
        ['touches read span', 'timestamp push'],
        ['touches read span', 'refresh or retry'],
      ],
    ),
    highlight: { active: ['w1:result', 'w2:result'], found: ['t1:cache', 't2:cache'] },
    explanation: `Serializable isolation needs read-write conflict tracking across ${txnCount} concurrent transactions. The timestamp cache turns reads into remembered constraints so a later write cannot sneak into the past and make both T1 and T2 look valid.`,
  };
}

function* readRefresh() {
  const originalTs = 50;
  const commitTs = 90;
  const interveningWriteTs = 70;
  const refreshInterval = `${originalTs}..${commitTs}`;
  const components = ['HLC', 'MVCC', 'timestamp cache', 'read refresh'];

  yield {
    state: cacheGraph('A pushed transaction can sometimes refresh instead of restarting'),
    highlight: { active: ['push', 'refresh', 'commit', 'e-cache-refresh', 'e-refresh-commit'], compare: ['writer'] },
    explanation: `If a transaction read at ts ${originalTs} but must commit at ts ${commitTs}, the system re-checks the read spans over the interval ${refreshInterval}. If nothing changed, the transaction can still commit.`,
    invariant: `Refresh asks: are the reads from ts ${originalTs} still valid at ts ${commitTs}?`,
  };

  yield {
    state: labelMatrix(
      'Read-refresh decision',
      [
        { id: 'read', label: 'read set' },
        { id: 'push', label: 'timestamp pushed' },
        { id: 'clean', label: 'refresh clean' },
        { id: 'dirty', label: 'refresh dirty' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'decision' },
      ],
      [
        ['keys and spans read at 50', 'remembered'],
        ['commit at 90', 'needs validation'],
        ['no writes 50..90', 'commit at 90'],
        ['write found 50..90', 'retry transaction'],
      ],
    ),
    highlight: { found: ['clean:decision'], removed: ['dirty:decision'], active: ['push:decision'] },
    explanation: `Read refresh is optimistic. It scans the interval ${refreshInterval} for conflicting writes. If no writes landed in that ${commitTs - originalTs}-timestamp window, the transaction commits at ts ${commitTs} without a full restart.`,
  };

  yield {
    state: labelMatrix(
      'Case study: inventory and order',
      [
        { id: 'start', label: 'T1 reads stock' },
        { id: 'other', label: 'T2 updates stock' },
        { id: 'push', label: 'T1 pushed later' },
        { id: 'refresh', label: 'T1 refreshes stock' },
      ],
      [
        { id: 'time', label: 'time' },
        { id: 'effect' },
      ],
      [
        ['ts 50', 'stock looked available'],
        ['ts 70', 'stock changed'],
        ['commit ts 90', 'old read suspect'],
        ['sees ts 70 write', 'retry required'],
      ],
    ),
    highlight: { active: ['other:effect', 'refresh:effect'], removed: ['push:effect'] },
    explanation: `T1 read stock at ts ${originalTs}, but T2 updated stock at ts ${interveningWriteTs}. When T1 tries to commit at ts ${commitTs}, refresh finds the ts ${interveningWriteTs} write in the interval ${refreshInterval} and forces a retry.`,
  };

  yield {
    state: labelMatrix(
      'Where the machinery lives',
      [
        { id: 'hlc', label: 'HLC' },
        { id: 'mvcc', label: 'MVCC' },
        { id: 'cache', label: 'timestamp cache' },
        { id: 'refresh', label: 'read refresh' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'failureMode' },
      ],
      [
        ['assigns comparable time', 'clock skew window'],
        ['stores versions', 'old version cleanup'],
        ['remembers read floors', 'pushes writers'],
        ['validates old reads', 'retry if changed'],
      ],
    ),
    highlight: { found: ['cache:role', 'refresh:role'], compare: ['hlc:failureMode'] },
    explanation: `The serializability stack has ${components.length} components: ${components.join(', ')}. Each solves one part — HLC creates timestamps, MVCC stores versions, the cache preserves read-write ordering, and refresh validates pushed transactions.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'timestamp cache') yield* timestampCache();
  else if (view === 'read refresh') yield* readRefresh();
  else throw new InputError('Pick a timestamp-cache view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: ['Read the animation as serializability repair with timestamps. Serializability means concurrent transactions behave like some one-at-a-time order. The timestamp cache records reads, and refresh checks whether a pushed transaction still read valid facts.', {type: 'image', src: './assets/gifs/timestamp-cache-read-refresh.gif', alt: 'Animated walkthrough of the timestamp cache read refresh visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: ['MVCC databases store versions at timestamps, so a write must not sneak before a read that already observed the old value. A transaction pushed to a later timestamp also must not commit with stale reads. The cache and refresh turn both problems into explicit proof obligations.', {type: 'callout', text: 'Timestamp cache entries turn served reads into future write constraints, and refresh turns a pushed timestamp into a proof obligation instead of an automatic abort.'},], },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is locking every key or range read until commit. That preserves order but blocks heavily in distributed systems. Checking only at commit is cheaper but can forget that a read already escaped to a client.'], },
    { heading: 'The wall', paragraphs: ['Reads create dependencies even when they do not write. A missing-row check is a span dependency because a concurrent insert inside that span can change the answer. A pushed timestamp creates a second dependency: earlier reads must still be true at the later time.'], },
    { heading: 'The core insight', paragraphs: ['Record read high-water marks and recheck read sets when timestamps move. If a span was read at time 100, overlapping writes must happen after 100. If a transaction read at 50 and commits at 90, every read must be unchanged across that interval.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Serialization constraints form a directed dependency graph: read-before-write edges must not be reversed by timestamp movement. Source: Wikimedia Commons, David W., public domain: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},], },
    { heading: 'How it works', paragraphs: ['Serving a read inserts a timestamp-cache entry for the key or span. A later overlapping write below that timestamp gets pushed above the read. A pushed transaction refreshes by checking MVCC versions for each recorded read dependency between the old and new timestamps.'], },
    { heading: 'Why it works', paragraphs: ['The timestamp cache preserves read-before-write edges in timestamp order. Read refresh is observational equivalence: if every value visible at the old timestamp is still visible at the new timestamp, the transaction could have read at the new timestamp all along. If any dependency changed, retry is required.'], },
    { heading: 'Cost and complexity', paragraphs: ['The cache costs memory and overlap lookup for recent read spans. Refresh costs a pass over the transaction read set, so 5 keys are cheap and 2 million scanned rows are not. Coarse spans reduce metadata but create false pushes.'], },
    { heading: 'Real-world uses', paragraphs: ['Distributed SQL systems use this pattern to keep serializable isolation with less blocking than read locks. It is useful for configuration reads, metadata reads, uniqueness checks, and small index spans that often remain stable despite timestamp pushes.'], },
    { heading: 'Where it fails', paragraphs: ['It fails when the read set is incomplete, especially for absence checks and predicates. It also performs poorly on hot ranges where refresh usually fails after doing work. Client transaction bodies still need retry-safe behavior because refresh can reject a commit.'], },
    { heading: 'Worked example', paragraphs: ['R reads account A at timestamp 50 and sees balance 100. A write to A at timestamp 40 arrives later, but the cache pushes it above 50 because it cannot serialize before the served read.', 'T reads B = 7 at timestamp 60 and is pushed to commit at 90. If B stayed 7 from 60 to 90, refresh succeeds. If B changed to 8 at 75, refresh fails and T retries.'], },
    { heading: 'Sources and study next', paragraphs: ['Study CockroachDB transaction docs, MVCC, serializable isolation, snapshot isolation, optimistic concurrency control, hybrid logical clocks, and predicate locking. Then test read-before-write, missing-row insert, refresh success, and refresh failure histories.'], },
  ],
};
