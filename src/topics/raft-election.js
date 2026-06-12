// Raft leader election: five servers, one crown, zero split-brain.
// Randomized timeouts nominate a candidate; a majority of votes makes it
// safe — because two majorities of five cannot exist.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'raft-election',
  title: 'Raft Leader Election',
  category: 'Systems',
  summary: 'How a cluster agrees on one leader after a crash — terms, votes, and the majority that prevents split-brain.',
  controls: [
    { id: 'scenario', label: 'Scenario', type: 'select', options: ['clean election', 'split vote, then retry'], defaultValue: 'clean election' },
  ],
  run,
};

// Five servers on a pentagon. S1 starts as leader of term 3.
const SERVERS = ['S1', 'S2', 'S3', 'S4', 'S5'];
const POS = SERVERS.map((id, i) => {
  const angle = (i / SERVERS.length) * 2 * Math.PI - Math.PI / 2;
  return { id, x: 5 + 3.8 * Math.cos(angle), y: 5 + 3.8 * Math.sin(angle) };
});
const EDGES = [];
for (let i = 0; i < SERVERS.length; i += 1) {
  for (let j = i + 1; j < SERVERS.length; j += 1) {
    EDGES.push({ id: `e${SERVERS[i]}${SERVERS[j]}`, from: SERVERS[i], to: SERVERS[j] });
  }
}
const edgesFrom = (id) => EDGES.filter((e) => e.from === id || e.to === id).map((e) => e.id);

