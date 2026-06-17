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
    explanation: `The famous failure (Kleppmann's how-to-do-distributed-locking analysis), with the numbers laid bare: every participant behaved correctly. The service MUST reclaim silent leases — that's the liveness it exists to provide. B acquired legally. And A is not buggy: a stop-the-world GC pause suspends the process BETWEEN instructions, so A cannot even observe that time passed until after it has already resumed doing damage. For ${OVERLAP} seconds, two clients each hold written proof of exclusive access. Pauses of this size are not hypothetical: multi-second GC pauses, live VM migrations, and even laptop lid closes appear in every ops team's incident history.`,
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
      heading: `What it is`,
      paragraphs: [
        `A distributed lock is a mechanism to guarantee mutual exclusion across multiple machines with no kernel to enforce it. The promise sounds simple: only one process may enter the critical section at a time. But every distributed lock is secretly a lease — a time-bounded grant that expires if the holder goes silent. That expiry is not a bug; it is the essential protection against crashed processes locking the system forever. The trade-off is structural: without an omniscient authority watching across network boundaries, the lock service must bet on timeouts, and timeouts create a seam where a paused but running process can lose exclusive access without ever detecting it.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The visualization computes the canonical race from first principles: TTL 10 seconds, holder A acquires at t=0, the system pauses at t=2 for 15 seconds, and A wakes at t=17 to find that the lease expired at t=10 and B legally acquired it at t=10. For seven seconds (t=10 to t=17), two processes each hold written proof of exclusive access. Neither is faulty; the service behaved correctly by reclaiming a silent lease. The pause is not hypothetical — a stop-the-world garbage collection, a live VM migration, a page-fault storm, or even a laptop lid closing can freeze a process mid-instruction. A process cannot check whether it still holds a lease between the check and the write, because the check-then-act seam is exactly where the pause can land. Renewal threads fail identically: they pause with the process they are meant to protect. The only fixes that work move the check INTO the resource: fencing tokens verified at the storage layer (see "View Changes: Replacing a Failed Leader"), conditional writes that atomically fail if a token is stale, or "Idempotency & Exactly-Once Delivery" so a double-hold is harmless rather than catastrophic.`,
      ],
    },
    {
      heading: `Visualization guide`,
      paragraphs: [
        `Read the lock as a lease with failure cases, not as a mutex stretched over the network. The holder can pause, the network can partition, the clock can drift, and the lock service can expire the lease while the old process is still running.`,
        `The animation's most important object is the fencing token. A downstream resource must reject stale tokens, otherwise an old lock holder can wake up and overwrite work after a newer holder has taken over. Without fencing, a distributed lock is often only a delay.`,
      ],
    },
    {
      heading: `The obvious approach and the wall`,
      paragraphs: [
        `The first attempt is usually a shared key with an expiry. A client writes the key if it is absent, does the work, and deletes the key when finished. The expiry is there so a crashed client does not keep the system blocked forever. That design is attractive because it has one obvious operation, one obvious cleanup rule, and a simple mental model: the key exists, so the lock is held.`,
        `The wall is that silence is not evidence. A client that stops sending heartbeats may be dead, partitioned, overloaded, frozen by garbage collection, or paused by the host. The lock service cannot tell these cases apart. If it keeps waiting, availability suffers. If it expires the lock, safety can suffer unless the protected resource has another defense. The timeout keeps the system moving, but it also means a running process can become a stale holder.`,
      ],
    },
    {
      heading: `Core invariant`,
      paragraphs: [
        `The useful invariant is not that only one client believes it holds the lock. That is exactly what pauses and partitions can break. The useful invariant is that the protected resource accepts side effects only from the newest valid owner. The lock service can nominate an owner; the resource must still reject stale writes.`,
        `Fencing tokens implement that invariant. Every successful acquisition receives a monotonically increasing token. The client sends the token with every protected operation. The resource stores the largest token it has accepted and rejects smaller tokens atomically with the write. A paused client may wake and try to write, but its token is old, so the write fails where it matters.`,
      ],
    },
    {
      heading: `Mechanism`,
      paragraphs: [
        `A lease-based lock record usually contains a key, owner id, lease id, expiry time, and sometimes a revision or token. Acquire is an atomic create or compare-and-swap. Renew extends the expiry only if the caller still owns the same lease. Release deletes the record only if the caller still owns it. Waiters poll, watch a predecessor, or subscribe to changes depending on the backing service.`,
        `A consensus-backed service replicates those ownership decisions through a log. That improves the lock service's own fault tolerance, but it does not make client pauses disappear. The client can still stop after it receives the grant. This is why ZooKeeper, etcd, Redis, and Redlock all need the same extra question for correctness work: what prevents an old holder from writing after a newer holder exists?`,
      ],
    },
    {
      heading: `Why fencing works`,
      paragraphs: [
        `Fencing turns a timing problem into an ordering problem. Time can be confusing in a distributed system: clocks drift, messages arrive late, and processes pause between instructions. A token assigned by the lock service gives the protected resource a simple order of authority. Token 52 is newer than token 51. A write from token 51 must not overwrite a write from token 52.`,
        `The check has to happen inside the resource operation. If a client asks "is my token still valid?" and then separately writes, the client can pause between the answer and the write. If the resource compares and writes in one atomic step, the stale holder has no gap to exploit. This is the same idea as conditional writes, compare-and-swap, object generation checks, and database transactions.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Distributed locks are computationally cheap: a single SET command in Redis or a znode creation in ZooKeeper is nanosecond-scale. The hidden cost is operational: the lock service itself must be available and strongly-consistent (or at least consensus-backed like "Raft Leader Election"). ZooKeeper uses Apache ZAB consensus; etcd uses Raft; Redis trades perfect availability for eventual consistency and hopes the cost of a rare split-brain is tolerable. The complexity of using them correctly is not in the service but in the client: the need to defend correctness-critical operations with not just a lease but also a fencing token at the store, or to re-architect so the lock is not needed at all. An efficiency lock (deduplicating a batch job, warming a cache) is operationally safe with single-instance Redis — the worst case is a wasted compute run. A correctness lock (protecting a ledger mutation, a schema migration, the exclusive leader role) demands deeper thinking: the lock alone never suffices.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Efficiency locks are everywhere: cron jobs use a lock to prevent two machines from running a backup simultaneously (duplication costs only storage), cache-warming systems grab a lock to ensure one machine does the expensive precompute while others wait, expensive but idempotent batch reports lock to avoid redundant computation. For these, a single Redis SET with NX (set only if not present) and PX (expire in milliseconds) is standard. Correctness locks guard the crown jewels: the exclusive leader in a database replication system uses a lease to maintain split-brain guarantees (paired with "View Changes: Replacing a Failed Leader" awareness), schema migrations lock to prevent concurrent DDL, and distributed transactions use locks to serialize writes to the same key. ZooKeeper's sequential ephemeral znode pattern — where the lowest-numbered waiter holds the lock and each waiter watches only its predecessor — is the canonical high-availability recipe: it delivers fairness (FIFO order), zero thundering herd (one wakeup per release), and leader watches that auto-cleanup when the leader's session dies. etcd's lease-backed locking exposes revision numbers as fencing tokens, making it the most complete recipe when the underlying resource checks those tokens.`,
      ],
    },
    {
      heading: `Efficiency versus correctness`,
      paragraphs: [
        `An efficiency lock prevents waste. Two workers warming the same cache, generating the same report, or running the same cleanup job are annoying but usually not corrupting. In that class, a simple Redis lease can be the most pragmatic answer. The rare duplicate costs money or time, not data integrity.`,
        `A correctness lock protects an invariant. Two holders can double-charge a customer, corrupt a migration, publish two incompatible versions, or let a stale leader overwrite newer state. In that class, the lock alone is not enough. The design needs fencing, conditional writes, idempotency, a single-writer log, or a queue that serializes the relevant key.`,
      ],
    },
    {
      heading: `Designing the lock away`,
      paragraphs: [
        `Many lock requests should become conditional writes. Instead of acquiring a lease before updating an object, write with an expected version, ETag, generation number, or database predicate. Every client may try; the store accepts exactly one. That removes the stale-holder write because the store is the authority from the start.`,
        `Queues are another way out. If all operations for a key go through one partition and one consumer, the partition order provides mutual exclusion without a separate lock service. Idempotency keys make retries harmless. Mergeable state, such as CRDT-style counters or sets, can remove the need for mutual exclusion when concurrent updates have a well-defined merge rule.`,
      ],
    },
    {
      heading: `Implementation guidance`,
      paragraphs: [
        `Write down the failure consequence before choosing the lock. If a double-holder wastes compute, document that it is an efficiency lock. If a double-holder corrupts data, require a resource-side guard before shipping. Use unique owner ids and lease ids so a late release cannot delete someone else's lock. Treat any failed renew as loss of ownership.`,
        `Keep critical sections short and bounded. Do not hold a lease while waiting for a user, calling an unreliable external API, scanning a huge dataset, or doing an unbounded retry loop. Emit metrics for acquisition latency, renewal failures, expiries, holder duration, wait time, duplicate work, and stale-token rejection. Those numbers tell you whether the lock is a coordination aid or a hidden outage source.`,
      ],
    },
    {
      heading: `Complete case study`,
      paragraphs: [
        `A data pipeline has several workers that may compact the same partition. The safe design is not just "lock the partition." Give each compaction attempt an output generation. Publish the compacted file with a conditional write that only succeeds if the partition still points to the expected prior generation. The lock reduces duplicate compaction; the conditional publish protects the manifest.`,
        `A database leader is more dangerous. The old leader may pause, lose its lease, and later issue storage writes. The storage layer must reject stale epochs, or writes must flow through a consensus log that orders them. If the storage layer accepts any writer that can connect, the leader lease is only a hint and stale writes remain possible.`,
      ],
    },
    {
      heading: `Where it wins and fails`,
      paragraphs: [
        `Distributed locks win for singleton jobs, operational coordination, short exclusive roles, migration gates, leader nomination, and cache-fill deduplication. They are easiest to reason about when the protected work is short, retries are explicit, and the downstream resource has its own version or token checks.`,
        `They fail when treated as a networked mutex. They fail when long critical sections outlive realistic TTLs. They fail when release is not conditional on ownership. They fail when the protected resource cannot tell a fresh holder from a stale one. The symptom may look like a broken lock service, but the deeper issue is usually an unprotected side effect.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first misconception is that a "distributed mutex" (the fancy name) is the same as an in-process mutex. It is not. An OS mutex releases instantly when its holder crashes because the kernel watches every thread; a distributed lock can only reclaim silence, not certainty. The second is that cleverness can close the pause window: checking the lease before writing, or renewing in a background thread. Both fail because the check and the write are two steps and the pause chooses where to land, and the renewal thread freezes with the process it protects. The third is that a quorum (Redlock acquiring 5 Redis nodes) solves the problem. Redlock defends against Redis crashes but not against the client pausing after it acquired a quorum — the canonical race from the visualization defeats Redlock identically. The most dangerous misconception is treating a lock as sufficient for correctness without checking fencing tokens at the resource. Two processes do not "both believe they have the lock" as a theoretical problem — they write competing changes to the same data and produce corruption.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Fencing Token Zombie Writer expands the lock-service warning into a concrete side-effect protocol: a monotonically increasing token on every grant, and a protected resource that rejects stale epochs from paused holders.`,
        `Begin with "View Changes: Replacing a Failed Leader" to understand how fencing tokens prevent stale leaders from corrupting data — that pattern is the finishing move after a lock. Study "Idempotency & Exactly-Once Delivery" to see how idempotent operations dissolve the double-hold window: if running the same operation twice is harmless, a lock is no longer required for safety, only for efficiency. Learn "Raft Leader Election" to see how consensus-backed leases (with heartbeats and election timeouts) work in practice; ZooKeeper and etcd use similar patterns. Explore "CRDTs: Conflict-Free Replicated Data Types" to see scenarios where concurrent writes merge correctly without any lock at all — the strongest move is designing the lock away entirely. Finally, "Message Queues" show how a queue with a single consumer per partition provides implicit mutual exclusion without any explicit lock service.`,
      ],
    },
  ],
};
