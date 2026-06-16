// Session guarantees: client-side high-water marks and session tokens preserve
// read-your-writes and monotonic reads even when replicas lag.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'session-guarantees-replica-lag-case-study',
  title: 'Session Guarantees & Replica Lag',
  category: 'Systems',
  summary: 'How read-your-writes, monotonic reads, monotonic writes, writes-follow-reads, session tokens, high-water marks, and replica lag fit together.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['session token', 'lagged replica'], defaultValue: 'session token' },
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

function sessionGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.5, y: 4.2, note: notes.client ?? 'session' },
      { id: 'token', label: 'token', x: 2.1, y: 4.2, note: notes.token ?? 'LSN 7' },
      { id: 'write', label: 'write', x: 3.6, y: 5.4, note: notes.write ?? 'v8' },
      { id: 'read', label: 'read', x: 3.6, y: 3.0, note: notes.read ?? 'need >=7' },
      { id: 'router', label: 'router', x: 5.3, y: 4.2, note: notes.router ?? 'choose' },
      { id: 'replicaA', label: 'R1', x: 7.0, y: 5.4, note: notes.replicaA ?? 'LSN 8' },
      { id: 'replicaB', label: 'R2', x: 7.0, y: 3.0, note: notes.replicaB ?? 'LSN 5' },
      { id: 'wait', label: 'wait', x: 8.5, y: 3.0, note: notes.wait ?? 'catch up' },
      { id: 'result', label: 'result', x: 9.6, y: 4.2, note: notes.result ?? 'fresh' },
    ],
    edges: [
      { id: 'e-client-token', from: 'client', to: 'token', weight: '' },
      { id: 'e-token-write', from: 'token', to: 'write', weight: '' },
      { id: 'e-token-read', from: 'token', to: 'read', weight: '' },
      { id: 'e-read-router', from: 'read', to: 'router', weight: '' },
      { id: 'e-write-router', from: 'write', to: 'router', weight: '' },
      { id: 'e-router-a', from: 'router', to: 'replicaA', weight: '' },
      { id: 'e-router-b', from: 'router', to: 'replicaB', weight: '' },
      { id: 'e-b-wait', from: 'replicaB', to: 'wait', weight: '' },
      { id: 'e-a-result', from: 'replicaA', to: 'result', weight: '' },
      { id: 'e-wait-result', from: 'wait', to: 'result', weight: '' },
    ],
  }, { title });
}

function* sessionToken() {
  yield {
    state: sessionGraph('A write returns a session token or high-water mark', { write: 'profile v8', token: 'LSN 8' }),
    highlight: { active: ['client', 'token', 'write', 'e-client-token', 'e-token-write'], compare: ['replicaB'] },
    explanation: 'A weakly consistent system can still protect a user session by returning a token that summarizes what this client has already observed or written.',
    invariant: 'The client session carries a freshness requirement forward.',
  };

  yield {
    state: sessionGraph('Later reads carry the token as a minimum freshness requirement', { read: 'need 8', router: 'route' }),
    highlight: { active: ['client', 'token', 'read', 'router', 'e-token-read', 'e-read-router'], compare: ['replicaB'] },
    explanation: 'The read does not need the globally newest value. It needs a replica whose state is at least as new as the client session high-water mark.',
  };

  yield {
    state: labelMatrix(
      'Guarantees',
      [
        { id: 'ryw', label: 'RYW' },
        { id: 'mr', label: 'mono read' },
        { id: 'mw', label: 'mono write' },
        { id: 'wfr', label: 'write after' },
      ],
      [
        { id: 'protects' },
        { id: 'state' },
      ],
      [
        ['own writes', 'token'],
        ['no rewind', 'max seen'],
        ['order', 'seq'],
        ['causal dep', 'deps'],
      ],
    ),
    highlight: { active: ['ryw:protects', 'mr:protects', 'mw:state', 'wfr:state'], compare: ['mr:state'] },
    explanation: 'Session guarantees are weaker than linearizability but stronger than arbitrary eventual reads. They preserve the story a single user or client has already seen.',
  };

  yield {
    state: sessionGraph('The router picks a replica that satisfies the token', { token: 'need >=8', replicaA: 'LSN 8', replicaB: 'LSN 5', result: 'from R1' }),
    highlight: { active: ['router', 'replicaA', 'result', 'e-router-a', 'e-a-result'], removed: ['replicaB'] },
    explanation: 'The route decision is a small constraint solver: choose a nearby replica if it has caught up; otherwise wait, retry elsewhere, or send the read to the primary.',
  };

  yield {
    state: sessionGraph('The complete flow gives low latency without self-contradiction', { client: 'user', token: 'profile 8', read: 'refresh', result: 'sees edit' }),
    highlight: { active: ['client', 'token', 'write', 'read', 'router', 'replicaA', 'result'], compare: ['replicaB'] },
    explanation: 'A user edits a profile and refreshes. The system may still be eventually consistent for other users, but this session routes or waits so the editor sees their own change.',
  };
}

