// Distributed locks: a mutex with no OS to clean up after dead holders.
// Every distributed lock is secretly a lease, every lease can be outlived
// by a paused process, and the honest fixes live outside the lock entirely.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'distributed-locks',
  title: 'Distributed Locks: What They Can Promise',
  category: 'Systems',
  summary: 'Why every distributed lock is a lease, why a GC pause defeats any client-side check, and when the right lock is no lock at all.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['why your lock is a lease', 'recipes & when not to lock'], defaultValue: 'why your lock is a lease' },
  ],
  run,
};

// The canonical race, computed: lease TTL 10s, holder pauses at t=2 for 15s.
const TTL = 10;
const PAUSE_AT = 2;
const PAUSE_LEN = 15;
const EXPIRES = TTL;                      // lease granted at t=0
const WAKES = PAUSE_AT + PAUSE_LEN;       // A resumes believing it holds the lock
const B_ACQUIRES = EXPIRES;               // B legally acquires the expired lease
const OVERLAP = WAKES - B_ACQUIRES;       // seconds with TWO believing holders

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

function* lease() {
  yield {
    state: table('A mutex and a "distributed mutex" are different species', [
      ['mutex', 'in-process mutex'],
      ['dead', 'what happens when the holder dies'],
      ['dist', 'distributed lock'],
      ['rename', 'the honest rename'],
    ], [['detail', '']], [
      ['the OS knows every holder: a crashed thread\'s locks are released by the kernel, instantly and reliably'],
      ['in-process: cleanup is guaranteed. Across machines: the lock service sees only SILENCE — and silence is also what a slow network, a GC pause, and a busy CPU look like'],
      ['no kernel spans machines. The service cannot distinguish "holder crashed" from "holder is slow", so it must reclaim locks on a timer — or risk a dead client locking the system forever'],
      ['a lock that expires is a LEASE. Every distributed lock is a lease; the word "lock" is marketing'],
    ]),
    highlight: { active: ['rename:detail'] },
    explanation: 'Start by renaming the thing, because the name smuggles in a false promise. An in-process mutex offers absolute exclusion because an absolute authority — the kernel — watches every holder and reaps the dead. Distributed systems have no kernel; the lock service\'s only signal about a holder\'s health is heartbeats, and the absence of heartbeats is ambiguous (the same slow-versus-dead dilemma from View Changes: Replacing a Failed Leader). So every practical design attaches a TTL: hold it, renew it, or lose it. That timer keeps the system alive after crashes — and it is also, inescapably, a second way to lose the lock while still running. Everything dangerous about distributed locking lives in that sentence.',
    invariant: 'No kernel spans machines: liveness requires expiry, and expiry means a running process can lose a lock it believes it holds.',
  };

  yield {
    state: table(`The canonical race, with the arithmetic (TTL ${TTL}s)`, [
      ['t0', 't=0 · A acquires the lease'],
      ['t2', `t=${PAUSE_AT} · A stops the world`],
      ['t10', `t=${EXPIRES} · the lease expires`],
      ['t17', `t=${WAKES} · A wakes up`],
      ['math', 'the overlap'],
    ], [['event', '']], [
      [`TTL ${TTL}s; A plans to finish in 5 and starts working`],
      [`a ${PAUSE_LEN}s GC pause / VM migration / page-fault storm — A executes nothing, including its own clock checks`],
      [`the service has heard nothing for ${EXPIRES - PAUSE_AT}s: it does exactly what it must, and grants the lock to B — who begins writing, correctly`],
      ['mid-critical-section, with no idea time passed: its next instruction runs as if the lease were still its own'],
      [`from t=${B_ACQUIRES} to t=${WAKES}: ${OVERLAP} seconds with TWO clients inside one critical section — computed from the timeline, no component at fault`],
    ]),
    highlight: { removed: ['t17:event', 'math:event'] },
    explanation: `The famous failure (Kleppmann\'s how-to-do-distributed-locking analysis), with the numbers laid bare: every participant behaved correctly. The service MUST reclaim silent leases — that\'s the liveness it exists to provide. B acquired legally. And A is not buggy: a stop-the-world GC pause suspends the process BETWEEN instructions, so A cannot even observe that time passed until after it has already resumed doing damage. For ${OVERLAP} seconds, two clients each hold written proof of exclusive access. Pauses of this size are not hypothetical: multi-second GC pauses, live VM migrations, and even laptop lid closes appear in every ops team\'s incident history.`,
    invariant: 'Overlap = wake time − expiry: any pause longer than the remaining TTL manufactures two believing holders, with zero faulty components.',
  };

  yield {
    state: table('Why no client-side cleverness closes the window', [
      ['check', '"check the lease before writing"'],
      ['gap', 'the gap'],
      ['heart', '"renew with a background thread"'],
      ['real', 'the only real fixes'],
    ], [['verdict', '']], [
      ['A checks at t=16.9… and the check itself can be answered, then the pause lands BETWEEN the check and the write'],
      ['check-then-act is two steps, and a pause can always land in the seam — shrinking the window never makes it zero'],
      ['the renewal thread is inside the same process: it pauses with everything else (that is what stop-the-world means)'],
      ['move the check INTO the resource: fencing tokens (one integer compare at the storage layer — see View Changes: Replacing a Failed Leader) or make the operation idempotent/conditional so a duplicate run is harmless (see Idempotency & Exactly-Once Delivery)'],
    ]),
    highlight: { removed: ['check:verdict', 'heart:verdict'], found: ['real:verdict'] },
    explanation: 'The instinctive patches all share one flaw: they run inside the process that might pause. Checking the lease before writing just moves the race into the gap between check and write — a seam no client code can close, because the pause chooses where to land after the code is written. The background renewal thread freezes along with the rest of the process; that is what "stop-the-world" means. The honest conclusion is structural: a client can never prove, from inside itself, that it still holds a lease at the instant its write lands. Safety must be enforced where the write ARRIVES — a fencing token compared at the storage layer, a conditional write, an idempotency key — by a party whose clock never stops with yours.',
    invariant: 'A process cannot verify its own timeliness: exclusion enforced client-side is a race; safety must live where the data lives.',
  };
}

