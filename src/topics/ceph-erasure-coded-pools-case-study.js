// Ceph erasure-coded pools: k data chunks, m coding chunks, CRUSH placement,
// degraded reads, and recovery traffic.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'ceph-erasure-coded-pools-case-study',
  title: 'Ceph Erasure-Coded Pools',
  category: 'Systems',
  summary: 'Ceph erasure-coded pools split objects into data and coding chunks, place them through CRUSH, and rebuild missing chunks from surviving shards.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['stripe and place', 'degraded read'], defaultValue: 'stripe and place' },
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

function cephGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'client', label: 'cli', x: 0.4, y: 4.0, note: notes.client ?? 'RADOS' },
      { id: 'object', label: 'obj', x: 2.1, y: 4.0, note: notes.object ?? 'object' },
      { id: 'pg', label: 'PG', x: 3.75, y: 4.0, note: notes.pg ?? 'maps' },
      { id: 'profile', label: 'profile', x: 5.1, y: 2.3, note: notes.profile ?? '4+2' },
      { id: 'crush', label: 'CRUSH', x: 5.1, y: 5.8, note: notes.crush ?? 'rule' },
      { id: 'd0', label: 'D0', x: 6.55, y: 1.35, note: notes.d0 ?? 'osd1' },
      { id: 'd1', label: 'D1', x: 7.55, y: 2.45, note: notes.d1 ?? 'osd2' },
      { id: 'd2', label: 'D2', x: 6.55, y: 3.55, note: notes.d2 ?? 'osd3' },
      { id: 'd3', label: 'D3', x: 7.55, y: 4.65, note: notes.d3 ?? 'osd4' },
      { id: 'c0', label: 'C0', x: 6.55, y: 5.75, note: notes.c0 ?? 'osd5' },
      { id: 'c1', label: 'C1', x: 7.55, y: 6.85, note: notes.c1 ?? 'osd6' },
      { id: 'osds', label: 'OSDs', x: 9.15, y: 4.1, note: notes.osds ?? 'domains' },
    ],
    edges: [
      { id: 'e-client-object', from: 'client', to: 'object', weight: '' },
      { id: 'e-object-pg', from: 'object', to: 'pg', weight: '' },
      { id: 'e-pg-profile', from: 'pg', to: 'profile', weight: '' },
      { id: 'e-pg-crush', from: 'pg', to: 'crush', weight: '' },
      { id: 'e-profile-d0', from: 'profile', to: 'd0', weight: '' },
      { id: 'e-profile-d1', from: 'profile', to: 'd1', weight: '' },
      { id: 'e-profile-d2', from: 'profile', to: 'd2', weight: '' },
      { id: 'e-profile-d3', from: 'profile', to: 'd3', weight: '' },
      { id: 'e-profile-c0', from: 'profile', to: 'c0', weight: '' },
      { id: 'e-profile-c1', from: 'profile', to: 'c1', weight: '' },
      { id: 'e-crush-osds', from: 'crush', to: 'osds', weight: '' },
      { id: 'e-d0-osds', from: 'd0', to: 'osds', weight: '' },
      { id: 'e-d1-osds', from: 'd1', to: 'osds', weight: '' },
      { id: 'e-d2-osds', from: 'd2', to: 'osds', weight: '' },
      { id: 'e-d3-osds', from: 'd3', to: 'osds', weight: '' },
      { id: 'e-c0-osds', from: 'c0', to: 'osds', weight: '' },
      { id: 'e-c1-osds', from: 'c1', to: 'osds', weight: '' },
    ],
  }, { title });
}

function recoveryGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'read', label: 'read', x: 0.7, y: 4.0, note: notes.read ?? 'degraded' },
      { id: 'd0', label: 'D0', x: 2.3, y: 1.8, note: notes.d0 ?? 'ok' },
      { id: 'd1', label: 'D1', x: 2.3, y: 3.1, note: notes.d1 ?? 'lost' },
      { id: 'd2', label: 'D2', x: 2.3, y: 4.4, note: notes.d2 ?? 'ok' },
      { id: 'd3', label: 'D3', x: 2.3, y: 5.7, note: notes.d3 ?? 'ok' },
      { id: 'c0', label: 'C0', x: 2.3, y: 7.0, note: notes.c0 ?? 'ok' },
      { id: 'decode', label: 'decode', x: 5.0, y: 4.4, note: notes.decode ?? 'k chunks' },
      { id: 'reply', label: 'reply', x: 7.0, y: 3.1, note: notes.reply ?? 'object bytes' },
      { id: 'backfill', label: 'backfill', x: 7.0, y: 5.7, note: notes.backfill ?? 'new D1' },
      { id: 'healthy', label: 'healthy', x: 9.0, y: 4.4, note: notes.healthy ?? 'clean' },
    ],
    edges: [
      { id: 'e-read-d0', from: 'read', to: 'd0', weight: '' },
      { id: 'e-read-d2', from: 'read', to: 'd2', weight: '' },
      { id: 'e-read-d3', from: 'read', to: 'd3', weight: '' },
      { id: 'e-read-c0', from: 'read', to: 'c0', weight: '' },
      { id: 'e-d0-decode', from: 'd0', to: 'decode', weight: '' },
      { id: 'e-d2-decode', from: 'd2', to: 'decode', weight: '' },
      { id: 'e-d3-decode', from: 'd3', to: 'decode', weight: '' },
      { id: 'e-c0-decode', from: 'c0', to: 'decode', weight: '' },
      { id: 'e-decode-reply', from: 'decode', to: 'reply', weight: '' },
      { id: 'e-decode-backfill', from: 'decode', to: 'backfill', weight: '' },
      { id: 'e-reply-healthy', from: 'reply', to: 'healthy', weight: '' },
      { id: 'e-backfill-healthy', from: 'backfill', to: 'healthy', weight: '' },
    ],
  }, { title });
}