function* laggedReplica() {
  yield {
    state: sessionGraph('A lagged replica can violate read-your-writes', { token: 'need 8', replicaA: 'LSN 8', replicaB: 'LSN 5', result: 'old v5' }),
    highlight: { active: ['client', 'token', 'read', 'replicaB'], removed: ['result'] },
    explanation: 'Without the session token, a load balancer may send the client to a stale replica after the client just wrote newer state. The UI appears to lose the write.',
    invariant: 'Replica lag is acceptable only when the caller contract permits staleness.',
  };

  yield {
    state: sessionGraph('The system can wait for the chosen replica to catch up', { replicaB: 'LSN 5', wait: 'until 8', result: 'v8' }),
    highlight: { active: ['replicaB', 'wait', 'result', 'e-b-wait', 'e-wait-result'], compare: ['replicaA'] },
    explanation: 'Waiting is often cheaper than global linearizability for every read. The wait is bounded by the freshness token rather than by a vague sleep.',
  };

  yield {
    state: labelMatrix(
      'Fallbacks',
      [
        { id: 'wait', label: 'wait' },
        { id: 'route', label: 'route' },
        { id: 'primary', label: 'primary' },
        { id: 'stale', label: 'stale ok' },
      ],
      [
        { id: 'cost' },
        { id: 'fit' },
      ],
      [
        ['latency', 'nearby'],
        ['fanout', 'regional'],
        ['load', 'strict'],
        ['cheap', 'feeds'],
      ],
    ),
    highlight: { active: ['wait:fit', 'route:fit', 'primary:fit'], compare: ['stale:cost'] },
    explanation: 'A session-guarantee system needs explicit fallback policy. Some reads can be stale. Some need wait-for-catchup. Some should route to the primary or a fresher region.',
  };

  yield {
    state: sessionGraph('Sharing the session token carries freshness across devices', { client: 'phone+web', token: 'cart 12', read: 'checkout', result: 'same cart' }),
    highlight: { active: ['client', 'token', 'read', 'router', 'result'], found: ['replicaA'] },
    explanation: 'A token is more precise than sticky sessions. A different device or service can preserve the same guarantee if it receives the high-water mark.',
  };

  yield {
    state: sessionGraph('The complete incident is a shopping cart after regional failover', { client: 'cart user', token: 'cart 19', replicaA: 'region A 19', replicaB: 'region B 16', result: 'route/wait' }),
    highlight: { active: ['client', 'token', 'read', 'router', 'replicaA', 'replicaB', 'wait', 'result'], compare: ['write'] },
    explanation: 'A user adds an item, then traffic shifts to another region. The session token prevents the next cart read from landing on a replica that has not replayed the add yet.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'session token') yield* sessionToken();
  else if (view === 'lagged replica') yield* laggedReplica();
  else throw new InputError('Pick a session-guarantees view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Session guarantees are consistency promises scoped to a client session. They include read-your-writes, monotonic reads, monotonic writes, and writes-follow-reads. They do not require every replica to be globally current; they require this session to avoid contradicting itself.',
        'Terry, Demers, Petersen, Spreitzer, Theimer, and Welch introduced the classic session guarantees for weakly consistent replicated data: https://www.cs.cornell.edu/courses/cs734/2000FA/cached%20papers/SessionGuaranteesPDIS_1.html. Azure Cosmos DB documents practical session tokens for read-your-writes behavior: https://learn.microsoft.com/en-us/azure/cosmos-db/consistency-levels.',
      ],
    },
    {
      heading: 'Core mental model',
      paragraphs: [
        'The data structure is a per-session high-water mark. Writes and reads advance the mark. Future reads carry the mark so the router can choose a sufficiently fresh replica, wait for catchup, or route to a primary.',
        'This is weaker and cheaper than linearizability. Other clients can see older data while this client sees a coherent progression of its own actions.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A shopping cart service writes to a quorum and replicates asynchronously across regions. The add-item response includes a session token. The browser sends that token on later cart reads. If the nearest replica is behind, the router waits until it reaches the token, chooses a fresher replica, or sends the read to the primary.',
        'After a regional failover, the token prevents the user from seeing an older cart just because DNS or a load balancer moved them to another replica.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not call session consistency linearizability. It does not define one global real-time order for all clients. It protects a session-level story.',
        'Do not rely only on sticky sessions. Tokens are more portable: they can cross devices, service boundaries, and regional failovers if the application carries them.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Session Guarantees for Weakly Consistent Replicated Data at https://www.cs.cornell.edu/courses/cs734/2000FA/cached%20papers/SessionGuaranteesPDIS_1.html, DBLP entry at https://dblp.org/rec/conf/pdis/TerryDPSTW94.html, Azure Cosmos DB consistency levels at https://learn.microsoft.com/en-us/azure/cosmos-db/consistency-levels, and Amazon Dynamo at https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf.',
        'Study Read/Write Quorums, Amazon Dynamo Case Study, Version Vectors, Read Repair Digest Quorum, Hinted Handoff Replica Queue, Cache Invalidation, and CRDTs next.',
      ],
    },
  ],
};
