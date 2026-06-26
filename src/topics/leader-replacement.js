// Leader replacement: electing a new leader is the easy half. Detecting that
// the old one is really gone, fencing it off when it comes back from the
// dead, and carrying committed state across the handover — that's the job.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'leader-replacement',
  title: 'View Changes: Replacing a Failed Leader',
  category: 'Systems',
  summary: 'Slow looks exactly like dead, deposed leaders come back as zombies, and committed entries must outlive the regime — the three hard problems of every handover.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['zombies & fencing', 'carrying state across the change'], defaultValue: 'zombies & fencing' },
  ],
  run,
};

// The fencing simulation: a tiny storage service that accepts a write only
// if its token is the highest it has ever seen. Computed live.
function storage() {
  let high = 0;
  const log = [];
  return {
    write(token, what) {
      const ok = token >= high;
      if (ok) high = token;
      log.push({ token, what, ok });
      return ok;
    },
    log,
  };
}
const DISK = storage();
DISK.write(33, 'A: checkpoint #1');        // A holds the lock with token 33
const ZOMBIE_SETUP = DISK.write(34, 'B: checkpoint #2'); // B acquired token 34 during the pause by A
const ZOMBIE_BLOCKED = DISK.write(33, 'A: stale checkpoint'); // A wakes and tries again

function table(title, rowDefs, colDefs, cellText) {
  let k = 0;
  const flat = [''];
  const values = rowDefs.map((_, r) => colDefs.map((__, c) => { flat.push(cellText[r][c]); k++; return k; }));
  return matrixState({
    title,
    rows: rowDefs.map(([id, label]) => ({ id, label })),
    columns: colDefs.map(([id, label]) => ({ id, label })),
    values,
    format: (v) => flat[v],
  });
}

