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
        'The four-timestamp view shows a client and server trying to measure clock offset through a network. t1 and t4 are read on the client clock, while t2 and t3 are read on the server clock. The highlighted estimate is safe only when the outbound and return delays are equal or close enough for the required accuracy.',
        'The PTP view shows why timestamp placement matters. Software timestamps include scheduler, driver, and queue delay; hardware timestamps happen near the wire. A safe inference is that better clocks alone do not solve sync unless the measurement path also removes jitter.',
        {type: 'image', src: './assets/gifs/ntp-sync.gif', alt: 'Animated walkthrough of the ntp sync visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'callout', text: 'Clock sync is a bounded measurement problem: the protocol estimates offset and uncertainty, and software above it must respect both.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Usno-amc.jpg', alt: 'Rack of reference clock equipment at the U.S. Naval Observatory', caption: 'A reference clock is only the top of the measurement chain; every client still has to estimate delay and uncertainty. Source: Wikimedia Commons, U.S. Naval Observatory, public domain.'},
        'Distributed systems need time for logs, leases, TLS certificates, cache expiry, tracing, financial audit, and physical control. Each machine has its own oscillator, and that oscillator drifts. Clock synchronization exists to estimate how far a local clock is from a reference while messages spend unknown time in the network.',
        'NTP means Network Time Protocol, the standard internet protocol for millisecond-class time synchronization. PTP means Precision Time Protocol, the hardware-assisted protocol used when microseconds or nanoseconds matter. Both are measurement systems under uncertainty, not sources of perfect simultaneity.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to ask a time server for the current time and set the local clock to the reply. That fails because the reply is already old when it arrives. A packet that spends 40 ms in flight makes the returned timestamp 40 ms stale.',
        'A better first attempt is to measure round-trip time and divide by two. If the request took 40 ms out and 40 ms back, half the round trip is a good one-way estimate. This is reasonable on a symmetric path, but real networks create asymmetric queues, routes, interrupts, and virtualization pauses.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is invisible one-way delay. A client can measure the total round trip, but it cannot directly measure how much happened before the server saw the request and how much happened after the server sent the reply. Two different clock offsets and path splits can produce the same four timestamps.',
        'A second wall is safe correction. Jumping a clock backward can reorder logs, break timers, confuse build tools, and violate lease assumptions. A sync client must measure offset and apply correction while preserving useful local time behavior.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to turn clock sync into a bounded estimator. NTP does not know one-way delay, so it assumes symmetry, computes offset, and uses delay as an uncertainty signal. Low-delay samples are preferred because they leave less room for hidden queueing and asymmetry.',
        'PTP keeps the same broad estimator shape but improves the measurements. Hardware timestamping removes software jitter, and PTP-aware switches can report packet residence time. Accuracy is bought by reducing uncertainty in the inputs, not by pretending the algebra is magic.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/NTP-Algorithm.svg', alt: 'NTP round trip delay and offset diagram', caption: 'The NTP algorithm diagram shows why the client needs both request and response timestamps to estimate delay and offset. Source: Wikimedia Commons, public domain.'},
        'NTP records four timestamps. The client sends at t1, the server receives at t2, the server replies at t3, and the client receives at t4. Offset is estimated as ((t2 - t1) + (t3 - t4)) / 2, and delay is (t4 - t1) - (t3 - t2).',
        'The server processing time is removed because t2 and t3 are both known. With equal one-way delays, the outbound term contains delay plus offset and the return term contains delay minus offset. Averaging cancels the delay and isolates offset.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Network_Time_Protocol_servers_and_clients.svg', alt: 'NTP stratum hierarchy of servers and clients', caption: 'The stratum hierarchy reduces blast radius by spreading time through layered sources instead of one universal server. Source: Wikimedia Commons, public domain.'},
        'Clients then discipline the local clock. Small offsets are usually slewed, meaning the clock runs slightly faster or slower until the error drains away. Large offsets may be stepped at startup, while extreme offsets can cause the client to refuse correction because the local machine may be misconfigured.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is algebraic under a stated assumption. If outbound delay equals return delay, the unknown delay appears once with a plus sign and once with a minus sign in the offset formula. The two terms cancel, leaving the true server-minus-client offset.',
        'The protocol remains useful when the assumption is imperfect because it exposes delay as a risk signal. A sample with 8 ms round trip cannot hide more than 4 ms of one-way asymmetry, while an 80 ms sample can hide much more. Filtering, multiple servers, and outlier rejection reduce but do not eliminate that bound.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'NTP is cheap: one exchange is four timestamps and small packets, and polling often runs every 64 to 1024 seconds after clocks stabilize. The operational cost is not bandwidth; it is error handling, source selection, leap-second policy, and monotonic correction. Accuracy over the open internet is usually milliseconds to tens of milliseconds because path asymmetry dominates.',
        'PTP has higher infrastructure cost. Hardware timestamping needs capable NICs, switches, profiles, and monitoring. In return, a managed LAN can reach sub-microsecond accuracy because software jitter and switch residence time are removed or measured.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'NTP fits log ordering, metrics, ordinary distributed tracing, certificate validity, cache expiry, and user-facing timestamps. These systems should still design with clock uncertainty, but they rarely need nanosecond agreement. A trace waterfall can tolerate some skew if causal context is also present.',
        'PTP fits finance, telecom, power grids, industrial control, media production, and some GPU clusters. In those settings, timing is part of correctness, regulation, or physical coordination. Google Spanner-style systems add another lesson: sometimes the system needs a bound on uncertainty more than a single best estimate.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'NTP fails when the path is asymmetric beyond the tolerance of the application. It also fails when clients trust bad sources, leap-second policies disagree, virtual machines have noisy clocks, or operators allow time to step backward during normal service. The protocol cannot detect every false assumption from timestamps alone.',
        'PTP fails when the network is not controlled end to end. One unmanaged switch, software timestamp fallback, wrong profile, bad grandmaster, or asymmetric fiber path can erase the expected precision. Hardware time is a measurement chain, so one weak link can dominate the error budget.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Let the true server clock be 120 ms ahead of the client. The client sends at t1 = 1000.000, the path out is 40 ms, the server receives at t2 = 1000.160, waits 2 ms, replies at t3 = 1000.162, and the client receives at t4 = 1000.082. Offset = ((0.160) + (0.080)) / 2 = 0.120 seconds.',
        'Now keep the round trip 80 ms but make the path 70 ms out and 10 ms back. t2 becomes 1000.190, t3 becomes 1000.192, and t4 is still 1000.082. Offset = ((0.190) + (0.110)) / 2 = 0.150 seconds, which is 30 ms too high. The error is half the 60 ms asymmetry.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 5905 for NTPv4, the IEEE 1588 Precision Time Protocol standard, Google Spanner and TrueTime papers, and vendor documentation for hardware timestamping and leap smear behavior.',
        'Study Lamport Clocks, Vector Clocks, Hybrid Logical Clocks, Distributed Tracing, TCP Congestion Control, quorum leases, and Spanner TrueTime next. The transferable habit is to ask what time property the system consumes: rough order, UTC traceability, monotonic local behavior, or a proven uncertainty bound.',
      ],
    },
  ],
};
