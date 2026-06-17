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
const ZOMBIE_SETUP = DISK.write(34, 'B: checkpoint #2'); // B acquired token 34 during A's pause
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
    explanation: 'Every view change begins with an accusation that can never be verified: "the leader is dead." In an asynchronous network there is no test that distinguishes a crashed process from a slow one — the evidence for both is the same absent heartbeat. So every system on this site, from Raft Leader Election to PBFT, runs on timeouts it KNOWS are imperfect, tuned between two failure modes: hair-trigger elections that depose healthy leaders versus long outages waiting on a corpse. This isn\'t sloppy engineering; it\'s the FLP impossibility surfacing as a config parameter. The consequence that drives this whole page: because detection can be WRONG, the old leader may not actually be dead — and protocols must survive its return.',
    invariant: 'Failure detection in async systems is inherently unreliable: every view change must assume the old leader might still be running.',
  };

  yield {
    state: table('The zombie: a deposed leader that never got the memo', [
      ['t1', 't1 · leader A (term 5) enters a 20s GC pause'],
      ['t2', 't2 · followers time out; C wins election for term 6'],
      ['t3', 't3 · A wakes up'],
      ['t4', 't4 · A keeps acting as leader'],
      ['fix', 'the in-protocol fix'],
    ], [['story', '']], [
      ['mid-heartbeat, mid-replication — a stop-the-world collection at the worst moment (the classic real-world trigger)'],
      ['the cluster has moved on; clients are writing through C'],
      ['its world-model is 20 seconds stale: it believes it holds term 5 leadership, because nothing told it otherwise'],
      ['it sends AppendEntries, serves "fresh" reads, acks writes — TWO leaders are now answering, and clients can read forked realities'],
      ['every message carries the term; any node seeing term 5 traffic replies "the term is 6" and A instantly steps down — inside the protocol, zombies die on first contact'],
    ]),
    highlight: { removed: ['t4:story'], found: ['fix:story'] },
    explanation: 'The zombie scenario is not exotic — a long garbage-collection pause is enough, and it has caused real split-brain outages in systems that skipped the defenses. Note what makes it dangerous: A is not malicious, not even buggy. It is executing the protocol PERFECTLY against a 20-second-old view of the world. Within the consensus group the cure is cheap and absolute: epochs. Every message carries the sender\'s term (Raft), ballot (Paxos), or view number (PBFT); any contact with the moved-on majority returns a higher number and the zombie steps down on the spot. The monotonic counter is doing for leadership exactly what it did in Clocks & Ordering: Lamport to TrueTime — replacing "what time is it?" with "whose number is bigger?", a question that has a correct answer.',
    invariant: 'Epoch numbers on every message make staleness self-detecting inside the protocol: a zombie cannot complete one round without learning it is deposed.',
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
      [`${ZOMBIE_BLOCKED ? 'accepted (BUG!)' : 'REJECTED — 33 < 34: the zombie\'s write bounces off the storage layer itself'}`],
      ['one integer compare: accept a write only if its token ≥ the highest ever seen — no clocks, no heartbeats, no trust in the client\'s health'],
    ]),
    highlight: { found: ['w3:result'], active: ['rule:result'] },
    explanation: 'Terms protect the consensus group — but leaders also touch the OUTSIDE world: shared disks, object stores, databases that know nothing about elections. A zombie that can no longer win a Raft vote can still happily corrupt a file. The fix is the FENCING TOKEN, simulated live above: the lock service hands out a monotonically increasing number with every grant, and the protected resource enforces one rule — never accept a token lower than the highest seen. A\'s stale write with 33 bounces off a store that has seen B\'s 34, regardless of what A believes about its own leadership. This is Kleppmann\'s famous critique of naive distributed locks (including Redis\'s Redlock as commonly deployed): a lock without fencing protects you only from processes polite enough to stay dead.',
    invariant: 'The resource enforces monotonicity, not the lock: a token check at the storage layer stops every zombie a heartbeat cannot.',
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
      ['ELIGIBILITY (push): voters refuse any candidate whose log is less up-to-date than theirs — since commits live on a majority, a winner\'s log already contains them; nothing transfers after victory'],
      ['ADOPTION (pull): the new leader\'s phase-1 promises report the highest accepted values, which it MUST re-propose — it wins the ballot, history wins the content'],
      ['CERTIFICATES (proof): view-change messages carry prepared certificates signed by 2f+1 replicas; the new primary must re-include every one — with Byzantine Fault Tolerance: When Nodes Lie in play, "trust the quorum" becomes "verify the signatures"'],
      ['any committed entry lives on a quorum; any new regime needs a quorum; the quorums intersect — the entry is IN the intersection, however each protocol chooses to read it out'],
    ]),
    highlight: { active: ['same:how'] },
    explanation: 'Now the constructive half: a client was told "committed," so the entry must outlive the leader who said it. All three protocol families lean on the same quorum-intersection theorem and differ only in WHO does the carrying. Raft moves the work before the election — unfit candidates simply cannot win, so the winner\'s own log is already complete. Paxos moves it after — anyone can win, but the promise messages force the winner to adopt what previous ballots accepted. PBFT can trust neither voters nor winner, so the evidence travels as signed certificates that any replica can check. Three engineering cultures, one safety proof: the intersection always contains a witness.',
    invariant: 'Committed ⇒ on a quorum ⇒ in every new quorum\'s intersection: protocols differ only in how the witness is consulted.',
  };

  yield {
    state: table('The subtle one: Raft\'s figure-8 — when majority replication is NOT commitment', [
      ['s1', 't1 · leader L1 (term 2) replicates entry X to 2 of 4 followers, crashes'],
      ['s2', 't2 · L2 (term 3) — which never saw X — wins election from the others, writes Y locally, crashes'],
      ['s3', 't3 · L1 returns, wins term 4, resumes spreading X — now on a MAJORITY'],
      ['s4', 't4 · is X committed? NO.'],
      ['rule', 'the rule that closes the hole'],
    ], [['story', '']], [
      ['X exists on L1 + 2 followers: 3 of 5 — a majority holds it, stamped term 2'],
      ['legal: L2\'s log was as up-to-date as its voters\' — X\'s absence didn\'t disqualify it'],
      ['majority replication achieved for X… the naive commit condition says "done"'],
      ['L2 could STILL return, win with its term-3 entry Y (newer term beats longer log), and erase X from the majority — an "committed" entry would vanish'],
      ['a leader may only count replication of entries from its OWN term; older entries commit indirectly, shielded behind a current-term entry committed on top of them'],
    ]),
    highlight: { removed: ['s4:story'], found: ['rule:story'] },
    explanation: 'The most famous subtlety in the Raft paper (its figure 8), walked slowly because it humbles everyone: an entry from an OLD term sitting on a majority can still be overwritten, because election eligibility compares terms before lengths — a rival with a newer-term entry can lawfully win and erase the "majority-replicated" entry. So majority replication alone is not commitment. Raft\'s repair is deliberately blunt: a leader never declares old-term entries committed by counting replicas; it commits an entry from its CURRENT term, and everything beneath becomes committed by log-prefix implication. The lesson generalizes beyond Raft: "how many copies" is never the whole commit condition — WHICH REGIME stamped the copies matters as much as the count.',
    invariant: 'Commitment = current-term entry on a majority; older entries are safe only as its prefix — counts without terms are not commitment.',
  };

  yield {
    state: table('Even READS need the regime check', [
      ['naive', 'naive leader read'],
      ['readindex', 'ReadIndex (etcd, TiKV)'],
      ['lease', 'lease-based reads'],
      ['tradeoff', 'the trade'],
    ], [['how', '']], [
      ['"I\'m the leader, here\'s the value" — but a zombie believes exactly the same thing: stale reads served with full confidence'],
      ['before answering, exchange one heartbeat round with a quorum: "am I still it?" — correctness from the quorum, +1 RTT per read batch'],
      ['after a successful heartbeat, serve reads locally for a bounded window (election timeout minus assumed clock-drift slack) — fast reads, but correctness now leans on bounded drift, the exact commodity NTP & PTP: How Clocks Actually Sync prices'],
      ['ReadIndex pays latency for certainty; leases pay a physics assumption for speed — most systems offer both and let the read choose'],
    ]),
    highlight: { compare: ['readindex:how', 'lease:how'] },
    explanation: 'A pure read mutates nothing, so it\'s tempting to skip the machinery — and that\'s precisely how zombie leaders serve stale data with a straight face. The honest options both re-verify the regime: ReadIndex performs a quorum round-trip per read batch (the leader proves it is still leader before answering), while leases amortize that proof over a time window — legitimate ONLY if clocks drift less than the slack budgeted, which quietly imports a synchrony assumption into an otherwise asynchronous design. It\'s the same bargain TrueTime made explicit: you can buy latency with physics, but you must actually pay the physics. Linearizable reads are never free; the only question is which currency.',
    invariant: 'A leader must re-prove its regime to read linearizably: by quorum round (pay latency) or by lease (pay a clock-drift assumption).',
  };

  yield {
    state: table('Epochs and fences in the wild', [
      ['zk', 'ZooKeeper'],
      ['kafka', 'Kafka'],
      ['etcd', 'etcd'],
      ['gfs', 'GFS / cloud storage'],
    ], [['where', '']], [
      ['the zxid\'s high 32 bits ARE the epoch: every transaction id carries the regime that minted it, so stale-epoch traffic is rejected by inspection'],
      ['controller epoch + per-partition leader epoch: brokers and consumers reject messages from deposed leaders — two fence layers deep'],
      ['leases with TTLs power locks and leader keys; ReadIndex and lease reads are both in the API, exactly the trade above'],
      ['chunk version numbers bump on every new lease — and conditional writes (S3 ETag If-Match, GCS generation numbers) are fencing tokens you can use TODAY without running a consensus protocol at all'],
    ]),
    highlight: { active: ['gfs:where'] },
    explanation: 'The pattern, once seen, is everywhere: a monotonic regime number attached to every action, checked by whoever holds the data. ZooKeeper bakes the epoch into transaction ids; Kafka fences at two levels because both the cluster controller and each partition leader can be replaced independently; etcd ships the read trade-off as API options. The last row is the practical takeaway for builders who will never implement Raft: cloud storage conditional writes — compare-and-swap on an ETag or generation number — are fencing tokens as a service. Guard your cron job\'s output with one conditional write and you\'ve applied this entire page: the resource checks the regime, and the zombie\'s retry bounces.',
    invariant: 'Every robust handover reduces to one device: a monotonic epoch, attached to every action, enforced at the data — not at the actor.',
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
    {
      heading: `What it is`,
      paragraphs: [
        `Leader replacement is the hardest half of any consensus system. Electing a new leader is mechanically simple — the hard part is everything else: how to detect that the old one really is gone (when silence can mean slow or dead), how to fence off the deposed leader if it wakes up from the grave, and how to guarantee that committed state survives the transition. Every distributed system from Raft Leader Election to PBFT lives or dies on these three problems. On an asynchronous network, none of them have perfect solutions — only carefully chosen trade-offs tuned between two failure modes.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `Leader replacement is safe only when authority is monotonic. A newer term, ballot, view number, lease epoch, or fencing token must dominate older authority everywhere the old leader can still act. The protocol cannot rely on the old leader understanding that it lost; it must make stale authority fail by construction.`,
        `The same idea appears twice. Inside the consensus group, terms and quorums make stale leaders step down and carry committed entries forward. Outside the group, fencing tokens make stale writes bounce at the resource itself. A handover is not complete until both boundaries are protected.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Detection starts with a timeout: the followers wait for a heartbeat from the leader, and if silence lasts longer than the timeout, they assume it is dead and hold an election. But here is the rub — silence looks identical whether the leader has crashed or just paused (a 20-second garbage-collection pause, a packet queue, an overloaded network card). The FLP lesson from "Paxos: Consensus Without a Leader" surfaces as an operational parameter: every system on this page knows its timeout is imperfect and tunes it between two failure modes. If the timeout is too short, healthy leaders get deposed mid-pause and the cluster wastes energy on duel elections. If the timeout is too long, every real failure becomes a full outage of that length. Raft Leader Election randomizes between 150–300ms; production etcd defaults to ~1s. Both systems accept failure modes at the edges — they have to.`,
        `The zombie scenario makes this vivid: A is the leader in term 5, hits a 20-second GC pause, and the cluster moves on. C wins an election for term 6, clients write through C, the consensus has progressed. A wakes up and has no idea it is deposed — its world-model is 20 seconds old. It sends heartbeats, serves reads, acknowledges writes, and suddenly two leaders are answering. Inside the consensus group, the cure is cheap: every message carries the sender's term (Raft), ballot (Paxos), or view number (PBFT). A's term-5 traffic hits the moved-on majority, learns it is term 6, and steps down instantly. Epochs on every message make staleness self-detecting — a zombie cannot complete one round without learning it is dead.`,
        `Outside the consensus group, resources need their own fence. A deposed leader can no longer win a Raft vote, but it can still happily corrupt a file or lose writes to a database that knows nothing about elections. The fix is the fencing token: the lock service hands out a monotonically increasing number with every grant (A gets 33, B gets 34), and the protected resource enforces one rule — never accept a write with a token lower than the highest seen. A's stale write with 33 bounces off a store that has seen B's 34, one integer compare, regardless of whether A believes itself to be the leader. This is Kleppmann's famous critique of naive distributed locks: a lock without fencing protects you only from processes polite enough to stay dead.`,
        `Carrying committed state across the handover rests on the quorum-intersection theorem: any committed entry lives on a quorum, any new regime needs a quorum, and the quorums overlap. The three protocol families differ only in who does the carrying. Raft moves the work before the election — unfit candidates simply cannot win, so the winner's own log already contains all committed entries. Multi-Paxos moves it after — anyone can win, but the promise messages from phase 1 force the winner to adopt the highest values previous ballots accepted. PBFT can trust neither voters nor winner, so the evidence travels as signed prepared certificates that any replica can verify. Raft's figure-8 teaches the subtle point: an entry from an old term sitting on a MAJORITY can still be erased, because election eligibility compares terms before lengths. So majority replication alone is not commitment — a leader commits an entry from its CURRENT term, and everything beneath becomes safe by log-prefix implication. The lesson generalizes: "how many copies" is never the whole commit condition. Which regime stamped the copies matters as much as the count.`,
        `Even reads need the regime check. A zombie leader believes exactly as strongly that it is the leader and serves reads from its stale cache. The honest options both re-verify: ReadIndex exchanges one heartbeat round with a quorum before answering (the leader proves it is still leader); leases amortize that proof over a time window, but correctness now leans on clocks drifting less than the slack budgeted — it pays a physics assumption for latency. Production systems offer both and let the read choose its currency.`,
      ],
    },
    {
      heading: `How the visual model teaches it`,
      paragraphs: [
        `Read leader replacement as failure detection plus handoff, not merely "pick a new primary." The system must notice the old leader is unavailable, prevent split-brain writers, transfer or rebuild authority, and let clients converge on the new leader.`,
        `The animation is strongest when you track leases, terms, or fencing tokens. A new leader is safe only if stale leaders cannot keep committing writes. Leader replacement is a correctness protocol before it is an availability feature.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The core cost is detection latency: every view change begins with a timeout guess that can never be verified. Setting it wrong costs either thrashed elections (too short) or real outages (too long). Raft and etcd accept both at the edges and split the difference. The second cost is the fencing token: a monotonically increasing number that must be issued atomically with every leadership grant and checked by every protected resource. In-protocol epoch checks (terms, ballots, view numbers) add a few bytes per message and one integer comparison per receipt — negligible. The log-prefix shield to close Raft's figure-8 adds one condition: a leader counts replication only for its own term. The ReadIndex round-trip is +1 RTT per read batch; lease-based reads pay a physical clock-drift assumption instead of latency. Carrying state across the handover is mathematically forced (the quorum-intersection theorem is unavoidable); the work is just implementing whichever protocol you choose.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `ZooKeeper bakes the epoch into transaction ids (the zxid's high 32 bits ARE the epoch), so stale-epoch traffic is rejected by inspection. Kafka fences at two levels — controller epoch and per-partition leader epoch — because both the cluster controller and each partition leader can be replaced independently. etcd ships both the quorum round (ReadIndex) and the lease-based read as API options, letting you choose the latency/assumption trade-off. GFS and modern cloud storage generalize this pattern: chunk version numbers bump on every new lease, and conditional writes (S3's ETag If-Match, Google Cloud Storage's generation numbers) are fencing tokens you can use today without running a consensus protocol at all. For anyone building a distributed system, the practical takeaway is: cloud storage conditional writes are fencing tokens as a service — guard your cron job's output with one conditional write and you've applied this entire page.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The most common mistake is believing that detection can be reliable: it cannot. Every timeout is a guess tuned between two failure modes, not a measurement. The second trap is skipping in-protocol defenses: a lock without fencing only protects you from processes polite enough to stay dead, and many real systems (including Redis Redlock without additional hardware safety) have been caught serving split-brain data because they trusted the lock and forgot the fence.`,
        `Another subtle pitfall is confusing majority replication with commitment in Raft. An entry on a majority can still be erased if an older-term entry wins the next election (Raft's figure-8). The whole commitment rule — current-term entry on a majority, with everything beneath as prefix — exists to close this hole. Reading Raft's own paper is mandatory before implementing it; the subtle cases bite anyone who skips that step.`,
        `Finally, do not assume reads are free. A zombie leader serves reads confidently from a stale world-model. Linearizable reads require the leader to re-prove its regime, either by quorum round (ReadIndex) or by paying a bounded-clock-drift assumption (leases). There is no free lunch; the only question is which currency you choose.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Use Raft Leader Lease Read Safety for the read-path version of the zombie-leader problem, and Fencing Token Zombie Writer for the external-resource version where epochs must be checked outside the consensus group.`,
        `Dive into "Raft Leader Election" to see how eligibility creates the pre-election carrying rule. Study "Paxos: Consensus Without a Leader" to understand the FLP impossibility and why timeouts can never distinguish slow from dead. Explore "Byzantine Fault Tolerance: When Nodes Lie" to see how PBFT handles untrusted voters and moves the proof to signed certificates. Continue into "HotStuff BFT Quorum Certificate Case Study" to see view-change data compressed into quorum certificates, timeout certificates, and a chained commit rule. Read "Clocks & Ordering: Lamport to TrueTime" to understand how epoch numbers detect staleness the same way logical clocks enforce ordering — by comparing numbers instead of trusting actors. Finally, study "NTP & PTP: How Clocks Actually Sync" to ground the physical assumptions that lease-based reads silently import. Together, these let you design any leader handover: epochs inside the protocol, fences outside, and quorum-intersection carrying state across the change.`,
      ],
    },
  ],
};
