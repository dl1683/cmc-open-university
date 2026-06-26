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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a safety chain for a replicated state machine. A replicated state machine is several servers applying the same ordered log so they end with the same state. Active nodes are the client, leader, quorum, read index, apply loop, and local state as the read moves through them.',
        'The safe inference rule is simple: a node may answer locally only after it has proved current leadership and applied through the read index. The stale leader view shows the opposite case. If the leader cannot hear from a majority, the read stops even if the local key-value map is still reachable.',
        {type:'callout', text:'ReadIndex avoids writing every read by first proving current leadership, then waiting until local state reaches the proven log boundary.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Raft is a consensus algorithm: it keeps several machines in one agreed log order despite failures. A write already has a log entry, so later reads must see it if the read starts after the write completes. A local read from one server is fast, but it can be stale after a partition or leadership change.',
        'ReadIndex exists for read-heavy systems that still need linearizability. Linearizability means each operation behaves as if it took effect at one instant between call and response. ReadIndex gives the read a safe position in the committed log without appending a new log entry for the read itself.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious safe approach is to put every read through the Raft log. The leader appends a read marker or no-op entry, replicates it to a majority, commits it, applies it, and then reads local state. That is easy to reason about because the read has an exact place in the history.',
        'The obvious fast approach is to trust the leader and read its state machine immediately. That often works in a quiet cluster. It is also the path a developer reaches for when the data is already in memory and the request does not change anything.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Writing every read turns a read-heavy workload into a write-heavy workload. With 20,000 reads per second, the cluster now asks the disk, network, and commit path to process 20,000 extra log entries per second. The read did not change state, but it paid most of the write cost.',
        'Trusting local leader state breaks under split brain timing. An old leader can keep serving clients while a majority has elected a new leader and committed newer writes. The local state machine may be internally consistent and still be too old for a linearizable answer.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A linearizable read needs a proven position in the log; it does not always need its own log entry. ReadIndex asks the leader to prove it is still current with a quorum and then records the current committed index as the read boundary. The application waits until the local applied index reaches that boundary.',
        'Two counters matter. The commit index is the highest log entry Raft knows is committed by a majority. The applied index is the highest committed entry the local application state machine has actually executed. ReadIndex is safe only when leadership is current and applied index is at least the read index.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client sends a linearizable read to the leader. The leader runs a read-only protocol that confirms with a quorum that this leader has not been displaced. In common safe-mode implementations, this confirmation is carried by heartbeat-style messages and acknowledgements.',
        'After the quorum check, the leader returns a read state containing a read index. The application queues the read until its apply loop reaches that index. When applied index catches up, the server reads local state and responds without appending a read entry.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Raft commits entries through majorities, and two majorities must overlap. If the leader can contact a majority in the relevant term, that proof blocks the stale-leader case where a different leader has already taken control with a separate committed future. This is the leadership side of the correctness argument.',
        'The apply wait supplies the state-machine side. Every write that committed at or before the read index has been executed locally before the read runs. The read therefore observes all earlier completed writes that Raft has placed before that boundary.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'ReadIndex removes the log append, disk write, and replicated read entry. It still pays for quorum communication and for waiting behind the apply loop. If a round trip to the majority is 2 ms and the state machine is 3 entries behind at 1,000 applied entries per second, the apply wait adds about 3 ms.',
        'When read volume doubles, the cost depends on batching. If 100 reads share one quorum confirmation, network cost grows slowly while queue management grows with the number of waiting reads. If every read forces its own quorum check, read latency and majority traffic grow with request rate.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'ReadIndex fits metadata systems where reads are common and stale answers are dangerous. etcd uses this pattern for linearizable reads, which matters because Kubernetes and other control planes make decisions from stored cluster state. Configuration stores, lock services, and leader-election systems have the same access pattern.',
        'The fit is strongest when most reads can be answered from local state after a small coordination step. If the system has a healthy leader and a fast apply loop, ReadIndex saves repeated log writes while preserving the same read freshness contract clients expect from consensus.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'ReadIndex does not improve availability when no majority is reachable. It correctly refuses to serve a linearizable read, because no server can prove it is still the current leader. A follower-local or serializable read may answer during that time, but it may be stale.',
        'It also fails as an optimization when the apply loop is the real bottleneck. A server can know the committed index and still wait because the application has not applied those entries. Confusing committed with applied is the bug that makes a safe-looking read stale.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose key x is updated to 7 at log index 120, and the write commits on three of five nodes. A client then sends a read for x to the leader. The leader confirms with a majority and records read index 120.',
        'If the local applied index is 118, the server cannot answer yet. At 500 applied entries per second, entries 119 and 120 take about 4 ms to apply. Once applied index reaches 120, the local map must include x = 7, so the read can return without writing a new log entry.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the Raft paper at https://raft.github.io/raft.pdf and the etcd raft ReadIndex documentation at https://pkg.go.dev/go.etcd.io/etcd/raft/v3. The etcd API docs explain the product distinction between linearizable and serializable reads at https://etcd.io/docs/v3.7/learning/api/.',
        'Study Raft log replication next for the commit rule, then Raft elections for term safety. After that, compare ReadIndex with leader leases, write-ahead logs, and state-machine apply loops so the boundary between consensus and application state is clear.',
      ],
    },
  ],
};
