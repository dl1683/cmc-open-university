// Raft log replication: the second half of Raft. The leader's log is the
// truth; followers copy it slot by slot; an entry is COMMITTED once a
// majority holds it — and committed entries can never be lost.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'raft-log-replication',
  title: 'Raft Log Replication',
  category: 'Systems',
  summary: 'How a leader copies its log to followers, when an entry counts as committed, and why committed never un-happens.',
  controls: [
    { id: 'scenario', label: 'Scenario', type: 'select', options: ['steady replication', 'leader crash + conflict'], defaultValue: 'steady replication' },
  ],
  run,
};

const SLOTS = 5;
const SERVERS = ['S1', 'S2', 'S3'];

export function* run(input) {
  const crashy = String(input.scenario) === 'leader crash + conflict';
  if (!['steady replication', 'leader crash + conflict'].includes(String(input.scenario))) {
    throw new InputError('Pick a scenario.');
  }

  // logs[server][slot] = term number (0 = empty)
  const logs = SERVERS.map(() => new Array(SLOTS).fill(0));
  let commitIndex = 0;
  const majority = Math.floor(SERVERS.length / 2) + 1;

  const rows = SERVERS.map((s, i) => ({ id: `s${i}`, label: s }));
  const cols = Array.from({ length: SLOTS }, (_, j) => ({ id: `l${j}`, label: `slot ${j + 1}` }));
  const snapshot = (title) => matrixState({
    title: `${title} — committed through slot ${commitIndex}`,
    rows,
    columns: cols,
    values: logs.map((row) => [...row]),
    format: (v) => (v === 0 ? '·' : `t${v}`),
  });
  const cell = (server, slot) => `s${server}:l${slot}`;
  const leaderTerm = 2;

  yield {
    state: snapshot('Three replicated logs, S1 leads (term 2)'),
    highlight: {},
    explanation: `Raft Leader Election crowned ${SERVERS[0]} for term ${leaderTerm} — now the actual job: keep ${SERVERS.length} copies of one LOG identical, because every server applies the log in order to build its state (a replicated Write-Ahead Log (WAL)). Each cell is a log slot; t${leaderTerm} will mean "an entry written in term ${leaderTerm}".`,
  };

  logs[0][0] = 2;
  yield {
    state: snapshot('Client command arrives: SET x=3'),
    highlight: { active: [cell(0, 0)] },
    explanation: `A client asks the leader to SET x=3. ${SERVERS[0]} appends it to its OWN log first (slot 1, term ${logs[0][0]}) — append-only, never overwriting. The client is NOT yet told "done": the entry exists on one machine and would die with it.`,
  };

  logs[1][0] = 2;
  logs[2][0] = 2;
  commitIndex = 1;
  const holdersSlot1 = SERVERS.filter((_, i) => logs[i][0] > 0);
  yield {
    state: snapshot('AppendEntries fan-out'),
    highlight: { found: [cell(0, 0), cell(1, 0), cell(2, 0)] },
    explanation: `${SERVERS[0]} sends AppendEntries to both followers; each appends slot ${commitIndex} and acks. The moment a MAJORITY (${majority} of ${SERVERS.length}) holds the entry, it is COMMITTED: now — and only now — the client hears "done" and the command is applied. Currently ${holdersSlot1.length}/${SERVERS.length} servers (${holdersSlot1.join(', ')}) hold slot ${commitIndex}. Committed means: any future leader must hold this entry (a majority has it, and elections require a majority — the overlap argument again).`,
    invariant: `Committed entries exist on a majority (>= ${majority}/${SERVERS.length}), so no electable leader can lack them.`,
  };

  logs[0][1] = 2;
  logs[1][1] = 2;
  commitIndex = 2;
  const holdersSlot2 = SERVERS.filter((_, i) => logs[i][1] > 0);
  const missingSlot2 = SERVERS.filter((_, i) => logs[i][1] === 0);
  yield {
    state: snapshot('SET y=7 — with S3 unreachable'),
    highlight: { found: [cell(0, 1), cell(1, 1)], swap: [cell(2, 1)] },
    explanation: `Next command, but ${missingSlot2.join(', ')} has gone quiet (network hiccup). No matter: ${holdersSlot2.join(' + ')} are already a majority (${holdersSlot2.length}/${SERVERS.length}), so slot ${commitIndex} commits without ${missingSlot2.join(', ')}. Stragglers never stall the cluster — that is the availability half of the design (and the CP half of the CAP Theorem when a majority cannot form).`,
  };

  if (!crashy) {
    logs[2][1] = 2;
    yield {
      state: snapshot('S3 returns and catches up'),
      highlight: { active: [cell(2, 1)] },
      explanation: `${SERVERS[2]} reconnects. Every AppendEntries carries a CONSISTENCY CHECK: "my previous entry is (slot 1, term ${logs[2][0]}) — does yours match?" ${SERVERS[2]} matches, accepts slot ${commitIndex}, and is identical again. The check runs on every append, so logs can never silently diverge: any mismatch walks backward until the logs agree, then overwrites forward.`,
    };

    logs[0][2] = 2; logs[1][2] = 2; logs[2][2] = 2;
    commitIndex = 3;
    const allHolders = SERVERS.filter((_, i) => logs[i][2] > 0);
    yield {
      state: snapshot('Steady state'),
      highlight: { found: SERVERS.map((_, i) => cell(i, 2)) },
      explanation: `And so it runs: append at the leader, fan out, commit at majority, apply in order. ${allHolders.length} machines, one log, one state machine — a database that survives any single failure with zero data loss. commitIndex is now ${commitIndex} with all ${SERVERS.length} servers in sync. This loop, plus the election from Raft Leader Election, is the complete Raft protocol running inside etcd, the Kubernetes metadata path, Consul, and CockroachDB.`,
    };
    return;
  }

  logs[0][2] = 2;
  const crashSlot = 3;
  yield {
    state: snapshot('S1 appends SET z=1 locally…'),
    highlight: { active: [cell(0, 2)] },
    explanation: `${SERVERS[0]} appends slot ${crashSlot} (term ${logs[0][2]}) to its own log — and CRASHES before telling anyone. Slot ${crashSlot} lives on one dead machine: appended, but NOT committed (commitIndex is still ${commitIndex}). Hold that distinction; it is about to matter.`,
  };

  const newTerm = 3;
  logs[1][2] = newTerm;
  commitIndex = 2;
  yield {
    state: snapshot('S2 elected leader of term 3'),
    highlight: { active: [cell(1, 2)], swap: [cell(0, 2)] },
    explanation: `${SERVERS[1]} wins the term-${newTerm} election (it holds every COMMITTED entry — slots 1–${commitIndex} — which is all the rules require) and accepts a new command into its slot ${crashSlot}, stamped t${newTerm}. Note the cluster now contains two different slot-${crashSlot} entries: the t${newTerm} entry from ${SERVERS[1]} and the t${leaderTerm} entry from dead ${SERVERS[0]}.`,
  };

  logs[0][2] = 3;
  logs[2][1] = 2;
  logs[2][2] = 3;
  commitIndex = 3;
  const resolvedHolders = SERVERS.filter((_, i) => logs[i][2] === newTerm);
  yield {
    state: snapshot('S1 rejoins as follower — conflict resolved'),
    highlight: { found: [cell(0, 2), cell(1, 2), cell(2, 2)] },
    explanation: `${SERVERS[0]} reboots as a follower and receives AppendEntries from leader ${SERVERS[1]}. The consistency check finds the conflict at slot ${crashSlot}: the old t${leaderTerm} entry on ${SERVERS[0]} does not match the t${newTerm} entry from the leader — so it is DELETED and overwritten. Now ${resolvedHolders.length}/${SERVERS.length} servers hold t${newTerm} at slot ${crashSlot}. The client whose z=1 was never confirmed simply retries. Uncommitted work can vanish; that is exactly WHY Raft refuses to confirm anything before majority.`,
    invariant: `The leader log is the truth: followers delete conflicting suffixes and adopt leader entries. commitIndex is now ${commitIndex}.`,
  };

  const finalMatching = SERVERS.every((_, i) => logs[i][2] === newTerm);
  yield {
    state: snapshot('All logs identical again'),
    highlight: {},
    explanation: `All ${SERVERS.length} logs identical: ${finalMatching}. The two-tier promise, in one story: COMMITTED entries (majority-held) survived leader failure untouched; the UNCOMMITTED entry evaporated without ever being acknowledged. No client was lied to. commitIndex = ${commitIndex}, all servers in sync through slot ${commitIndex}. That asymmetry — cheap to append, expensive to promise — is the entire art of replicated logs, and you have now seen both halves of Raft.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each row as one server log and each column as one log index. A term is the election era that created an entry, and commitIndex is the highest log position known to be committed.',
        {type: 'callout', text: 'Raft does not promise a write when the leader sees it; it promises a write when a future majority cannot avoid it.'},
        'Active cells are newly appended entries. Found cells are entries now stored on a majority, which means the leader can commit them and later apply them in order.',
        'The safe inference is majority durability. A committed entry is stored on a majority, and every future leader must win a majority election that intersects that stored majority.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Leader election chooses who may accept writes, but it does not make those writes durable. If the leader stores a command locally and crashes, the next leader may never see it.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of servers in a data center', caption: 'Replicated logs turn several ordinary servers into one fault-tolerant state machine. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0.'},
        'Raft log replication turns client commands into a shared ordered log. Servers apply committed entries in the same order, so their state machines reach the same state.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious safe approach is to send every command to every follower and wait for all acknowledgements. Then every server has the entry before the client hears success.',
        'That rule is too brittle. One slow disk, paused process, or unreachable follower stalls every write, so the cluster behaves as if the weakest server controls availability.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Acknowledging after only the leader append is fast but unsafe. Waiting for all followers is safe but unavailable under ordinary partial failure.',
        'The wall is deciding when a promise to the client becomes justified. The system needs enough copies that no future valid leader can lack the entry.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A log entry is committed when a majority stores it. Majority storage makes the entry unavoidable because any future leader election also requires a majority.',
        'AppendEntries includes the previous log index and previous log term. That consistency check lets a leader find the last shared prefix with a follower and overwrite only conflicting uncommitted suffixes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client sends a command to the leader. The leader appends it locally, sends AppendEntries messages to followers, and tracks which followers have matched each index.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Packet switching animation across a network', caption: 'AppendEntries messages are ordinary network packets, so the protocol must tolerate delay, loss, and reordering while preserving log order. Source: Wikimedia Commons, Oddbodz, public domain.'},
        'When an entry from the leader current term is stored on a majority, the leader advances commitIndex. Followers learn the commitIndex through later AppendEntries and apply committed entries in order.',
        'If a follower rejects the previous-index check, the leader backs up nextIndex and retries. Once a matching prefix is found, the follower deletes its conflicting suffix and copies the leader entries forward.',
      
        {type: 'image', src: './assets/gifs/raft-log-replication.gif', alt: 'Animated walkthrough of the raft log replication visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Committed-entry safety follows from majority intersection. The commit quorum and any future election quorum overlap, so at least one future voter has the committed entry.',
        'Raft voting rules require a candidate log to be at least as up to date as the voter logs it depends on. That prevents a leader missing committed history from winning and then overwriting it.',
        'The log-matching property handles repair. If two logs have the same term at the same index, Raft treats the prefix up to that index as the same history and replaces only the divergent suffix after it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A successful write costs one leader append plus a leader-to-majority replication round trip. In a 3-node group, two copies commit; in a 5-node group, three copies commit and two failures can be tolerated.',
        'Slow followers do not block progress unless the leader needs them for a majority. They create catch-up debt, which costs log retention, snapshot transfer, bandwidth, and disk IO later.',
        'Doubling the number of Raft voters increases fanout and the size of a majority. Most systems scale write throughput by sharding into many Raft groups instead of making one group very large.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'etcd uses Raft logs for Kubernetes metadata. Consul, TiKV, CockroachDB ranges, and many embedded coordination systems use the same pattern of leader append, majority replication, and ordered apply.',
        'The pattern fits control-plane state, leases, shard metadata, and small transactional kernels where one ordered history is worth the cost of majority coordination.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Raft log replication is one ordered log per consensus group. It does not automatically provide cross-shard SQL transactions or global serializability across many Raft groups.',
        'It assumes crash faults and honest protocol behavior. Byzantine faults, disk corruption without detection, and fabricated messages require different protocols or additional integrity layers.',
        'Clients must handle uncertainty after timeouts. A command that timed out may have committed or may have vanished, so production systems use request ids or idempotent operations.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use three servers S1, S2, and S3. S1 is leader in term 2 and appends SET x=3 at slot 1, then sends it to S2 and S3.',
        'When S2 acknowledges, S1 and S2 form a majority of two out of three, so slot 1 can commit even if S3 is slow. The client hears success only after that majority point.',
        'Now S1 appends slot 3 locally and crashes before replication. S2 becomes leader in term 3, writes a different slot 3, and commits it with S3; when S1 returns, its old uncommitted slot 3 is overwritten without breaking any client promise.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Ongaro and Ousterhout, In Search of an Understandable Consensus Algorithm, 2014, especially the log replication and safety sections.',
        'Study Raft election first for terms and voting. Then study write-ahead logs, Raft snapshots, log compaction, two-phase commit for cross-shard work, CAP theorem, and joint consensus for membership changes.',
      ],
    },
  ],
};