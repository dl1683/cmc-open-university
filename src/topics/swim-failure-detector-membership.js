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
  const hl1 = { active: ['a', 'd', 'e-a-d'], compare: ['b', 'c'] };
  yield {
    state: swimCluster('Each period probes one target'),
    highlight: hl1,
    explanation: `SWIM avoids all-to-all heartbeats. In each protocol period, a node probes one peer from its membership list. Here ${hl1.active.filter(id => !id.startsWith('e-')).length} nodes are active (${hl1.active.filter(id => !id.startsWith('e-')).join(', ')}) with ${hl1.compare.length} helpers (${hl1.compare.join(', ')}) standing by. If the peer answers, the detector learned enough for this period.`,
    invariant: 'Per-node message load stays roughly constant as the cluster grows.',
  };

  const hl2 = { active: ['a', 'b', 'c', 'd', 'e-a-b', 'e-a-c', 'e-b-d', 'e-c-d'], compare: ['e-a-d'] };
  yield {
    state: swimCluster('No direct ACK: ask helpers to probe indirectly'),
    highlight: hl2,
    explanation: `A missed direct ping might be a bad network path from A to D, not a failed D. SWIM asks ${hl2.active.filter(id => !id.startsWith('e-')).length} participating nodes (${hl2.active.filter(id => !id.startsWith('e-')).join(', ')}) to relay indirect probes across ${hl2.active.filter(id => id.startsWith('e-')).length} edges. The ${hl2.compare.length} failed direct edge (${hl2.compare.join(', ')}) is bypassed, reducing false failure detection caused by one bad link.`,
  };

  const hl3 = { active: ['d', 'b', 'c', 'e-d-b', 'e-d-c'], found: ['a'], compare: ['view'] };
  yield {
    state: swimCluster('Indirect ACK clears the suspicion'),
    highlight: hl3,
    explanation: `If D answers one helper, ${hl3.found.join(', ')} can treat D as alive. ${hl3.active.filter(id => !id.startsWith('e-')).length} nodes (${hl3.active.filter(id => !id.startsWith('e-')).join(', ')}) relay the ACK across ${hl3.active.filter(id => id.startsWith('e-')).length} edges. The key idea is not majority voting; it is probabilistic path diversity with tiny message cost.`,
  };

  const rows4 = [
    { id: 'alive', label: 'alive' },
    { id: 'miss', label: 'missed ping' },
    { id: 'suspect', label: 'suspect' },
    { id: 'failed', label: 'failed' },
  ];
  const cols4 = [
    { id: 'meaning', label: 'meaning' },
    { id: 'next', label: 'next action' },
  ];
  const hl4 = { active: ['miss:next', 'suspect:next'], found: ['failed:meaning'] };
  yield {
    state: labelMatrix(
      'Failure detector states',
      rows4,
      cols4,
      [
        ['recent ACK', 'continue probing'],
        ['no direct ACK', 'ask helpers'],
        ['no indirect ACK yet', 'gossip suspicion'],
        ['timeout elapsed', 'gossip failure'],
      ],
    ),
    highlight: hl4,
    explanation: `The ${rows4.length} detector states (${rows4.map(r => r.label).join(', ')}) map across ${cols4.length} columns (${cols4.map(c => c.label).join(', ')}). Many implementations use a suspect state before final failure. That grace period lets a slow node refute suspicion with a newer alive message, reducing false positives. Here ${hl4.active.length} action cells are highlighted: ${hl4.active.join(', ')}.`,
  };

  const hl5 = { active: ['e', 'f', 'view', 'e-e-view', 'e-f-view'], found: ['a', 'b', 'c'] };
  yield {
    state: swimCluster('Membership changes ride on probe traffic'),
    highlight: hl5,
    explanation: `SWIM separates failure detection from dissemination, then composes them: ${hl5.active.filter(id => !id.startsWith('e-')).length} active nodes (${hl5.active.filter(id => !id.startsWith('e-')).join(', ')}) push updates while ${hl5.found.length} nodes (${hl5.found.join(', ')}) receive piggybacked membership changes. The cluster converges without a coordinator or a full broadcast tree.`,
  };
}

