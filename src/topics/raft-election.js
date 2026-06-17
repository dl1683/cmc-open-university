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
      heading: 'The problem',
      paragraphs: [
        'A replicated state machine needs every healthy replica to apply the same commands in the same order. That usually means one node must assign the next log index. If two nodes both believe they are allowed to order writes, clients can observe two histories and replicas can diverge.',
        'Raft leader election exists to recover from a failed or unreachable leader without creating split-brain. It chooses one leader for a numbered term, then Raft log replication uses that leader as the source of order until another term supersedes it.',
      ],
    },
    {
      heading: 'Context',
      paragraphs: [
        'Raft is a consensus protocol built around understandability. Instead of letting every node propose values equally at every moment, Raft makes normal operation leader-centered. Followers accept append requests from the current leader, candidates run elections, and terms act like logical eras.',
        'The election problem is a balance between safety and liveness. Safety says there must not be two valid leaders for the same term and committed history must not be lost. Liveness says that when a leader really disappears and a majority can still communicate, the cluster should eventually pick a replacement.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core idea is small: time is divided into monotonically increasing terms, each server can cast at most one durable vote per term, and a candidate becomes leader only after winning a majority of the current voting configuration.',
        'Majorities are the safety structure. In a five-node cluster, a majority is three. Any two sets of three share at least one node. Since that shared node can only vote once in a term, two different candidates cannot both collect a majority in the same term. Randomized election timeouts are the liveness trick that makes repeated ties unlikely.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'Followers expect periodic heartbeats from the leader. If a follower receives no valid heartbeat before its randomized election timeout, it increments its current term, becomes a candidate, votes for itself, persists that vote, and sends RequestVote RPCs to the other servers.',
        "A receiver grants the vote only if it has not already voted in that term and the candidate's log is at least as up to date as its own. If the candidate receives a majority, it becomes leader and immediately sends heartbeats. If the vote splits, nobody becomes leader; candidates time out again, increment the term, and retry with new randomized timeouts.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'The animation starts with five servers, S1 through S5. S1 is leader in term 3 and sends heartbeats. Then S1 dies. The followers do not receive a special crash message; they only notice silence. Because their election timers are randomized, one follower, S3, is likely to time out first.',
        'S3 starts term 4, votes for itself, and asks the others for votes. If S2, S4, and S5 grant votes, S3 has four votes and only three were needed. S3 becomes leader for term 4 and begins heartbeating. If S5 times out at nearly the same moment and the votes split 2-2, nobody reaches three; the failed term is safe, and a later term retries.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Election safety comes from majority intersection plus durable single voting. Two leaders in the same term would require two winning majorities. Those majorities must overlap, and the overlapping server would have had to vote for both candidates in the same term, which the protocol forbids and persists across crashes.',
        "Leader completeness comes from the log freshness check. A voter rejects a candidate whose log is less up to date than the voter's log. That connects election to replication: a candidate should not gain authority to append new entries if it is missing committed history that future leaders must preserve.",
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the clean-election path, watch the term number and the role label on each server. S1 starts as leader, disappears, S3 changes to candidate, votes flow to S3, and S3 becomes the only highlighted leader. The important transition is not the timer firing. It is the majority vote that turns a timed-out follower into an authorized leader.',
        'In the split-vote path, the absence of a leader is the teaching point. S3 and S5 can both become candidates, but neither can cross the majority threshold. The retry frame shows randomized timeouts doing liveness work: they do not make leadership safe by themselves, but they reduce the chance that every term repeats the same tie.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'Election traffic is modest for normal Raft groups but can be O(n^2) in a noisy split election because multiple candidates ask multiple peers. Raft groups are usually kept small, often 3, 5, or 7 voters, because larger groups increase coordination cost and make majorities harder to reach.',
        'Timeout tuning is the practical tradeoff. Short election timeouts reduce failover latency, but they can trigger unnecessary elections during garbage-collection pauses, network jitter, overloaded disks, or scheduler stalls. Long timeouts are calmer but extend the outage after a real leader failure.',
      ],
    },
    {
      heading: 'Limits',
      paragraphs: [
        'Election alone does not make data safe. The leader still has to replicate entries and commit them with a majority. A server can be leader and still be unable to serve writes if it cannot contact enough peers to commit.',
        'Raft also does not use wall-clock timestamps to order authority. Clocks only affect when local timeouts fire. Terms, votes, and RPC comparisons define leadership. Bad timing can hurt availability, but it should not violate election safety if terms and votes are persisted correctly.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A split vote is a safe failure mode: no majority, no leader. A minority partition is also safe but unavailable for writes, because it cannot elect or sustain a leader that can commit. A disruptive candidate with a high term can force an old leader to step down, so production systems often add pre-vote or careful timeout tuning to reduce unnecessary disruption.',
        'Implementation bugs are more dangerous than protocol-level ties. Losing the persisted vote can allow double-voting after reboot. Forgetting the log freshness rule can elect a stale leader. Applying membership changes without the proper joint-consensus rules can break the majority-intersection argument that the proof relies on.',
      ],
    },
    {
      heading: 'Practical use',
      paragraphs: [
        'Raft election fits small replicated state machines that need a single ordered log: metadata stores, control planes, lock services, configuration stores, and database shards. etcd, Consul, TiKV, CockroachDB-style ranges, and many embedded Raft libraries use this shape because it is easier to reason about than many alternatives.',
        'Operationally, watch election rate, leader changes, heartbeat latency, disk fsync latency, and quorum health. A healthy cluster should not campaign constantly. Repeated elections usually point to pauses, overload, slow disks, network instability, or timeout values that do not match the deployment.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Tune election timeout against the deployment, not against a diagram. It should be comfortably larger than normal heartbeat delay, disk stalls, scheduler pauses, and network jitter, while still short enough that a real leader failure does not create a long outage.',
        'Every implementation should persist current term and vote before replying to RequestVote. It should reject stale terms, step down on higher terms, apply the log freshness rule, and expose metrics for term changes, vote grants, election timeouts, and leader transfers.',
      ],
    },
    {
      heading: 'Testing it',
      paragraphs: [
        'Test clean elections, split votes, leader crash and recovery, minority partitions, delayed RequestVote messages, reboot after voting, and candidates with stale logs. The important assertions are that at most one leader exists per term and that a stale candidate cannot win over a more up-to-date voter.',
        'Chaos tests should add disk pauses and network delay, not just process crashes. Many real election incidents come from slow persistence or scheduling stalls that make a healthy leader look dead long enough to trigger unnecessary campaigns.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm" at https://raft.github.io/raft.pdf. The Raft site also collects the extended paper and teaching material at https://raft.github.io/.',
        'Read Raft Log Replication next: election chooses who may lead, but replication decides which commands survive. Write-Ahead Log explains how terms, votes, and entries persist through crashes. CAP Theorem explains why minority partitions refuse service. Consistent Hashing shows a different distributed pattern where ownership is partitioned instead of ordered by one leader, and Distributed Tracing helps diagnose failover in production.',
      ],
    },
  ],
};
