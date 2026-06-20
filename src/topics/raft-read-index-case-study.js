// Raft ReadIndex case study: linearizable reads without appending every read
// to the replicated log.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'raft-read-index-case-study',
  title: 'Raft ReadIndex Case Study',
  category: 'Systems',
  summary: 'Serve linearizable Raft reads by confirming leadership, obtaining a read index, and waiting until the state machine has applied that index.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['read index path', 'stale leader guard'], defaultValue: 'read index path' },
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

function raftReadGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 4.0, note: 'linearizable read' },
      { id: 'leader', label: 'leader', x: 2.8, y: 4.0, note: 'current term?' },
      { id: 'f1', label: 'follower 1', x: 5.0, y: 2.3, note: 'heartbeat ack' },
      { id: 'f2', label: 'follower 2', x: 5.0, y: 5.7, note: 'heartbeat ack' },
      { id: 'commit', label: 'commit index', x: 7.1, y: 2.7, note: 'read index' },
      { id: 'apply', label: 'applied index', x: 7.1, y: 5.3, note: 'state machine' },
      { id: 'kv', label: 'local state', x: 9.2, y: 4.0, note: 'serve read' },
    ],
    edges: [
      { id: 'e-client-leader', from: 'client', to: 'leader', weight: 'read' },
      { id: 'e-leader-f1', from: 'leader', to: 'f1', weight: 'heartbeat' },
      { id: 'e-leader-f2', from: 'leader', to: 'f2', weight: 'heartbeat' },
      { id: 'e-f1-commit', from: 'f1', to: 'commit', weight: 'majority' },
      { id: 'e-f2-commit', from: 'f2', to: 'commit', weight: 'majority' },
      { id: 'e-commit-apply', from: 'commit', to: 'apply', weight: 'wait apply' },
      { id: 'e-apply-kv', from: 'apply', to: 'kv', weight: 'read local' },
    ],
  }, { title });
}

function* readIndexPath() {
  yield {
    state: raftReadGraph('A linearizable read cannot trust memory alone'),
    highlight: { active: ['client', 'leader', 'e-client-leader'], compare: ['kv'] },
    explanation: 'A Raft leader may have a local state machine, but a linearizable read must prove the leader is still current and that the state machine has applied all writes before the read point.',
    invariant: 'A read must reflect every write completed before the read began.',
  };

  yield {
    state: raftReadGraph('Confirm leadership with a quorum'),
    highlight: { active: ['leader', 'f1', 'f2', 'e-leader-f1', 'e-leader-f2'], found: ['commit'] },
    explanation: 'ReadIndex avoids appending the read itself to the log. The leader contacts a quorum, usually through heartbeats, to confirm it has not been deposed.',
  };

  yield {
    state: labelMatrix(
      'ReadIndex state',
      [
        { id: 'term', label: 'current term' },
        { id: 'commit', label: 'commit index' },
        { id: 'read', label: 'read index' },
        { id: 'apply', label: 'applied index' },
      ],
      [{ id: 'meaning', label: 'meaning' }, { id: 'condition', label: 'condition' }],
      [
        ['leadership epoch', 'quorum confirms'],
        ['highest known committed entry', 'safe boundary'],
        ['index attached to read', 'must be applied'],
        ['state machine progress', 'apply >= read index'],
      ],
    ),
    highlight: { active: ['read:condition', 'apply:condition'], found: ['commit:meaning'] },
    explanation: 'The read state carries an index. Once the application has applied at least that index, local state is fresh enough to answer the read.',
  };

  yield {
    state: raftReadGraph('Serve from local state after apply catches up'),
    highlight: { active: ['commit', 'apply', 'kv', 'e-commit-apply', 'e-apply-kv'], found: ['kv'] },
    explanation: 'The final read can be served locally, but only after the apply index reaches the read index. This is the performance win: no new log entry for every read, while preserving linearizability.',
  };
}

