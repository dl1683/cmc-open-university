// Fencing tokens: monotonic epochs attached to lock acquisitions so an external
// resource can reject stale writes from paused or partitioned lock holders.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'fencing-token-zombie-writer-case-study',
  title: 'Fencing Token Zombie Writer',
  category: 'Systems',
  summary: 'How fencing tokens make leased locks safer by attaching monotonic epochs to side effects, rejecting old writers, and surviving pauses, partitions, and retries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['token gate', 'zombie write'], defaultValue: 'token gate' },
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

function fenceGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'clientA', label: 'A', x: 0.5, y: 5.4, note: notes.clientA ?? 'worker' },
      { id: 'clientB', label: 'B', x: 0.5, y: 3.0, note: notes.clientB ?? 'worker' },
      { id: 'lock', label: 'lock', x: 2.1, y: 4.2, note: notes.lock ?? 'lease' },
      { id: 'token', label: 'epoch', x: 4.2, y: 4.2, note: notes.token ?? 'n+1' },
      { id: 'pause', label: 'pause', x: 5.6, y: 5.4, note: notes.pause ?? 'GC' },
      { id: 'gate', label: 'gate', x: 5.6, y: 3.0, note: notes.gate ?? 'max seen' },
      { id: 'store', label: 'store', x: 7.5, y: 4.2, note: notes.store ?? 'side effect' },
      { id: 'accept', label: 'accept', x: 9.2, y: 5.4, note: notes.accept ?? 'new' },
      { id: 'reject', label: 'reject', x: 9.2, y: 3.0, note: notes.reject ?? 'old' },
    ],
    edges: [
      { id: 'e-a-lock', from: 'clientA', to: 'lock', weight: '' },
      { id: 'e-b-lock', from: 'clientB', to: 'lock', weight: '' },
      { id: 'e-lock-token', from: 'lock', to: 'token', weight: '' },
      { id: 'e-token-pause', from: 'token', to: 'pause', weight: '' },
      { id: 'e-token-gate', from: 'token', to: 'gate', weight: '' },
      { id: 'e-pause-store', from: 'pause', to: 'store', weight: '' },
      { id: 'e-gate-store', from: 'gate', to: 'store', weight: '' },
      { id: 'e-store-accept', from: 'store', to: 'accept', weight: '' },
      { id: 'e-store-reject', from: 'store', to: 'reject', weight: '' },
    ],
  }, { title });
}

function* tokenGate() {
  yield {
    state: fenceGraph('A lock grant returns a monotonically increasing fencing token'),
    highlight: { active: ['clientA', 'lock', 'token', 'e-a-lock', 'e-lock-token'], compare: ['store'] },
    explanation: 'A lease says who may act for a time. A fencing token says which lease generation this action belongs to. The token must increase every time the lock is granted.',
    invariant: 'The protected resource must check tokens; the lock service alone cannot fence external side effects.',
  };

  yield {
    state: fenceGraph('The storage gate remembers the highest token already accepted', { gate: 'max=41', token: '42', accept: 'write' }),
    highlight: { active: ['token', 'gate', 'store', 'accept', 'e-token-gate', 'e-gate-store', 'e-store-accept'], compare: ['reject'] },
    explanation: 'The resource compares incoming token against its last accepted token. If the token is newer, the write can proceed and the resource advances its high-water mark.',
  };

  yield {
    state: labelMatrix(
      'Lock layers',
      [
        { id: 'lease', label: 'lease' },
        { id: 'token', label: 'token' },
        { id: 'store', label: 'store' },
        { id: 'retry', label: 'retry' },
      ],
      [
        { id: 'job' },
        { id: 'failure' },
      ],
      [
        ['time owner', 'pause'],
        ['epoch', 'reuse'],
        ['reject old', 'not checked'],
        ['idempotent', 'dup side fx'],
      ],
    ),
    highlight: { active: ['token:job', 'store:job', 'retry:job'], compare: ['store:failure'] },
    explanation: 'Fencing is a layered protocol. The lock service issues epochs. The resource enforces epochs. The client still needs idempotency and retry discipline for ambiguous responses.',
  };

  yield {
    state: fenceGraph('A newer token supersedes every older holder', { clientB: 'new holder', token: '43', gate: 'max=42', accept: 'accept 43' }),
    highlight: { active: ['clientB', 'lock', 'token', 'gate', 'store', 'accept', 'e-b-lock', 'e-lock-token'], compare: ['clientA'] },
    explanation: 'The useful property is monotonicity. Once token 43 is accepted, any operation from token 42 or lower is stale even if the old client still thinks it owns something.',
  };

  yield {
    state: fenceGraph('The complete protocol turns a lease into an enforceable epoch', { token: 'epoch 44', gate: 'max seen', store: 'DB row', accept: 'commit' }),
    highlight: { active: ['lock', 'token', 'gate', 'store', 'accept'], found: ['clientA'] },
    explanation: 'A job runner uses a lock service for election, includes the fencing token on every write to the output table, and the table rejects writes whose token is lower than the stored token.',
  };
}

