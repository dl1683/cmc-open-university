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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each frame as a race between ownership and delayed side effects. Active marks the process or resource currently making a decision; visited marks state already recorded, such as the highest fencing token accepted by the storage gate. Found marks the only result the protocol is allowed to commit: a write whose token is newer than the stored high-water mark.',
        'A fencing token is a number that increases every time a lock, lease, or leadership grant changes hands. The safe inference rule is simple: if the resource has accepted token 42, any later request with token 41 is stale even if it arrives after a long network pause. The animation is correct only if the comparison happens at the resource that applies the write.',
        {type:'callout', text:'A lock only proposes ownership; fencing makes freshness enforceable at the resource that applies the write.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A distributed lock lets one process act as the owner of shared work. The hard part is that real processes pause, packets arrive late, clocks drift, and a lease can expire while the old process still has enough local state to send writes. A stale process that keeps writing after losing ownership is called a zombie writer.',
        'The lock service alone cannot protect an external database, object store, or manifest service. The resource receiving the side effect must know whether the writer is still fresh. Fencing exists to move the final safety check from the client to the place where corruption would happen.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a leased lock. Worker A acquires a lease for 30 seconds, does the critical section, renews the lease while alive, and releases it when done. If A crashes, the lease expires and Worker B can continue.',
        'That design is reasonable because it solves liveness: the system does not wait forever for a dead owner. It fails because liveness is not safety. A process can be alive but paused long enough to lose the lease, then resume and write using stale assumptions.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the check-then-act gap. A worker can check that it owns the lease, pause for 45 seconds during garbage collection, lose the lease at second 30, and still send a write at second 46. A client-side check cannot cover the time between checking ownership and applying the side effect.',
        'The network makes this worse because old packets can arrive after new ones. If Worker B publishes backup manifest 18 and Worker A later publishes older manifest 17, the durable truth can move backward. The lock service may have behaved correctly while the storage service accepted the wrong write.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Attach a monotonically increasing token to each ownership grant, and make the protected resource reject old tokens. Monotonic means the number only moves upward for a given resource: 10, then 11, then 12, never reused. The resource stores the highest accepted token and treats lower tokens as stale forever.',
        'This turns a timing problem into an ordering problem. The resource no longer has to know whether a worker paused, whether a packet was delayed, or whether the worker still thinks it owns the lock. It only compares the incoming token with the stored high-water mark.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The lock service issues token 11 when it grants ownership. The client includes token 11 on every protected write. The resource performs a conditional update: accept the write only if incoming_token is greater than the stored fencing_token, then store the new value and token together.',
        'The comparison and the mutation must be atomic. In SQL, that can be one conditional update in a transaction. In an object store, it can be a generation precondition. In an API, it can be a compare-and-set field that advances only with a newer epoch.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that the resource high-water mark is always the greatest token it has accepted. If token 11 has been accepted, then token 10 cannot be current under any legal ownership sequence. Rejecting token 10 preserves the invariant even when messages arrive out of order.',
        'This is the right boundary because the token check and the side effect happen together. A stale client cannot sneak through a gap between validation and mutation because there is no separate gap at the resource. The lock chooses a likely owner; the fenced write proves freshness at commit time.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The runtime cost is tiny: one token field on each request, one stored high-water mark per protected resource, and one integer comparison per write. The real cost is coverage. Every path that can change the protected resource must carry the token and enforce the same rule.',
        'Fencing does not remove retry complexity. If a fresh token write succeeds but the client times out, retrying the same operation needs an idempotency key or operation id so the resource can recognize a duplicate. Fencing rejects old owners; idempotency handles repeated attempts by the current owner.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Fencing fits leader-elected writers, storage masters, backup publishers, compaction workers, distributed cron jobs, and hardware controllers. The common shape is one owner at a time plus an external resource that can be damaged by stale writes. Chubby describes this pattern with a lock acquisition count passed to the server that performs the write.',
        'It also appears inside consensus systems as leader terms. A leader term fences older leaders only if followers and downstream resources reject stale terms. Leadership is a claim about who should act; fencing is the write rule that makes the claim enforceable.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Fencing fails if tokens are random, reused, scoped to the wrong resource, or generated by split-brain authorities. Two independent lock services issuing token 12 for the same object destroy the comparison. Tokens must be monotonic for the exact resource whose writes they protect.',
        'It also fails when enforcement is partial. Logging the token is not enough, checking it in the client is not enough, and checking it before a non-atomic write is not enough. One unfenced side effect can still corrupt the system.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A backup service elects one manifest publisher. Worker A receives token 10 and starts building manifest 17, then pauses for 45 seconds. Its 30-second lease expires, Worker B receives token 11, and B writes manifest 18 with fencing_token 11.',
        'A wakes and tries to write manifest 17 with token 10. Without fencing, restore tooling can point at the older manifest. With fencing, the manifest row already stores token 11, so the conditional update 10 > 11 is false and the write is rejected.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: The Chubby lock service paper at https://research.google.com/archive/chubby-osdi06.pdf, ZooKeeper programmer guide at https://zookeeper.apache.org/doc/current/zookeeperProgrammers.html, and Martin Kleppmann on distributed locking at https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html.',
        'Study next by role. For lock services, read Chubby Lock Service and ZooKeeper and Zab. For commit-time guards, read Compare-and-Swap and Write-Ahead Log. For repeated writes after timeout, read Idempotency and Exactly-Once Delivery.',
      ],
    },
  ],
};