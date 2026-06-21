// NTP & PTP: Clocks & Ordering showed clocks lie; this page shows how hard
// the internet fights back. Four timestamps recover a 120ms offset exactly —
// until the path turns asymmetric, and physics presents its bill.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'ntp-sync',
  title: 'NTP & PTP: How Clocks Actually Sync',
  category: 'Systems',
  summary: 'The four-timestamp exchange that measures a clock\'s offset through an unknown network delay — and why asymmetry, not distance, is the accuracy wall.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['the four-timestamp trick', 'PTP & the nanosecond world'], defaultValue: 'the four-timestamp trick' },
  ],
  run,
};

// The NTP estimator, actually computed. The client clock runs TRUE_OFFSET
// behind the server. Timestamps t1/t4 are read on the client clock,
// t2/t3 on the server clock; out/back are the one-way path delays.
const TRUE_OFFSET = 0.120;
const PROCESS = 0.002;
function exchange(out, back) {
  const t1 = 1000.0;                              // client clock, at send
  const t2 = t1 + out + TRUE_OFFSET;              // server clock, at receive
  const t3 = t2 + PROCESS;                        // server clock, at reply
  const t4 = t1 + out + PROCESS + back;           // client clock, at receive
  const offset = ((t2 - t1) + (t3 - t4)) / 2;     // the NTP estimator
  const delay = (t4 - t1) - (t3 - t2);            // round trip minus server hold
  return { t1, t2, t3, t4, offset, delay };
}
const SYM = exchange(0.040, 0.040);
const ASYM = exchange(0.070, 0.010);
const ms = (v) => `${(v * 1000).toFixed(0)}ms`;

// Collision-proof matrix builder: every cell gets a unique format index.
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

