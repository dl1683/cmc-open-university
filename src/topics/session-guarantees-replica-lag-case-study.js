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
      heading: 'Why it exists',
      paragraphs: [
        'Replicated systems often serve reads from nearby or lightly loaded replicas. That keeps latency low, but it can make one user see time run backward. A user edits a profile, refreshes, lands on a lagging replica, and sees the old profile.',
        'Session guarantees solve that user-facing problem without requiring global linearizability. They include read-your-writes, monotonic reads, monotonic writes, and writes-follow-reads. The system does not promise that every replica is current. It promises that this session will not contradict the history it has already observed.',
      ],
    },
    {
      heading: 'The obvious attempt',
      paragraphs: [
        'The simple approach is sticky sessions: keep sending the same user to the same replica. That works until the replica fails, a region changes, the user switches devices, or a service-to-service call loses the routing context.',
        'The stronger simple approach is to make every read linearizable. That gives a clean global order, but it can add cross-replica coordination to reads that only need to respect one client session. Many products do not need the entire world to agree before showing a user their own cart edit.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The data structure is a per-session high-water mark. A write response or read response advances the mark to the latest logical sequence number, version, timestamp, or dependency set the session has observed. Future reads carry that mark as a minimum freshness requirement.',
        'The invariant is local: do not serve this session from a replica whose state is older than the session token permits. The router can satisfy the token by choosing a fresh replica, waiting for a lagging one to catch up, routing to a primary, or rejecting the low-consistency path.',
      ],
    },
    {
      heading: 'The four guarantees',
      paragraphs: [
        'Read-your-writes means a session that writes version 8 should not later read version 5 of the same item. Monotonic reads mean a session that has seen version 8 should not later see version 7. Monotonic writes mean the session writes in an order the system preserves. Writes-follow-reads means a write that depends on a prior read carries that dependency forward.',
        'These guarantees are weaker than linearizability because they do not order every operation from every client. They are stronger than arbitrary eventual consistency because they preserve one session story.',
      ],
    },
    {
      heading: 'How the token is used',
      paragraphs: [
        'The useful object is the session token. After a write, the token records the version, log sequence number, timestamp, or dependency frontier that the session has observed. Later reads carry that token as a minimum freshness requirement. A replica below the token is not eligible to answer unless the router waits for it to catch up.',
        'This turns replica choice into a data-dependent routing decision. The router is not merely choosing the closest replica; it is choosing a replica fresh enough for this user history. A different user with no token may receive a stale but fast read, while this session gets a slower but coherent read.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A write returns a token such as an LSN, vector-like dependency, or service-specific session value. The client stores it and sends it on later reads and writes. The read router checks candidate replicas against the token. A replica that has caught up can serve the read; a lagging replica must wait, be skipped, or forward the request.',
        'Azure Cosmos DB documents practical session tokens for read-your-writes behavior: https://learn.microsoft.com/en-us/azure/cosmos-db/consistency-levels. The general idea goes back to the classic session-guarantees paper by Terry, Demers, Petersen, Spreitzer, Theimer, and Welch: https://www.cs.cornell.edu/courses/cs734/2000FA/cached%20papers/SessionGuaranteesPDIS_1.html.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is monotonicity over the session token. The token only advances as the session observes newer state. If every later operation requires a replica at least as fresh as the token, that session cannot move backward relative to its own observations.',
        'This is not a claim that the replica is globally latest. It is a claim that the chosen replica satisfies the session lower bound. Other clients may still see older data if their contracts allow stale reads.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Session guarantees add token plumbing to clients, APIs, routers, caches, and service calls. The token must be carried across devices or backend calls when the user experience depends on it. Lose the token and the system falls back to ordinary replica freshness.',
        'Freshness constraints can increase latency. A nearby replica may need to wait for replication, or the router may send the read to a farther region or primary. Large dependency tokens can also become a metadata cost in systems with many partitions or causal dependencies.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Session guarantees win in product flows where self-contradiction is worse than slight routing complexity: carts, profiles, account settings, document edits, dashboards after a write, and mobile-to-web handoff.',
        'They are also useful in multi-region systems. A regional failover can move traffic without making a user forget an update, as long as the token crosses the failover boundary and the new region can satisfy or wait for it.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Session guarantees are the wrong contract when the application needs one real-time order for all clients, such as strict inventory decrement, certain financial ledgers, or coordination locks. Those need stronger consistency or transaction protocols.',
        'They also fail if the application treats the token as optional while promising read-your-writes in the UI. Sticky routing alone is not enough once traffic moves across devices, services, regions, or recovery paths.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A shopping cart service writes to a quorum and replicates asynchronously across regions. The add-item response includes a session token for cart version 19. The browser sends that token on later cart reads. If the nearest replica is at version 16, the router waits until it reaches 19, chooses a fresher replica, or sends the read to the primary.',
        'After a regional failover, the token prevents the user from seeing an older cart just because DNS or a load balancer moved them to another replica. The system stays eventually consistent for clients that accept stale reads, while this session keeps a coherent cart history.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'A session-guarantee implementation should track token propagation rate, reads that had to wait for freshness, fallback-to-primary rate, replica lag by partition, token size, cross-region token failures, and user-visible stale-read reports. These metrics tell operators whether the guarantee is actually being delivered or only documented.',
        'The highest-risk path is context loss. If a frontend drops the token, a background service strips it, or a mobile client switches devices without carrying it, the system may violate read-your-writes while every replica behaves correctly according to its own local state. Session guarantees are end-to-end contracts, not storage-engine features alone.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Session guarantees are a middle ground. They are stronger than arbitrary eventual consistency because one user does not move backward through their own history. They are weaker and cheaper than global linearizability because they do not order every client against every other client.',
        'The deep lesson is that consistency can be scoped. A product may not need the world to agree before every read, but it often needs a user to see a coherent story after their own actions. Session tokens make that story explicit.',
        'The wrong tool is global consistency by default. If the only user-facing requirement is "show me my own write," a per-session high-water mark may deliver the experience with less coordination. If the requirement is "everyone must agree before the next action," session guarantees are too weak. Teach students to name the user promise before choosing the consistency model.',
        'If students remember one diagnostic question, make it this: whose history must remain coherent? Session guarantees answer "this user or workflow," not "the entire system."',
        'The comparison to caching is useful. A cache can serve stale data safely only when the caller\'s freshness contract allows it. A session token is the caller carrying that contract into the cache or replica-routing layer.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Session Guarantees for Weakly Consistent Replicated Data at https://www.cs.cornell.edu/courses/cs734/2000FA/cached%20papers/SessionGuaranteesPDIS_1.html, DBLP entry at https://dblp.org/rec/conf/pdis/TerryDPSTW94.html, Azure Cosmos DB consistency levels at https://learn.microsoft.com/en-us/azure/cosmos-db/consistency-levels, and Amazon Dynamo at https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf.',
        'Study Read/Write Quorums for replica acknowledgment rules, Amazon Dynamo Case Study for eventual-consistency lineage, Version Vectors for dependency tracking, Read Repair Digest Quorum for touched-replica convergence, Hinted Handoff Replica Queue for short-outage catchup, Cache Invalidation for freshness boundaries, and CRDTs for another way to preserve useful behavior under replication.',
      ],
    },
  ],
};
