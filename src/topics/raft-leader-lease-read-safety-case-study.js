// Raft leader-lease reads: avoid a quorum round trip only when timing, election
// lease, commit index, and apply index prove the leader cannot be stale.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'raft-leader-lease-read-safety-case-study',
  title: 'Raft Leader Lease Read Safety',
  category: 'Systems',
  summary: 'How Raft systems trade ReadIndex quorum checks for leader leases with lease start, clock-drift bounds, commit index, apply index, and stale-leader hazards.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lease read', 'stale leader'], defaultValue: 'lease read' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function leaseGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.5, y: 4.2, note: notes.client ?? 'read' },
      { id: 'leader', label: 'leader', x: 2.1, y: 4.2, note: notes.leader ?? 'term 9' },
      { id: 'quorum', label: 'quorum', x: 3.7, y: 5.4, note: notes.quorum ?? 'acks' },
      { id: 'lease', label: 'lease', x: 3.7, y: 3.0, note: notes.lease ?? 'valid' },
      { id: 'commit', label: 'commit', x: 5.4, y: 5.4, note: notes.commit ?? 'index' },
      { id: 'apply', label: 'apply', x: 5.4, y: 3.0, note: notes.apply ?? 'state' },
      { id: 'clock', label: 'clock', x: 7.0, y: 3.0, note: notes.clock ?? 'drift' },
      { id: 'read', label: 'read', x: 8.4, y: 4.2, note: notes.read ?? 'serve' },
      { id: 'safe', label: 'safe', x: 9.6, y: 4.2, note: notes.safe ?? 'linear' },
    ],
    edges: [
      { id: 'e-client-leader', from: 'client', to: 'leader', weight: '' },
      { id: 'e-leader-quorum', from: 'leader', to: 'quorum', weight: '' },
      { id: 'e-quorum-lease', from: 'quorum', to: 'lease', weight: '' },
      { id: 'e-quorum-commit', from: 'quorum', to: 'commit', weight: '' },
      { id: 'e-lease-clock', from: 'lease', to: 'clock', weight: '' },
      { id: 'e-commit-apply', from: 'commit', to: 'apply', weight: '' },
      { id: 'e-apply-read', from: 'apply', to: 'read', weight: '' },
      { id: 'e-clock-read', from: 'clock', to: 'read', weight: '' },
      { id: 'e-read-safe', from: 'read', to: 'safe', weight: '' },
    ],
  }, { title });
}

function* leaseRead() {
  yield {
    state: leaseGraph('ReadIndex confirms leadership with a quorum before serving a read'),
    highlight: { active: ['client', 'leader', 'quorum', 'commit', 'apply', 'e-client-leader', 'e-leader-quorum'], compare: ['lease'] },
    explanation: 'A conservative Raft linearizable read asks the leader to prove it is still leader through the quorum path, then waits until the state machine has applied the relevant index.',
    invariant: 'A read is safe only after leadership and applied-state freshness are both established.',
  };

  yield {
    state: leaseGraph('A leader lease caches recent quorum authority', { lease: 'fresh', read: 'fast path' }),
    highlight: { active: ['quorum', 'lease', 'clock', 'read', 'e-quorum-lease', 'e-lease-clock', 'e-clock-read'], compare: ['commit'] },
    explanation: 'A lease read tries to avoid a quorum round trip for every read. The leader can serve locally only while the lease is known to be valid under the system clock assumptions.',
  };

  yield {
    state: labelMatrix(
      'Read paths',
      [
        { id: 'log', label: 'log read' },
        { id: 'readindex', label: 'ReadIndex' },
        { id: 'lease', label: 'lease' },
        { id: 'serial', label: 'stale ok' },
      ],
      [
        { id: 'cost' },
        { id: 'risk' },
      ],
      [
        ['append', 'slow'],
        ['quorum', 'RTT'],
        ['local', 'clock'],
        ['local', 'stale'],
      ],
    ),
    highlight: { active: ['readindex:cost', 'lease:cost'], compare: ['lease:risk', 'serial:risk'] },
    explanation: 'The read options trade latency for assumptions. Appending a read is safest but slowest. ReadIndex avoids log writes. Lease reads are fastest, but only under carefully bounded timing.',
  };

  yield {
    state: leaseGraph('The apply index still gates the local read', { commit: 'idx 120', apply: 'wait 120', read: 'serve 120' }),
    highlight: { active: ['commit', 'apply', 'read', 'e-commit-apply', 'e-apply-read'], found: ['lease'] },
    explanation: 'Even a valid leader cannot serve from state that has not applied the committed index the read depends on. The local state machine must catch up before returning.',
  };

  yield {
    state: leaseGraph('The complete fast path is leader lease plus apply wait', { client: 'GET key', lease: 'not expired', clock: 'bounded', apply: 'caught up', safe: 'linear' }),
    highlight: { active: ['client', 'leader', 'lease', 'clock', 'commit', 'apply', 'read', 'safe'], found: ['quorum'] },
    explanation: 'A control-plane read can use the lease fast path when the leader recently renewed authority, the local clock assumptions still hold, and the state machine has applied far enough.',
  };
}

