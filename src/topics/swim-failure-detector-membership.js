// SWIM membership: randomized probes plus gossip-style dissemination.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'swim-failure-detector-membership',
  title: 'SWIM Failure Detector & Membership',
  category: 'Systems',
  summary: 'A scalable membership protocol: probe one peer, ask helpers for indirect pings, move through suspect states, and gossip membership changes.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['probe protocol', 'suspicion gossip'], defaultValue: 'probe protocol' },
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

function swimCluster(title) {
  return graphState({
    nodes: [
      { id: 'a', label: 'A', x: 0.9, y: 4.0, note: 'prober' },
      { id: 'b', label: 'B', x: 3.0, y: 1.6, note: 'helper' },
      { id: 'c', label: 'C', x: 3.0, y: 6.4, note: 'helper' },
      { id: 'd', label: 'D', x: 5.1, y: 4.0, note: 'target' },
      { id: 'e', label: 'E', x: 7.2, y: 2.0, note: 'member' },
      { id: 'f', label: 'F', x: 7.2, y: 6.0, note: 'member' },
      { id: 'view', label: 'views', x: 9.1, y: 4.0, note: 'membership' },
    ],
    edges: [
      { id: 'e-a-d', from: 'a', to: 'd', weight: '' },
      { id: 'e-a-b', from: 'a', to: 'b', weight: '' },
      { id: 'e-a-c', from: 'a', to: 'c', weight: '' },
      { id: 'e-b-d', from: 'b', to: 'd', weight: '' },
      { id: 'e-c-d', from: 'c', to: 'd', weight: '' },
      { id: 'e-d-a', from: 'd', to: 'a', weight: '' },
      { id: 'e-d-b', from: 'd', to: 'b', weight: '' },
      { id: 'e-d-c', from: 'd', to: 'c', weight: '' },
      { id: 'e-e-view', from: 'e', to: 'view', weight: '' },
      { id: 'e-f-view', from: 'f', to: 'view', weight: '' },
    ],
  }, { title });
}

function* probeProtocol() {
  yield {
    state: swimCluster('Each period probes one target'),
    highlight: { active: ['a', 'd', 'e-a-d'], compare: ['b', 'c'] },
    explanation: 'SWIM avoids all-to-all heartbeats. In each protocol period, a node probes one peer from its membership list. If the peer answers, the detector learned enough for this period.',
    invariant: 'Per-node message load stays roughly constant as the cluster grows.',
  };

  yield {
    state: swimCluster('No direct ACK: ask helpers to probe indirectly'),
    highlight: { active: ['a', 'b', 'c', 'd', 'e-a-b', 'e-a-c', 'e-b-d', 'e-c-d'], compare: ['e-a-d'] },
    explanation: 'A missed direct ping might be a bad network path from A to D, not a failed D. SWIM asks a few helpers to ping D. That outsourced heartbeat reduces false failure detection caused by one bad link.',
  };

  yield {
    state: swimCluster('Indirect ACK clears the suspicion'),
    highlight: { active: ['d', 'b', 'c', 'e-d-b', 'e-d-c'], found: ['a'], compare: ['view'] },
    explanation: 'If D answers one helper, A can treat D as alive. The key idea is not majority voting; it is probabilistic path diversity with tiny message cost.',
  };

  yield {
    state: labelMatrix(
      'Failure detector states',
      [
        { id: 'alive', label: 'alive' },
        { id: 'miss', label: 'missed ping' },
        { id: 'suspect', label: 'suspect' },
        { id: 'failed', label: 'failed' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'next', label: 'next action' },
      ],
      [
        ['recent ACK', 'continue probing'],
        ['no direct ACK', 'ask helpers'],
        ['no indirect ACK yet', 'gossip suspicion'],
        ['timeout elapsed', 'gossip failure'],
      ],
    ),
    highlight: { active: ['miss:next', 'suspect:next'], found: ['failed:meaning'] },
    explanation: 'Many implementations use a suspect state before final failure. That grace period lets a slow node refute suspicion with a newer alive message, reducing false positives.',
  };

  yield {
    state: swimCluster('Membership changes ride on probe traffic'),
    highlight: { active: ['e', 'f', 'view', 'e-e-view', 'e-f-view'], found: ['a', 'b', 'c'] },
    explanation: 'SWIM separates failure detection from dissemination, then composes them: probe messages can piggyback membership updates. The cluster converges without a coordinator or a full broadcast tree.',
  };
}