function* staleLeaderGuard() {
  yield {
    state: labelMatrix(
      'Why stale leaders are dangerous',
      [
        { id: 'partition', label: 'old leader partitioned' },
        { id: 'new', label: 'new leader elected' },
        { id: 'write', label: 'new write commits' },
        { id: 'oldread', label: 'old leader reads' },
      ],
      [{ id: 'state', label: 'state' }, { id: 'risk' }],
      [
        ['cannot hear majority', 'may not know it lost leadership'],
        ['majority has newer term', 'system moved on'],
        ['committed elsewhere', 'old state is stale'],
        ['served locally without check', 'linearizability violation'],
      ],
    ),
    highlight: { active: ['oldread:risk', 'partition:risk'], found: ['new:state'] },
    explanation: 'The core failure mode is a leader that still thinks it is leader after a partition. A quorum check before reading prevents it from serving stale state.',
  };

  yield {
    state: raftReadGraph('ReadIndex quorum check blocks the stale leader'),
    highlight: { active: ['leader', 'f1', 'f2'], compare: ['e-leader-f1', 'e-leader-f2'], found: ['client'] },
    explanation: 'If the node cannot contact a quorum in its current term, it cannot complete the ReadIndex protocol and must not serve the linearizable read.',
  };

  yield {
    state: labelMatrix(
      'Case study: Kubernetes control-plane read',
      [
        { id: 'get', label: 'GET object' },
        { id: 'linear', label: 'linearizable read' },
        { id: 'serial', label: 'serializable read' },
        { id: 'watch', label: 'watch resume' },
      ],
      [{ id: 'path', label: 'path' }, { id: 'tradeoff' }],
      [
        ['API server asks etcd', 'fresh state needed'],
        ['ReadIndex/quorum', 'higher latency'],
        ['local member', 'may be stale'],
        ['revision boundary', 'must handle compaction'],
      ],
    ),
    highlight: { found: ['linear:path'], compare: ['serial:tradeoff'] },
    explanation: 'Control planes often need fresh reads for decisions such as leader election or object updates. ReadIndex is the middle path between appending every read and trusting a possibly stale local replica.',
  };

  yield {
    state: labelMatrix(
      'Read modes',
      [
        { id: 'logread', label: 'read through log' },
        { id: 'readindex', label: 'ReadIndex' },
        { id: 'lease', label: 'lease read' },
        { id: 'local', label: 'local read' },
      ],
      [{ id: 'cost', label: 'cost' }, { id: 'assumption' }],
      [
        ['replicate read entry', 'strong but expensive'],
        ['quorum heartbeat + apply wait', 'no new log entry'],
        ['no quorum per read', 'clock/timing assumptions'],
        ['single replica', 'staleness accepted'],
      ],
    ),
    highlight: { found: ['readindex:cost'], compare: ['lease:assumption', 'local:assumption'] },
    explanation: 'ReadIndex is a useful systems pattern because it makes the safety preconditions explicit: leadership confirmed, read index known, and local state applied far enough.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'read index path') yield* readIndexPath();
  else if (view === 'stale leader guard') yield* staleLeaderGuard();
  else throw new InputError('Pick a Raft ReadIndex view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A replicated state machine has many copies of the same logical data. Reads are tempting because they do not change the log, but a local copy can be stale. A linearizable read must behave as if it happened at one instant after every write that completed before it began.',
        'ReadIndex is the Raft pattern for serving that kind of read without appending a log entry for every request. It gives the application a log boundary and says: answer locally only after leadership has been confirmed and local apply has reached this boundary.',
        {type:'callout', text:'ReadIndex avoids writing every read by first proving current leadership, then waiting until local state reaches the proven log boundary.'},
      ],
    },
    {
      heading: 'The naive choices are both costly',
      paragraphs: [
        'The simplest safe read is to write the read through the Raft log, or append a no-op first and then read after it applies. That creates a clear position in the replicated history, but read-heavy workloads start paying write-path disk, replication, and commit costs for operations that only wanted data.',
        'The simplest fast read is to trust the leader local state machine. That is unsafe after partitions and leadership changes. An old leader can still have memory, sockets, and clients while a majority has elected a new leader and committed newer writes elsewhere.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A linearizable read needs a point in the log timeline. It does not always need its own log entry. ReadIndex obtains a safe read boundary, then waits until the local state machine has applied through that boundary.',
        'Two guards make the boundary meaningful. The leader must confirm with a quorum that it is still current, and the application must wait until applied index >= read index. The quorum guard prevents stale leaders. The apply guard prevents reading a state machine that is behind the committed log.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the read index path, follow the arrows as a safety chain rather than a request pipeline. The client asks the leader. The leader reaches a quorum. The read index marks the commit boundary. The apply node waits until local state catches up. Only then does the key-value state answer.',
        'In the stale leader guard view, focus on the missing quorum. A partitioned old leader may still accept a client request, but the highlighted follower acknowledgements are the proof it needs and cannot fake. Without that proof, the local read must stop.',
        'The commit index and applied index are intentionally separate in the picture. Commit means Raft has agreed on the log entry. Applied means the application state machine has actually incorporated it. A read from local state only sees applied work.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A leader receives a linearizable read request and starts a ReadIndex request. In the safe mode used by etcd raft, the leader communicates with a quorum, often through heartbeat-style messages, to confirm that no newer leader has displaced it.',
        'After that confirmation, the leader returns or records a read state containing a read index. The application queues the client read behind that index. When its applied index advances far enough, it evaluates the read on local state and sends the response.',
        'Real implementations batch this path. Several reads can share a leadership confirmation and then wait for the same or nearby apply boundary. Batching reduces traffic without changing the rule that every served read must be behind a confirmed read index.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a write to key /config commits at log index 120. A client then asks for a linearizable read. The leader confirms current leadership with a quorum and gives the read index 120 or later.',
        'If the local state machine has applied only through index 118, it cannot answer yet. The log is committed, but the key-value map in memory has not incorporated the last two entries. Once apply reaches 120, the read can return from local state without appending a new read entry.',
        'If the same node has been partitioned away from the majority, the process stops earlier. It cannot complete the quorum check in its current term, so it cannot prove that its local state is fresh enough for a linearizable response.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Raft commits entries only through a quorum. A leader that can still communicate with a quorum in the relevant term has evidence that no different leader has already taken over with a newer committed history. That is the leadership side of the proof.',
        'The read index gives the read a place in the committed log order. Waiting for applied index >= read index guarantees that every earlier committed write is visible in the local state machine before the read runs.',
        'Production implementations also need the normal Raft startup guard: a leader must establish authority for its current term, commonly by committing an entry in that term, before relying on its commit index for read-only requests. ReadIndex is a read optimization, not a shortcut around Raft term safety.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'ReadIndex removes the disk and log-entry cost of appending every read, but it is not a free local read. In the safe mode, it still waits on quorum communication unless leadership freshness has already been established by the implementation path.',
        'Read latency has two main pieces: quorum wait and apply wait. Quorum wait grows with network delay and slow majority members. Apply wait grows when the state machine falls behind commit, often because snapshots, large writes, compaction, or application work are blocking the apply loop.',
        'Serializable member-local reads are cheaper and more available, but they may be stale. Lease reads can be faster than ReadIndex, but they rely on timing assumptions such as bounded clock drift and pauses. ReadIndex pays more coordination to avoid those timing assumptions.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'ReadIndex fits control planes, metadata stores, configuration systems, and coordination services where clients need fresh reads but the workload is read-heavy. etcd is the standard example: range requests are linearizable by default, while serializable reads trade freshness for lower latency and higher availability.',
        'A Kubernetes API server reading from etcd may need current state before making an update, scheduling, or leadership decision. ReadIndex lets the serving member avoid appending a read entry while still proving that local state includes the committed writes that matter.',
      ],
    },
    {
      heading: 'Where it is not the right tool',
      paragraphs: [
        'If the application accepts stale reads, a serializable or follower-local read can be cheaper. If the cluster cannot reach quorum, ReadIndex correctly refuses to provide linearizable reads, so it does not improve availability during a majority failure.',
        'If the state machine apply loop is the bottleneck, ReadIndex will expose that bottleneck rather than hide it. The read can be safe and still slow because safety requires applied state, not merely committed log entries.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The dangerous bug is treating committed index and applied index as the same thing. A system can replicate an entry and still serve stale local state if the application has not applied it.',
        'Another failure mode is lost or unretired read requests. The etcd raft API notes that a ReadIndex request can be lost, so callers must handle retry and correlation with the request context. A read waiting forever behind a missing read state is an availability bug, not a Raft proof.',
        'Lease-based variants fail differently: unbounded clock drift, long pauses, or bad CheckQuorum handling can let a leader believe a lease is valid for too long. That is why lease reads need a separate safety discussion.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Raft Log Replication for the commit rule, Raft Election for term and leadership safety, Raft Leader Lease Read Safety for the timing-based alternative, Write-Ahead Log for durability boundaries, and etcd Raft Case Study for the production API shape.',
        'Sources: the Raft paper at https://raft.github.io/raft.pdf, etcd raft ReadIndex and ReadOnlyOption documentation at https://pkg.go.dev/go.etcd.io/etcd/raft/v3, and etcd API/performance notes on linearizable versus serializable reads at https://etcd.io/docs/v3.7/learning/api/ and https://etcd.io/docs/v3.5/op-guide/performance/.',
      ],
    },
  ],
};