export function* run(input) {
  const splitVote = String(input.scenario) === 'split vote, then retry';
  if (!['clean election', 'split vote, then retry'].includes(String(input.scenario))) {
    throw new InputError('Pick a scenario.');
  }

  const roles = new Map(SERVERS.map((s) => [s, 'follower']));
  const alive = new Set(SERVERS);
  let term = 3;
  roles.set('S1', 'leader');

  const snapshot = () => graphState({
    nodes: POS.filter((p) => alive.has(p.id)).map((p) => ({
      ...p,
      label: p.id,
      note: `${roles.get(p.id)} · t${term === 3 || roles.get(p.id) !== 'follower' ? term : term}`,
    })),
    edges: EDGES.filter((e) => alive.has(e.from) && alive.has(e.to)),
  });

  yield {
    state: snapshot(),
    highlight: { found: ['S1'], active: edgesFrom('S1') },
    explanation: 'Five servers replicate the same Write-Ahead Log — but SOMEONE must decide the order of entries, or replicas diverge. Raft\'s answer: exactly one LEADER per TERM (a logical era, currently term 3). S1 leads, proving it\'s alive with constant heartbeats. Every other server is a follower with an election timer that resets on each heartbeat received.',
  };

  alive.delete('S1');
  yield {
    state: snapshot(),
    highlight: {},
    explanation: '⚡ S1 dies. The heartbeats stop — but nobody is told; followers just notice SILENCE. Each follower\'s election timer keeps counting down, and here is Raft\'s sly trick: every timer was set to a RANDOM duration (say 150–300ms), so they will not all expire at once.',
    invariant: 'Randomized timeouts are the tie-breaker built into the protocol itself.',
  };

  term += 1;
  roles.set('S3', 'candidate');
  yield {
    state: snapshot(),
    highlight: { active: ['S3'] },
    explanation: `S3's timer fires first. It becomes a CANDIDATE: increments the term to ${term}, votes for ITSELF, and sends RequestVote to everyone. The rule each receiver follows is tiny: one vote per term, first eligible candidate to ask gets it — and the vote is persisted to disk (a tiny WAL!) so a reboot cannot double-vote.`,
  };

  if (splitVote) {
    roles.set('S5', 'candidate');
    yield {
      state: snapshot(),
      highlight: { active: ['S3', 'S5'], compare: [...edgesFrom('S3').filter((e) => !e.includes('S5')), ...edgesFrom('S5').filter((e) => !e.includes('S3'))] },
      explanation: `Bad luck: S5's timer fired almost simultaneously — TWO candidates for term ${term}. S2 votes for S3; S4 votes for S5; each candidate has its own vote. Tally: S3 has 2, S5 has 2 — with S1 dead, NOBODY reaches the majority of 3. The election fails… safely. No majority, no leader, no harm.`,
      invariant: 'A term can elect at most one leader, because each server votes once per term.',
    };

    term += 1;
    roles.set('S5', 'follower');
    yield {
      state: snapshot(),
      highlight: { active: ['S3'] },
      explanation: `Both candidates time out and re-roll their RANDOM timers — this time S3 draws a much shorter one and starts term ${term} alone before S5's timer fires. This is why the randomness matters: repeated ties become exponentially unlikely. (In practice split votes resolve within a few hundred milliseconds.)`,
    };
  }

  yield {
    state: snapshot(),
    highlight: { active: ['S3'], compare: edgesFrom('S3') },
    explanation: `RequestVote(term ${term}) goes out. ${splitVote ? 'S2, S4, and S5 are all unvoted in this fresh term — ' : 'S2, S4, and S5 have not voted in this term — '}each grants its single vote to S3. With S3's own vote, that's 4 of 5.`,
  };

  roles.set('S3', 'leader');
  yield {
    state: snapshot(),
    highlight: { found: ['S3'], active: edgesFrom('S3') },
    explanation: `MAJORITY (3 of 5 needed): S3 is the leader of term ${term} and immediately starts heartbeating. Now the safety argument, the entire reason this works: a second leader in term ${term} would need its own majority — but two majorities of 5 servers must OVERLAP in at least one server, and that server only had one vote to give. Split-brain isn't unlikely; it is ARITHMETICALLY impossible.`,
    invariant: 'Any two majorities of the same cluster share at least one member.',
  };

  yield {
    state: snapshot(),
    highlight: { found: ['S3'] },
    explanation: `When S1 reboots, it hears heartbeats stamped term ${term} > its remembered term 3, and instantly steps down to follower — old leaders cannot un-elect new ones. This election protocol (plus log replication, where the leader commits entries once a majority confirms them) runs etcd — meaning every Kubernetes cluster — plus Consul, CockroachDB, and TiDB. Five servers, coin-flip timers, and counting to three: that is how distributed systems crown a king.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Raft leader election solves the split-brain problem: how do the surviving servers in a cluster agree on one leader to coordinate writes — without deadlock or two leaders claiming power? The answer: randomized election timers (150–300 ms) nominate candidates, votes are one per term (recorded on disk), and a majority wins. Two majorities of five servers MUST overlap in at least one member, and that member gave its single vote already. Therefore, two leaders in the same term are arithmetically impossible — no luck required.`,
        `Terms are epochs of authority. When a server hears a heartbeat or vote request stamped with a higher term than it remembers, it instantly steps down and adopts the new term. This prevents stale leaders (crashed servers that rebooted) from claiming power after a partition heals.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The leader sends heartbeats to all followers every ~50 ms. Each heartbeat resets the follower's election timer. When the leader dies, heartbeats stop. Followers' randomized timers tick down and expire at staggered times. The first timer to fire (say, S3's) triggers an election: S3 increments the term, votes for itself, and sends RequestVote to all peers. Each peer follows a simple rule: grant one vote per term to the first eligible candidate, write it to disk before answering. S3 collects votes: its own, plus S2 and S4. That is three of five — a majority. S3 becomes leader and broadcasts heartbeats. If two candidates split the votes (S3 gets two, S5 gets two), neither reaches three votes. Both time out, randomize fresh timers, and the next timer to fire starts a new term. Split votes resolve within milliseconds.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Each server persists two pieces of state: its current term and the server ID it voted for in that term. Election latency is bounded by the longest timer (300 ms worst case) plus network delay; in practice, sub-second convergence is typical. The protocol is safe because math, not luck — split-brain is impossible by design.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Raft powers etcd, the metadata backbone of every Kubernetes cluster. Consul (service discovery), CockroachDB and TiDB (distributed SQL), and Elasticsearch all use Raft. It is now the default consensus protocol in modern infrastructure because it combines elegance with proof of correctness grounded in arithmetic.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Randomized timeouts are not a gamble — exponential re-randomization makes collisions exponentially unlikely. A cluster of five servers needs at least three. Never deploy fewer than three; two servers cannot elect (neither has a majority of two). Raft election alone does not replicate data; log replication is the second phase, where the leader commits entries once a majority persists them. Both together form the complete protocol.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `After election, the leader broadcasts commands safely via Write-Ahead Log (WAL). Log replication shows how to extend election into full consensus: the leader proposes, the majority confirms, the leader commits. Consistent Hashing splits data across clusters without needing a leader. Load Balancer sketches the boundary: stateless replicas need no leader; stateful clusters rely on Raft.`,
      ],
    },
  ],
};