function* zombieWrite() {
  yield {
    state: fenceGraph('Worker A pauses after receiving token 10', { clientA: 'token 10', token: '10', pause: 'long GC', gate: 'max=9' }),
    highlight: { active: ['clientA', 'lock', 'token', 'pause', 'e-a-lock', 'e-lock-token', 'e-token-pause'], compare: ['store'] },
    explanation: 'The classic failure is a process pause. Worker A acquired the lock, stopped running long enough for its lease to expire, but later resumes with old local state.',
    invariant: 'A paused process can outlive its lease; external resources need their own stale-writer check.',
  };

  yield {
    state: fenceGraph('Worker B receives token 11 and completes the real write', { clientB: 'token 11', token: '11', gate: 'max=10', accept: 'ok 11' }),
    highlight: { active: ['clientB', 'lock', 'token', 'gate', 'store', 'accept', 'e-b-lock', 'e-token-gate'], compare: ['clientA'] },
    explanation: 'After the lease expires, a new worker can legitimately acquire the lock. The resource now expects token 11 or higher.',
  };

  yield {
    state: fenceGraph('Zombie A wakes and tries to write with token 10', { clientA: 'zombie', token: '10', pause: 'resumed', gate: 'max=11', reject: 'reject 10' }),
    highlight: { active: ['clientA', 'pause', 'token', 'gate', 'store', 'reject', 'e-pause-store', 'e-store-reject'], removed: ['accept'] },
    explanation: 'Without fencing, A can overwrite B despite no longer owning the lease. With fencing, the storage layer rejects A because token 10 is older than the accepted high-water mark.',
  };

  yield {
    state: labelMatrix(
      'Bad fixes',
      [
        { id: 'clock', label: 'clock' },
        { id: 'check', label: 'self check' },
        { id: 'mutex', label: 'mutex' },
        { id: 'fence', label: 'fence' },
      ],
      [
        { id: 'claim' },
        { id: 'gap' },
      ],
      [
        ['lease time', 'drift'],
        ['still own?', 'pause gap'],
        ['one process', 'external'],
        ['epoch gate', 'needs store'],
      ],
    ),
    highlight: { active: ['fence:claim', 'fence:gap'], compare: ['check:gap', 'clock:gap'] },
    explanation: 'Self-checks are not enough because the stale client may check before a pause and write after it. The resource that receives the side effect must enforce the epoch.',
  };

  yield {
    state: fenceGraph('The complete incident is a backup job writing a manifest', { clientA: 'old backup', clientB: 'new backup', store: 'manifest', reject: 'old token' }),
    highlight: { active: ['clientA', 'clientB', 'lock', 'token', 'gate', 'store', 'reject'], found: ['accept'] },
    explanation: 'A backup worker pauses after acquiring a lease. Another worker finishes the backup with a newer token. When the old worker resumes, the manifest service rejects its stale token instead of publishing an older backup.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'token gate') yield* tokenGate();
  else if (view === 'zombie write') yield* zombieWrite();
  else throw new InputError('Pick a fencing-token view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A fencing token is a monotonically increasing number attached to a lock grant, lease, leadership term, or exclusive work assignment. The client includes that number on every side effect. The protected resource stores the highest token it has accepted and rejects operations with older tokens. The token turns "I think I still own the lock" into a checkable epoch at the place where data would actually change.',
        'This exists because a distributed lock service can choose a new owner while an old owner is paused, partitioned, or delayed. When the old process resumes, it may still have stale local state and may still be capable of sending writes. The lock service alone cannot stop writes that go to a database, object store, manifest service, hardware controller, or external API. The resource receiving the side effect must participate.',
      ],
    },
    {
      heading: 'The real problem',
      paragraphs: [
        'The obvious approach is a leased lock. A worker acquires the lock, receives permission for a bounded time, performs the critical section, and renews or releases the lease. That protects liveness because a crashed worker will eventually stop renewing and another worker can take over. The same expiry rule creates the safety problem: a running process can outlive its own lease without observing the loss in time.',
        'The dangerous window is check-then-act. Worker A can acquire a lease, check that it still owns the lease, pause for a long garbage collection or network stall, lose the lease, and then resume by writing to the external resource. Worker B may have already acquired a newer lease and completed the correct write. Without a resource-side token check, zombie A can overwrite B while every component believes it behaved correctly.',
      ],
    },
    {
      heading: 'The core mechanism',
      paragraphs: [
        'The lock service must issue tokens in a total monotonic order: 10, then 11, then 12, never reused and never going backward. A client must attach its token to every protected operation. The resource must compare the incoming token against a stored high-water mark in the same transaction or conditional update that applies the operation. If token 11 has been accepted, token 10 is stale forever.',
        'The data structure is simple: a max-seen epoch at the side-effect boundary. The engineering requirement is harder: every write path must carry the token, and every resource that can be corrupted by a stale holder must enforce it. Fencing is not a property of the lock client. It is a protocol between the lock service, the client, and the resource being protected.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the token-gate view, follow the lease grant into the epoch node and then into the storage gate. The lock service decides who should act next, but the gate decides whether a write is still current. The frame where the gate remembers max=41 and accepts token 42 is the whole protocol in miniature: compare, apply, advance the high-water mark.',
        'In the zombie-write view, watch the old worker pause after receiving token 10. A newer worker receives token 11 and writes successfully. When the old worker wakes, its request still reaches the store, but the store rejects it because max=11. The rejected edge is the safety guarantee. The old client did not need to know it was stale; the resource knew.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A concrete implementation can be one row with protected_value and fencing_token. The update says: apply this write only if incoming_token is greater than the stored fencing_token; if accepted, store the new value and the new token together. In SQL this is a conditional update inside a transaction. In an object store it may be a generation precondition. In a service API it may be an explicit compare-and-set on the epoch field. The essential rule is atomicity: the token comparison and the side effect must not be separable.',
        'Tokens can come from a consensus-backed lock service, a ZooKeeper sequential node number, an etcd revision, a database sequence, or a leadership term, as long as the order is monotonic for the protected resource. Chubby describes sequencers and acquisition counts for validating lock ownership: https://research.google.com/archive/chubby-osdi06.pdf. Martin Kleppmann emphasizes the storage-server side of the design: stale tokens must be rejected where the write lands: https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because monotonic order survives delay. The network can deliver token 10 after token 11. A garbage collector can stop a process for longer than its lease. A retry can arrive after a newer owner has completed the job. None of those timing facts change the comparison: 10 is less than 11. The high-water mark turns a timing problem into an integer-ordering problem.',
        'It also moves the safety check to the only place that can make it exact. A client-side self-check is always stale by the time the write happens because the process can pause between the check and the write. A resource-side conditional write closes that gap because the comparison and the mutation happen together. The lock remains useful for choosing a likely owner; the fencing gate enforces correctness.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The cost is protocol coverage. Every protected write path needs a token parameter. Every resource needs storage for the high-water mark. Multi-resource operations need every resource to enforce the same epoch, or they need a higher-level transaction that does. If one side effect bypasses the gate, that path can still be corrupted by a stale holder.',
        'Fencing also does not solve retries by itself. A request with a fresh token can succeed while the client times out waiting for the response. Retrying the same operation needs an idempotency key, operation id, or compare-and-set shape so the resource can distinguish a duplicate from a new action under the same owner. Fencing rejects old owners; idempotency handles ambiguous repeats by a current owner.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A backup system elects one worker to publish the latest backup manifest. Worker A receives token 10, starts uploading chunks, then pauses during garbage collection. Its lease expires. Worker B receives token 11, verifies the chunks for the new backup, and writes manifest_version=2026-06-17 with fencing_token=11. The manifest service stores token 11 as the high-water mark.',
        'Worker A wakes and tries to publish its older manifest with token 10. Without fencing, the older manifest could replace the newer one and make restore tooling point at stale or incomplete data. With fencing, the manifest service performs one conditional update, sees 10 < 11, and rejects the write. The backup lock helped coordinate workers, but the manifest service protected the durable truth.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Fencing fails if tokens are random, reused, scoped incorrectly, or generated by a split-brain authority. The token order must match the resource being protected. If two lock services can issue token 12 for the same resource, the comparison is meaningless. If a token is only monotonic per client rather than per resource, an old client can still look fresh to the store.',
        'It also fails when enforcement is only advisory. Logging the token is not enough. Checking it in the client is not enough. Checking it before a non-atomic write is not enough. Sending one fenced write to the database and one unfenced write to an object store is not enough if either side effect can corrupt the invariant. The resource that receives the side effect must reject stale epochs before applying them.',
      ],
    },
    {
      heading: 'Useful contexts',
      paragraphs: [
        'Fencing tokens are useful for leader-elected writers, backup manifests, storage controllers, distributed schedulers, compaction workers, primary-only maintenance jobs, distributed cron, and any workflow where an old holder can resume after losing ownership. They pair well with databases, object stores, and APIs that support conditional writes over a version or generation field.',
        'They are also a way to read leader terms in consensus systems. A new leader term fences older leaders only if followers and downstream resources reject stale terms. That is the general lesson: leadership, locks, and leases are proposals about who should act; fencing turns that proposal into an enforceable write rule.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Chubby paper at https://research.google.com/archive/chubby-osdi06.pdf, ZooKeeper programmer guide at https://zookeeper.apache.org/doc/current/zookeeperProgrammers.html, and Martin Kleppmann distributed locking analysis at https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html.',
        'Study Distributed Locks, View Changes: Replacing a Failed Leader, Raft Leader Lease Read Safety, Chubby Lock Service, ZooKeeper & Zab, Idempotency & Exactly-Once Delivery, Transactional Outbox, Compare-and-Swap, and Write-Ahead Log next.',
      ],
    },
  ],
};