function* fourTimestamps() {
  yield {
    state: table(`Symmetric path (40ms each way): four timestamps, computed live`, [
      ['t1', 't1 · client sends'],
      ['t2', 't2 · server receives'],
      ['t3', 't3 · server replies'],
      ['t4', 't4 · client receives'],
      ['est', 'NTP estimate'],
    ], [['clock', 'whose clock'], ['reads', 'reads'], ['means', 'what it captures']], [
      ['client', SYM.t1.toFixed(3), 'the question leaves'],
      ['server', SYM.t2.toFixed(3), 'outbound delay + the offset, entangled'],
      ['server', SYM.t3.toFixed(3), `${ms(PROCESS)} of server think-time, measured and excluded`],
      ['client', SYM.t4.toFixed(3), 'the answer returns'],
      ['—', `offset ${ms(SYM.offset)}, delay ${ms(SYM.delay)}`, `recovered the true ${ms(TRUE_OFFSET)} EXACTLY`],
    ]),
    highlight: { found: ['est:reads'] },
    explanation: `The puzzle Clocks & Ordering: Lamport to TrueTime left open: how do you measure another machine's clock through a network whose delay you don't know? NTP's answer needs exactly four timestamps. The client stamps its send (t1) and its receive (t4) on ITS clock; the server stamps its receive (t2) and reply (t3) on ITS clock. Offset = ((t2−t1) + (t3−t4))/2 — the outbound leg measures delay PLUS offset, the return leg measures delay MINUS offset, and averaging cancels the delay entirely. Run live with a true offset of ${ms(TRUE_OFFSET)} and 40ms legs: the estimate is ${ms(SYM.offset)}. Not approximately — exactly, no matter how long the (symmetric) path is.`,
    invariant: 'Offset = ((t2−t1) + (t3−t4))/2: with equal legs, the unknown delay cancels perfectly out of the estimate.',
  };

  yield {
    state: table(`Same total delay, asymmetric legs (70ms out, 10ms back)`, [
      ['t2', 't2 · server receives'],
      ['t4', 't4 · client receives'],
      ['est', 'NTP estimate'],
      ['err', 'error'],
    ], [['reads', 'reads'], ['why', 'why it moved']], [
      [ASYM.t2.toFixed(3), 'the outbound leg now carries 70 of the 80ms'],
      [ASYM.t4.toFixed(3), 'unchanged — total round trip is the same 80ms'],
      [`offset ${ms(ASYM.offset)}, delay ${ms(ASYM.delay)}`, `the true offset is still ${ms(TRUE_OFFSET)}`],
      [`${ms(ASYM.offset - TRUE_OFFSET)} — exactly the asymmetry ÷ 2`, 'and NTP has NO WAY to detect it'],
    ]),
    highlight: { removed: ['err:reads'] },
    explanation: `Now the catch. Keep the same 80ms round trip but route it unevenly — 70ms out, 10ms back (congestion on one direction does this constantly; see TCP: Handshake & Congestion Control for why queues build asymmetrically). The estimator, which silently assumes equal legs, now reads ${ms(ASYM.offset)} instead of ${ms(TRUE_OFFSET)}: off by ${ms(ASYM.offset - TRUE_OFFSET)}, precisely half the asymmetry, computed live. Worse: no exchange of timestamps can ever expose the split — a fast clock with a slow return path produces literally identical timestamps to a slow clock with a fast return path. The round trip is measurable; its division is not. This, not bandwidth or distance, is clock sync's fundamental wall.`,
    invariant: 'Sync error is bounded by delay/2, reached at full asymmetry — and asymmetry is invisible to any timestamp protocol.',
  };

  yield {
    state: table('The defense in depth: strata, polls, and filters', [
      ['s0', 'stratum 0'],
      ['s1', 'stratum 1'],
      ['s2', 'stratum 2–15'],
      ['poll', 'polling'],
      ['filter', 'the clock filter'],
    ], [['what', 'what it is']], [
      ['the reference: GPS receivers, atomic clocks — not on the network at all'],
      ['servers wired directly to a stratum-0 device (microseconds from truth)'],
      ['each level syncs to the one above; your laptop sits at 3–4 via pool.ntp.org\'s ~4,000 volunteer servers'],
      ['every 64–1024s, adaptive: stable clocks earn longer intervals'],
      ['keep 8 recent exchanges, TRUST ONLY THE LOWEST-DELAY ones — short trips had less room to be asymmetric'],
    ]),
    highlight: { active: ['filter:what'] },
    explanation: 'NTP can\'t beat the asymmetry bound, so it plays statistics against it. The hierarchy keeps paths short: strata fan out from atomic truth so most syncs cross a campus, not a continent (the same delegation shape as How DNS Works, and for the same reason). The clock filter is the clever part: among the last eight exchanges it trusts only the minimum-delay samples — a packet that round-tripped in 8ms simply had less queueing in it than one that took 80ms, so its symmetric-path assumption is safer. Add multiple servers, outlier rejection ("falsetickers" get voted out), and the result is a few milliseconds of accuracy on a LAN, tens over the open internet — for free, since 1985.',
    invariant: 'Minimum-delay samples carry minimum asymmetry risk: NTP filters by delay because it cannot filter by error.',
  };

  yield {
    state: table('Applying the correction: why clocks never jump backward', [
      ['slew', 'slew (the normal path)'],
      ['step', 'step (the exception)'],
      ['panic', 'panic (the refusal)'],
      ['smear', 'leap smear'],
    ], [['how', 'how it works']], [
      ['speed the clock up or down by ≤ 500 parts per million until the error drains — time stays monotonic'],
      ['error > 128ms: jump once at boot-ish moments; backward steps break make, log order, TLS, schedulers'],
      ['error > 1000s: refuse and demand a human — something is too wrong to trust'],
      ['Google & AWS stretch the leap second across 24h (each second lies by ~11.6µs) so midnight never happens twice'],
    ]),
    highlight: { active: ['slew:how'] },
    explanation: 'Measuring the offset is half the job; applying it is the other half, and the rule is: never let time go backward. A backward jump re-orders log lines, convinces build tools that outputs predate inputs, and fires timers twice — so NTP SLEWS, running the clock imperceptibly fast or slow (≤500ppm, half a millisecond per second) until the error drains away. Leap seconds get the same medicine at planetary scale: rather than replay 23:59:59, Google and AWS smear the extra second across a full day. The philosophical punchline for readers of Clocks & Ordering: Lamport to TrueTime: even the machinery that SYNCS clocks refuses to trust raw time — it bends the clock\'s rate rather than ever contradict its past.',
    invariant: 'Corrections preserve monotonicity: rate-bend the clock, never rewind it — local order is worth more than global truth.',
  };
}