function* suspicionGossip() {
  yield {
    state: labelMatrix(
      'Membership records need incarnation numbers',
      [
        { id: 'old', label: 'D alive@7' },
        { id: 'sus', label: 'D suspect@7' },
        { id: 'refute', label: 'D alive@8' },
        { id: 'fail', label: 'D failed@7' },
      ],
      [
        { id: 'wins', label: 'wins over' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['older records', 'same node, same status'],
        ['alive@7', 'stronger suspicion'],
        ['suspect@7', 'newer incarnation'],
        ['suspect@7 after timeout', 'no refutation'],
      ],
    ),
    highlight: { active: ['sus:wins', 'refute:wins'], found: ['refute:reason'] },
    explanation: 'A node can refute a suspicion by advertising a newer incarnation of itself. This turns membership state into an ordered record instead of a shouting match between stale gossip messages.',
  };

  yield {
    state: swimCluster('A suspects D and gossips the suspicion'),
    highlight: { active: ['a', 'd', 'view', 'e-e-view', 'e-f-view'], compare: ['b', 'c'] },
    explanation: 'Suspicion is intentionally weaker than failure. It spreads the warning so other nodes can help observe D, but it gives D time to prove it is alive.',
  };

  yield {
    state: swimCluster('D refutes by publishing alive with a newer incarnation'),
    highlight: { active: ['d', 'view', 'e-d-a', 'e-d-b', 'e-d-c'], found: ['a', 'b', 'c'] },
    explanation: 'If D is merely slow, it can send an alive update with a higher incarnation. Receivers keep the newer record and drop the stale suspicion.',
  };

  yield {
    state: labelMatrix(
      'Why SWIM scales better than naive heartbeats',
      [
        { id: 'central', label: 'central monitor' },
        { id: 'all', label: 'all-to-all' },
        { id: 'swim', label: 'SWIM' },
      ],
      [
        { id: 'load', label: 'per-node load' },
        { id: 'weakness', label: 'weakness' },
      ],
      [
        ['monitor hot spot', 'single authority fails'],
        ['grows with cluster', 'message storm'],
        ['constant-ish probes', 'probabilistic delay'],
      ],
    ),
    highlight: { active: ['swim:load'], compare: ['central:weakness', 'all:load'] },
    explanation: 'SWIM trades immediate global certainty for stable local work. That is the correct trade when membership is large, changing, and already probabilistic under packet loss.',
  };

  yield {
    state: swimCluster('Complete case: probe, suspect, refute or fail, disseminate'),
    highlight: { active: ['a', 'd', 'view'], found: ['b', 'c', 'e', 'f'] },
    explanation: 'The complete loop is small: randomly probe, use indirect probes on timeout, mark suspect rather than instantly failed, use incarnation numbers to refute stale suspicion, and gossip the final membership view.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'probe protocol') yield* probeProtocol();
  else if (view === 'suspicion gossip') yield* suspicionGossip();
  else throw new InputError('Pick a SWIM view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'SWIM is a scalable membership protocol. Each node maintains a local view of which peers are alive, suspect, failed, joined, or left. It does this without a central heartbeat service and without every node pinging every other node.',
        'The design has two pieces: a failure detector that periodically probes one peer, and a dissemination layer that spreads membership updates in infection-style gossip. The result is stable per-node message load, bounded expected detection time, and eventual convergence of membership views.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In each protocol period, node A pings one target D. If D ACKs, A moves on. If not, A asks a few helpers to ping D. If a helper reaches D, the suspicion clears; the problem may have been only the A-to-D path. If nobody gets an ACK before the timeout, A marks D suspect or failed, depending on the implementation stage.',
        'Suspicion reduces false positives. A suspected node can refute the suspicion by gossiping an alive record with a newer incarnation number. Membership records therefore need both a status and an ordering field. Stale gossip should not overwrite newer evidence.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'SWIM keeps per-node probe work roughly constant: one direct target plus a small number of indirect helpers. Dissemination can piggyback on ordinary probe messages, so membership updates do not require a separate full-cluster broadcast.',
        'The complexity moves into timeouts, suspicion windows, incarnation numbers, and deployment tuning. Too aggressive a timeout creates false failures during GC pauses or network jitter. Too slow a timeout delays failover. The protocol gives a scalable shape, not magic failure truth.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A cluster of storage nodes uses SWIM-style membership. A probes D and gets no response. A asks B and C to probe D. B also times out, but C receives an ACK from D. A keeps D alive and avoids triggering replica movement from one bad network path. Later, D actually crashes; direct and indirect probes fail, D becomes suspect, the suspicion is gossiped, no refutation arrives, and the failed membership record spreads through the cluster.',
        'That case study links Gossip Protocol to real membership. Gossip by itself spreads a fact. SWIM decides which membership facts to spread and how to keep the detector scalable.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Das, Gupta, and Motivala, "SWIM: Scalable Weakly-consistent Infection-style Process Group Membership Protocol": https://www.cs.cornell.edu/projects/Quicksilver/public_pdfs/SWIM.pdf. ACM entry: https://dl.acm.org/doi/10.5555/647883.738420. Study Gossip Protocol, Consistent Hashing, Dynamo Case Study, Cassandra Repair Case Study, Raft Leader Election, and Read/Write Quorums next.',
      ],
    },
  ],
};