function* suspicionGossip() {
  const sRows1 = [
    { id: 'old', label: 'D alive@7' },
    { id: 'sus', label: 'D suspect@7' },
    { id: 'refute', label: 'D alive@8' },
    { id: 'fail', label: 'D failed@7' },
  ];
  const sCols1 = [
    { id: 'wins', label: 'wins over' },
    { id: 'reason', label: 'reason' },
  ];
  const sHl1 = { active: ['sus:wins', 'refute:wins'], found: ['refute:reason'] };
  yield {
    state: labelMatrix(
      'Membership records need incarnation numbers',
      sRows1,
      sCols1,
      [
        ['older records', 'same node, same status'],
        ['alive@7', 'stronger suspicion'],
        ['suspect@7', 'newer incarnation'],
        ['suspect@7 after timeout', 'no refutation'],
      ],
    ),
    highlight: sHl1,
    explanation: `A node can refute a suspicion by advertising a newer incarnation of itself. ${sRows1.length} record types (${sRows1.map(r => r.label).join(', ')}) are compared across ${sCols1.length} columns. ${sHl1.active.length} active cells (${sHl1.active.join(', ')}) show which records win, turning membership state into an ordered record instead of a shouting match between stale gossip messages.`,
  };

  const sHl2 = { active: ['a', 'd', 'view', 'e-e-view', 'e-f-view'], compare: ['b', 'c'] };
  yield {
    state: swimCluster('A suspects D and gossips the suspicion'),
    highlight: sHl2,
    explanation: `Suspicion is intentionally weaker than failure. ${sHl2.active.filter(id => !id.startsWith('e-')).length} nodes (${sHl2.active.filter(id => !id.startsWith('e-')).join(', ')}) are active in spreading the warning, while ${sHl2.compare.length} observers (${sHl2.compare.join(', ')}) can help verify D. It gives D time to prove it is alive.`,
  };

  const sHl3 = { active: ['d', 'view', 'e-d-a', 'e-d-b', 'e-d-c'], found: ['a', 'b', 'c'] };
  yield {
    state: swimCluster('D refutes by publishing alive with a newer incarnation'),
    highlight: sHl3,
    explanation: `If D is merely slow, it can send an alive update with a higher incarnation across ${sHl3.active.filter(id => id.startsWith('e-')).length} edges (${sHl3.active.filter(id => id.startsWith('e-')).join(', ')}). ${sHl3.found.length} receivers (${sHl3.found.join(', ')}) keep the newer record and drop the stale suspicion.`,
  };

  const sRows4 = [
    { id: 'central', label: 'central monitor' },
    { id: 'all', label: 'all-to-all' },
    { id: 'swim', label: 'SWIM' },
  ];
  const sCols4 = [
    { id: 'load', label: 'per-node load' },
    { id: 'weakness', label: 'weakness' },
  ];
  const sHl4 = { active: ['swim:load'], compare: ['central:weakness', 'all:load'] };
  yield {
    state: labelMatrix(
      'Why SWIM scales better than naive heartbeats',
      sRows4,
      sCols4,
      [
        ['monitor hot spot', 'single authority fails'],
        ['grows with cluster', 'message storm'],
        ['constant-ish probes', 'probabilistic delay'],
      ],
    ),
    highlight: sHl4,
    explanation: `Comparing ${sRows4.length} approaches (${sRows4.map(r => r.label).join(', ')}) across ${sCols4.length} dimensions (${sCols4.map(c => c.label).join(', ')}). ${sHl4.active.length} SWIM strength (${sHl4.active.join(', ')}) is highlighted against ${sHl4.compare.length} weaknesses of alternatives (${sHl4.compare.join(', ')}). SWIM trades immediate global certainty for stable local work.`,
  };

  const sHl5 = { active: ['a', 'd', 'view'], found: ['b', 'c', 'e', 'f'] };
  yield {
    state: swimCluster('Complete case: probe, suspect, refute or fail, disseminate'),
    highlight: sHl5,
    explanation: `The complete loop is small: ${sHl5.active.length} core participants (${sHl5.active.join(', ')}) drive the probe-suspect-resolve cycle while ${sHl5.found.length} members (${sHl5.found.join(', ')}) receive the gossiped outcome. Randomly probe, use indirect probes on timeout, mark suspect rather than instantly failed, use incarnation numbers to refute stale suspicion, and gossip the final membership view.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read node A as the current prober and node D as the target for this protocol period. A direct ping asks whether D responds on this path now; an indirect ping asks helpers to test other paths before A declares suspicion.',
        'The membership records carry states such as alive, suspect, and failed plus an incarnation number, which is a version for one member. A newer incarnation beats stale gossip about the same member.',
        {
          type: 'image',
          src: './assets/gifs/swim-failure-detector-membership.gif',
          alt: 'Animated walkthrough of the swim failure detector membership visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'callout',
          text: 'SWIM scales by making membership an eventually spread record, not a synchronized heartbeat matrix.',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg',
          alt: 'Rows of server racks in a data center.',
          caption: 'Membership protocols matter because a service often spans many machines, and every machine needs a usable view of peer liveness. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Wikimedia_Foundation_Servers-8055_35.jpg.',
        },
        'A distributed cluster needs a usable view of which peers are alive. Storage replicas, service discovery systems, actor runtimes, and schedulers all make routing decisions from membership state.',
        'Perfect failure detection is impossible in an asynchronous network because a slow node and a dead node can look identical for a while. SWIM exists to keep the work bounded while letting the cluster converge on good enough liveness information.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is all-to-all heartbeats. Every node periodically pings every other node and marks peers failed after missed responses.',
        'That works in small clusters and gives direct evidence. In a 1,000-node cluster, each period asks each node to send 999 probes, and the cluster sends about 999,000 probe messages before application traffic is counted.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is message growth. All-to-all monitoring makes membership traffic grow with n^2 across the cluster, so the failure detector becomes a load source.',
        'A central monitor reduces messages but creates a hot authority. If that monitor is partitioned or overloaded, it can make the whole cluster believe the wrong story.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate detection from dissemination. Detection probes a small number of peers locally; dissemination spreads the resulting membership records through gossip.',
        'Suspicion is deliberately weaker than failure. It gives a slow node time to refute the claim with a newer incarnation before the cluster treats it as dead.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif',
          alt: 'Animated packet switching paths through a small network.',
          caption: 'Packet paths can fail asymmetrically, which is why SWIM asks helper nodes before turning one missed ping into failure. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Packet_Switching.gif.',
        },
        'Each protocol period, a node chooses one target from its membership list and sends a ping. If the target acknowledges, the period ends and the node may piggyback membership updates on later messages.',
        'If the direct ping times out, the prober asks a few helpers to ping the target indirectly. If any helper receives an acknowledgement from the target, the prober avoids marking it failed.',
        'If no answer returns, the prober gossips a suspect record. The target can refute it by publishing alive with a higher incarnation number; otherwise the suspicion can mature into failed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The scaling argument is per-node bounded work. A node probes one target and a small helper set per period, so its normal load does not grow linearly with the full cluster size.',
        'The correctness argument is eventual convergence, not instant agreement. If live nodes keep exchanging membership records and newer records dominate older ones, then a record that keeps being gossiped eventually reaches most reachable members.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Normal probe cost is O(1) messages per node per period, plus a bounded indirect-probe fanout after timeouts. Gossip increases total traffic by piggybacking small records on protocol messages rather than broadcasting every change immediately.',
        'Detection time depends on protocol period, helper fanout, timeout length, and suspicion timeout. Short timeouts detect faster but increase false positives; longer timeouts reduce false positives but route around real failures later.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SWIM-style membership appears in systems that need decentralized cluster views, including hash-ring storage, service discovery, and actor or gossip runtimes. The fit is best when approximate membership is acceptable and central coordination would be too expensive.',
        'It is also useful when clusters are elastic. Joins, leaves, pauses, and partial network failures can be recorded as membership updates instead of handled through one global lock.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SWIM does not give strong consistency. Two nodes can hold different membership views for a while, especially during partitions or message loss.',
        'It also depends on careful timeout tuning. If timeouts are too tight for the network, healthy nodes become suspect often; if too loose, dead nodes stay in routing tables too long.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'In a 500-node cluster, all-to-all heartbeats send 500 * 499 = 249,500 probes per period. SWIM with one direct target and three helpers after a miss sends about 500 direct probes in the normal case, with extra probes only for suspected targets.',
        'Suppose A suspects D at incarnation 7. D is alive but paused, then resumes and gossips alive at incarnation 8. Receivers keep D alive@8 and reject D suspect@7 because the newer incarnation is the ordered record for the same member.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Das, Gupta, and Motivala 2002 for the SWIM paper and Chandra and Toueg for failure-detector theory. Next study gossip protocols, consistent hashing, hinted handoff, and circuit breakers for systems that consume membership decisions.',
      ],
    },
  ],
};