function* stripeAndPlace() {
  yield {
    state: cephGraph('The erasure-code profile defines the chunk layout'),
    highlight: { active: ['client', 'object', 'pg', 'profile', 'e-client-object', 'e-object-pg', 'e-pg-profile'], found: ['d0', 'd1', 'd2', 'd3', 'c0', 'c1'] },
    explanation: 'A Ceph erasure-coded pool uses a profile such as k=4, m=2. The object is encoded into four data chunks and two coding chunks. Any four chunks can recover the object.',
    invariant: 'Ceph calls data shards data chunks and parity shards coding chunks.',
  };

  yield {
    state: labelMatrix(
      'Example EC profile',
      [
        { id: 'k', label: 'k' },
        { id: 'm', label: 'm' },
        { id: 'plugin', label: 'plugin' },
        { id: 'rule', label: 'rule' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['4', 'data chunks'],
        ['2', 'coding chunks'],
        ['isa/jerasure', 'codec'],
        ['rack spread', 'fail domains'],
      ],
    ),
    highlight: { active: ['k:meaning', 'm:meaning', 'rule:meaning'], compare: ['plugin:value'] },
    explanation: 'The profile is the durable contract for the pool. It tells the OSDs how many chunks to produce, which coding plugin to use, and which placement rule should separate failure domains.',
  };

  yield {
    state: cephGraph('CRUSH places chunks across OSDs and failure domains', { crush: 'place', osds: 'spread' }),
    highlight: { active: ['crush', 'osds', 'e-pg-crush', 'e-crush-osds'], found: ['d0', 'd1', 'd2', 'd3', 'c0', 'c1'] },
    explanation: 'CRUSH placement remains central. A k+m layout is only durable if the chunks land on distinct enough devices, hosts, or racks. Otherwise one correlated failure can erase too many chunks.',
  };

  yield {
    state: labelMatrix(
      'Replication vs erasure coding',
      [
        { id: 'rep', label: '3x repl' },
        { id: 'ec42', label: 'EC 4+2' },
        { id: 'hot', label: 'hot small' },
        { id: 'cold', label: 'cold large' },
      ],
      [
        { id: 'space', label: 'space' },
        { id: 'read', label: 'read cost' },
        { id: 'write', label: 'write cost' },
      ],
      [
        ['3.0x', 'simple', 'simple'],
        ['1.5x', 'decode if bad', 'encode chunks'],
        ['costly EC', 'latency risk', 'write amp'],
        ['good fit', 'batched IO', 'space win'],
      ],
    ),
    highlight: { active: ['ec42:space', 'cold:space'], compare: ['rep:space', 'hot:write'] },
    explanation: 'Erasure coding usually fits large, colder data better than tiny hot writes. Space efficiency improves, but write path, repair path, and degraded reads get heavier.',
  };

  yield {
    state: cephGraph('Object APIs hide chunks behind one logical object', { object: 'logical', pg: 'stripe', osds: 'chunks' }),
    highlight: { active: ['object', 'pg', 'profile', 'crush'], found: ['osds'] },
    explanation: 'Clients ask for objects. The storage cluster handles striping, coding, placement, and repair beneath that API. The abstraction is simple because the hidden metadata is not.',
  };
}

function* degradedRead() {
  yield {
    state: recoveryGraph('A degraded read gathers enough surviving chunks'),
    highlight: { active: ['read', 'd0', 'd2', 'd3', 'c0', 'decode'], removed: ['d1'], found: ['reply'] },
    explanation: 'If one data chunk is unavailable, the OSDs can read enough surviving chunks and decode the requested data. The client still receives object bytes, but the cluster pays extra work.',
    invariant: 'Degraded mode consumes the failure budget until repair finishes.',
  };

  yield {
    state: labelMatrix(
      'Degraded read plan',
      [
        { id: 'd0', label: 'D0' },
        { id: 'd1', label: 'D1' },
        { id: 'd2', label: 'D2' },
        { id: 'd3', label: 'D3' },
        { id: 'c0', label: 'C0' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'action', label: 'action' },
      ],
      [
        ['present', 'read'],
        ['missing', 'rebuild'],
        ['present', 'read'],
        ['present', 'read'],
        ['present', 'read'],
      ],
    ),
    highlight: { active: ['d1:state', 'd1:action'], found: ['d0:action', 'd2:action', 'd3:action', 'c0:action'] },
    explanation: 'The decoder reads k available chunks. It can serve the request and also produce the missing chunk for backfill if the cluster decides to repair immediately.',
  };

  yield {
    state: recoveryGraph('Backfill writes a replacement chunk'),
    highlight: { active: ['decode', 'backfill', 'e-decode-backfill'], found: ['healthy'], compare: ['reply'] },
    explanation: 'Recovery writes a replacement chunk to a healthy OSD chosen by the current CRUSH map. The system returns to a full k+m chunk set only after backfill completes.',
  };

  yield {
    state: labelMatrix(
      'Failure-domain checks',
      [
        { id: 'osd', label: 'OSD down' },
        { id: 'host', label: 'host down' },
        { id: 'rack', label: 'rack down' },
        { id: 'map', label: 'map drift' },
      ],
      [
        { id: 'safe', label: 'safe if' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['<= m chunks', 'repair load'],
        ['chunks spread', 'bad rule'],
        ['rack spread', 'corr loss'],
        ['clients update', 'stale route'],
      ],
    ),
    highlight: { active: ['host:safe', 'rack:safe'], compare: ['map:risk'] },
    explanation: 'The m value is only meaningful relative to placement. Losing two disks is different from losing one rack if several chunks were placed under the same rack failure domain.',
  };

  yield {
    state: labelMatrix(
      'Operational costs',
      [
        { id: 'cpu', label: 'CPU' },
        { id: 'net', label: 'network' },
        { id: 'scrub', label: 'scrub' },
        { id: 'small', label: 'small IO' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['encode/decode', 'profile choice'],
        ['repair reads', 'throttle'],
        ['find bad shard', 'checksums'],
        ['read-mod-write', 'cache or repl'],
      ],
    ),
    highlight: { active: ['cpu:why', 'net:guard', 'scrub:guard'], compare: ['small:why'] },
    explanation: 'Ceph erasure coding is strongest when profile, placement, scrubbing, and recovery throttles match the workload. The wrong pool layout can save space while damaging latency.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'stripe and place') yield* stripeAndPlace();
  else if (view === 'degraded read') yield* degradedRead();
  else throw new InputError('Pick a Ceph erasure-code view.');
}

export const article = {
  sections: [
    {
      heading: 'The problem',
      paragraphs: [
        `Ceph stores data as objects spread across OSDs. The easiest durable design is replication: keep three full copies, place them on different failure domains, and read from any healthy copy. That design is valuable because it is simple. A write is a few full-object writes. A read does not need decoding. A repair copies a full object from a surviving replica to a replacement OSD.`,
        `The price is raw capacity. Three-way replication spends roughly three bytes of disk for every logical byte before filesystem, compression, and operational overhead. For hot metadata, virtual machine images, and latency-sensitive small writes, that price can be justified. For cold logs, backup objects, media archives, and large analytical blobs, the space tax can dominate the cluster budget.`,
        `Erasure-coded pools exist to move that tradeoff. Instead of storing whole copies, Ceph splits an object into k data chunks and computes m coding chunks. A 4+2 profile stores six chunks total and can reconstruct the object from any four suitable chunks. The pool may spend about 1.5x raw space instead of 3.0x, while accepting more CPU, more network traffic, heavier degraded reads, and a more demanding repair path.`,
      ],
    },
    {
      heading: 'The naive wall',
      paragraphs: [
        `A naive attempt at saving space is to lower the replication factor. Two replicas are cheaper than three, but they narrow the failure budget sharply. A disk failure plus a second correlated fault during recovery can become a data-loss event. One copy is not a storage system; it is a wish with a checksum.`,
        `Another naive attempt is to compress or deduplicate everything. Those techniques help when data has redundancy, but they do not replace a durability strategy. A compressed object still needs a failure model. A deduplicated chunk still needs placement and repair. Capacity optimization below the object layer cannot answer the question "how many independent failures can this placement group survive?"`,
        `Erasure coding answers a different question: how can the cluster store enough independent information to recover the object without storing complete replicas? The wall it hits is that independence must be real, not just mathematical. If six chunks are placed across six OSDs under one rack, then a rack outage can remove all six at once. The code profile and the CRUSH rule must be designed together.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Ceph combines erasure coding with deterministic placement. The erasure-code profile defines the coding contract: k data chunks, m coding chunks, the coding plugin, stripe behavior, and related parameters. CRUSH defines the placement contract: which OSDs should hold those chunks, and how the pool should spread them across hosts, racks, device classes, or other failure domains.`,
        `The invariant has two halves. The coding half says that enough surviving chunks can reconstruct the original object. The placement half says that normal failures should not remove more chunks from a placement group than the code can tolerate. A 4+2 pool can tolerate two missing chunks only if the missing chunks are independent enough that real failures usually remove no more than two for the same object stripe.`,
        `That is why k and m are not just capacity knobs. Larger k improves space efficiency but requires more chunks to read and repair. Larger m improves the missing-chunk budget but adds storage and write cost. A wider layout needs more healthy placement targets, more network fanout, and more careful topology. The right profile follows the workload and the fault model, not a generic best practice table.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `On write, the client sends a logical object through RADOS. The object maps to a placement group. The acting OSD set applies the erasure-code profile, cuts the object into data chunks, computes coding chunks, and writes each chunk to the OSD selected by CRUSH. The client still sees one object. The cluster stores a stripe of related chunks with enough metadata to find, verify, and repair them later.`,
        `On a healthy read, Ceph can often read the chunks needed for the requested range and return the logical bytes. On a degraded read, one or more chunks are unavailable. Ceph reads enough surviving chunks, decodes the missing data, and serves the request. The caller may not see an error, but the cluster has paid extra CPU and network cost, and the placement group is consuming its failure budget until recovery completes.`,
        `Recovery is a distributed reconstruction job. Ceph chooses replacement OSDs using the current CRUSH map, reads surviving chunks, reconstructs missing chunks, writes the replacements, and marks the placement group clean only after the required chunk set is restored. Scrubbing and checksums matter because a silent corrupt chunk can be as dangerous as a missing one when the decoder needs that chunk during a later failure.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The coding part works because the coding chunks store independent equations over the data chunks. Reed-Solomon-style codes are the usual mental model: if enough independent chunks survive, the decoder can solve for the missing data. The cluster does not need to guess what was on the failed disk; it recomputes it from the surviving information.`,
        `The placement part works because CRUSH makes the chunk location a function of cluster topology, pool rules, placement group, and current OSD state. That avoids a central lookup table for every object while still giving operators a way to express "do not put all chunks under one host" or "use this device class." Deterministic placement also lets clients and OSDs converge on the same map after topology changes.`,
        `The abstraction works because object identity is separated from chunk identity. Applications do not manage D0, D1, C0, or C1. They read and write objects. Ceph manages striping, encoding, placement, peering, backfill, and degraded service beneath that API. The price of that abstraction is that operators must understand the hidden state well enough to tune and debug it.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Erasure-coded pools fit large, colder objects where capacity efficiency is more important than the simplest possible write path. Archive buckets, log retention, media libraries, backup repositories, and analytical object stores are common examples. These workloads often write in larger units, tolerate batch-oriented repair, and value a lower raw-capacity multiplier.`,
        `They also fit clusters with enough physical spread to make the profile meaningful. A 4+2 pool is more convincing when the six chunks can be separated across real hosts or racks than when they are squeezed into a tiny cluster. The operator should be able to describe the intended failure: one host, two disks, one rack, one device class, or some combination. If that sentence is vague, the profile is probably not ready.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The main tradeoff is space for work. Every encoded write performs coding. Many partial updates need read-modify-write behavior because the coding chunks must remain consistent with the data chunks. Degraded reads require more remote reads and decode work. Recovery reads survivors, reconstructs missing chunks, and writes replacements while foreground traffic still needs service.`,
        `Small random writes are the classic danger zone. A replicated pool can update a small object or block by writing full copies. An erasure-coded pool may need to touch several chunks for the same logical change. Ceph has features that make overwrites possible for suitable clients and configurations, but the operator should still treat tiny hot overwrite workloads as suspicious until measured.`,
        `The profile is also a long-lived contract. Moving an existing pool from one k/m layout to another is not a casual toggle because the stored chunks were created under the old layout. Operators often create a new pool, migrate data, and retire the old one when the layout decision changes. That makes initial profile selection important.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The obvious failure is losing more chunks than m for a placement group. The less obvious failure is losing independence. If CRUSH rules, host labels, rack labels, device classes, or OSD weights do not describe the physical world accurately, the pool can look redundant while several chunks share the same blast radius.`,
        `Another failure mode is recovery overload. After an OSD loss, the cluster may be able to reconstruct every missing chunk, but the repair traffic can compete with client reads and writes. If recovery is too aggressive, users see latency spikes. If recovery is too slow, the cluster spends too long in degraded mode. The right throttle depends on service level, spare bandwidth, and the probability of a second failure.`,
        `A third failure mode is treating erasure coding as a universal replacement for replication. Monitor metadata, hot indexes, tiny update-heavy objects, and latency-sensitive block workloads may be better served by replicated pools. Saving raw capacity is not a win if it forces constant degraded reads, long repair windows, or p99 latency that breaks the product.`,
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        `Watch degraded and misplaced placement groups, recovery bytes, backfill queue depth, OSD op latency, scrub errors, slow requests, and the distribution of chunks across failure domains. A healthy erasure-coded pool should not merely be "active+clean" most of the time; it should recover within the time budget assumed by the failure model.`,
        `Capacity metrics need interpretation. Raw savings from 4+2 look attractive, but usable capacity also depends on nearfull ratios, backfill reserve, object size distribution, compression, and the need for replicated pools elsewhere in the same cluster. A cluster designed with no slack for recovery is fragile even if the erasure code is mathematically sound.`,
        `Evaluation should include fault drills. Mark out an OSD, observe degraded read latency, measure repair bandwidth, and verify that CRUSH selects replacement locations in the expected domains. Then repeat for a host or rack scenario if that is part of the stated durability story. The important question is not "does EC work?" but "does this profile, on this topology, under this workload, recover within budget?"`,
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        `Suppose a company keeps twelve months of compressed request logs in Ceph. The logs are written once, read occasionally for investigations, and copied to a separate disaster-recovery region. Three-way replication would be easy but expensive. The operator creates a 4+2 erasure-coded pool with a CRUSH rule that spreads chunks across hosts and racks. Large object writes are batched, and the application does not require low-latency overwrites.`,
        `During normal service, each object becomes four data chunks and two coding chunks. Reads are mostly healthy and sequential. When one OSD fails, placement groups containing chunks on that OSD become degraded. A read that needs a missing data chunk gathers four surviving chunks, decodes, and returns the requested bytes. Backfill reconstructs replacement chunks onto healthy OSDs selected by the current CRUSH map.`,
        `The design is successful only if the measurements support it. If degraded reads stay within the investigation tooling budget, repair finishes quickly enough, scrub finds no recurring corruption, and failure drills show chunks spread across the intended domains, the pool is doing its job. If small overwrite latency dominates, recovery saturates the network, or topology labels are wrong, replication or a different profile is the better engineering choice.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: Ceph erasure-code documentation at https://docs.ceph.com/en/reef/rados/operations/erasure-code/, Ceph erasure-code profile documentation at https://docs.ceph.com/en/reef/rados/operations/erasure-code-profile/, and the CRUSH paper at https://ceph.com/assets/pdfs/weil-crush-sc06.pdf.`,
        `Study Reed-Solomon Erasure Coding for the threshold math, Ceph CRUSH Placement Case Study for deterministic failure-domain placement, S3 Object Storage Case Study for object durability design, Backpressure and Flow Control for recovery throttling, and Tail Latency and p99 Thinking for degraded-read impact.`,
      ],
    },
  ],
};
