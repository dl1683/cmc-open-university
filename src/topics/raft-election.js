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
      note: `${roles.get(p.id)} Â· t${term === 3 || roles.get(p.id) !== 'follower' ? term : term}`,
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
    explanation: 'âš¡ S1 dies. The heartbeats stop — but nobody is told; followers just notice SILENCE. Each follower\'s election timer keeps counting down, and here is Raft\'s sly trick: every timer was set to a RANDOM duration (say 150–300ms), so they will not all expire at once.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Five servers sit on a pentagon. Each carries a role label (leader, follower, or candidate) and a term number. Highlighted (found) nodes are the current leader. Active nodes are candidates requesting votes. Lit edges show vote traffic or heartbeat paths.',
        { type: 'callout', text: 'Raft election safety is majority overlap plus one durable vote per term.' },
        'Watch the term counter: it increments on every election attempt. When a node turns candidate, it votes for itself and lights edges to request votes from peers. When enough edges light up (a majority responds), the candidate turns leader. In the split-vote scenario, two candidates light up simultaneously but neither collects enough edges, so the term ends leaderless and a fresh term begins.',
        'The key inference: if a node is highlighted as leader for term T, no other node can be highlighted as leader for the same term T, because the majority that elected it overlaps with any other possible majority.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A replicated state machine runs the same commands in the same order on every server, so any server can answer reads and any surviving majority can continue after failures. The hard part is agreeing on that order. If two servers both accept writes independently, replicas diverge and clients see conflicting histories.',
        'Paxos (Lamport, 1998) solved this problem, but its specification is notoriously difficult to implement correctly. Entire engineering teams have shipped subtly broken Paxos implementations because the protocol separates proposers, acceptors, and learners in ways that are hard to map onto practical systems.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Raft_Consensus_Algorithm_Mascot_on_transparent_background.svg/250px-Raft_Consensus_Algorithm_Mascot_on_transparent_background.svg.png', alt: 'Raft consensus algorithm mascot', caption: 'The official Raft material emphasizes understandability; the protocol earns that by separating election, replication, and safety. Source: Wikimedia Commons, Raft Consensus Algorithm Mascot, CC BY-SA 4.0: https://commons.wikimedia.org/wiki/File:Raft_Consensus_Algorithm_Mascot_on_transparent_background.svg' },
        'Raft (Ongaro and Ousterhout, 2014) was designed from the start to be understandable. It provides the same safety guarantees as Paxos but decomposes consensus into three clear subproblems -- leader election, log replication, and safety -- and makes leader-based operation the normal case. The paper\'s user study showed that students learned Raft faster and answered exam questions more accurately than those who learned Paxos.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Pick one server as the leader. The leader accepts all writes, appends them to a log, and replicates entries to followers. Followers apply whatever the leader sends. This is fast, simple, and correct as long as the leader stays alive.',
        'The problem is that "as long as the leader stays alive" is a fantasy. Servers crash, networks partition, disks stall. Without an automated way to choose a new leader, the system is down until a human intervenes -- minutes to hours of lost availability for every failure.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Leader crash means lost writes unless followers have already replicated them. Worse, if two servers both believe they are leader -- split-brain -- they accept conflicting writes and replicas permanently diverge. Manual failover is too slow. Letting any server self-promote is too dangerous.',
        'The system needs an agreement protocol: a way for a majority of servers to pick exactly one leader, reject stale leaders, and ensure that the new leader carries all committed history. That protocol must work without human intervention, without synchronized clocks, and without knowing in advance which server will fail.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Divide time into numbered terms. Each term has at most one leader. A server becomes leader only by winning a majority vote in a given term, and each server casts at most one durable vote per term.',
        'Safety follows from arithmetic: in a cluster of n servers, a majority requires more than n/2 votes. Any two majorities overlap by at least one server. That shared server voted once, so it cannot have voted for two different candidates in the same term. Two leaders in the same term is not just unlikely -- it is impossible.',
        'Liveness comes from randomized election timeouts. Each follower picks a random timeout (typically 150-300ms). When a leader dies, followers notice silence at different times, so one server almost always times out first and runs unopposed. Repeated split votes are possible but exponentially unlikely because each retry re-randomizes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Every server is in one of three states: follower, candidate, or leader. Followers passively receive heartbeats and log entries. Candidates are running an election. The leader handles all client writes and replicates entries to followers.',
        'Leader election: when a follower\'s randomized election timer expires without hearing a heartbeat, it increments its term, transitions to candidate, votes for itself (persisting the vote to disk), and sends RequestVote RPCs to all other servers. A receiver grants its vote if (a) it has not already voted in this term and (b) the candidate\'s log is at least as up-to-date as the receiver\'s log. If the candidate collects votes from a majority, it becomes leader and immediately sends heartbeats to suppress further elections.',
        'Log replication: the leader appends each client command to its log, sends AppendEntries RPCs to followers, and waits for a majority to acknowledge. Once a majority has stored the entry, the leader commits it (advances the commit index) and applies it to its state machine. Followers learn the commit point through subsequent heartbeats and apply committed entries in order.',
        'Safety -- the election restriction: a candidate\'s RequestVote includes the index and term of its last log entry. A voter rejects the candidate if the voter\'s own log is more up-to-date (compared first by last entry\'s term, then by log length). This prevents a server with a stale log from winning an election and overwriting entries that a majority already committed. The restriction links election to replication: only a server that already has all committed entries can become leader.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Election safety: at most one leader per term. Proof: two leaders in term T would need two disjoint majorities of votes in term T. Any two majorities of n servers share at least one server. That server voted once and persisted its vote, so it cannot have supported both candidates. Contradiction.',
        'Leader completeness: every committed entry appears in every future leader\'s log. Proof sketch: an entry is committed when a majority stores it. A future candidate must win a majority of votes. Those two majorities overlap. The overlapping server has the committed entry. The election restriction guarantees the candidate\'s log is at least as up-to-date as that server\'s, so the candidate has the entry too. By induction, the entry survives every future leadership change.',
        'These two properties together mean the committed log is append-only and consistent across leadership transitions. A new leader never overwrites committed entries; it only appends new ones.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each committed write costs two network round trips: the leader sends AppendEntries to followers, waits for a majority to acknowledge, then notifies followers of the new commit point on the next heartbeat. For an n-node cluster, each commit requires O(n) messages.',
        'A majority quorum of a 2f+1 cluster tolerates f failures. A 3-node cluster tolerates 1 failure; a 5-node cluster tolerates 2. Larger clusters increase fault tolerance but also increase per-commit message cost and make majorities harder to collect across slow networks.',
        'Election cost is typically modest: one RequestVote per peer, one round trip. Split votes add one wasted term per retry, but randomized timeouts keep the expected number of retries near zero. In practice, failover completes within a few hundred milliseconds.',
        'The real performance cost is leader bottleneck: all writes flow through one server. Throughput is bounded by the leader\'s network bandwidth and disk fsync speed. Multi-Raft (one Raft group per data shard) is the standard workaround.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Raft is the dominant consensus protocol in production infrastructure. etcd uses Raft for Kubernetes cluster state -- every pod scheduling decision, every config change flows through a Raft-replicated log. CockroachDB and TiKV run a separate Raft group per data range (Multi-Raft), so each shard has its own leader and the write bottleneck is distributed. Consul uses Raft for service discovery and configuration. HashiCorp Vault uses Raft for secrets storage replication.',
        'The pattern fits anywhere a small group of servers needs a single ordered log: metadata stores, lock services, control planes, leader-election primitives, and coordination kernels embedded inside larger systems.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Leader bottleneck: every write must go through one server. A single Raft group tops out at whatever one machine\'s disk and network can handle. Multi-Raft helps but adds complexity for cross-shard transactions.',
        'Cross-datacenter latency: each commit needs a majority round trip. If replicas span continents, commit latency is at least the speed-of-light RTT to the nearest majority. Paxos variants like EPaxos or Flexible Paxos can commit with fewer cross-region messages in some cases.',
        'Reconfiguration edge cases: adding or removing servers changes what constitutes a majority. Raft\'s joint-consensus protocol handles this safely but is tricky to implement. Bugs in membership changes have caused real outages.',
        'Not Byzantine fault tolerant: Raft assumes servers follow the protocol and only fail by crashing or going silent. A compromised server that sends fabricated messages can violate safety. Byzantine fault tolerance requires protocols like PBFT, which are far more expensive.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Five servers: S1 is leader for term 3, replicating entries to S2-S5. S1 crashes. The followers receive no heartbeat. Each has a randomized election timer; S3\'s fires first.',
        'S3 increments its term to 4, votes for itself (persists vote to disk), and sends RequestVote(term=4, lastLogIndex=7, lastLogTerm=3) to S2, S4, S5. Each receiver checks: have I voted in term 4? No. Is S3\'s log at least as current as mine? S3 has index 7, term 3 -- same as theirs. They grant the vote.',
        'S3 collects 4 votes (itself + S2, S4, S5). Only 3 were needed. S3 becomes leader of term 4 and immediately heartbeats. When S1 reboots, it receives a heartbeat stamped term 4, sees that 4 > 3, and steps down to follower.',
        'Suppose S1 had appended an uncommitted entry at index 8 before crashing -- an entry it had not yet replicated to a majority. S3\'s log does not have index 8. When S3 becomes leader, it replicates its own log to all followers. S1\'s uncommitted index 8 is overwritten. Only majority-acknowledged entries survive leadership changes. This is not data loss; it is the protocol working correctly. The client whose write was at index 8 never received a success response, so it knows to retry.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm," 2014 (the Raft paper): https://raft.github.io/raft.pdf. The Raft website collects the extended dissertation, teaching materials, and an interactive visualization: https://raft.github.io/. Lamport, "The Part-Time Parliament," 1998 (Paxos, the theoretical foundation Raft was designed to replace in practice).',
        'Study next: Raft Log Replication (how the leader commits entries with majority acknowledgment), Write-Ahead Log (how terms, votes, and entries survive crashes on disk), Paxos (the older consensus protocol Raft simplifies), distributed locks (a common application of consensus), Two-Phase Commit (a different agreement protocol for distributed transactions), and CAP Theorem (why a minority partition must refuse writes to preserve consistency).',
      ],
    },
  ],
};
