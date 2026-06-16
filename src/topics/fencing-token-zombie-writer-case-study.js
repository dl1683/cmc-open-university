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
        'A fencing token is a monotonically increasing epoch attached to a lease or lock grant. The holder includes the token on every side effect. The protected resource remembers the highest token it has accepted and rejects older tokens.',
        'Chubby describes sequencers, lock acquisition counts, and client checks for validating that a lock is still held: https://research.google.com/archive/chubby-osdi06.pdf. Martin Kleppmann popularized fencing tokens for safe distributed lock side effects and emphasizes that the storage server must reject stale tokens: https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html.',
      ],
    },
    {
      heading: 'Core mental model',
      paragraphs: [
        'A distributed lock is not a mutex. The client can pause, the network can delay messages, and a lease can expire while the client is asleep. Fencing moves enforcement to the resource that receives the write.',
        'The data structure is a high-water mark. Each resource records the greatest token accepted so far. Incoming writes with lower tokens are stale and must be rejected even if they arrive late.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A backup service elects one active writer through a lock service. Each grant returns a token. The writer includes that token in manifest updates. The manifest table has a stored fencing_token column and accepts only writes whose token is greater than the current value.',
        'If an old writer resumes after a GC pause, it can still send HTTP requests. The manifest table rejects them because their token is stale. The correctness boundary is at the side-effect store, not in the lock client.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not rely on a client asking the lock service whether it still owns the lock before every write. The client can pause after the check and before the write.',
        'Do not issue random lock IDs as fencing tokens. Tokens need a monotonic order the resource can compare. Also do not forget idempotency; a fresh token can still be retried after an ambiguous response.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Chubby paper at https://research.google.com/archive/chubby-osdi06.pdf, ZooKeeper programmer guide at https://zookeeper.apache.org/doc/current/zookeeperProgrammers.html, and Martin Kleppmann distributed locking analysis at https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html.',
        'Study Distributed Locks, Leader Replacement, Raft Leader Lease Read Safety, Chubby Lock Service, ZooKeeper & Zab, Idempotency, and Transactional Outbox next.',
      ],
    },
  ],
};