function* recipes() {
  yield {
    state: table('The standard recipes, with their actual guarantees', [
      ['zk', 'ZooKeeper'],
      ['etcd', 'etcd'],
      ['redis', 'single Redis'],
      ['redlock', 'Redlock (5 Redis nodes)'],
    ], [['how', 'mechanism'], ['guarantee', 'what it actually promises']], [
      ['ephemeral sequential znode; lowest number holds the lock; each waiter watches only its predecessor', 'session-based expiry (consensus-backed via ZAB); the watch chain gives FIFO fairness and wakes ONE waiter per release — no thundering herd'],
      ['lease + transaction: acquire = atomic compare-and-swap keyed to a lease id', 'Raft Leader Election-backed; lease revisions double as fencing tokens — the most complete recipe if the resource checks them'],
      ['SET key value NX PX 30000', 'fast and simple; one node = one failure point; replication is async so a failover can resurrect a granted lock'],
      ['acquire a majority of 5 independent Redis nodes within a drift budget', 'better than one node against crashes — but its safety still assumes bounded clock drift and bounded pauses: the GC-pause race from the first view defeats it identically (the Kleppmann–antirez debate, 2016)'],
    ]),
    highlight: { compare: ['etcd:guarantee', 'redlock:guarantee'] },
    explanation: 'The recipes differ less than their marketing suggests. ZooKeeper\'s sequential-znode pattern is the classic, and its watch-the-predecessor trick is genuinely elegant — releases wake exactly one waiter, in arrival order, instead of stampeding the herd. etcd\'s lease objects expose revision numbers that work directly as fencing tokens, which makes it the recipe most likely to be used CORRECTLY. Redis\'s single-node lock is honest about being best-effort. Redlock is the cautionary tale: acquiring a majority of independent nodes defends against Redis crashes, but the client-side hazard — a pause after acquisition — is untouched by how many nodes granted the lease. No quorum of grantors can keep YOUR process from freezing. The first view\'s race defeats all four recipes equally unless the resource itself checks tokens.',
    invariant: 'Recipes vary in availability and fairness; against a paused holder they are identical — the defense was never in the lock service.',
  };

  yield {
    state: table('The question that decides everything: what does a violation cost?', [
      ['eff', 'EFFICIENCY lock'],
      ['effex', 'examples'],
      ['corr', 'CORRECTNESS lock'],
      ['correx', 'examples'],
    ], [['detail', '']], [
      ['exclusion saves money, not data: if two holders sneak through, you compute something twice and shrug'],
      ['cron deduplication, cache warming, one-at-a-time report generation, expensive jobs nobody wants doubled — single Redis SET NX is perfectly fine here, and operationally the cheapest'],
      ['exclusion protects an invariant: two holders means corrupted data, double-charged customers, split-brain state'],
      ['ledger updates, schema migrations, the leader in a storage system — here a lock ALONE is never sufficient: pair it with fencing at the resource, or redesign so the operation tolerates duplicates'],
    ]),
    highlight: { compare: ['eff:detail', 'corr:detail'] },
    explanation: 'Kleppmann\'s distinction, and the most practical sentence on this page: decide whether your lock is for EFFICIENCY or CORRECTNESS, because the engineering follows the answer. An efficiency lock guards against waste — a duplicated batch job, a doubly-warmed cache — and the worst case of a rare double-hold is a few wasted dollars, so the simplest lease wins. A correctness lock guards an invariant, and the first view proved that no lock service, however well built, can carry that burden alone across paused processes: the resource must verify tokens, or the operation must be safe to repeat. Most production outrage at "broken" distributed locks traces to an efficiency-grade lock quietly promoted into a correctness role.',
    invariant: 'Efficiency violation costs money — buy the cheap lock. Correctness violation costs data — the lock alone can never be the whole defense.',
  };

  yield {
    state: table('The strongest move: design the lock away', [
      ['cas', 'conditional writes'],
      ['queue', 'a queue with one consumer'],
      ['idem', 'idempotent operations'],
      ['crdt', 'mergeable state'],
    ], [['how', '']], [
      ['compare-and-swap at the store (S3 If-Match, GCS generations, DynamoDB condition expressions): every writer may try, the data accepts exactly one — optimistic concurrency needs no lease at all'],
      ['route all writes for a key through one Message Queues partition: Kafka\'s consumer-per-partition rule IS mutual exclusion, with ordering and replay thrown in'],
      ['if running twice is harmless (Idempotency & Exactly-Once Delivery), the double-holder window stops being a failure mode — the race still happens and no longer matters'],
      ['if concurrent updates can MERGE (CRDTs: Conflict-Free Replicated Data Types), exclusion was never required — let both writers write'],
    ]),
    highlight: { active: ['cas:how', 'idem:how'] },
    explanation: 'The senior answer to "which distributed lock should we use?" is usually "let\'s see if we can not". Each alternative removes the failure mode instead of narrowing it: conditional writes make the STORE the arbiter, so a stale writer\'s attempt fails atomically rather than corrupting anything; a single-consumer queue serializes without any client ever holding a revocable grant; idempotency makes the double-hold window harmless rather than rare; CRDTs dissolve the premise that only one writer may proceed. Locks remain right for long-lived exclusive roles — being THE leader, running THE migration — where the role itself is the point. For a three-second critical section around one write, a conditional write is the same safety with none of the moving parts.',
    invariant: 'A lock narrows the race window; conditional writes, idempotency, and merges remove it — prefer designs where the window cannot exist.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'why your lock is a lease') yield* lease();
  else if (view === 'recipes & when not to lock') yield* recipes();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The first view builds the canonical lease-expiry race with exact arithmetic. Client A acquires a lock with TTL 10 seconds, pauses at t=2 for a 15-second GC stop-the-world, and wakes at t=17 believing it still holds exclusive access. Meanwhile the lock service expired the lease at t=10 and legally granted it to client B. From t=10 to t=17, two clients each hold written proof of ownership. Neither client is buggy. The overlap window is computed directly from the timeline: wake time minus expiry time equals 7 seconds of double-holding with zero faulty components.',
        {
          type: 'callout',
          text: 'A distributed lock is useful only after you decide whether overlap wastes money or corrupts data.',
        },
        'The second view compares four lock recipes (ZooKeeper, etcd, Redis, Redlock) side by side with their actual guarantees, then poses the question that decides engineering: is this an efficiency lock or a correctness lock? The final table shows four designs that remove the lock entirely. Pay close attention to the fencing token throughout both views. A downstream resource that does not check fencing tokens has no defense against a stale holder waking up and overwriting newer work. The token is the only mechanism that converts the timing problem into an ordering problem, and its presence or absence determines whether the lock provides real safety or just a probabilistic window-narrowing.',
        {type: 'image', src: './assets/gifs/distributed-locks.gif', alt: 'Animated walkthrough of the distributed locks visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An in-process mutex works because the operating system kernel is omniscient over its threads. When a thread crashes or exits while holding a mutex, the kernel detects the death instantly and releases the lock. The kernel can do this because it controls scheduling, memory, and process lifecycle for every thread on the machine. There is a single authority that both grants locks and detects holder failures, so cleanup is immediate and reliable.',
        'Across machines, no such authority exists. The lock service sits on a different machine from the holder. Its only signal about the holder\'s health is periodic heartbeats or keep-alive messages over the network. The absence of heartbeats is fundamentally ambiguous: a crashed process, a slow network, a stop-the-world garbage collection pause, a live VM migration, and a busy CPU all produce the same observable silence. The lock service cannot distinguish "dead and never coming back" from "alive but temporarily unreachable."',
        'This ambiguity forces a choice. If the service waits forever for a silent holder, a single crashed client blocks the entire system permanently. If the service reclaims a silent lock after a timeout, a slow-but-living client can lose a lock it believes it still holds. Every practical design chooses the timeout. That timeout is a lease: a grant of exclusive access that expires unless actively renewed. Every distributed lock is a lease. The word "lock" is borrowed from the OS world, and it smuggles in the promise of permanent-until-released exclusion that no network service can deliver.',
        'The need is genuine. Singleton jobs, leader election, schema migrations, and cache-fill deduplication all require some form of mutual exclusion across machines. The danger is the gap between what "lock" promises and what a lease delivers. That gap is where production incidents live.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is a shared key with an expiry. In Redis the command is SET resource_lock $owner NX PX 30000. NX means "set only if the key does not exist" (atomic create-if-absent). PX 30000 attaches a 30-second TTL in milliseconds. If the key is absent, the caller wins and becomes the owner. It does its work, then deletes the key to release. If the key already exists, the caller knows someone else holds it and backs off.',
        'The mental model is clean: key present means locked, key absent means free, TTL means a dead holder cannot block the world forever. This works well enough for single-node Redis protecting an efficiency concern. A nightly backup cron runs on two machines; both try SET NX; one wins, one skips. If the winner crashes mid-backup, the key expires in 30 seconds and the next cron cycle picks up the work. A rare duplicate run costs only wasted compute.',
        'Teams reach for this pattern because it is five lines of code, operationally cheap, and the failure mode is tolerable. For efficiency-only use cases, the obvious approach is the right approach. The problems begin when the same five lines are copied into a path that guards data integrity.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Three forces break the simple lease model when correctness matters. The first is network partitions. The holder loses contact with the lock service but keeps running on its own machine. The service sees silence, expires the lease after the TTL, and grants it to another client. The original holder has no way to discover this until its next successful network round-trip, which could be seconds or minutes away. During that entire gap, two clients believe they hold the lock.',
        'The second force is process pauses. A stop-the-world GC pause, a live VM migration, a thrashing swap, or a page-fault storm freezes the holder mid-instruction. Everything inside the process stops: the application thread, the lease-renewal goroutine, the timer that would check expiry. A 15-second GC pause on a 10-second lease creates 5 seconds of overlap with zero faulty components. The process did not crash. The network did not fail. The lock service behaved correctly. Yet two clients operated inside the critical section simultaneously.',
        {
          type: 'image',
          src: 'https://martin.kleppmann.com/2016/02/unsafe-lock.png',
          alt: 'Distributed lock lease expiry timeline showing a paused client writing stale data after another client acquires the lock',
          caption: 'A paused holder can resume after lease expiry and overwrite newer work. Source: Martin Kleppmann, https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html.',
        },
        'The third force is clock skew. If the holder\'s clock runs 2% slower than the lock service\'s clock, the holder believes it has 3 seconds of lease remaining while the service has already expired it and granted it to someone else. NTP keeps clocks within tens of milliseconds most of the time, but spikes, VM suspend/resume, and leap-second smearing can produce larger jumps.',
        'Every instinctive fix shares one flaw: it runs inside the process that might pause. "Check the lease before writing" moves the race into the gap between the check and the write. "Renew with a background thread" freezes the thread along with everything else. "Shrink the TTL" makes the overlap window shorter but never zero. No client-side cleverness closes the seam, because the pause chooses where to land after the code is written. The defense must live outside the client.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A process cannot verify its own timeliness. It cannot prove, from inside itself, that its lease has not expired, because the very mechanism that would perform the proof (a timer, a clock check, a network call) is subject to the same pauses and delays that caused the problem. Client-side exclusion is fundamentally a race condition that no amount of local checking can eliminate.',
        'The core insight is that safety must be enforced where the data lives, not where the lock lives. If the protected resource (a database, an object store, a ledger) rejects stale writes on its own, the lock can expire, the client can pause, and the worst outcome is a failed write rather than corrupted data. The mechanism that enables this is a fencing token: a monotonically increasing integer assigned by the lock service with each new grant.',
        'Fencing converts a timing problem into an ordering problem. The lock service assigns token 33 to client A, then (after A\'s lease expires) token 34 to client B. Client A wakes from its pause and tries to write with token 33. The resource has already accepted token 34 from B, so it rejects any write carrying a token less than 34. The stale write fails at the data, which is the only place where failure is safe. The lock becomes advisory for scheduling and mandatory only at the resource.',
        'This insight is Martin Kleppmann\'s central contribution in the 2016 distributed-locking analysis. It reframes the entire engineering question: the lock service\'s job is to assign ordering (tokens), not to guarantee exclusion (timing). Exclusion is a property of the resource\'s acceptance policy, not of the lock\'s grant policy.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A lease record contains a key (identifying the protected resource), an owner ID (so only the holder can renew or release), a lease ID or revision (which becomes the fencing token), an expiry timestamp, and the TTL duration. Acquire is an atomic create-if-absent or compare-and-swap on the key. Renew extends the expiry only if the caller\'s owner ID matches the current record. Release deletes the record only if the owner ID matches. These operations must be atomic to prevent two clients from both believing they won.',
        'ZooKeeper implements locks with ephemeral sequential znodes. Each client creates a child node under /lock/ with a sequential suffix: /lock/lock-0000000012. The client with the lowest sequence number holds the lock. Each waiter watches only its immediate predecessor in the sequence, so when a holder releases (or its session dies), exactly one waiter is notified. This avoids the thundering-herd problem where N waiters all race simultaneously. Session expiry, backed by the ZAB consensus protocol, handles dead holders automatically. Google\'s Chubby lock service (Burrows, 2006) pioneered this internal design; ZooKeeper is its open-source descendant.',
        'etcd uses Raft-backed leases. A client creates a lease object with a TTL (e.g., 15 seconds), attaches a key-value pair to that lease, and sends periodic keep-alive RPCs to renew it. The lease\'s revision number increments on every new grant and serves directly as a fencing token without any additional machinery. If keep-alives stop, etcd revokes the lease and deletes all attached keys. The revision-as-token design makes etcd the most complete recipe for correctness locks, provided the downstream resource actually checks the token.',
        'Redis offers SET key value NX PX 30000 on a single node. This is fast and operationally simple but provides no consensus: if the Redis instance restarts, the lock vanishes, and asynchronous replication to a replica means a failover can resurrect a lock already granted to someone else. Redlock (Sanfilippo, 2015) attempts to fix this by requiring the client to acquire a majority of 5 independent Redis nodes within a clock-drift budget. The client must succeed on at least 3 of 5 nodes, and the total acquisition time must be less than the lock validity time minus a drift allowance. If the quorum attempt fails, the client releases all nodes and retries after a random backoff to avoid livelock.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The lock service\'s own correctness is straightforward. A consensus-backed compare-and-swap guarantees that at most one client owns a given key at any instant on the server. ZAB, Raft, and Paxos each provide linearizable writes to the lock state, so the grant decision is safe even if lock-service nodes crash and recover. The consensus protocol ensures the lock service itself does not produce contradictory grants.',
        'But the server-side guarantee is only half the story. Pauses break the "at most one holder" invariant as seen from clients, so the real safety argument depends on fencing. The useful invariant is not "only one client believes it holds the lock" but rather "the protected resource accepts side effects only from the newest valid owner." Fencing tokens achieve this by converting the lock\'s time-based grant into a monotonic ordering that the resource can verify independently of any clock.',
        'The resource stores the highest token it has accepted. Every incoming write must carry its token. The resource performs an atomic compare-and-write: if the incoming token is greater than or equal to the stored maximum, accept the write and update the stored maximum; otherwise reject. This single comparison at the data layer makes pause duration irrelevant. A client that paused for 5 seconds or 5 minutes fails identically: its token is stale, and the write is rejected.',
        'The atomic compare-and-write at the resource is non-negotiable. If the client first asks "is my token still valid?" and then separately issues the write, a pause can land between the check and the write, reproducing the exact race that fencing was supposed to fix. The resource must compare and write in one step: a conditional PUT with an If-Match header, a database UPDATE with a WHERE token >= $my_token clause, or a compare-and-swap primitive.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lock acquisition is computationally cheap. A single SET in Redis takes microseconds. A znode creation in ZooKeeper or a lease grant in etcd takes low single-digit milliseconds of network round-trip time. The computational cost of the lock itself is negligible compared to the work the lock protects.',
        'The operational cost is not negligible. ZooKeeper requires a 3- or 5-node ensemble running ZAB consensus, with monitoring, JVM tuning, and disk latency awareness (ZAB writes to a transaction log on every proposal). etcd requires a 3- or 5-node Raft cluster with similar operational overhead. Redis in single-node mode is cheapest to operate but weakest on correctness. Redlock demands 5 independent Redis instances, each separately maintained, with clock synchronization tight enough that drift stays within the safety margin. Running any of these in production means capacity planning, failover runbooks, and on-call for the lock service itself.',
        'The hidden cost is architectural. Every correctness-critical lock needs a fencing token checked at the resource layer. The downstream store must support conditional writes, version comparisons, or token checks. If it does not, the lock provides only an efficiency guarantee regardless of how robust the lock service is. Retrofitting fencing into a store that was not designed for it can require schema migrations (adding a token column), API changes (accepting and checking the token on every write), and cross-team coordination. Many teams discover this cost only after the first pause-induced corruption incident.',
        'Lease TTLs create a fundamental tension. Short TTLs (5-10 seconds) recover quickly from crashes but expire more easily during legitimate GC pauses or network blips, causing spurious lock losses. Long TTLs (30-60 seconds) tolerate more jitter but leave the system blocked longer after a real crash. Most production systems settle on 10-30 second TTLs with renewal at one-third of the TTL interval, accepting the tradeoff as unavoidable.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Efficiency locks are the sweet spot. Cron-job deduplication: two machines try SET NX before running a nightly backup; the loser skips; a rare duplicate costs only extra storage. Cache warming: one machine acquires the lock to precompute an expensive result while others wait or serve stale data. Batch-report generation: a lock prevents two workers from running the same 20-minute aggregation query. For all of these, single-node Redis SET NX PX is sufficient. The worst case is a wasted compute run, not corrupted data.',
        'Correctness locks guard stronger invariants but demand more infrastructure. The exclusive leader in a database replication system holds an etcd lease to prevent split-brain; the lease revision doubles as the fencing epoch, so the storage layer can reject stale-leader writes. Schema migrations lock to prevent concurrent DDL from corrupting table structure. Distributed transaction coordinators use locks to serialize writes to the same key. ZooKeeper\'s sequential-ephemeral-znode pattern is the canonical recipe for high-availability leader election, giving FIFO fairness, one wakeup per release, and automatic cleanup when a session dies.',
        'The decision that shapes the entire design: if a double-holder wastes money, the simplest lease is enough. If a double-holder corrupts data, the lock alone is never sufficient. Pair it with fencing at the resource, or redesign the operation so it tolerates duplicates. Most production outrage at "broken" distributed locks traces to an efficiency-grade lock quietly promoted into a correctness role without adding fencing.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Martin Kleppmann\'s 2016 analysis showed that Redlock\'s safety depends on two assumptions it cannot enforce: bounded clock drift across all 5 Redis nodes, and bounded process pauses on the client. A GC pause after quorum acquisition defeats Redlock identically to how it defeats a single-node lock. Salvatore Sanfilippo (antirez) responded that Redlock is safe if clocks do not jump and processes do not pause longer than the TTL. Kleppmann\'s counter: those are exactly the assumptions that distributed systems exist to survive. The debate settled a lasting principle: Redlock improves availability (surviving Redis node crashes) but does not improve safety (surviving client pauses or clock jumps) over a single-node lock with fencing.',
        'Long critical sections are a recurring failure mode. A lock with a 30-second TTL held during a 45-second API call expires mid-operation. The holder believes it still owns the lock; the service has already granted it to someone else. The fix is not a longer TTL (which delays crash recovery for every future failure) but a shorter critical section, or a design that removes the lock entirely.',
        'Late releases corrupt other clients\' locks. If client A acquires, its lease expires, client B acquires, and then A\'s finally-block runs DEL on the key, A deletes B\'s lock. Now the resource is unprotected. Every release must be conditional: delete the key only if the stored owner ID matches yours. In Redis this requires a Lua script (GET + compare + DEL atomically) because the three operations are not natively atomic.',
        'The deepest failure is cultural. Teams treat a distributed lock as a networked mutex, expecting the same absolute exclusion the OS kernel provides. No lock service has that power across machines. When teams deploy a lock expecting mutex semantics and skip fencing, the first multi-second GC pause or network partition produces data corruption that looks like a lock-service bug but is actually an architectural gap. The lock worked exactly as designed; the architecture around it did not.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A data pipeline has 8 workers that compact S3 partitions hourly. The naive design: acquire a Redis lock on the partition key (SET partition-2024-06-15 workerA NX PX 15000), compact the partition locally, upload the result to S3, release the lock. The failure: worker A acquires with TTL 15 seconds, begins compacting, and hits a 20-second GC pause at t=3. At t=15 the lock expires. Worker B acquires at t=15, compacts the same partition with fresh data, and uploads at t=25. Worker A wakes at t=23, uploads its stale compaction result at t=28, overwriting B\'s correct output. The manifest now points to a file built from data that was current 25 seconds ago.',
        'The safe design layers a fencing token. Each lock grant carries a monotonically increasing generation number (e.g., etcd lease revision 1047 for A, revision 1048 for B). The compacted file is uploaded with a conditional PUT: S3\'s If-Match on the partition\'s current ETag, or a DynamoDB condition expression checking that the stored generation is still 1047. Worker A wakes and tries to upload with generation 1047, but the manifest already records generation 1048 from B\'s successful upload. The conditional PUT fails. The pipeline logs the stale attempt, discards the wasted work, and moves on. Efficiency cost: one redundant compaction (about 90 seconds of CPU). Correctness cost: zero.',
        'A database leader lease is more dangerous because writes are continuous, not one-shot. The old leader pauses, loses its lease, and the new leader begins accepting writes from clients. When the old leader wakes, it still holds open connections to storage and may issue writes from its in-memory state. If the storage layer accepts any writer that can authenticate, those stale writes corrupt replicated state. The fix: the storage layer carries a current-epoch register. Every write includes the leader\'s epoch (etcd lease revision or ZooKeeper zxid). The storage layer atomically rejects any write with an epoch below the current maximum. The old leader\'s first post-wake write fails, it discovers it is no longer leader, and it fences itself off.',
        'Concrete numbers for the leader case: etcd lease TTL 10 seconds, keep-alive interval 3.3 seconds. The old leader\'s last successful keep-alive was at t=6. A 12-second GC pause begins at t=7. The lease expires at t=10. The new leader is elected at t=10.5 with revision 1049. The old leader wakes at t=19 and issues a write with revision 1048. Storage rejects it. The gap between t=10 and t=19 saw 9 seconds of potential dual-leadership, but zero corruption because the resource enforced ordering.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The primary source is Martin Kleppmann, "How to do distributed locking" (2016), which presents the fencing-token argument and the GC-pause race with careful diagrams. The Antirez response, "Is Redlock safe?" (2016), gives the bounded-clock defense. Together they form the clearest public debate on what distributed locks can and cannot promise. For implementation details: the ZooKeeper Recipes documentation covers the sequential-ephemeral-znode pattern, the etcd concurrency package documents lease-backed locking with revisions as fencing tokens, and the Redis SET documentation specifies the NX/PX flags. Google\'s Chubby paper (Burrows, 2006) introduced the design that ZooKeeper later made open-source.',
        'Prerequisite: study Raft Leader Election to understand how consensus-backed leases work internally, including heartbeat intervals, election timeouts, and log replication. That is the engine inside etcd and the foundation for understanding why the lock service itself is fault-tolerant even when the client is not. Study next: Fencing Token Zombie Writer expands the lease-expiry hazard into a complete side-effect protocol with monotonic tokens and resource-side rejection. Idempotency & Exactly-Once Delivery shows how to dissolve the double-hold window entirely: if the operation is safe to run twice, the lock is needed only for efficiency, not correctness.',
        'Alternative paths: CRDTs (Conflict-Free Replicated Data Types) demonstrate scenarios where concurrent writes merge correctly without any lock at all, removing the need for exclusion. Message Queues show how a single consumer per partition provides implicit mutual exclusion without an explicit lock service. Both approaches reframe the problem so the double-holder window cannot exist rather than trying to narrow it.',
      ],
    },
  ],
};
