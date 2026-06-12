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
  const liveEdgesFrom = (id) => EDGES
    .filter((e) => (e.from === id || e.to === id) && alive.has(e.from) && alive.has(e.to))
    .map((e) => e.id);
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
      highlight: { active: ['S3', 'S5'], compare: [...liveEdgesFrom('S3').filter((e) => !e.includes('S5')), ...liveEdgesFrom('S5').filter((e) => !e.includes('S3'))] },
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
    highlight: { active: ['S3'], compare: liveEdgesFrom('S3') },
    explanation: `RequestVote(term ${term}) goes out. ${splitVote ? 'S2, S4, and S5 are all unvoted in this fresh term — ' : 'S2, S4, and S5 have not voted in this term — '}each grants its single vote to S3. With S3's own vote, that's 4 of 5.`,
  };

  roles.set('S3', 'leader');
  yield {
    state: snapshot(),
    highlight: { found: ['S3'], active: liveEdgesFrom('S3') },
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
        `Raft leader election is the part of Raft that chooses exactly one server to coordinate a replicated log. Diego Ongaro and John Ousterhout designed Raft to be easier to understand than Paxos, and the election protocol is the clearest example: time is divided into numbered terms, each server grants at most one vote per term, and a candidate becomes leader only after winning a majority. In a five-node cluster, any two majorities overlap, so two leaders in the same term cannot both win.`,
        `The leader is not a performance convenience; it is the source of ordering. Clients send writes to the leader, the leader assigns log positions, and Raft Log Replication copies those entries to followers. If the leader dies or becomes unreachable, followers run an election so the cluster can continue without split-brain.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Followers expect heartbeats, often every few tens of milliseconds. If no heartbeat arrives before a randomized election timeout, commonly in the 150-300 ms range in examples, a follower increments its term, votes for itself, persists that vote to disk, and sends RequestVote RPCs. Persisting term and vote before replying matters: after a crash, the node must not forget that it already voted.`,
        `A peer grants its vote only if it has not voted in that term and the candidate's log is at least as up to date as its own. That second rule prevents an old, missing-log server from winning just because it woke up first. If one candidate receives a majority, it becomes leader and immediately sends heartbeats. If votes split, no majority forms; candidates time out again with new random delays and a higher term. A server that observes a higher term steps down, which is how stale leaders lose authority after partitions heal.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Election traffic is O(n^2) in the worst case because candidates ask all peers, but clusters are usually 3, 5, or 7 voting members. A three-node cluster tolerates one failure; a five-node cluster tolerates two. A two-node cluster can elect a leader while both are healthy, but it tolerates zero failures because one survivor is not a majority of two. Election latency is usually one timeout plus a network round trip, so sub-second failover is common inside one region.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `etcd uses Raft to protect Kubernetes control-plane state. Consul uses it for service discovery metadata and configuration. TiKV, CockroachDB, and many embedded libraries use Raft-style groups per shard or range. The CAP Theorem frame is direct: a Raft group chooses consistency over availability when it cannot reach a majority. A Load Balancer can retry stateless requests elsewhere; a Raft minority must refuse writes.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Randomized timeouts reduce repeated split votes, but safety comes from majority overlap and persistent voting, not luck. Another misconception is that election alone means the data is safe. The new leader must also contain every committed entry, which is why the RequestVote up-to-date-log rule exists. If clocks drift, Raft still works because terms and RPCs, not wall-clock timestamps, define authority. The clock only affects how quickly elections start.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Raft Log Replication next: election chooses the leader, but replication proves which commands survive. Write-Ahead Log (WAL) explains how votes, terms, and log entries persist through crashes. CAP Theorem explains why minority partitions refuse service. Consistent Hashing shows a different distributed pattern where ownership is partitioned instead of ordered by one leader, and Distributed Tracing helps diagnose the failover path in production.`,
      ],
    },
  ],
};
