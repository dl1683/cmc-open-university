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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views, selectable at the top. "Zombies & fencing" traces a deposed leader returning from a GC pause and shows why fencing tokens stop its stale writes. "Carrying state across the change" traces how committed entries survive a leadership transition in Raft, Multi-Paxos, and PBFT.',
        {
          type: 'callout',
          text: 'Leader replacement is safe only when authority, external writes, and committed state all move through a monotonic regime boundary.',
        },
        {
          type: 'bullets',
          items: [
            'Active cells mark the current decision point -- the thing the protocol is evaluating right now.',
            'Found cells mark outcomes now proven safe -- invariants that hold regardless of what happens next.',
            'Removed cells mark states that violate safety -- writes that were rejected, scenarios that would break linearizability.',
            'Compared cells highlight the tension between two design choices -- the trade-off the protocol must navigate.',
          ],
        },
        'At each frame, ask: what changed, what invariant does that change preserve, and what would break if the invariant were missing? The fencing-token step is computed live from an actual monotonic-counter simulation -- the "REJECTED" result is not a label but a runtime check.',
      
        {type: 'image', src: './assets/gifs/leader-replacement.gif', alt: 'Animated walkthrough of the leader replacement visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Electing a new leader is mechanically simple. The hard part is everything around it: detecting that the old leader is really gone when silence can mean slow or dead, fencing the deposed leader off when it wakes from the grave, and guaranteeing that committed state survives the transition. Every consensus system from Raft to PBFT lives or dies on these three problems.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg',
          alt: 'Process state transition diagram',
          caption: 'Leader replacement is a state transition with safety conditions, not just a timeout event. Source: Wikimedia Commons, CC BY-SA 3.0.',
        },
        {
          type: 'note',
          text: 'Leader replacement is not an availability feature with a correctness side effect. It is a correctness protocol that happens to restore availability. If the handover loses a committed entry or allows two leaders to write simultaneously, the system has violated its contract -- no amount of uptime repairs that.',
        },
        'On an asynchronous network, none of the three problems have perfect solutions. FLP impossibility guarantees that no deterministic protocol can distinguish a crashed process from a slow one. The entire page is a study in carefully chosen trade-offs tuned between two failure modes that cannot both be eliminated.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt: use a heartbeat timeout. If the leader stops sending heartbeats for T milliseconds, declare it dead, elect a new one, and move on. The old leader will notice it lost the election eventually, so everything should converge.',
        'This works well enough that every production system uses it. Raft randomizes between 150-300ms. Production etcd defaults to roughly 1 second. The heartbeat timeout is the universal starting point because there is no alternative -- in an asynchronous network, silence is the only evidence you get.',
        {
          type: 'bullets',
          items: [
            'Too short, for example 50ms: healthy leaders can be deposed during GC pauses, packet queues, or NIC stalls; elections duel and the cluster burns terms without useful work.',
            'Too long, for example 10 seconds: every real crash becomes a full write outage for the whole timeout window.',
            'Compromise plus jitter, such as 150-300ms in Raft: the system accepts occasional false depositions and occasional delayed detection because no timeout can remove both edges.',
          ],
        },
        'The approach is not stupid. It is the only approach. The question is what you do about its two unavoidable failure modes.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The heartbeat timeout has a lethal blind spot: the old leader may not be dead. A 20-second garbage-collection pause, a saturated network queue, a kernel scheduling delay -- any of these produce the same silence as a crash. The protocol declares the leader dead and elects a replacement. Then the old leader wakes up.',
        {
          type: 'diagram',
          text: 'Timeline:\n\n  t=0s   Leader A (term 5) enters GC pause\n         |  ...silence...\n  t=1s   Followers time out, start election\n  t=2s   C wins election for term 6\n  t=3s   Clients write X, Y, Z through C\n         ...\n  t=20s  A wakes up, believes it is still leader (term 5)\n         A sends AppendEntries, serves reads, acks writes\n         >>> TWO LEADERS ANSWERING <<<',
          label: 'The zombie scenario: a GC pause creates two concurrent leaders',
        },
        'A is not malicious. It is not buggy. It is executing the protocol perfectly against a 20-second-old view of the world. Three things can go wrong simultaneously:',
        {
          type: 'bullets',
          items: [
            'Split-brain writes: A and C both accept client writes, forking the log.',
            'Stale reads: A serves reads from its stale state, violating linearizability.',
            'External corruption: A writes to a shared disk or database that knows nothing about elections.',
          ],
        },
        'The wall is that detection unreliability is not a bug to fix -- it is a theorem (FLP) wearing operational clothing. Any protocol that declares a leader dead must handle the case where the declaration was wrong.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Leader replacement solves three problems in sequence: detect the failure (imperfectly), fence the zombie (inside and outside the protocol), and carry committed state across the handover.',
        {
          type: 'note',
          text: 'The three problems are independent defenses. Skipping any one of them creates a distinct failure mode: skip detection tuning and you get thrashing or long outages; skip fencing and you get split-brain corruption; skip state carrying and you lose committed entries.',
        },
        'Problem 1: Detection. Followers wait for heartbeats. If silence exceeds the timeout, they start an election. The timeout is a guess between two failure modes, tuned with randomized jitter to prevent election duels. No system can do better than this in an asynchronous network.',
        'Problem 2: In-protocol fencing. Every message carries the epoch of the sender -- term in Raft, ballot in Paxos, view number in PBFT. When zombie A sends a term-5 message to a node that has seen term 6, the node replies with the higher term. A learns it is deposed and steps down immediately. One integer comparison per message, and staleness becomes self-detecting.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Simplified epoch check on message receipt\nfunction onReceive(msg, myTerm) {\n  if (msg.term > myTerm) {\n    myTerm = msg.term;  // adopt higher term\n    stepDown();         // revert to follower\n  }\n  if (msg.term < myTerm) {\n    reply({ term: myTerm }); // tell sender it is stale\n    return;                  // reject stale message\n  }\n  // process message normally\n}',
        },
        'Problem 3: External fencing. A deposed leader can no longer win a Raft vote, but it can still corrupt a file or lose writes to a database that knows nothing about elections. The fix is the fencing token: the lock service hands out a monotonically increasing number with every leadership grant. The protected resource enforces one rule -- reject any write whose token is lower than the highest it has seen.',
        {
          type: 'diagram',
          text: 'Lock service grants:\n  A gets token 33    B gets token 34 (during the pause by A)\n\nStorage-side enforcement:\n  A writes (token 33) --> accepted  (high-water mark: 33)\n  B writes (token 34) --> accepted  (high-water mark: 34)\n  A retries (token 33) --> REJECTED (33 < 34)\n\nRule: accept iff token >= high-water mark\nNo clocks. No heartbeats. One integer compare.',
          label: 'Fencing token: the storage layer enforces monotonicity, not the lock holder',
        },
        'Problem 4: Carrying committed state. A client was told "committed," so the entry must survive the leader that said it. All three protocol families lean on the quorum-intersection theorem: a committed entry lives on a quorum, a new leader needs a quorum, and those quorums overlap. The entry is in the intersection.',
        {
          type: 'bullets',
          items: [
            'Raft transfers state before election: voters reject candidates with less up-to-date logs, so the winner already has all committed entries.',
            'Multi-Paxos transfers state after election: phase-1 promises report the highest accepted values, and the new leader must re-propose them.',
            'PBFT transfers state during view change: view-change messages carry prepared certificates signed by 2f+1 replicas, and the new primary re-includes every one.',
          ],
        },
        'The subtle case is Raft figure-8: an entry from an old term sitting on a majority can still be overwritten, because election eligibility compares terms before log lengths. Majority replication alone is not commitment. A leader commits only entries from its current term; older entries become safe as a prefix beneath a current-term commit.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Safety rests on two monotonic invariants, each enforced by a different mechanism.',
        {
          type: 'note',
          text: 'Invariant 1 (in-protocol): epoch numbers on every message make staleness self-detecting. A zombie cannot complete one round-trip without learning it is deposed, because any contact with the moved-on majority returns a higher epoch.',
        },
        {
          type: 'note',
          text: 'Invariant 2 (external): fencing tokens make stale authority fail at the resource. The storage layer rejects any token lower than its high-water mark, regardless of the belief held by the writer about leadership.',
        },
        'Preservation argument for in-protocol fencing: Before any message is processed, the receiver checks the epoch of the sender against its own. If the epoch of the sender is lower, the message is rejected and the sender is informed. If the epoch of the sender is higher, the receiver adopts it and steps down. After the check, exactly one epoch governs -- the highest one. No stale-epoch operation can complete because the first message it sends triggers the check.',
        'Preservation argument for state carrying (Raft): Before the election, every committed entry is on a majority. During the election, the candidate must win a majority. The two majorities overlap in at least one node, and that node rejects the candidate if its log is less up-to-date. After the election, the log of the winner contains every committed entry. The log-prefix commit rule (commit only current-term entries) closes the figure-8 hole: an old-term entry on a majority is not yet committed, so its potential loss does not violate safety.',
        {
          type: 'quote',
          text: 'If an entry is committed, then that entry will be present in the logs of the leaders for all higher-numbered terms.',
          attribution: 'Diego Ongaro and John Ousterhout, "In Search of an Understandable Consensus Algorithm" (USENIX ATC 2014), Leader Completeness Property',
        },
        'The same quorum-intersection argument holds for Paxos (promise messages carry the witness) and PBFT (signed certificates carry the proof). The protocols differ in mechanics; the safety proof is the same.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Failure detection costs one timeout window of unavailability per real failure, usually in the 150ms to 1s range, because silence is the only signal available in an async network.',
            'In-protocol epoch checks cost a few bytes per message and one integer comparison per receipt, buying self-detecting staleness.',
            'Fencing token issuance costs one atomic counter increment per leadership grant, buying protection for resources outside the protocol.',
            'Fencing token checks cost one integer comparison per write at the storage layer, buying rejection of stale writers regardless of belief.',
            'State carrying in Raft costs no extra messages because eligibility is part of the vote, buying committed entries by construction.',
            'State carrying in Paxos costs one extra phase-1 round after election, buying adoption of previously accepted values.',
            'State carrying in PBFT costs 2f+1 signed certificates in view-change messages, buying Byzantine-safe proof that committed data was not lost.',
            'ReadIndex costs one quorum heartbeat round per read batch, buying linearizable reads without clock assumptions.',
            'Lease reads cost no extra RTT inside the lease window, but correctness depends on bounded clock drift.',
          ],
        },
        'The dominant cost in practice is the detection timeout itself. Every other mechanism adds negligible overhead -- epoch checks are a single comparison, fencing tokens are a single counter, and state carrying is forced by the quorum-intersection theorem regardless of which protocol you choose.',
        {
          type: 'note',
          text: 'The log-prefix commit rule (the Raft figure-8 fix) adds exactly one condition: a leader counts replication only for entries stamped with its own term. Older entries piggyback to safety beneath a current-term commit. This costs nothing at runtime -- it is a condition on the commit decision, not an extra message.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Every system that elects a leader must replace it safely. The mechanisms on this page appear in every production consensus deployment.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Apache_ZooKeeper_logo.svg',
          alt: 'Apache ZooKeeper project logo',
          caption: 'ZooKeeper is a production example of epochs, sessions, and ordered identifiers used to keep distributed coordination safe. Source: Wikimedia Commons, Apache Software Foundation, Apache License 2.0.',
        },
        {
          type: 'bullets',
          items: [
            'ZooKeeper: zxid high bits carry the epoch, session expiry and sequential znodes provide fences, and sync forces a leader round before a linearizable read.',
            'Kafka: controller epoch and per-partition leader epoch fence separate authority layers, while brokers reject produce requests from deposed partition leaders.',
            'etcd: the Raft term rides on every message, lock keys use lease TTLs, and the API exposes both ReadIndex and lease reads.',
            'Cloud storage such as S3 or GCS: conditional writes with ETag or generation checks act as fencing tokens without exposing a consensus protocol.',
          ],
        },
        {
          type: 'note',
          text: 'The last row is the practical takeaway for builders who will never implement Raft: guard output from your cron job with one conditional write (If-Match on the ETag) and you have applied the fencing-token pattern from this entire page. The storage layer checks the regime; the retry from the zombie bounces.',
        },
        'Lease-based reads (etcd, TiKV) amortize the regime-verification cost over a time window. This is legitimate only if clocks drift less than the budgeted slack -- the same synchrony assumption that NTP and PTP price. Production systems offer both lease reads and ReadIndex, letting each query choose its currency: latency or certainty.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Believing detection can be reliable. It cannot. Every timeout is a guess tuned between two failure modes, not a measurement. FLP guarantees this.',
            'Skipping external fencing. A lock without a fencing token protects you only from processes polite enough to stay dead. Redis Redlock without additional storage-side checks has been caught serving split-brain data because it trusted the lock and forgot the fence.',
            'Confusing majority replication with commitment. In Raft, an entry from an old term on a majority can still be erased if a candidate with a newer-term entry wins the next election (the figure-8 scenario). The commit rule -- current-term entry on a majority, everything beneath as prefix -- exists specifically to close this hole.',
            'Assuming reads are free. A zombie leader serves reads from a stale world-model with full confidence. Linearizable reads require re-proving the regime: ReadIndex pays one RTT, leases pay a clock-drift assumption. There is no free option.',
            'Ignoring lease clock drift. Lease-based reads silently import a synchrony assumption into an otherwise asynchronous protocol. If NTP drifts beyond the budgeted slack, a deposed leader can serve stale reads during the drift window without any protocol violation -- the lease has not expired from its perspective.',
          ],
        },
        {
          type: 'quote',
          text: 'If you are using locks merely for efficiency, the cost of a lock failure is low... If you are using them for correctness, the cost of a lock failure is high, and you need a fencing token.',
          attribution: 'Martin Kleppmann, "How to do distributed locking" (2016)',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm" (USENIX ATC 2014): Raft leader election, log-prefix commitment, and figure-8.',
            'Lamport, "The Part-Time Parliament" (ACM TOCS 1998) and "Paxos Made Simple" (2001): Paxos phase-1 promises and state carrying.',
            'Castro and Liskov, "Practical Byzantine Fault Tolerance" (OSDI 1999): PBFT view change with signed prepared certificates.',
            'Kleppmann, "How to do distributed locking" (2016): fencing tokens, the Redlock critique, and locks without fences.',
            'Fischer, Lynch, and Paterson, "Impossibility of Distributed Consensus with One Faulty Process" (JACM 1985): why failure detection in async systems can never be reliable.',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Raft Leader Election -- see how eligibility creates the pre-election carrying rule that makes the log of the winner complete.',
            'Prerequisite: Paxos: Consensus Without a Leader -- understand FLP impossibility and why timeouts can never distinguish slow from dead.',
            'Extension: Byzantine Fault Tolerance: When Nodes Lie -- see how PBFT handles untrusted voters and moves proof to signed certificates.',
            'Extension: HotStuff BFT Quorum Certificate Case Study -- view-change data compressed into quorum certificates and timeout certificates.',
            'Related: Clocks & Ordering: Lamport to TrueTime -- epoch numbers detect staleness the same way logical clocks enforce ordering: by comparing numbers instead of trusting actors.',
            'Related: NTP & PTP: How Clocks Actually Sync -- grounds the physical assumptions that lease-based reads silently import.',
            'Applied: Raft Leader Lease Read Safety -- the read-path version of the zombie-leader problem.',
            'Applied: Fencing Token Zombie Writer -- the external-resource version where epochs must be checked outside the consensus group.',
          ],
        },
      ],
    },
  ],
};
