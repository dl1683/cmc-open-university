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
  yield {
    state: cacheGraph('A read leaves a high-water mark in the timestamp cache'),
    highlight: { active: ['reader', 'span', 'cache', 'e-reader-span', 'e-span-cache'], compare: ['writer'] },
    explanation: 'When a transaction reads a key or span, the leaseholder records the read timestamp in a timestamp cache. Later writers touching that span must be ordered after that read.',
    invariant: 'A read is not only a returned value; it is a constraint on future writes.',
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
    explanation: 'The cache does not need to remember every read forever. It keeps enough high-water information to push writes that would otherwise appear before reads that already happened.',
  };

  yield {
    state: cacheGraph('A writer below the read high-water mark is pushed forward'),
    highlight: { active: ['writer', 'cache', 'push', 'e-writer-span', 'e-cache-push'], found: ['commit'] },
    explanation: 'If a writer wants to write at timestamp 40 but the cache says that span was read at 50, the writer cannot commit at 40. It is pushed to a timestamp after the read, preserving a serial order.',
    invariant: 'Read-before-write becomes timestamp-before-timestamp.',
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
    explanation: 'Serializable isolation needs read-write conflict tracking. A timestamp cache turns reads into remembered constraints so a later write cannot sneak into the past and make both transactions look valid.',
  };
}

