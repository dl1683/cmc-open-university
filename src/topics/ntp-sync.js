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
      heading: `What it is`,
      paragraphs: [
        `NTP (Network Time Protocol) and PTP (Precision Time Protocol) measure a computer's clock offset — how far ahead or behind it runs — through an unknown network delay. NTP exchanges four timestamps (client sends t1, server echoes t2 and t3, client receives t4) to solve for both offset and delay simultaneously: offset = ((t2 − t1) + (t3 − t4)) / 2. On a symmetric path, the delay cancels exactly. PTP pushes accuracy from NTP's millisecond floor to nanoseconds by stamping packets in hardware (the NIC's physical layer) instead of software, eliminating scheduler and driver jitter.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The visualization shows the four-timestamp algebra in action: with a 120ms true offset and symmetric 80ms round trip (40ms each way), it recovers exactly 120ms. Switch to asymmetric 70ms out / 10ms back, and the estimate reads 150ms — off by 30ms, exactly half the asymmetry. No timestamp protocol can detect this error: a slow clock with a fast return path looks identical to a fast clock with a slow return path. The round-trip delay is observable; its split is invisible. Sync error ≤ delay/2 is the bedrock limit.`,
        `NTP defends through HIERARCHY (stratum 0 atomic clocks fan out to stratum 1–2 intermediate servers to stratum 3–4 clients, keeping paths short), FILTERING (trust only minimum-delay samples, which suffered less queueing and thus less asymmetry), and VOTING (multiple servers with outlier rejection). Result: milliseconds on a LAN, tens on the internet. PTP adds hardware timestamps on the NIC (deleting software jitter) and transparent clocks in switches (which measure and subtract their own queueing delay from each packet). Sub-microsecond accuracy follows; tens of nanoseconds with good hardware.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `NTP's algorithm is cheap — four timestamps, one division — but the system cost is high: multiple servers, constant daemons, and careful clock slewing (speeding/slowing at ≤500 ppm to never jump backward, which breaks logs and schedulers). For leap seconds, Google and AWS smear the extra second across 24 hours so midnight never repeats. PTP's cost is hardware: NIC and switch infrastructure. Once in place, accuracy improves by orders of magnitude because software timestamps are limited by scheduler noise (microseconds to milliseconds), while hardware stamps live at the wire itself.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Logs and "Distributed Tracing" use NTP — milliseconds of skew blur waterfall charts but don't break the system. Financial exchanges require 100-microsecond UTC precision by law (MiFID II), spurring PTP hardware everywhere. Google's Spanner (via "Clocks & Ordering: Lamport to TrueTime") proved the mature insight: don't chase accuracy; provide a GUARANTEED BOUND. TrueTime's "±4ms, certainly" lets code commit-wait safely. Power grids and 5G need ~1-microsecond alignment; GPU clusters use PTP to find synchronous-step stragglers.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `First trap: NTP measures relative accuracy (you and the server stay synchronized) not absolute correctness (deviation from UTC truth). Second: asymmetry is invisible. If outbound traffic routes via satellite (500ms) and returns via fiber (10ms), NTP reports an offset error of exactly (500 − 10) / 2 = 245 seconds — and no protocol change can fix it. You measure round-trip delay; you cannot measure its split. Third misconception: more samples approach truth. NTP's filter selects minimum-delay exchanges because they're least asymmetric — it's not statistics, it's trusting the quietest path.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `"Clocks & Ordering: Lamport to TrueTime" explains why clock sync matters and how TrueTime bounds the error. "Distributed Tracing" shows system design that tolerates NTP's limits. "How DNS Works" reveals the stratum delegation pattern both use. "TCP: Handshake & Congestion Control" explains why asymmetric delays exist and how queues and retransmission cause timing scatter.`,
      ],
    },
  ],
};
