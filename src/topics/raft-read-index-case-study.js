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
    { heading: 'What it is', paragraphs: [
      'ReadIndex is a Raft read optimization used by systems such as etcd. A replicated state machine can always serve a linearizable read by appending a no-op or read entry to the log, but doing that for every read is expensive. ReadIndex avoids a new log entry while still checking that the leader is current.',
      'The protocol gives the application a read index. Once the local state machine has applied at least that index, the node can answer the read from local state without missing earlier committed writes.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The leader receives a linearizable read request. It confirms leadership with a quorum, usually by piggybacking on heartbeats or issuing a read-index request. The leader records the current commit index as the read boundary. Then the application waits until its applied index reaches that boundary before serving the read.',
      'Two conditions matter. The node must still be leader, and the local state machine must be caught up to the chosen read index. If either condition is false, a local read can return stale state.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'ReadIndex is cheaper than log-appending every read, but it is not free. It still requires quorum communication when leadership freshness is not already established, and it can wait behind the apply loop. Serializable or local reads are faster but may be stale.',
      'The implementation risk is separating Raft commit progress from application apply progress. A committed log entry is not visible to reads until the state machine has applied it. That boundary is where many subtle control-plane bugs live.',
      'Batching matters in real systems. Multiple pending reads can share a leadership confirmation and then wait on the same or nearby apply indexes. That keeps the optimization useful under read-heavy workloads without weakening the safety rule.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'A Kubernetes API server reading from etcd may need a fresh view before making a scheduling or update decision. ReadIndex lets etcd answer that read without appending a new log entry, while still forcing the serving member to prove leadership and apply through the read boundary.',
      'The case study explains the performance-safety balance: one can read locally for speed, through the log for simplicity, through leases with timing assumptions, or through ReadIndex for a practical middle ground.',
      'The operational signal to watch is read latency split by quorum wait and apply wait. If apply falls behind, ReadIndex may still be correct but no longer cheap from the clients point of view.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: the Raft paper, https://raft.github.io/raft.pdf, etcd raft package ReadIndex documentation, https://pkg.go.dev/go.etcd.io/etcd/raft/v3, and etcd performance notes on linearizable reads, https://etcd.io/docs/v3.2/op-guide/performance/. Study Raft Log Replication, etcd Raft Case Study, Write-Ahead Log, Logical Clocks, and PostgreSQL Streaming Replication next.',
      'Raft Leader Lease Read Safety is the timing-assumption continuation: ReadIndex pays a quorum round for freshness, while lease reads cache that proof and must account for clock drift, pauses, and apply-index lag.',
    ] },
  ],
};