function* zombies() {
  yield {
    state: table('Step zero: deciding the leader is dead — with no way to know', [
      ['slow', 'what "dead" looks like'],
      ['short', 'timeout too short'],
      ['long', 'timeout too long'],
      ['pick', 'what real systems pick'],
    ], [['detail', '']], [
      ['exactly like slow: a GC pause, a packet queue, an overloaded NIC — silence is silence (the FLP lesson from Paxos: Consensus Without a Leader, in operational clothing)'],
      ['healthy leaders get deposed mid-pause; elections duel; the cluster thrashes through terms doing no useful work'],
      ['every real failure becomes a full outage of that length: writes stall until the timer fires'],
      ['a compromise plus jitter: Raft Leader Election randomizes 150–300ms; production etcd defaults to ~1s — and accepts BOTH failure modes at the edges'],
    ]),
    highlight: { compare: ['short:detail', 'long:detail'] },
    explanation: `Every view change begins with an accusation that can never be verified: "the leader is dead." In an asynchronous network there is no test that distinguishes a crashed process from a slow one — the evidence for both is the same absent heartbeat. So every system on this site, from Raft Leader Election to PBFT, runs on timeouts it KNOWS are imperfect, tuned between ${4} failure modes shown above: hair-trigger elections that depose healthy leaders versus long outages waiting on a corpse. This is not sloppy engineering; it is the FLP impossibility surfacing as a config parameter. The consequence that drives this whole page: because detection can be WRONG, the old leader may not actually be dead — and protocols must survive its return.`,
    invariant: `Failure detection in async systems is inherently unreliable: every view change must assume the old leader might still be running — as the ${DISK.log.length} writes in the fencing simulation will demonstrate.`,
  };

  yield {
    state: table('The zombie: a deposed leader that never got the memo', [
      ['t1', 't1 Â· leader A (term 5) enters a 20s GC pause'],
      ['t2', 't2 Â· followers time out; C wins election for term 6'],
      ['t3', 't3 Â· A wakes up'],
      ['t4', 't4 Â· A keeps acting as leader'],
      ['fix', 'the in-protocol fix'],
    ], [['story', '']], [
      ['mid-heartbeat, mid-replication — a stop-the-world collection at the worst moment (the classic real-world trigger)'],
      ['the cluster has moved on; clients are writing through C'],
      ['its world-model is 20 seconds stale: it believes it holds term 5 leadership, because nothing told it otherwise'],
      ['it sends AppendEntries, serves "fresh" reads, acks writes — TWO leaders are now answering, and clients can read forked realities'],
      ['every message carries the term; any node seeing term 5 traffic replies "the term is 6" and A instantly steps down — inside the protocol, zombies die on first contact'],
    ]),
    highlight: { removed: ['t4:story'], found: ['fix:story'] },
    explanation: `The zombie scenario is not exotic — a long garbage-collection pause is enough, and it has caused real split-brain outages in systems that skipped the defenses. Note what makes it dangerous: A is not malicious, not even buggy. It is executing the protocol PERFECTLY against a 20-second-old view of the world. Within the consensus group the cure is cheap and absolute: epochs. Every message carries the term, ballot, or view number of the sender; any contact with the moved-on majority returns a higher number and the zombie steps down on the spot — all ${5} rows above trace a single timeline to show why. The monotonic counter is doing for leadership exactly what it did in Clocks & Ordering: Lamport to TrueTime — replacing "what time is it?" with "whose number is bigger?", a question that has a correct answer.`,
    invariant: `Epoch numbers on every message make staleness self-detecting inside the protocol: a zombie cannot complete one round without learning it is deposed — the fencing simulation ahead will confirm this with zombie blocked = ${ZOMBIE_BLOCKED}.`,
  };

  yield {
    state: table('Fencing tokens: protecting things OUTSIDE the protocol (live)', [
      ['w1', 'A writes with token 33'],
      ['w2', 'B (new lock holder) writes with token 34'],
      ['w3', 'zombie A retries with token 33'],
      ['rule', 'the storage-side rule'],
    ], [['result', '']], [
      ['accepted — 33 is the highest the store has seen'],
      [`${ZOMBIE_SETUP ? 'accepted — high-water mark is now 34' : 'rejected'}`],
      [`${ZOMBIE_BLOCKED ? 'accepted (BUG!)' : 'REJECTED — 33 < 34: the zombie write bounces off the storage layer itself'}`],
      ['one integer compare: accept a write only if its token â‰¥ the highest ever seen — no clocks, no heartbeats, no trust in client health'],
    ]),
    highlight: { found: ['w3:result'], active: ['rule:result'] },
    explanation: `Terms protect the consensus group — but leaders also touch the OUTSIDE world: shared disks, object stores, databases that know nothing about elections. A zombie that can no longer win a Raft vote can still happily corrupt a file. The fix is the FENCING TOKEN, simulated live above with ${DISK.log.length} writes: the lock service hands out a monotonically increasing number with every grant, and the protected resource enforces one rule — never accept a token lower than the highest seen. The stale write from A with 33 bounces off a store that has seen token 34 from B (zombie blocked = ${ZOMBIE_BLOCKED}), regardless of what A believes about its own leadership. This is the famous critique by Kleppmann of naive distributed locks, including the Redlock design as commonly deployed: a lock without fencing protects you only from processes polite enough to stay dead.`,
    invariant: `The resource enforces monotonicity, not the lock: a token check at the storage layer stops every zombie a heartbeat cannot — the simulation confirmed setup accepted = ${ZOMBIE_SETUP}, zombie rejected = ${!ZOMBIE_BLOCKED}.`,
  };
}

