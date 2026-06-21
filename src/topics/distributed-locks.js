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
        'The first view computes the canonical lease-expiry race with real arithmetic. A acquires a lease with TTL 10 seconds, pauses at t=2 for 15 seconds, and wakes at t=17 believing it still holds exclusive access. The lock service expired the lease at t=10 and granted it to B. From t=10 to t=17, two clients each hold written proof of ownership. Neither is buggy. Watch for the overlap highlight: that is the window where corruption happens, computed from the timeline, not from any component fault.',
        {
          type: 'callout',
          text: 'A distributed lock is useful only after you decide whether overlap wastes money or corrupts data.',
        },
        'The second view compares recipes (ZooKeeper, etcd, Redis, Redlock) and then asks the question that decides engineering: is this an efficiency lock or a correctness lock? The final table shows designs that remove the lock entirely. The most important object across both views is the fencing token. A downstream resource that does not check tokens has no defense against a stale holder waking up and overwriting newer work.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An in-process mutex works because the OS kernel watches every thread. When a holder crashes, the kernel releases the lock instantly and reliably. Across machines, there is no kernel. The lock service sees only heartbeats, and the absence of heartbeats is ambiguous: a crashed process, a slow network, a GC pause, and a busy CPU all look like silence. Without an omniscient authority, the service must reclaim silent locks on a timer or risk a dead client blocking the system forever. That timer is a lease. Every distributed lock is a lease; the word "lock" is marketing.',
        'The need is real: singleton jobs, leader election, schema migrations, and cache-fill deduplication all require some form of mutual exclusion across machines. The danger is that the word "lock" smuggles in the promise of an OS mutex, which no network service can deliver. The gap between the promise and the reality is where production incidents live.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is a shared key with an expiry. In Redis: SET resource_lock $owner NX PX 30000. If the key is absent, the caller wins. It does its work, then deletes the key. The PX 30000 sets a 30-second TTL so a crashed holder does not block everyone forever. The mental model is clean: key exists means lock is held, key absent means lock is free.',
        'This works well enough for single-node Redis protecting an efficiency concern, like deduplicating a cron job. One Redis instance, one SET command, one clear owner. Teams reach for it because it is five lines of code and the failure mode (a rare duplicate run) costs only wasted compute. For that use case, the obvious approach is the right approach.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Three forces break the simple lease model when correctness matters. First, network partitions: the holder loses contact with the lock service but keeps running. The service sees silence, expires the lease, and grants it to another client. The original holder has no way to learn this until its next network round-trip, which may be seconds or minutes away. Second, process pauses: a stop-the-world GC pause, a live VM migration, or a page-fault storm freezes the holder mid-instruction. The pause suspends everything, including the code that would check the lease, including the background renewal thread. A 15-second GC pause on a 10-second lease creates 5 seconds of overlap with zero faulty components. Third, clock skew: if the holder and the lock service disagree on how fast time passes, the holder may believe it has 3 seconds of lease remaining while the service has already expired it and granted it to someone else.',
        {
          type: 'image',
          src: 'https://martin.kleppmann.com/2016/02/unsafe-lock.png',
          alt: 'Distributed lock lease expiry timeline showing a paused client writing stale data after another client acquires the lock',
          caption: 'A paused holder can resume after lease expiry and overwrite newer work. Source: Martin Kleppmann, https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html.',
        },
        'The instinctive patches all share one flaw: they run inside the process that might pause. Checking the lease before writing just moves the race into the gap between check and write. The background renewal thread freezes along with the rest of the process. Shrinking the TTL makes the overlap window shorter but never zero. No client-side cleverness closes the seam because the pause chooses where to land after the code is written.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A lease record typically contains a key, an owner ID, a lease ID or revision, an expiry timestamp, and sometimes a monotonically increasing token. Acquire is an atomic create-if-absent or compare-and-swap. Renew extends the expiry only if the caller still owns the current lease. Release deletes the record only if the caller still owns it. Waiters poll, watch a predecessor node, or subscribe to key changes depending on the backing service.',
        'ZooKeeper uses ephemeral sequential znodes: each client creates /lock/lock-000000N, and the client with the lowest sequence number holds the lock. Each waiter watches only its predecessor, so a release wakes exactly one client in FIFO order with no thundering herd. Session expiry (backed by the ZAB consensus protocol) handles dead holders. Google\'s Chubby lock service (2006) pioneered this design internally; ZooKeeper is its open-source descendant.',
        'etcd uses Raft-backed leases. A client creates a lease with a TTL (e.g., 15 seconds), attaches a key to that lease, and renews with keep-alive RPCs. The lease\'s revision number increments on every grant and works directly as a fencing token. If the client stops renewing, etcd revokes the lease and deletes attached keys. The revision-as-token design makes etcd the most complete recipe when the downstream resource checks tokens.',
        'Redis offers SET key value NX PX 30000 on a single node. This is fast and operationally simple but provides no consensus: if the Redis node fails, the lock state is lost, and asynchronous replication means a failover can resurrect a lock that was already granted to someone else. Redlock (Salvatore Sanfilippo, 2015) tries to fix this by acquiring a majority of 5 independent Redis nodes within a clock-drift budget. The client must acquire at least 3 of 5 nodes, and the total acquisition time must be less than the lock validity time minus a drift allowance. If the quorum fails, the client releases all nodes and retries after a random backoff.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The lock service itself is straightforward: a consensus-backed compare-and-swap ensures that at most one client owns a given key at any instant on the server side. ZAB, Raft, and Paxos each guarantee linearizable writes to the lock state, so the grant decision is safe even if lock-service nodes crash.',
        'The deeper correctness argument is about fencing. The useful invariant is not "only one client believes it holds the lock" (pauses break that), but "the protected resource accepts side effects only from the newest valid owner." Fencing tokens convert a timing problem into an ordering problem. The lock service assigns monotonically increasing tokens. The client sends its token with every protected write. The resource stores the highest token it has accepted and atomically rejects any write carrying a smaller token. A paused client wakes with token 51, tries to write, and the resource has already accepted token 52 from the new holder. The write fails where it matters, at the data, not at the lock.',
        'The atomic compare-and-write at the resource is essential. If the client asks "is my token still valid?" and then separately writes, a pause can land between the check and the write. The resource must compare and write in one step: conditional PUT, compare-and-swap, or a database transaction with a WHERE clause on the token column.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lock acquisition is computationally cheap: a single SET in Redis takes microseconds; a znode creation in ZooKeeper or a lease grant in etcd takes low single-digit milliseconds over the network. The real costs are operational and architectural.',
        'The lock service must be available and consistent. ZooKeeper requires a 3- or 5-node ensemble running ZAB consensus. etcd requires a 3- or 5-node cluster running Raft. Redis in single-node mode is the cheapest to operate but the weakest on correctness. Redlock requires 5 independent Redis instances, each separately maintained, with careful clock synchronization. Running any of these in production means monitoring, failover runbooks, and capacity planning for the lock service itself.',
        'The hidden cost is in the client. Every correctness-critical lock needs a fencing token checked at the resource layer. That means the downstream store must support conditional writes, version checks, or token comparisons. If it does not, the lock provides only an efficiency guarantee regardless of how robust the lock service is. Adding fencing to an existing system that was not designed for it can require schema changes, API changes, and coordination across teams.',
        'Lease TTLs create a tension: short TTLs (5-10 seconds) recover quickly from crashes but are more likely to expire during legitimate GC pauses or network blips. Long TTLs (30-60 seconds) tolerate more jitter but leave the system blocked longer after a real crash. Most production systems use 10-30 second TTLs with renewal at one-third of the TTL interval.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Efficiency locks are the sweet spot. Cron-job deduplication: two machines check a Redis key before running a nightly backup; a rare duplicate costs only extra storage. Cache warming: one machine grabs a lock to precompute an expensive result while others wait or serve stale data. Batch-report generation: lock prevents two workers from running the same 20-minute aggregation. For all of these, single-node Redis SET NX PX is standard and sufficient. The worst case is a wasted compute run, not corrupted data.',
        'Correctness locks guard stronger invariants. The exclusive leader in a database replication system holds a lease to prevent split-brain (etcd\'s lease revision doubles as the fencing epoch). Schema migrations lock to prevent concurrent DDL from corrupting table structure. Distributed transactions use locks to serialize writes to the same key within a transaction coordinator. ZooKeeper\'s sequential-ephemeral-znode pattern is the canonical recipe for high-availability leader election: FIFO fairness, one wakeup per release, and automatic cleanup when a session dies.',
        'The distinction that decides engineering: if a double-holder wastes money, use the simplest lease available. If a double-holder corrupts data, the lock alone is never sufficient. Pair it with fencing at the resource, or redesign so the operation tolerates duplicates.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Martin Kleppmann\'s 2016 analysis ("How to do distributed locking") showed that Redlock\'s safety depends on two assumptions it cannot enforce: bounded clock drift across all 5 Redis nodes, and bounded process pauses on the client. A GC pause after quorum acquisition defeats Redlock identically to how it defeats a single-node lock. Antirez (Salvatore Sanfilippo) responded that Redlock is safe if clocks do not jump and processes do not pause for longer than the TTL. Kleppmann\'s counter: those are exactly the assumptions that distributed systems exist to survive. The debate clarified a lasting principle: Redlock improves availability (surviving Redis node crashes) but does not improve safety (surviving client pauses or clock jumps) over a single-node lock with fencing.',
        'Long critical sections are a recurring failure mode. A lock with a 30-second TTL held during a 45-second API call will expire mid-operation. The holder believes it still owns the lock; the service has already granted it to someone else. The fix is not a longer TTL (which delays crash recovery) but a shorter critical section, or a design that does not need a lock at all.',
        'Late releases corrupt other clients\' locks. If client A acquires, its lease expires, client B acquires, and then A\'s finally block runs DEL on the key, A deletes B\'s lock. Every release must be conditional: delete the key only if the value matches your owner ID. Redis requires a Lua script (GET + compare + DEL atomically) or the SET ... GET pattern to do this safely.',
        'The deepest failure is cultural: treating a distributed lock as a networked mutex. An OS mutex provides absolute exclusion because the kernel is omniscient over its threads. No lock service has that power across machines. When teams deploy a lock expecting mutex semantics and skip fencing, the first multi-second GC pause or network partition produces data corruption that looks like a lock-service bug but is actually an architectural gap.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A data pipeline has 8 workers that compact S3 partitions. The naive design: acquire a Redis lock on the partition key, compact, upload, release. The failure: worker A acquires, starts compacting, hits a 20-second GC pause. The lock expires at 15 seconds. Worker B acquires, compacts the same partition, uploads. A wakes, uploads its (now stale) compaction, overwriting B\'s result. The manifest now points to a file built from stale data.',
        'The safe design layers a fencing token on top of the lock. Each lock grant carries a monotonically increasing generation number. The compacted file is uploaded with a conditional PUT: If-Match on the partition\'s current generation. The lock prevents duplicate compaction work (efficiency). The conditional PUT prevents stale uploads (correctness). Worker A\'s upload fails because the generation has advanced, and the pipeline retries or skips, losing only the wasted compute.',
        'A database leader lease is more dangerous. The old leader pauses, loses its lease, and later issues storage writes. If the storage layer accepts any writer that can connect, stale writes corrupt replicated state. The fix: the storage layer rejects any write carrying an epoch older than the current leader\'s epoch. In etcd-based systems, the lease revision is the epoch. In ZooKeeper-based systems, the zxid (ZooKeeper transaction ID) of the leader\'s ephemeral node serves the same role.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Martin Kleppmann, "How to do distributed locking" (2016), which lays out the fencing-token argument and the GC-pause race. The Antirez response, "Is Redlock safe?" (2016), gives the bounded-clock defense. Together they form the clearest public debate on what distributed locks can and cannot promise. Implementation references: the ZooKeeper Recipes documentation for the sequential-ephemeral-znode pattern, the etcd concurrency package for lease-backed locking with revisions, and the Redis SET documentation for the NX/PX pattern. Production case study: Google\'s Chubby lock service (Burrows, 2006) introduced the design that ZooKeeper later made open-source.',
        'Prerequisite: study Raft Leader Election to understand how consensus-backed leases work internally, with heartbeats, election timeouts, and log replication. That is the engine inside etcd and the foundation for understanding why the lock service itself is fault-tolerant even when the client is not. Extension: Fencing Token Zombie Writer expands the lock-expiry hazard into a complete side-effect protocol with monotonic tokens and resource-side rejection. Idempotency & Exactly-Once Delivery shows how to dissolve the double-hold window entirely: if the operation is safe to run twice, the lock is needed only for efficiency, not correctness. Alternative path: CRDTs (Conflict-Free Replicated Data Types) show scenarios where concurrent writes merge correctly without any lock, and Message Queues show how a single consumer per partition provides implicit mutual exclusion without an explicit lock service.',
      ],
    },
  ],
};