function* readRefresh() {
  yield {
    state: cacheGraph('A pushed transaction can sometimes refresh instead of restarting'),
    highlight: { active: ['push', 'refresh', 'commit', 'e-cache-refresh', 'e-refresh-commit'], compare: ['writer'] },
    explanation: 'If a transaction has to commit at a later timestamp than it originally read at, the system can re-check the read spans. If nothing changed in the interval, the transaction can still commit.',
    invariant: 'Refresh asks: are the reads from old timestamp still valid at the new timestamp?',
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
    explanation: 'Read refresh is optimistic. It avoids needless full restarts when a timestamp push did not actually invalidate the data the transaction read.',
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
    explanation: 'The transaction cannot place the order based on the old stock read once it is committing after a stock change. Refresh catches that the earlier read is stale and forces a retry.',
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
    explanation: 'The pieces are separate. HLC creates timestamps, MVCC stores versions, timestamp cache preserves read-write ordering, and read refresh decides whether a pushed transaction can safely commit.',
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
    {
      heading: 'Why this exists',
      paragraphs: [
        'Serializable databases must make concurrent transactions look as if they ran one at a time. In an MVCC system, reads and writes carry timestamps, so the problem becomes concrete: a write must not sneak into the past before a read that already happened, and a transaction pushed to a later timestamp must not commit using stale facts.',
        'The timestamp cache and read refresh solve those two parts of the problem. The timestamp cache remembers recent read constraints so conflicting writes are forced later. Read refresh rechecks a transaction reads when its commit timestamp moves forward, allowing safe commits without restarting every transaction that was merely delayed.',
        {type: 'callout', text: 'Timestamp cache entries turn served reads into future write constraints, and refresh turns a pushed timestamp into a proof obligation instead of an automatic abort.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to lock every key or range that any transaction reads until the transaction finishes. That can work, but it harms concurrency and creates painful blocking in distributed systems where range ownership, network delay, and long read-only transactions are common.',
        'Another tempting approach is to let timestamps sort everything out at commit time. That fails when a write chooses an old timestamp after a read has already observed the old value. Without remembered read evidence, the system can accept a history that violates the serial order it promised.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A timestamp cache records read high-water marks for keys or spans. If a transaction read span S at timestamp 100, a later writer that wants to write S at timestamp 80 must be pushed above 100. The read happened first in real execution, so the write cannot be serialized before it.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Serialization constraints form a directed dependency graph: read-before-write edges must not be reversed by timestamp movement. Source: Wikimedia Commons, David W., public domain: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Read refresh handles the opposite pressure. If a transaction originally read at timestamp 50 but gets pushed to commit at timestamp 90, its earlier reads may no longer be valid. Instead of aborting immediately, the system checks whether any read key or span changed between 50 and 90. No change means the transaction can safely commit at the later timestamp.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When a leaseholder serves a read, it inserts or updates timestamp-cache entries for the key or range that was read. Point reads protect individual keys. Predicate reads, missing-key checks, and scans protect spans, because a future inserted key inside the span could invalidate the read result.',
        'When a write arrives, the concurrency layer checks whether its target overlaps a timestamp-cache entry with a higher read timestamp. If so, the write timestamp is pushed above that read. The write can still happen, but not at a logical time that would make the earlier read wrong.',
        'When a transaction timestamp is pushed forward, the transaction attempts a refresh. It revalidates its read set at the new timestamp. If every previously read value is still the value that would be visible at the new timestamp, the transaction can commit. If a relevant value or span changed, the transaction must retry with a fresh read view.',
        'The read set is therefore a first-class artifact. The system must remember not only values returned to the application, but also spans that were scanned, absence checks that were trusted, and index ranges that made a predicate true or false. Refresh can only be as correct as that recorded dependency set.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The timestamp-cache view proves that a read leaves evidence behind. It is not just a value returned to a client. It becomes a constraint on future writes that overlap the same key or span. The write push is the system preserving a serial order that matches already served reads.',
        'The read-refresh view proves that pushed timestamps are not automatically fatal. A transaction can move from timestamp 50 to timestamp 90 if the facts it depended on are unchanged across that interval. The visual should be read as validation of a read set, not as generic cache invalidation.',
        'A useful way to read the example is to separate conflict detection from conflict repair. The cache detects that an old write would violate a newer read. Refresh repairs a pushed transaction only if its own reads remain true. They solve different halves of timestamp movement.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The timestamp cache works because serializability only requires a valid order, not the original timestamp every transaction hoped for. If a write conflicts with a prior read, pushing the write later preserves the order read-before-write. The database is not guessing; it is enforcing a timestamp relationship backed by observed reads.',
        'Read refresh works because MVCC can ask what value would be visible at the new timestamp. If every read returns the same result after the push, the transaction behavior is indistinguishable from having read at the later timestamp in the first place. If any result changes, committing would depend on stale evidence, so retry is required.',
        'The design is optimistic but not casual. It lets transactions proceed without holding every read lock, then pays for validation only when timestamps move. That is the difference between ignoring conflicts and proving that the apparent conflict did not change the transaction answer.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The timestamp cache spends memory on recent read spans and needs efficient overlap checks. Fine-grained entries reduce false pushes but use more memory. Coarse spans are cheaper but conservative: a write may be pushed even though it would not have changed the transaction result.',
        'Read refresh trades extra validation work for fewer full restarts. It is valuable when read sets are small or changes are rare. It becomes expensive for long transactions, wide scans, and hot ranges where intervening writes are likely. In those cases the refresh often fails after doing extra work.',
        'There is also a user-facing tradeoff. Successful refresh hides harmless concurrency from the application. Failed refresh becomes a retry error, so client code still needs retry loops and idempotent transaction bodies. The database reduces retries; it cannot promise they vanish.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The design is strongest in optimistic distributed SQL systems where reads are common, writes should not block unnecessarily, and most timestamp pushes are harmless. It keeps the fast path lock-light while still preserving serializable behavior.',
        'It is especially useful for transactions that read configuration, account metadata, or small index spans, then get pushed by unrelated conflicts. Refresh lets those transactions commit instead of forcing the application into avoidable retry loops.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A missing span read is a correctness bug. Checking that a username does not exist is not just a point read of one absent key; it is a predicate over the keyspace where that username would be inserted. If the system fails to protect that span, a concurrent insert can violate serializable uniqueness.',
        'Eviction and lease transfers are another source of risk. The structure is called a cache, but losing detail must be conservative. After restart or ownership change, the system may need low-water marks or other safe initialization so it never forgets a read in a way that allows an old conflicting write.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study MVCC Internals and Vacuum for version visibility, Hybrid Logical Clocks for timestamp generation, Transaction Isolation Levels for the user-facing contract, Snapshot Isolation for the anomaly boundary, Raft Log Replication for range ownership, and CockroachDB Transaction Layer material for the production version of timestamp pushes and refresh.',
        'When implementing a toy version, start with point keys and a read set, then add range reads only after the point-key logic is clear. Most mistakes in real systems come from forgetting that absence and predicates also create dependencies.',
        'Then test it with adversarial histories: read-before-write, write-before-read, missing-row uniqueness, and a transaction pushed after reading. If each case has an explicit reason to commit or retry, the mechanism is becoming understandable instead of mystical.',
      ],
    },
  ],
};