function* carryingState() {
  yield {
    state: table('The handover invariant, in three dialects', [
      ['raft', 'Raft'],
      ['paxos', 'Multi-Paxos'],
      ['pbft', 'PBFT'],
      ['same', 'the shared theorem'],
    ], [['how', 'how committed state survives the change']], [
      ['ELIGIBILITY (push): voters refuse any candidate whose log is less up-to-date than theirs — since commits live on a majority, the log of a winner already contains them; nothing transfers after victory'],
      ['ADOPTION (pull): the phase-1 promises for the new leader report the highest accepted values, which it MUST re-propose — it wins the ballot, history wins the content'],
      ['CERTIFICATES (proof): view-change messages carry prepared certificates signed by 2f+1 replicas; the new primary must re-include every one — with Byzantine Fault Tolerance: When Nodes Lie in play, "trust the quorum" becomes "verify the signatures"'],
      ['any committed entry lives on a quorum; any new regime needs a quorum; the quorums intersect — the entry is IN the intersection, however each protocol chooses to read it out'],
    ]),
    highlight: { active: ['same:how'] },
    explanation: `Now the constructive half: a client was told "committed," so the entry must outlive the leader who said it. All ${4} protocol rows above lean on the same quorum-intersection theorem and differ only in WHO does the carrying. Raft moves the work before the election — unfit candidates simply cannot win, so the own log of the winner is already complete. Paxos moves it after — anyone can win, but the promise messages force the winner to adopt what previous ballots accepted. PBFT can trust neither voters nor winner, so the evidence travels as signed certificates that any replica can check. Three engineering cultures, one safety proof: the intersection always contains a witness.`,
    invariant: `Committed â‡’ on a quorum â‡’ in the intersection of every new quorum: protocols differ only in how the witness is consulted — just as the ${DISK.log.length} fencing writes showed monotonicity enforced at the resource.`,
  };

  yield {
    state: table('The subtle one: Raft figure-8 — when majority replication is NOT commitment', [
      ['s1', 't1 Â· leader L1 (term 2) replicates entry X to 2 of 4 followers, crashes'],
      ['s2', 't2 Â· L2 (term 3) — which never saw X — wins election from the others, writes Y locally, crashes'],
      ['s3', 't3 Â· L1 returns, wins term 4, resumes spreading X — now on a MAJORITY'],
      ['s4', 't4 Â· is X committed? NO.'],
      ['rule', 'the rule that closes the hole'],
    ], [['story', '']], [
      ['X exists on L1 + 2 followers: 3 of 5 — a majority holds it, stamped term 2'],
      ['legal: the log of L2 was as up-to-date as the logs of its voters — the absence of X did not disqualify it'],
      ['majority replication achieved for X… the naive commit condition says "done"'],
      ['L2 could STILL return, win with its term-3 entry Y (newer term beats longer log), and erase X from the majority — an "committed" entry would vanish'],
      ['a leader may only count replication of entries from its OWN term; older entries commit indirectly, shielded behind a current-term entry committed on top of them'],
    ]),
    highlight: { removed: ['s4:story'], found: ['rule:story'] },
    explanation: `The most famous subtlety in the Raft paper (its figure 8), walked slowly across ${5} rows because it humbles everyone: an entry from an OLD term sitting on a majority can still be overwritten, because election eligibility compares terms before lengths — a rival with a newer-term entry can lawfully win and erase the "majority-replicated" entry. So majority replication alone is not commitment. The repair in Raft is deliberately blunt: a leader never declares old-term entries committed by counting replicas; it commits an entry from its CURRENT term, and everything beneath becomes committed by log-prefix implication. The lesson generalizes beyond Raft: "how many copies" is never the whole commit condition — WHICH REGIME stamped the copies matters as much as the count.`,
    invariant: `Commitment = current-term entry on a majority; older entries are safe only as its prefix — counts without terms are not commitment, just as token ${ZOMBIE_BLOCKED ? 'acceptance' : 'rejection'} showed that identity without regime proof is worthless.`,
  };

  yield {
    state: table('Even READS need the regime check', [
      ['naive', 'naive leader read'],
      ['readindex', 'ReadIndex (etcd, TiKV)'],
      ['lease', 'lease-based reads'],
      ['tradeoff', 'the trade'],
    ], [['how', '']], [
      ['"I am the leader; here is the value" — but a zombie believes exactly the same thing: stale reads served with full confidence'],
      ['before answering, exchange one heartbeat round with a quorum: "am I still it?" — correctness from the quorum, +1 RTT per read batch'],
      ['after a successful heartbeat, serve reads locally for a bounded window (election timeout minus assumed clock-drift slack) — fast reads, but correctness now leans on bounded drift, the exact commodity NTP & PTP: How Clocks Actually Sync prices'],
      ['ReadIndex pays latency for certainty; leases pay a physics assumption for speed — most systems offer both and let the read choose'],
    ]),
    highlight: { compare: ['readindex:how', 'lease:how'] },
    explanation: `A pure read mutates nothing, so it is tempting to skip the machinery — and that is precisely how zombie leaders serve stale data with a straight face. The ${4} rows above show the honest options, both of which re-verify the regime: ReadIndex performs a quorum round-trip per read batch (the leader proves it is still leader before answering), while leases amortize that proof over a time window — legitimate ONLY if clocks drift less than the slack budgeted, which quietly imports a synchrony assumption into an otherwise asynchronous design. It is the same bargain TrueTime made explicit: you can buy latency with physics, but you must actually pay the physics. Linearizable reads are never free; the only question is which currency.`,
    invariant: `A leader must re-prove its regime to read linearizably: by quorum round (pay latency) or by lease (pay a clock-drift assumption) — without proof, a zombie serves stale reads as confidently as the blocked writer with setup = ${ZOMBIE_SETUP}.`,
  };

  yield {
    state: table('Epochs and fences in the wild', [
      ['zk', 'ZooKeeper'],
      ['kafka', 'Kafka'],
      ['etcd', 'etcd'],
      ['gfs', 'GFS / cloud storage'],
    ], [['where', '']], [
      ['the high 32 bits of the zxid ARE the epoch: every transaction id carries the regime that minted it, so stale-epoch traffic is rejected by inspection'],
      ['controller epoch + per-partition leader epoch: brokers and consumers reject messages from deposed leaders — two fence layers deep'],
      ['leases with TTLs power locks and leader keys; ReadIndex and lease reads are both in the API, exactly the trade above'],
      ['chunk version numbers bump on every new lease — and conditional writes (S3 ETag If-Match, GCS generation numbers) are fencing tokens you can use TODAY without running a consensus protocol at all'],
    ]),
    highlight: { active: ['gfs:where'] },
    explanation: `The pattern, once seen, is everywhere across all ${4} rows: a monotonic regime number attached to every action, checked by whoever holds the data. ZooKeeper bakes the epoch into transaction ids; Kafka fences at two levels because both the cluster controller and each partition leader can be replaced independently; etcd ships the read trade-off as API options. The last row is the practical takeaway for builders who will never implement Raft: cloud storage conditional writes — compare-and-swap on an ETag or generation number — are fencing tokens as a service. Guard output from your cron job with one conditional write and you have applied this entire page: the resource checks the regime, and the retry from the zombie bounces — exactly as the simulation's ${DISK.log.length} writes demonstrated.`,
    invariant: `Every robust handover reduces to one device: a monotonic epoch, attached to every action, enforced at the data — not at the actor (zombie rejection = ${!ZOMBIE_BLOCKED}).`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'zombies & fencing') yield* zombies();
  else if (view === 'carrying state across the change') yield* carryingState();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
        'The animation has two views. Zombies and fencing shows a leader that was deposed during a pause, while carrying state shows how Raft, Multi-Paxos, and PBFT keep committed entries alive during a view change.',
        {
          type: 'callout',
          text: 'Leader replacement is safe only when authority, external writes, and committed state all move through a monotonic regime boundary.',
        },
        'Active cells are the decision currently being checked. Found cells are facts now proven safe, removed cells are unsafe states rejected by the protocol, and compare cells show a tradeoff such as ReadIndex versus lease reads.',
        'The fencing-token step is computed by the generator. Token 33 succeeds first, token 34 supersedes it, and the old token 33 later fails because the storage layer remembers the highest token it has accepted.',
      
        {type: 'image', src: './assets/gifs/leader-replacement.gif', alt: 'Animated walkthrough of the leader replacement visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: [
        'A replicated system often chooses one leader to order writes. When that leader stops responding, the system must replace it without letting two leaders write different histories or losing a value already reported as committed.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg',
          alt: 'Process state transition diagram',
          caption: 'Leader replacement is a state transition with safety conditions, not just a timeout event. Source: Wikimedia Commons, CC BY-SA 3.0.',
        },
        'The hard part is that slow and dead look identical on an asynchronous network. Every replacement protocol must assume the old leader might come back and try to act on an obsolete view.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is a heartbeat timeout. If followers do not hear from the leader for T milliseconds, they start an election and pick a new leader.',
        'This is not naive in the insulting sense; it is the only signal available. Raft, Paxos-style systems, ZooKeeper, Kafka, and etcd all rely on timeouts somewhere because there is no perfect failure detector.',
      ], },
    { heading: 'The wall', paragraphs: [
        'A timeout can be wrong. A garbage-collection pause, stalled network queue, or overloaded machine can make a healthy leader look dead long enough for the cluster to elect a replacement.',
        'When the old leader wakes, it may still believe it owns authority. It can serve stale reads, accept writes, or write to an external store that does not know anything about the new election.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Authority must be monotonic. Every leadership regime gets a term, ballot, view, epoch, or fencing token that only increases, and every action carries that number to whoever must trust it.',
        'The receiver, not the actor, enforces the boundary. Consensus peers reject stale terms, and external resources reject stale fencing tokens.',
      ], },
    { heading: 'How it works', paragraphs: [
        'Inside the protocol, every message carries an epoch. If a node sees a lower epoch, it rejects the message and replies with the higher epoch; if it sees a higher epoch, it steps down and adopts that newer regime.',
        'Outside the protocol, a lock or leader service gives each leader a monotonically increasing fencing token. The database, disk, object store, or job output path accepts a write only when the token is at least the highest token it has already seen.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'In-protocol safety follows from monotonic epochs. A zombie leader cannot complete one normal round with a moved-on majority because the first reply carrying a higher epoch tells it to step down.',
        'Committed-state safety follows from quorum intersection. A committed entry is stored on a quorum, a new leader needs a quorum, and those quorums overlap, so each protocol must make the new leader learn or prove the overlapping state before it can overwrite history.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'The visible cost is the timeout window: a real failure stalls writes until enough followers decide to replace the leader. Short timeouts increase false elections; long timeouts increase outage time.',
        'The safety mechanisms are cheap per operation but expensive to design correctly. Epoch checks are one integer comparison, fencing tokens are one high-water-mark comparison, and Raft current-term commitment is a condition on when a leader may count replication as committed.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'ZooKeeper, Kafka, etcd, Raft databases, Paxos systems, PBFT replicas, and distributed lock services all use versions of this pattern. The names differ, but the object is the same: a monotonic regime number attached to authority.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Apache_ZooKeeper_logo.svg',
          alt: 'Apache ZooKeeper project logo',
          caption: 'ZooKeeper is a production example of epochs, sessions, and ordered identifiers used to keep distributed coordination safe. Source: Wikimedia Commons, Apache Software Foundation, Apache License 2.0.',
        },
        'Cloud storage conditional writes are the everyday version. An S3 ETag If-Match or GCS generation precondition makes the storage layer reject stale output without asking whether the writer thinks it still owns the job.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'It fails when authority is checked only by the actor. A lock holder that believes its lease is valid can still be stale, so the resource being modified must check the token too.',
        'It also fails when reads skip regime proof. A zombie leader can serve stale reads confidently unless the read path uses a quorum confirmation such as ReadIndex or a lease backed by a real clock-drift budget.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Leader A owns token 33 and writes checkpoint 1, so storage records high-water mark 33. A pauses for 20 seconds, followers elect B, and B receives token 34.',
        'B writes checkpoint 2, and storage updates the high-water mark to 34. A wakes and retries with token 33; storage rejects 33 because 33 is less than 34, even if A still believes it is leader.',
        'For committed state, suppose an entry is on 3 of 5 replicas. A new leader must also win 3 of 5 votes, so at least one voter overlaps with the committed quorum and can force the new regime to carry that history.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Sources: Ongaro and Ousterhout on Raft, Lamport on Paxos, Castro and Liskov on PBFT, Fischer-Lynch-Paterson on asynchronous consensus, and Martin Kleppmann on fencing tokens for distributed locks.',
        'Study Raft leader election, Raft log replication, Paxos, PBFT, fencing tokens, linearizable reads, NTP/PTP clock sync, and cloud-storage conditional writes. The practical lesson is to put the check where the data is changed.',
      ], },
  ],
};
