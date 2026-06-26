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
        'Read each server label as role plus term. A term is a numbered election era, and a role is follower, candidate, or leader.',
        { type: 'callout', text: 'Raft election safety is majority overlap plus one durable vote per term.' },
        'Active nodes are candidates requesting votes, and found nodes are leaders. Lit edges are vote traffic or heartbeat paths, depending on the frame.',
        'The safe inference is per-term uniqueness. If one candidate gets a majority in term T, no other candidate can also get a majority in term T because the two majorities would share a voter that can only vote once.',
      
        {type: 'image', src: './assets/gifs/raft-election.gif', alt: 'Animated walkthrough of the raft election visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Raft is a consensus protocol for replicated state machines. A cluster needs one leader to choose the order of log entries so all replicas apply the same commands in the same order.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Raft_Consensus_Algorithm_Mascot_on_transparent_background.svg/250px-Raft_Consensus_Algorithm_Mascot_on_transparent_background.svg.png', alt: 'Raft consensus algorithm mascot', caption: 'The official Raft material emphasizes understandability; the protocol earns that by separating election, replication, and safety. Source: Wikimedia Commons, Raft Consensus Algorithm Mascot, CC BY-SA 4.0: https://commons.wikimedia.org/wiki/File:Raft_Consensus_Algorithm_Mascot_on_transparent_background.svg' },
        'Leader election exists because leaders crash and networks drop messages. The cluster must replace a missing leader without allowing two leaders to accept conflicting writes in the same term.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is manual failover: pick a new leader when the old one stops responding. That is understandable, but it is too slow for a system that should recover in milliseconds or seconds.',
        'Another tempting approach is self-promotion. Any server that misses heartbeats declares itself leader, but two servers can make that decision during the same network delay and create split-brain.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is distributed silence. A follower cannot tell whether the leader crashed, the network delayed a heartbeat, or the follower itself is partitioned.',
        'The system needs a leader-choice rule that is safe under uncertainty. It must elect one leader when a majority can communicate and elect none when the votes are split.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Number time into terms, and allow each server to cast one durable vote per term. A candidate becomes leader only after receiving votes from a majority of the cluster.',
        'Randomized election timeouts make one candidate likely to start first. Majority overlap makes it impossible for two different candidates to both win the same term.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Followers reset an election timer whenever they hear from a valid leader. If the timer expires, a follower increments its term, becomes candidate, votes for itself, and sends RequestVote messages.',
        'A receiver grants a vote if it has not voted in that term and the candidate log is at least as up to date as its own. If the candidate reaches a majority, it becomes leader and sends heartbeats to stop other elections.',
        'If two candidates split votes, neither reaches a majority. Each times out again with a fresh random delay, making a repeated tie unlikely.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Election safety follows from majority intersection. Two leaders in one term would require two majorities, but any two majorities share at least one server.',
        'That shared server persists one vote per term, so it cannot vote for both candidates. The log up-to-date check connects election safety to log safety by preventing stale candidates from replacing committed history.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A normal election costs one RequestVote round trip to peers, so message cost is O(n) for n servers. A five-node cluster needs three votes and can tolerate two failed servers.',
        'Randomized timeouts trade a little failover delay for fewer split votes. Short timeouts recover quickly but risk elections during transient pauses; long timeouts reduce churn but extend outage windows.',
        'The leader remains a bottleneck after election because all writes flow through it. Systems shard work across many Raft groups when one leader cannot carry all write traffic.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'etcd uses Raft elections to maintain Kubernetes cluster state. Consul, CockroachDB, TiKV, and HashiCorp Vault use Raft or Raft-like leader election for replicated metadata and storage groups.',
        'The pattern fits small control-plane groups where a single ordered log matters more than accepting writes in every partition.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Raft elections assume crash faults, not malicious servers. A Byzantine server that lies about votes or terms is outside the model.',
        'Cross-region deployments can suffer high failover and commit latency because a majority round trip may cross long distances. A minority partition must refuse leadership even if it contains clients.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use five servers S1 through S5. S1 leads term 3 and then crashes, so followers stop receiving heartbeats.',
        'S3 timeout fires first. It increments to term 4, votes for itself, and asks S2, S4, and S5 for votes; each has not voted in term 4 and grants the vote.',
        'S3 has four votes including its own, which exceeds the majority threshold of three. It becomes leader for term 4, and when S1 later hears term 4 heartbeats, S1 steps down.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Ongaro and Ousterhout, In Search of an Understandable Consensus Algorithm, 2014. Background source: Lamport, The Part-Time Parliament, 1998.',
        'Study Raft log replication next because elections only choose authority. Then study write-ahead logs, CAP theorem, Paxos, and Raft joint consensus for membership changes.',
      ],
    },
  ],
};