function* staleLeader() {
  yield {
    state: leaseGraph('A partitioned old leader may still receive client reads', { leader: 'old term', quorum: 'lost', lease: 'expired?', safe: 'unsafe' }),
    highlight: { active: ['client', 'leader', 'lease'], removed: ['quorum', 'safe'] },
    explanation: 'The stale-leader problem is the reason lease reads are delicate. A leader that cannot contact a quorum may still be alive and serving clients unless the read path blocks.',
    invariant: 'A lease is a proof with an expiration, not a feeling that leadership probably remains true.',
  };

  yield {
    state: leaseGraph('Clock drift can turn a lease into a stale-read bug', { clock: 'fast/slow', lease: 'ambiguous', read: 'wrong?' }),
    highlight: { active: ['lease', 'clock', 'read', 'e-lease-clock', 'e-clock-read'], compare: ['quorum'] },
    explanation: 'Lease algorithms depend on clock assumptions. If a node measures time incorrectly relative to the lease proof, it can believe the lease is valid after the cluster has moved on.',
  };

  yield {
    state: labelMatrix(
      'Hazards',
      [
        { id: 'pause', label: 'GC pause' },
        { id: 'drift', label: 'drift' },
        { id: 'partition', label: 'partition' },
        { id: 'lag', label: 'apply lag' },
      ],
      [
        { id: 'failure' },
        { id: 'guard' },
      ],
      [
        ['wakes stale', 'lease age'],
        ['bad time', 'drift bound'],
        ['no quorum', 'step down'],
        ['old state', 'wait apply'],
      ],
    ),
    highlight: { active: ['pause:guard', 'partition:guard', 'lag:guard'], compare: ['drift:failure'] },
    explanation: 'A correct design names the hazards explicitly: process pauses, clock drift, network partitions, and state-machine apply lag. Each needs a guard, not a hopeful comment.',
  };

  yield {
    state: leaseGraph('Falling back to ReadIndex repairs uncertainty', { quorum: 'check now', lease: 'unknown', read: 'after ack', safe: 'linear' }),
    highlight: { active: ['leader', 'quorum', 'commit', 'apply', 'read', 'safe', 'e-leader-quorum'], compare: ['clock'] },
    explanation: 'When the lease proof is missing, expired, or ambiguous, the safe fallback is the quorum-backed read path. That is the baseline lease reads must preserve.',
  };

  yield {
    state: leaseGraph('The complete incident is a paused leader and a quick election', { leader: 'paused', quorum: 'new leader', lease: 'old', clock: 'expired', read: 'block' }),
    highlight: { active: ['leader', 'quorum', 'lease', 'clock', 'read'], removed: ['safe'] },
    explanation: 'A leader pauses long enough for followers to elect a replacement. When it resumes, its lease has expired, so local reads block or use ReadIndex instead of serving stale data.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lease read') yield* leaseRead();
  else if (view === 'stale leader') yield* staleLeader();
  else throw new InputError('Pick a Raft lease-read view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "lease read" view traces the fast path: a client read that skips the quorum round trip because the leader holds a valid lease. Active nodes are the current decision point. Found nodes are conditions already proven true. Watch the lease, clock, and apply nodes -- all three must be active before the read node lights up.',
        'The "stale leader" view traces the failure case. A partitioned or paused leader still receives client reads but cannot prove leadership. Removed nodes are conditions the system can no longer establish. The critical frames are where the lease becomes ambiguous and the read path blocks or falls back to ReadIndex.',
        {
          type: 'note',
          text: 'One safe inference rule: if both the lease node and the apply node are active (found) in the same frame, the read is linearizable. If either is missing, the read must not proceed locally.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Raft gives a replicated system a single ordered log for writes, but reads also need a consistency guarantee. A client asking for the current value of a key wants a linearizable answer: if a write completed before the read began, the read must reflect it. The simplest way to guarantee this is ReadIndex -- the leader contacts a quorum to confirm it is still the leader, records the current commit index, and waits until the local state machine has applied through that index before responding.',
        'ReadIndex is correct, but every linearizable read pays a quorum round trip. In a system like etcd backing a Kubernetes control plane, the API server may issue thousands of small reads per second for pods, leases, configmaps, and endpoints. Each quorum round trip adds one network RTT of latency (typically 0.5-2 ms within a datacenter, much more across zones) and generates O(n) messages across n/2+1 voters. At 10,000 reads/second on a 5-node cluster, that is 30,000 extra network messages per second just to prove leadership repeatedly.',
        {
          type: 'quote',
          attribution: 'Diego Ongaro, Raft extended paper (2014), Section 6.4',
          text: 'Reads must not return stale data, and Raft needs an extra mechanism to ensure reads do not return stale data without using the log.',
        },
        'Leader-lease reads exist to amortize that proof. If the leader can show that no new election could have started since its last quorum interaction, it can serve reads locally for a bounded interval without re-contacting voters. The technique is a performance optimization around a safety proof, not a shortcut around Raft.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is ReadIndex, and it works well. The leader sends a lightweight heartbeat to a quorum, confirms its term is still current, records the commit index at the time of the read request, and waits for its state machine to apply through that index. The result is linearizable with no timing assumptions.',
        {
          type: 'diagram',
          alt: 'ReadIndex message flow between client, leader, and quorum',
          label: 'ReadIndex: one quorum round trip per read',
          body: [
            'client --[read(key)]--> leader',
            '                          |',
            '              leader --[heartbeat]--> follower A',
            '              leader --[heartbeat]--> follower B',
            '                          |',
            '              follower A --[ack]--> leader',
            '              follower B --[ack]--> leader',
            '                          |',
            '              leader confirms: still leader in term T',
            '              leader records: readIndex = commitIndex',
            '              leader waits: applyIndex >= readIndex',
            '                          |',
            'client <--[value]------- leader',
          ].join('\n'),
          text: 'client sends read to leader; leader heartbeats quorum to confirm leadership; leader waits for apply index to reach commit index; leader returns value to client.',
        },
        'ReadIndex is safe because it relies on fresh communication, not timing. But the quorum round trip is the bottleneck. In a read-dominated workload, the leader spends most of its network budget proving something that changes rarely: its own leadership status. If the leader just confirmed leadership 50 ms ago and the election timeout is 1000 ms, re-asking feels wasteful.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is time. Removing the quorum check means the leader must reason about the future: "No new leader could have been elected between my last quorum proof and this read." That requires bounding how long an election takes and trusting that the leader can measure that interval accurately.',
        'Three hazards make this hard:',
        {
          type: 'table',
          headers: ['Hazard', 'Mechanism', 'Why it breaks lease safety'],
          rows: [
            ['Clock drift', 'Leader\'s local clock runs faster or slower than followers\' clocks', 'The leader believes 200 ms have passed; followers have experienced 250 ms -- enough to start an election the leader does not know about'],
            ['Process pause', 'GC stop, VM live migration, OS scheduling delay', 'The leader pauses for 3 seconds, wakes up, and checks its lease timer -- but the timer did not advance during the pause, so it still looks valid'],
            ['Network partition', 'Leader can reach clients but not followers', 'Followers elect a new leader and accept writes the old leader cannot see; the old leader\'s lease may not have expired yet from its own perspective'],
          ],
        },
        'The fast approach -- reading directly from the leader\'s memory without any check -- is unsafe precisely because a process can pause, lose its lease, miss an election, resume, and still believe it is the leader. The read path must force the leader to prove it is not stale.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A leader lease is a cached proof of leadership with an expiration time. When the leader receives a successful heartbeat response from a quorum, it records a lease start time on its local clock. It then calculates a lease expiration using a duration that is strictly shorter than the election timeout, adjusted for maximum expected clock drift.',
        {
          type: 'note',
          text: 'The key formula: leaseExpiry = leaseStart + electionTimeout - maxClockDrift. The subtraction of maxClockDrift is what makes the proof conservative. If the leader\'s clock is fast by up to maxClockDrift, the lease still expires before any follower\'s election timer can fire.',
        },
        'But leadership freshness is only half the safety requirement. A safe linearizable read also needs state freshness: the local state machine must have applied at least through the commit index that existed when the read arrived. A leader with a valid lease but an apply index of 118 cannot serve a read that depends on commit index 120.',
        'The mental model is two gates, not one. The lease gate answers: "Is this node still authorized to act as leader?" The apply gate answers: "Has this node\'s local state caught up to the point the read needs?" Both must be satisfied simultaneously.',
        {
          type: 'diagram',
          alt: 'Two-gate model for lease read safety',
          label: 'Both gates must pass before a lease read can be served',
          body: [
            '                    read request arrives',
            '                          |',
            '                    +-----+-----+',
            '                    |           |',
            '              GATE 1: LEASE  GATE 2: APPLY',
            '              Is the lease   Has the state',
            '              still valid?   machine applied',
            '                 |           through readIndex?',
            '                 |           |',
            '              both YES? ---> serve read locally',
            '              either NO? --> fall back to ReadIndex',
          ].join('\n'),
          text: 'Read request must pass two gates: lease validity check and apply index check. Both yes means serve locally. Either no means fall back to ReadIndex.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Step 1: Lease acquisition. When the leader sends a heartbeat and receives acknowledgements from a majority, it records leaseStart = now() on its local monotonic clock. It sets leaseExpiry = leaseStart + leaseDuration, where leaseDuration is chosen conservatively (typically electionTimeout minus a clock-drift safety margin).',
        'Step 2: Read arrives. A client sends a linearizable read request to the leader. The leader checks: is now() < leaseExpiry? If yes, the lease gate passes. If no, fall back to ReadIndex.',
        'Step 3: Apply wait. The leader records readIndex = commitIndex at the moment the read arrived. It then checks: has the local state machine applied through readIndex? If applyIndex >= readIndex, the apply gate passes. If not, the leader waits for the state machine to catch up.',
        'Step 4: Serve. Both gates passed. The leader reads the value from local state and returns it to the client.',
        {
          type: 'code',
          language: 'javascript',
          body: [
            '// Simplified lease-read decision logic',
            'function handleLeaseRead(leader, readKey) {',
            '  const now = monotonicClock();',
            '',
            '  // Gate 1: lease validity',
            '  if (now >= leader.leaseExpiry) {',
            '    return fallbackToReadIndex(leader, readKey);',
            '  }',
            '',
            '  // Gate 2: state freshness',
            '  const readIndex = leader.commitIndex;',
            '  if (leader.applyIndex < readIndex) {',
            '    waitForApply(leader, readIndex);  // blocks until caught up',
            '  }',
            '',
            '  // Both gates passed: serve from local state',
            '  return leader.stateMachine.get(readKey);',
            '}',
            '',
            '// Lease renewal on heartbeat success',
            'function onHeartbeatQuorumAck(leader) {',
            '  leader.leaseStart = monotonicClock();',
            '  leader.leaseExpiry = leader.leaseStart + LEASE_DURATION;',
            '  // LEASE_DURATION < electionTimeout - maxClockDrift',
            '}',
          ].join('\n'),
          text: 'Pseudocode: handleLeaseRead checks lease expiry (gate 1) and apply index (gate 2) before serving locally. onHeartbeatQuorumAck renews the lease on quorum acknowledgement.',
        },
        'If the lease proof is missing, expired, or made suspicious by timing uncertainty, the read path falls back to ReadIndex. The fallback is part of the design -- it is how the fast path preserves the same external contract as the slow path.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Raft guarantees at most one leader per term. A leader lease extends that guarantee to a bounded time interval by exploiting voter overlap: the same majority that acknowledged the heartbeat would be needed to elect a new leader. If the lease duration is shorter than the minimum time needed to complete a new election, no new leader can exist during the lease window.',
        'The proof has three parts:',
        {
          type: 'bullets',
          items: [
            'Voter overlap: Any new election requires votes from a majority. The lease was established by acknowledgement from a majority. These two majorities must share at least one member (pigeonhole principle). That shared member cannot vote for a new candidate until its election timer fires, which takes at least electionTimeout.',
            'Clock bound: The leader expires its lease at leaseStart + electionTimeout - maxClockDrift. Even if the leader\'s clock runs fast by maxClockDrift relative to the slowest follower, the lease expires before any follower could have started a new election.',
            'Apply completeness: The leader reads commitIndex at request time and waits until applyIndex >= commitIndex. Any write committed before the read arrived is included in the local state. Combined with the lease proof (no newer leader exists), this guarantees linearizability: the read reflects all writes that completed before it began.',
          ],
        },
        {
          type: 'note',
          text: 'The proof assumes bounded clock drift. If a clock drifts by more than maxClockDrift, the lease can overlap with a new leader\'s term, and the system can return stale reads. This is not a bug in the algorithm -- it is an explicit assumption that the deployment must uphold.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A 5-node etcd cluster backs a Kubernetes API server. The configuration uses electionTimeout = 1000 ms, heartbeat interval = 100 ms, and maxClockDrift = 50 ms. The computed lease duration is 1000 - 50 = 950 ms.',
        {
          type: 'table',
          headers: ['Time (ms)', 'Event', 'Leader lease state', 'Safe to serve locally?'],
          rows: [
            ['0', 'Leader sends heartbeat, gets quorum ack', 'leaseStart=0, leaseExpiry=950', 'Yes'],
            ['100', 'Next heartbeat, quorum ack', 'leaseStart=100, leaseExpiry=1050', 'Yes (renewed)'],
            ['200', 'Client read arrives, commitIndex=120, applyIndex=120', 'Valid (200 < 1050)', 'Yes -- both gates pass'],
            ['300', 'Network partition begins: leader loses quorum', 'No renewal possible', 'Yes until 1050'],
            ['1050', 'Lease expires on leader', 'Expired', 'No -- falls back to ReadIndex'],
            ['1100', 'Followers elect new leader in term 10', 'Old leader has no lease', 'No -- old leader blocks reads'],
            ['1200', 'Client reaches old leader', 'Expired', 'No -- ReadIndex fails (no quorum), read rejected'],
          ],
        },
        'The 50 ms clock-drift margin is the safety cushion. At t=1050, the old leader stops serving locally. Even if followers\' clocks are 50 ms behind (making their real wall time 1000 ms when the leader sees 1050 ms), the earliest an election could complete is t=1000 on the followers\' clocks. The old leader has already stopped serving by then.',
        'Now consider the failure case. Suppose the leader experiences a 2-second GC pause starting at t=200. It wakes up at t=2200. Its monotonic clock advanced during the pause (on most OSes, monotonic clocks count wall time, not CPU time), so it reads now()=2200, checks 2200 >= 1050, and correctly refuses to serve from its lease. If the implementation mistakenly used a CPU-time clock that did not advance during the pause, it would read now()=200, believe the lease is still valid, and serve stale data from a leader that was replaced 1100 ms ago.',
        {
          type: 'note',
          text: 'This is why implementations use monotonic clocks (clock_gettime(CLOCK_MONOTONIC) on Linux, System.nanoTime() in Java), not wall clocks. Wall clocks can jump backward on NTP corrections. Monotonic clocks advance steadily but still advance during process pauses, which is the correct behavior for lease expiry.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Metric', 'ReadIndex', 'Lease read', 'Stale (serializable) read'],
          rows: [
            ['Network cost per read', 'O(n) messages to quorum', 'Zero (local check)', 'Zero'],
            ['Latency per read', '1 RTT + apply wait', 'Apply wait only', 'Immediate'],
            ['Clock assumptions', 'None', 'Bounded drift required', 'None'],
            ['Safety under partition', 'Fully safe (quorum proof)', 'Safe until lease expires', 'Unsafe (may read stale)'],
            ['Implementation complexity', 'Low', 'Medium (lease tracking, clock management, fallback)', 'Low'],
            ['Throughput ceiling', 'Quorum bandwidth limited', 'CPU/state-machine limited', 'CPU limited'],
          ],
        },
        'The benefit is measurable. In a 5-node cluster doing 10,000 reads/second, ReadIndex generates ~30,000 heartbeat messages/second for reads alone. Lease reads reduce that to whatever the heartbeat interval already provides (typically 10 heartbeats/second per follower, or ~40 messages/second total). Read latency drops from RTT + apply wait to just apply wait -- often sub-millisecond when the state machine is caught up.',
        'The cost is a timing contract the deployment must maintain. The system needs bounded clock drift (NTP or PTP with known error bounds), monotonic clocks for lease tracking, and GC or scheduling pauses shorter than the lease safety margin. It also needs monitoring: if apply lag grows, reads stall; if clock drift exceeds the bound, safety is silently lost.',
        'Lease reads add roughly 200-400 lines of non-trivial code to a Raft implementation (lease tracking, clock abstraction, fallback logic, configuration validation). A subtle off-by-one in time arithmetic can become a linearizability violation that only manifests under partition or pause -- the hardest bugs to test for.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'etcd: Supports lease reads through its Raft implementation. The etcd linearizable read path uses ReadIndex by default; lease-based reads are an opt-in optimization for deployments that can guarantee clock bounds. etcd\'s election timeout default is 1000 ms with a 100 ms heartbeat interval.',
            'TiKV: Uses Raft leader leases extensively for its distributed key-value store backing TiDB. TiKV\'s lease read implementation tracks lease start times per region leader and falls back to ReadIndex when the lease is uncertain. Their blog documents the design tradeoffs in detail.',
            'CockroachDB: Uses epoch-based leases for its range-level Raft groups. A range lease is tied to a node\'s liveness record in a system range. If the liveness record expires (the node fails to heartbeat it), the lease is considered expired and another node can acquire it. This is a coarser variant of the same idea.',
            'Consul: HashiCorp Consul\'s Raft-backed KV store supports stale reads (any server, possibly stale) and consistent reads (leader with ReadIndex). Lease-like optimizations apply at the leader for consistent reads within the leader\'s known-good interval.',
          ],
        },
        'The pattern fits best in read-heavy replicated metadata systems: the write rate is low enough that Raft log replication is not the bottleneck, but the read rate is high enough that quorum-per-read is expensive. Control-plane databases (etcd, Consul, ZooKeeper-style systems) are the canonical use case.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Lease reads fail when timing assumptions are weak. Specific failure modes:',
        {
          type: 'bullets',
          items: [
            'Unbounded GC pauses: A Java-based Raft node experiencing a 10-second stop-the-world GC will have its lease expire, but if the implementation uses a clock that does not advance during the pause, it will not notice. Go\'s runtime has shorter GC pauses (sub-millisecond in modern versions), which is one reason etcd and TiKV chose Go and Rust respectively.',
            'Bad clocks: NTP can correct wall clocks by several hundred milliseconds in a single step. If a lease expiry is computed against wall time and NTP jumps the clock backward, the lease appears to extend. Monotonic clocks fix this, but not every implementation gets it right.',
            'Virtualization: VM live migration can pause a process for seconds. The monotonic clock advances, so the lease correctly expires, but the lease safety margin must account for the worst-case migration pause -- which may be unpredictable.',
            'Misconfigured election timeouts: If the election timeout is set too low relative to actual network latency, followers may start elections before the leader\'s lease has expired. The clock-drift margin must account for the gap between configured and actual timing behavior.',
          ],
        },
        'Lease reads also fail conceptually when teams conflate serializable reads with linearizable reads. A serializable read returns some consistent snapshot but not necessarily the latest one. It is useful for dashboards, monitoring, and caches. It is not safe for decisions that depend on the current committed state, such as leader election, lock acquisition, or configuration changes.',
        {
          type: 'quote',
          attribution: 'Martin Kleppmann, Designing Data-Intensive Applications, Chapter 9',
          text: 'If you think you can avoid consensus and get away with leases and timeouts... you need to be very careful about your assumptions regarding clocks.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary: Diego Ongaro and John Ousterhout, "In Search of an Understandable Consensus Algorithm (Extended Version)," 2014. Section 6.4 discusses read-only operations and the ReadIndex approach. Available at https://raft.github.io/raft.pdf.',
            'Implementation: TiKV lease-read design blog post at https://tikv.org/blog/lease-read/. Covers the lease-start tracking, clock-drift bounds, and fallback logic in a production Raft system.',
            'Implementation: etcd Raft package documentation at https://pkg.go.dev/go.etcd.io/raft/v3. The ReadIndex and lease-read paths are visible in the Raft state machine code.',
            'Context: etcd API guarantees at https://etcd.io/docs/v3.5/learning/api_guarantees/. Documents the linearizable read contract from the client perspective.',
            'Background: Martin Kleppmann, "Designing Data-Intensive Applications," Chapter 8 (clocks) and Chapter 9 (consistency). The discussion of lease-based assumptions and clock hazards directly informs this topic.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Raft Leader Election', 'Lease reads depend on understanding how elections work and what election timeout governs'],
            ['Prerequisite', 'Clocks and Ordering', 'The lease proof requires bounded clock drift -- understand why clocks diverge'],
            ['Sibling', 'Raft ReadIndex Case Study', 'ReadIndex is the baseline that lease reads optimize; compare the two paths'],
            ['Extension', 'Fencing Token Zombie Writer', 'Another technique for detecting stale actors -- fencing tokens solve a related problem for writes'],
            ['Extension', 'Distributed Locks', 'Lease-based distributed locks face the same clock-drift and pause hazards as lease reads'],
          ],
        },
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'State the two gates a lease read must pass in one sentence each.',
            'Explain why leaseExpiry subtracts maxClockDrift from electionTimeout.',
            'A leader pauses for 5 seconds, wakes up, and checks its lease. What should happen, and what clock property makes it work?',
            'Name one system that uses lease reads in production and one failure mode it must guard against.',
            'A colleague proposes setting leaseDuration = electionTimeout with no clock-drift margin. Explain the bug.',
          ],
        },
      ],
    },
  ],
};