function* ptpWorld() {
  yield {
    state: table('Where NTP\'s accuracy actually dies: the timestamp\'s journey', [
      ['app', 'application stamps t1'],
      ['kernel', 'kernel & NIC queues'],
      ['wire', 'on the wire'],
      ['switch', 'inside each switch'],
    ], [['jitter', 'jitter added']], [
      ['scheduler delay: the process wrote t1, then waited its turn — 10s of µs to ms, unmeasured'],
      ['driver rings and interrupt coalescing: more µs of noise between the stamp and the wire'],
      ['propagation is stable (5µs/km in fiber) — the honest part of the trip'],
      ['queueing behind other traffic: µs to ms, different every packet, in each direction'],
    ]),
    highlight: { removed: ['app:jitter', 'switch:jitter'] },
    explanation: 'Why does NTP plateau at milliseconds even on a quiet LAN? Because its timestamps are taken in SOFTWARE: t1 is stamped by a process that then waits in the scheduler, the driver, the NIC queue — so the number describes when the code ran, not when the photons left. Every queue adds jitter, every switch adds more, and the four-timestamp algebra faithfully computes an offset for a journey whose endpoints were measured sloppily. The estimator isn\'t the bottleneck; the measurement is. Fixing it means moving the stopwatch out of software and into the hardware that touches the wire — which is exactly PTP\'s design.',
    invariant: 'A sync protocol\'s floor is its timestamp jitter: software stamps → milliseconds, hardware stamps → microseconds and below.',
  };

  yield {
    state: table('PTP (IEEE 1588): move the stopwatch into the silicon', [
      ['hw', 'hardware timestamps'],
      ['tc', 'transparent clocks'],
      ['bc', 'boundary clocks'],
      ['result', 'the result'],
    ], [['idea', 'the move']], [
      ['the NIC\'s PHY stamps the packet as bits cross the wire — scheduler and driver jitter vanish'],
      ['PTP-aware switches measure each packet\'s own queueing delay and write it INTO the packet for subtraction'],
      ['or the switch itself syncs and re-originates time on every port — the path is never opaque'],
      ['sub-microsecond over a LAN routinely; tens of nanoseconds with good hardware'],
    ]),
    highlight: { found: ['result:idea'] },
    explanation: 'PTP attacks both jitter sources by changing where measurement happens. Hardware timestamping: the NIC\'s physical-layer chip stamps frames at the exact symbol crossing the wire, deleting the entire software stack from the error budget. Transparent clocks: each PTP-aware switch measures how long THIS packet sat in ITS queues and adds it to a correction field — so the variable part of the path subtracts itself out, packet by packet. What remains is propagation (stable) and residual asymmetry (small on a managed LAN). Same four-timestamp algebra as NTP underneath; the revolution is entirely in the quality of the inputs. Cost: PTP-capable NICs and switches — accuracy is bought, not computed.',
    invariant: 'PTP doesn\'t improve the estimator — it deletes the jitter from its inputs: silicon stamps + per-hop queue corrections.',
  };

  yield {
    state: table('Who needs which clock', [
      ['logs', 'log merging, tracing'],
      ['fin', 'finance (MiFID II / SEC)'],
      ['spanner', 'Spanner TrueTime'],
      ['grid', 'power grids & 5G'],
      ['ml', 'GPU training clusters'],
    ], [['needs', 'needs'], ['uses', 'uses']], [
      ['milliseconds', 'NTP — Distributed Tracing survives ms skew by design'],
      ['100µs traceable to UTC (regulation, not preference)', 'PTP with hardware stamps, audited'],
      ['a BOUND ε, not just accuracy', 'GPS + atomic per datacenter: ε ≈ 1–7ms, then commit-wait'],
      ['~1µs phase alignment to keep the physics in sync', 'PTP profiles built into the standard'],
      ['µs-aligned step traces to find stragglers', 'PTP increasingly standard in new clusters'],
    ]),
    highlight: { active: ['spanner:needs'] },
    explanation: 'The buyer\'s guide. Log pipelines and Distributed Tracing live happily on NTP — milliseconds of skew blur a waterfall chart, nothing more. European and US trading regulation makes 100µs-to-UTC a legal requirement, which singlehandedly put PTP hardware in every exchange colo. The most instructive row is Spanner\'s: TrueTime\'s superpower is not accuracy but a GUARANTEED interval — it would rather know "±4ms, certainly" than "±1ms, probably," because Clocks & Ordering: Lamport to TrueTime showed you can wait out a bound but you can\'t wait out a hope. That\'s the mature view of clock sync: pick the guarantee your correctness argument needs, then buy exactly that much physics.',
    invariant: 'Choose sync by the property your invariants consume: rough order → NTP, regulatory precision → PTP, provable bounds → TrueTime.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the four-timestamp trick') yield* fourTimestamps();
  else if (view === 'PTP & the nanosecond world') yield* ptpWorld();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/ntp-sync.gif', alt: 'Animated walkthrough of the ntp sync visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why clock sync exists',
      paragraphs: [
        'Distributed systems need clocks even though clocks are unreliable. Logs need timestamps. TLS certificates expire. Databases enforce leases. Schedulers fire timers. Tracing systems merge events from many machines. Humans want one timeline, but each computer has a quartz oscillator that drifts, a kernel that may pause work, and a network path with variable delay. The hard problem is not merely asking a trusted server for the time. The hard problem is learning how far your local clock is from that server while the message itself spent an unknown amount of time in flight.',
        'NTP, the Network Time Protocol, is the classic answer for internet and LAN synchronization. PTP, the Precision Time Protocol, is the answer when microseconds or nanoseconds matter enough to buy hardware support. Both protocols should be understood as measurement systems under uncertainty. They estimate offset, bound error, reject bad samples, and discipline the local clock gradually. They do not create perfect simultaneity. They provide an operationally useful approximation whose failure modes have to be included in the design of the distributed system above them.',
        {type: 'callout', text: 'Clock sync is a bounded measurement problem: the protocol estimates offset and uncertainty, and software above it must respect both.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Usno-amc.jpg', alt: 'Rack of reference clock equipment at the U.S. Naval Observatory', caption: 'A reference clock is only the top of the measurement chain; every client still has to estimate delay and uncertainty. Source: Wikimedia Commons, U.S. Naval Observatory, public domain.'},
      ],
    },
    {
      heading: 'The naive solution fails',
      paragraphs: [
        'The naive solution is to send a request to a time server and set the local clock to the time in the response. That is wrong because the response was delayed. If the packet took 40 ms to return, the server time is already old by the time the client sees it. A slightly less naive solution is to measure round-trip time and divide by two. That works only if the outbound and return delays are equal. Real networks violate that assumption through congestion, routing asymmetry, interrupt delays, switch queues, Wi-Fi contention, and virtualization noise.',
        'The other naive mistake is to jump the clock whenever an offset is found. Backward jumps can reorder logs, make build systems believe outputs predate inputs, break timeout calculations, and confuse lease protocols. Clock synchronization has two jobs: estimating offset and applying correction without destroying local monotonic order. Mature clients usually slew the clock, meaning they run it slightly faster or slower until the error drains away. Large errors may be stepped at controlled moments, but arbitrary rewinds are treated as dangerous.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Clock synchronization is not a request for truth; it is an error-bounded measurement. The protocol can observe local send time, remote receive time, remote send time, local receive time, and round-trip delay. It cannot directly observe how much of that delay happened in each direction.',
        'That is why every serious clock design carries an uncertainty story. NTP filters for low-delay samples because low delay leaves less room for hidden asymmetry. PTP moves timestamps into hardware because poor timestamp placement adds noise before the algebra even starts. TrueTime-style systems expose a bound because correctness can wait out a known bound but cannot wait out a hopeful point estimate.',
      ],
    },
    {
      heading: 'The four-timestamp mechanism',
      paragraphs: [
        'NTP uses four timestamps. The client records t1 when it sends a request. The server records t2 when it receives that request and t3 when it sends the reply. The client records t4 when the reply arrives. Timestamps t1 and t4 are on the client clock; t2 and t3 are on the server clock. From those four numbers, NTP estimates offset as ((t2 - t1) + (t3 - t4)) / 2. It estimates delay as (t4 - t1) - (t3 - t2), which is the round trip minus the time the server held the packet.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/NTP-Algorithm.svg', alt: 'NTP round trip delay and offset diagram', caption: 'The NTP algorithm diagram shows why the client needs both request and response timestamps to estimate delay and offset. Source: Wikimedia Commons, public domain.'},
        'The algebra is elegant because, with symmetric one-way delays, the unknown delay cancels out. The outbound leg sees delay plus offset. The return leg sees delay minus offset. Averaging those two expressions isolates offset. The protocol also subtracts server processing time because the server supplies both receive and transmit timestamps. That is the reason four timestamps are enough: the client can separate network flight time, server hold time, and relative clock position under the symmetric-path assumption.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The symmetric-path table proves the happy case. With a true offset of 120 ms and equal 40 ms legs, the computed offset is exactly 120 ms. The total network delay can be large and still cancel if the split is equal. This is why NTP can work surprisingly well with a simple exchange. It is not guessing the one-way delay. It is exploiting a symmetry assumption that removes the need to know it.',
        'The asymmetric-path table proves the fundamental wall. Keep the same 80 ms round trip, but make the outbound leg 70 ms and the return leg 10 ms. The estimator reports an offset 30 ms too high, exactly half the asymmetry. The timestamps cannot reveal the split. A fast client clock plus one path split can produce the same observations as a slower client clock plus another split. The round trip is observable; its division into one-way delays is not. NTP can bound and filter this error, but it cannot make asymmetry disappear by algebra alone.',
      ],
    },
    {
      heading: 'NTP defenses',
      paragraphs: [
        'Because NTP cannot directly observe asymmetry, it uses hierarchy, filtering, and voting. Stratum 0 devices are reference clocks such as GPS receivers or atomic clocks. Stratum 1 servers are attached to those references. Lower strata synchronize through the hierarchy, keeping most clients close to a stable source rather than sending every laptop to one global clock. Multiple servers give the client a way to reject falsetickers and prefer sources that agree.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Network_Time_Protocol_servers_and_clients.svg', alt: 'NTP stratum hierarchy of servers and clients', caption: 'The stratum hierarchy reduces blast radius by spreading time through layered sources instead of one universal server. Source: Wikimedia Commons, public domain.'},
        'The clock filter is especially important. Among recent exchanges, the lowest-delay samples are usually trusted more because they had less room for queueing and asymmetry. This is not naive averaging. A packet that round-tripped in 8 ms is not automatically correct, but it is less exposed to variable congestion than a packet that took 80 ms. Poll intervals also adapt as the local oscillator proves stable or unstable. The result is often millisecond-level accuracy on a LAN and worse but still useful accuracy over the open internet.',
      ],
    },
    {
      heading: 'PTP and hardware time',
      paragraphs: [
        'PTP attacks a different part of the error budget: timestamp quality. Ordinary software timestamps can be late by scheduler delay, driver queues, interrupt coalescing, virtualization pauses, and NIC buffering. The timestamp may record when a process ran, not when bits crossed the wire. Precision Time Protocol moves the stopwatch into hardware. A PTP-capable NIC can timestamp packets at or near the physical layer, removing much of the software stack from the measurement.',
        'PTP-aware switches can also participate. Transparent clocks measure how long a packet spent inside the switch and add that residence time to a correction field. Boundary clocks synchronize themselves and re-originate timing on each port. These mechanisms do not repeal the laws of asymmetry, but on a managed LAN with known paths they reduce variable queueing and measurement jitter enough to reach sub-microsecond accuracy, and sometimes tens of nanoseconds. The cost is real infrastructure: compatible NICs, switches, profiles, configuration, and monitoring.',
      ],
    },
    {
      heading: 'Where it helps and where it fails',
      paragraphs: [
        'NTP is enough for many systems. Log merging, monitoring, cache expiry, ordinary distributed tracing, and user-facing timestamps can tolerate milliseconds of skew. These systems should still design for uncertainty: traces should use causal context, leases should include margins, and metrics should not pretend that clocks are perfect. Google Spanner illustrates the deeper principle through TrueTime: correctness needs a bound on uncertainty, not just a hopeful point estimate. If the bound is known, software can wait it out.',
        'PTP is useful where timing is part of the product or the regulation. Financial markets may require traceable sub-millisecond or microsecond timestamps. Power grids, industrial control, telecom, audio/video production, and 5G can require phase alignment. GPU clusters can use better sync to correlate step traces and diagnose stragglers. The limits remain: asymmetric paths, bad reference clocks, leap-second policy disagreements, virtualized timestamp noise, and misconfigured hardware can all create false confidence. Clock sync is an engineered measurement chain, not a magic time oracle.',
        'Study Lamport clocks, vector clocks, Hybrid Logical Clocks, Distributed Tracing, Spanner TrueTime, TCP congestion control, quorum leases, and lease-based leader election next. The habit to build is simple: whenever a system uses time, ask whether it needs rough ordering, regulatory traceability, monotonic local behavior, or a proven uncertainty bound. Those are different requirements, and NTP, PTP, and TrueTime-style systems serve different parts of that design space.',
      ],
    },
  ],
};
