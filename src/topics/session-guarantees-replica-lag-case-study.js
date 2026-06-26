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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a replica-routing trace. A replica is a copy of data, replica lag is the delay before a copy receives a write, and a session token is metadata carried by one user or workflow to say how fresh later reads must be.',
        'Active nodes are the client, router, or replica making the current decision. A replica marked stale is not morally bad; it is only below the session high-water mark, so it cannot answer this read without breaking the user history.',
        'The safe inference rule is simple: if a session has observed version 19, any later read for that session must come from a replica at version 19 or newer, wait until one catches up, or route to a stronger path.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Replicated systems keep copies of data in several machines or regions so reads stay fast and failures do not erase the service. The cost is that replicas do not all receive writes at the same instant. A user can update a cart on one replica, refresh through another replica, and see the old cart.',
        'Session guarantees are consistency rules scoped to one session rather than the whole world. They include read-your-writes, monotonic reads, monotonic writes, and writes-follow-reads. The system does not promise every client sees the latest value; it promises this client will not move backward through state it has already seen.',
        {type:'callout', text:'Session guarantees scope freshness to one user history by carrying a high-water mark through replica routing.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first approach is sticky routing: keep one user pinned to one replica. That can preserve a coherent view while the replica stays healthy and the user path stays simple. It fails when the replica dies, a region fails over, a backend service performs the next read, or the user switches device.',
        'The stronger approach is linearizable reads, where every read observes a single global order. That is clean, but it can force coordination with a leader or quorum for reads that only need to respect one user history. Many product flows need read-your-writes, not a global agreement point for every observer.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is hidden context loss. The storage system may have enough information to tell which replica is fresh, but a stateless request can arrive without saying what this session has already observed. The router then optimizes for latency and can choose a replica whose version is older than the user memory.',
        'Replica lag turns that missing context into a correctness bug. A replica at version 16 is fine for a new anonymous read, but wrong for a session that just wrote version 19. Correctness depends on a lower bound carried across clients, proxies, services, caches, and failover paths.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core data structure is a per-session high-water mark. A high-water mark is the newest version, log sequence number, timestamp, or dependency frontier the session has observed. Each response can advance it, and each later request carries it as a minimum freshness requirement.',
        'The invariant is local and checkable: never serve this session from state older than its token. The router can satisfy the invariant by choosing a fresh replica, waiting for catchup, forwarding to the primary, or rejecting the stale-read path. The rest of the system may remain eventually consistent.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A write commits as a new version and returns a token, such as cart:19 or a vector of partition versions. The client stores that token and sends it on later reads and writes. The router compares candidate replicas against the token before it lets one answer.',
        'If the nearest replica is fresh enough, the read stays fast. If the nearest replica is behind, the router has three common choices: wait for replication, route to a farther fresh replica, or route to the primary. Each choice spends latency, availability, or load to preserve the session story.',
        'Writes-follow-reads uses the same idea for dependencies. If a session reads profile version 7 and then writes a setting that depends on it, the write must carry that dependency so the system does not commit it as if the older profile state were irrelevant.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is monotonicity. The session token only advances as the session observes newer state. If every later operation requires a replica whose state is at least that token, the session cannot observe version 16 after it has already observed version 19.',
        'This proof does not say the chosen replica is globally latest. It says the replica satisfies the lower bound required by this session. Other sessions with lower tokens can still receive stale reads if their contract allows it, which is why the guarantee is cheaper than global linearizability.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The time cost appears when the closest replica is too far behind. A read that would take 12 ms locally may wait 40 ms for catchup or travel 80 ms to a fresh region. As lag grows, the router spends more time on coordination paths even though the read itself is simple.',
        'The space cost is token metadata and dependency tracking. A single-partition token can be a small version number, but a multi-partition workflow may need a vector or compact dependency frontier. Engineering cost often dominates: every client, proxy, cache, and backend call must preserve the token or the guarantee silently disappears.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Session guarantees fit carts, profiles, dashboards after a write, document edits, account settings, and mobile-to-web handoff. These flows do not require every user to see the same value at the same instant, but they do require one user not to see their own action vanish.',
        'They are also useful during regional failover. Traffic can move from region A to region B while the token tells region B the freshness floor it must satisfy. Without the token, failover can look successful at the infrastructure layer while users see older state.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Session guarantees are too weak for invariants that require one real-time order across clients. Inventory decrement, bank ledger movement, lock ownership, and uniqueness constraints usually need transactions, quorum protocols, or linearizable reads. A coherent personal story is not the same as a globally safe decision.',
        'They also fail in systems that treat metadata as optional. If a CDN strips the token, a background worker reads without it, or a mobile client loses it during login, every replica can behave correctly locally while the end-to-end product promise is broken.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A cart has three replicas. Replica A is at version 19, replica B is at version 18, and replica C is at version 16. The user adds a charger, the write commits at version 19, and the response returns token cart:19.',
        'On refresh, the nearest replica is C with 8 ms network latency. A plain router would use C and show the old cart. A session-aware router rejects C because 16 is below 19, rejects B because 18 is below 19, and chooses A at 55 ms or waits until B reaches 19.',
        'The cost is visible. The guarantee turns an 8 ms stale read into a 55 ms coherent read, or into a wait that may be shorter if B catches up in 25 ms. That extra latency is the price of preserving the user history without making every read globally linearizable.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Terry, Demers, Petersen, Spreitzer, Theimer, and Welch, Session Guarantees for Weakly Consistent Replicated Data; the Amazon Dynamo paper for eventual-consistency lineage; and Azure Cosmos DB consistency documentation for a production session-token model.',
        'Study read/write quorums for acknowledgment rules, version vectors for dependency frontiers, read repair for convergence, hinted handoff for outage recovery, cache invalidation for freshness boundaries, and CRDTs for a different way to preserve useful behavior under replication.',
      ],
    },
  ],
};