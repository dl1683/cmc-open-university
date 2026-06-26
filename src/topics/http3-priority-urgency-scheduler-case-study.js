// HTTP/3 priority scheduling: RFC 9218 urgency buckets, incremental delivery,
// PRIORITY_UPDATE frames, QUIC congestion/flow-control budgets, and page-load gates.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'http3-priority-urgency-scheduler-case-study',
  title: 'HTTP/3 Priority Urgency Scheduler',
  category: 'Systems',
  summary: 'A scheduler case study for RFC 9218 HTTP priorities: urgency buckets, incremental streams, PRIORITY_UPDATE, QUIC credit, QPACK stalls, and page-load release gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['urgency queues', 'congestion budget', 'reprioritize audit'], defaultValue: 'urgency queues' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function priorityGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'browser', label: 'browser', x: 0.6, y: 4.0, note: notes.browser ?? 'fetches' },
      { id: 'hint', label: 'hints', x: 2.0, y: 2.2, note: notes.hint ?? 'prio' },
      { id: 'header', label: 'Priority', x: 2.0, y: 5.8, note: notes.header ?? 'u/i' },
      { id: 'control', label: 'control', x: 3.9, y: 4.0, note: notes.control ?? 'update' },
      { id: 'u0', label: 'u0', x: 5.8, y: 1.7, note: notes.u0 ?? 'css' },
      { id: 'u2', label: 'u2', x: 5.8, y: 3.6, note: notes.u2 ?? 'hero' },
      { id: 'u5', label: 'u5', x: 5.8, y: 5.5, note: notes.u5 ?? 'imgs' },
      { id: 'u7', label: 'u7', x: 5.8, y: 7.0, note: notes.u7 ?? 'bg' },
      { id: 'send', label: 'sender', x: 7.7, y: 4.0, note: notes.send ?? 'pick' },
      { id: 'quic', label: 'QUIC', x: 9.2, y: 4.0, note: notes.quic ?? 'credit' },
    ],
    edges: [
      { id: 'e-browser-hint', from: 'browser', to: 'hint', weight: 'link' },
      { id: 'e-browser-header', from: 'browser', to: 'header', weight: 'req' },
      { id: 'e-header-control', from: 'header', to: 'control', weight: 'init' },
      { id: 'e-control-u0', from: 'control', to: 'u0', weight: 'u=0' },
      { id: 'e-control-u2', from: 'control', to: 'u2', weight: 'u=2' },
      { id: 'e-control-u5', from: 'control', to: 'u5', weight: 'u=5' },
      { id: 'e-control-u7', from: 'control', to: 'u7', weight: 'u=7' },
      { id: 'e-u0-send', from: 'u0', to: 'send', weight: 'first' },
      { id: 'e-u2-send', from: 'u2', to: 'send', weight: 'next' },
      { id: 'e-u5-send', from: 'u5', to: 'send', weight: 'share' },
      { id: 'e-u7-send', from: 'u7', to: 'send', weight: 'idle' },
      { id: 'e-send-quic', from: 'send', to: 'quic', weight: 'frames' },
    ],
  }, { title });
}

function budgetGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'sched', label: 'sched', x: 0.8, y: 4.0, note: notes.sched ?? 'queues' },
      { id: 'cwnd', label: 'cwnd', x: 2.5, y: 1.9, note: notes.cwnd ?? 'pipe' },
      { id: 'flow', label: 'flow', x: 2.5, y: 4.0, note: notes.flow ?? 'credit' },
      { id: 'qpack', label: 'QPACK', x: 2.5, y: 6.1, note: notes.qpack ?? 'ready?' },
      { id: 'frame', label: 'frames', x: 4.6, y: 4.0, note: notes.frame ?? 'DATA' },
      { id: 'loss', label: 'loss', x: 6.4, y: 2.4, note: notes.loss ?? 'ACK gap' },
      { id: 'path', label: 'path', x: 6.4, y: 5.6, note: notes.path ?? 'RTT' },
      { id: 'client', label: 'client', x: 8.3, y: 4.0, note: notes.client ?? 'paint' },
      { id: 'gate', label: 'gate', x: 9.6, y: 4.0, note: notes.gate ?? 'LCP' },
    ],
    edges: [
      { id: 'e-sched-cwnd', from: 'sched', to: 'cwnd', weight: '' },
      { id: 'e-sched-flow', from: 'sched', to: 'flow', weight: '' },
      { id: 'e-sched-qpack', from: 'sched', to: 'qpack', weight: '' },
      { id: 'e-cwnd-frame', from: 'cwnd', to: 'frame', weight: 'allow' },
      { id: 'e-flow-frame', from: 'flow', to: 'frame', weight: 'allow' },
      { id: 'e-qpack-frame', from: 'qpack', to: 'frame', weight: 'headers' },
      { id: 'e-frame-loss', from: 'frame', to: 'loss', weight: 'may gap' },
      { id: 'e-frame-path', from: 'frame', to: 'path', weight: 'send' },
      { id: 'e-path-client', from: 'path', to: 'client', weight: '' },
      { id: 'e-client-gate', from: 'client', to: 'gate', weight: '' },
    ],
  }, { title });
}

function* urgencyQueues() {
  yield {
    state: priorityGraph('RFC 9218 turns priority into urgency plus incremental'),
    highlight: { active: ['browser', 'header', 'control', 'u0', 'u2', 'u5'], found: ['send'], compare: ['u7'] },
    explanation: 'HTTP extensible priorities use a small parameter set instead of an HTTP/2 dependency tree. Urgency runs from 0 to 7, where 0 is most urgent, and incremental tells the sender whether partial progress is useful.',
    invariant: 'Priority is an input to scheduling, not a promise that bytes will ignore congestion, flow control, or server work.',
  };

  yield {
    state: labelMatrix(
      'Priority params',
      [
        { id: 'u0', label: 'u0' },
        { id: 'u1', label: 'u1' },
        { id: 'u3', label: 'u3' },
        { id: 'u7', label: 'u7' },
        { id: 'inc', label: 'inc' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'use', label: 'use' },
      ],
      [
        ['top', 'CSS'],
        ['high', 'hero'],
        ['default', 'page img'],
        ['idle', 'bg'],
        ['stream', 'chunks'],
      ],
    ),
    highlight: { active: ['u0:use', 'u1:use'], found: ['inc:use'], compare: ['u7:use'] },
    explanation: 'A browser can express a render-critical stylesheet as very urgent, a hero image as high urgency, ordinary images near default, and background work as low urgency. Incremental delivery fits progressive images or streams where early chunks help.',
  };

  yield {
    state: labelMatrix(
      'Page-load ledger',
      [
        { id: 'css', label: 'CSS' },
        { id: 'hero', label: 'hero' },
        { id: 'font', label: 'font' },
        { id: 'img', label: 'imgs' },
        { id: 'ana', label: 'ana' },
      ],
      [
        { id: 'prio', label: 'prio' },
        { id: 'why', label: 'why' },
      ],
      [
        ['u=0', 'blocks'],
        ['u=1', 'LCP'],
        ['u=2', 'text'],
        ['u=5 i', 'prog'],
        ['u=7', 'later'],
      ],
    ),
    highlight: { active: ['css:prio', 'hero:prio'], found: ['img:prio'], compare: ['ana:prio'] },
    explanation: 'The scheduler ledger connects browser intent to server queues. It should say which resource got which priority, why that priority is justified, and whether the object benefits from incremental delivery.',
  };

  yield {
    state: priorityGraph('Sender drains lower urgency numbers before background work', { u0: 'CSS', u2: 'hero', u5: 'thumbs', u7: 'ads', send: 'DRR' }),
    highlight: { active: ['u0', 'u2', 'e-u0-send', 'e-u2-send', 'send'], found: ['u5'], removed: ['u7'] },
    explanation: 'A practical implementation can keep one queue per urgency, then use round-robin or deficit round-robin inside an urgency class. Low urgency work should advance when higher queues are empty or when starvation guards fire.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'ms', min: 0, max: 500 }, y: { label: 'KB', min: 0, max: 900 } },
      series: [
        { id: 'css', label: 'css', points: [{ x: 0, y: 0 }, { x: 80, y: 120 }, { x: 160, y: 120 }, { x: 500, y: 120 }] },
        { id: 'hero', label: 'hero', points: [{ x: 0, y: 0 }, { x: 120, y: 80 }, { x: 260, y: 520 }, { x: 500, y: 520 }] },
        { id: 'imgs', label: 'imgs', points: [{ x: 0, y: 0 }, { x: 220, y: 40 }, { x: 380, y: 180 }, { x: 500, y: 260 }] },
      ],
      markers: [
        { id: 'lcp', x: 260, y: 520, label: 'LCP' },
      ],
    }),
    highlight: { active: ['css', 'hero', 'lcp'], found: ['imgs'] },
    explanation: 'The desired waterfall is not equal sharing. CSS completes early, the hero image reaches LCP quickly, and incremental thumbnails make visible progress only after the critical bytes have room.',
  };
}

function* congestionBudget() {
  yield {
    state: budgetGraph('Priority queues still fit through QUIC budgets'),
    highlight: { active: ['sched', 'cwnd', 'flow', 'qpack', 'frame'], found: ['client'], compare: ['loss'] },
    explanation: 'The HTTP/3 scheduler chooses which stream frames to send next, but QUIC decides how many bytes can be in flight and how much stream or connection credit exists. Priority ranks eligible bytes; it does not create capacity.',
    invariant: 'A stream is schedulable only when its headers are ready, it has flow-control credit, and the connection can send more bytes.',
  };

  yield {
    state: labelMatrix(
      'Send gates',
      [
        { id: 'cwnd', label: 'cwnd' },
        { id: 'flow', label: 'flow' },
        { id: 'qpack', label: 'QPACK' },
        { id: 'app', label: 'app' },
        { id: 'loss', label: 'loss' },
      ],
      [
        { id: 'asks', label: 'asks' },
        { id: 'block', label: 'block' },
      ],
      [
        ['pipe?', 'full'],
        ['credit?', 'zero'],
        ['ready?', 'RIC wait'],
        ['bytes?', 'empty'],
        ['repair?', 'PTO'],
      ],
    ),
    highlight: { active: ['cwnd:asks', 'flow:asks', 'qpack:asks'], removed: ['qpack:block'], compare: ['loss:block'] },
    explanation: 'The high-priority queue can be blocked by missing QPACK dynamic-table state, stream credit, or application bytes. A robust scheduler then looks for the next eligible stream instead of idling the connection.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'RTT', min: 0, max: 8 }, y: { label: 'KB', min: 0, max: 640 } },
      series: [
        { id: 'cwnd', label: 'cwnd', points: [{ x: 0, y: 120 }, { x: 1, y: 180 }, { x: 2, y: 260 }, { x: 3, y: 380 }, { x: 4, y: 300 }, { x: 6, y: 420 }, { x: 8, y: 560 }] },
        { id: 'crit', label: 'crit', points: [{ x: 0, y: 0 }, { x: 1, y: 110 }, { x: 2, y: 220 }, { x: 3, y: 340 }, { x: 4, y: 420 }, { x: 8, y: 420 }] },
        { id: 'bulk', label: 'bulk', points: [{ x: 0, y: 0 }, { x: 2, y: 20 }, { x: 4, y: 90 }, { x: 6, y: 210 }, { x: 8, y: 360 }] },
      ],
      markers: [
        { id: 'loss', x: 4, y: 300, label: 'loss' },
      ],
    }),
    highlight: { active: ['cwnd', 'crit'], found: ['bulk'], compare: ['loss'] },
    explanation: 'When congestion tightens, the scheduler should preserve the critical queue first and let bulk incremental objects absorb most of the slowdown. That is a policy choice layered above QUIC recovery.',
  };

  yield {
    state: budgetGraph('QPACK stalls are not transport stalls', { qpack: 'RIC wait', frame: 'skip', client: 'paint CSS', gate: 'no stall' }),
    highlight: { removed: ['qpack'], active: ['sched', 'cwnd', 'flow', 'frame'], found: ['client', 'gate'] },
    explanation: 'If a request stream is blocked waiting for a QPACK insert, other streams with literal, static, or already-known headers can still send. The scheduler needs QPACK state in its eligibility check.',
  };

  yield {
    state: labelMatrix(
      'Budget policy',
      [
        { id: 'crit', label: 'crit' },
        { id: 'inc', label: 'inc' },
        { id: 'bulk', label: 'bulk' },
        { id: 'idle', label: 'idle' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['finish', 'LCP'],
        ['share', 'smooth'],
        ['fill', 'fair'],
        ['pause', 'save'],
      ],
    ),
    highlight: { active: ['crit:rule', 'crit:gate'], found: ['inc:rule'], compare: ['bulk:gate'] },
    explanation: 'The release policy is measurable: finish critical objects, stream progressive objects fairly, fill spare capacity with bulk work, and prove that background bytes do not regress LCP, INP, or error rates.',
  };
}

function* reprioritizeAudit() {
  yield {
    state: priorityGraph('PRIORITY_UPDATE changes a response while it is live', { header: 'u=5,i', control: 'PRIO_UPD', u2: 'hero', u5: 'old', send: 'move' }),
    highlight: { active: ['header', 'control', 'u5', 'u2', 'send'], found: ['e-control-u2'], compare: ['u7'] },
    explanation: 'RFC 9218 defines initial Priority signals and reprioritization. In HTTP/3, a client can send PRIORITY_UPDATE on the control stream to change the urgency or incremental flag for a response that is already in flight.',
  };

  yield {
    state: labelMatrix(
      'Update ledger',
      [
        { id: 'hero', label: 'hero' },
        { id: 'img', label: 'img' },
        { id: 'api', label: 'api' },
        { id: 'ad', label: 'ad' },
      ],
      [
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after' },
        { id: 'why', label: 'why' },
      ],
      [
        ['u=5 i', 'u=1', 'LCP'],
        ['u=3', 'u=5 i', 'below'],
        ['u=3', 'u=0', 'input'],
        ['u=7', 'same', 'idle'],
      ],
    ),
    highlight: { active: ['hero:after', 'api:after'], found: ['img:after'], compare: ['ad:after'] },
    explanation: 'A reprioritization ledger is small but powerful: request id, old priority, new priority, trigger, timestamp, and outcome. It lets teams distinguish intentional browser changes from server-side scheduling bugs.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'invert', label: 'invert' },
        { id: 'stale', label: 'stale' },
        { id: 'starve', label: 'starve' },
        { id: 'ignore', label: 'ignore' },
        { id: 'qpack', label: 'QPACK' },
      ],
      [
        { id: 'sym', label: 'sym' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['bad u', 'test'],
        ['late', 'drop'],
        ['bg wait', 'floor'],
        ['proxy', 'trace'],
        ['RIC', 'lit'],
      ],
    ),
    highlight: { active: ['invert:fix', 'stale:fix', 'starve:fix'], found: ['ignore:fix'], compare: ['qpack:sym'] },
    explanation: 'Priority bugs often look like vague page slowness. The audit should catch inverted urgency, stale updates after a stream finished, starvation of incremental work, intermediaries that ignore signals, and QPACK stalls misattributed to priority.',
  };

  yield {
    state: budgetGraph('Complete case: CDN page-load gate', { sched: 'u table', cwnd: 'ok', flow: 'ok', qpack: 'ok', frame: 'CSS+hero', client: 'paint', gate: 'pass' }),
    highlight: { active: ['sched', 'frame', 'client', 'gate', 'e-client-gate'], found: ['cwnd', 'flow', 'qpack'] },
    explanation: 'Case study: a CDN applies RFC 9218 priorities for a product page. CSS and the API response for a user interaction outrank the hero; the hero outranks thumbnails; thumbnails are incremental; ads wait for spare capacity.',
  };

  yield {
    state: labelMatrix(
      'Ship gate',
      [
        { id: 'lcp', label: 'LCP' },
        { id: 'inp', label: 'INP' },
        { id: 'bytes', label: 'bytes' },
        { id: 'stall', label: 'stall' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'watch', label: 'watch' },
        { id: 'pass', label: 'pass' },
      ],
      [
        ['p75', 'faster'],
        ['p75', 'same'],
        ['crit', 'front'],
        ['QPACK', 'bounded'],
        ['updates', 'visible'],
      ],
    ),
    highlight: { active: ['lcp:pass', 'bytes:pass'], found: ['trace:pass'], compare: ['stall:watch'] },
    explanation: 'The rollout gate should track user-visible outcomes and scheduler evidence: p75 LCP, p75 INP, critical-byte ordering, bounded QPACK stalls, and traces that show accepted priority updates.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'urgency queues') yield* urgencyQueues();
  else if (view === 'congestion budget') yield* congestionBudget();
  else if (view === 'reprioritize audit') yield* reprioritizeAudit();
  else throw new InputError('Pick an HTTP/3 priority scheduler view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a scheduler, not as a network speed test. Active nodes are the stream or gate being considered now, visited nodes have already been checked for eligibility, and found nodes are streams that can actually send bytes. A safe inference is: a lower urgency number wins only after congestion control, flow control, application bytes, and QPACK header readiness all say the stream is eligible.',
        {type:'callout', text:'HTTP/3 priority is a queueing policy over eligible bytes, not a way to bypass congestion, flow control, or header readiness.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An HTTP/3 connection may carry HTML, CSS, JavaScript, images, fonts, API responses, and background beacons at the same time. HTTP/3 runs over QUIC, a transport protocol that gives each response its own stream, but all streams still share one path through the network. Priority exists because early bytes are scarce and not all bytes have the same effect on the page.',
        'A stylesheet may be 12 KB and block first paint, while a product image may be 900 KB and only matter after layout starts. If the sender spends the first congestion window on the image, the browser waits even though the network was busy. Priority is the policy that says which eligible bytes should leave first when the connection cannot send everything.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first approach is first-in, first-out scheduling: send whichever response becomes ready first. That is easy to implement and it works on pages where all resources have similar value. It fails on real pages because readiness is not importance; an image can be ready before the CSS that makes any image visible.',
        'The second approach is equal sharing across all active streams. Equal sharing feels fair because every stream gets progress, and it avoids total starvation. It still wastes early capacity because a 1 KB slice of analytics code can delay a 1 KB slice of render-blocking CSS.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that the sender must solve two different problems at once. Eligibility asks whether a stream can send now; priority asks whether it should send before other eligible streams. A scheduler that waits on blocked high-priority CSS can leave the congestion window unused while lower-priority eligible bytes sit ready.',
        'HTTP/2 tried to express priority with a dependency tree, where streams had parents and weights. That tree was expressive, but browsers, servers, and intermediaries disagreed on the tree shape and many deployments flattened it. A priority language that cannot survive the CDN and proxy path becomes an implementation detail, not a web platform contract.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'RFC 9218 replaces the tree with two small parameters. Urgency is an integer from 0 to 7, where 0 is most urgent, and incremental is a boolean that says whether partial delivery is useful. The system gives up some expressiveness so every hop can preserve and act on the same signal.',
        'The data structure is a set of urgency queues, not a dependency graph. A stream can move from one queue to another when a PRIORITY_UPDATE arrives, and the scheduler can scan from urgency 0 to urgency 7 when bytes become available. The important invariant is that priority orders eligible streams only; it never overrides transport gates.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each stream keeps metadata: stream id, urgency, incremental flag, queued bytes, flow-control credit, QPACK readiness, and completion state. On each send opportunity, QUIC first decides whether the connection can put more bytes in flight. The HTTP/3 scheduler then checks streams in urgency order and skips any stream with no bytes, no credit, or blocked headers.',
        'Non-incremental responses usually drain within their urgency class because partial delivery does not help much. Incremental responses, such as progressive images or video chunks, can share using a round-robin or deficit round-robin rule. Reprioritization is a queue move: if an image becomes the largest-contentful-paint candidate, the browser can promote it from u=3 to u=1 without rebuilding a tree.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a separation argument. QUIC owns capacity and flow control, QPACK owns header readiness, and the priority scheduler owns ordering among streams that pass those tests. Because the scheduler skips blocked streams instead of waiting on them, it never treats importance as sendability.',
        'The urgency invariant also makes behavior predictable across intermediaries. A CDN that sees u=0 for CSS and u=5 with incremental for thumbnails does not need the browser dependency tree to act sensibly. It only needs to preserve the same two fields and apply the same rule: lower urgency number first, with incremental sharing inside a class.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The scheduling data structure is cheap. With eight fixed urgency queues, insertion, removal, and priority updates are O(1), and choosing the next urgency class is bounded by eight checks. If a connection grows from 50 active streams to 100, the expensive part is not the queue number; it is the extra eligibility checks and accounting per stream.',
        'The real cost is operational behavior. Small send chunks make reprioritization responsive but add loop overhead and packetization decisions. Strict priority improves critical resource completion but can starve background work unless the implementation adds a starvation guard or incremental sharing policy.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Browsers use HTTP priority to protect render-blocking resources during page load. A CDN edge can honor the same hints even when the origin is slower or unaware of the browser render graph. The pattern also fits media players, map tiles, and API-heavy web apps where user-triggered responses should outrun background refreshes.',
        'The useful access pattern is many independent responses sharing one constrained path. Priority is less valuable when there are only one or two objects, or when the bottleneck is server CPU rather than network scheduling. It is most visible on lossy mobile paths and image-heavy pages where early bytes decide perceived progress.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when priority is confused with authorization to send. A u=0 stream can still be blocked by QPACK, flow control, missing application bytes, or a closed congestion window. Good traces must separate scheduler-deferred time from QPACK-blocked time and congestion-blocked time.',
        'It also fails when intermediaries strip or ignore the signal. A browser can send perfect hints, but a CDN or reverse proxy can flatten them into equal sharing. Over-large data frames create another failure: a stream may be reprioritized, but the sender has already committed too many bytes before checking for updates.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the first send window is 14,600 bytes. The page has 12,000 bytes of CSS at u=0, an 80,000 byte hero image at u=1, a 40,000 byte async script at u=2, two 20,000 byte thumbnails at u=5 with incremental set, and an 8,000 byte analytics script at u=7. If all but one thumbnail are eligible, the scheduler sends 12,000 bytes of CSS, then the remaining 2,600 bytes to the hero image.',
        'On the next round trip, assume the window grows to 29,200 bytes and the QPACK-blocked thumbnail becomes eligible. The hero still wins because u=1 is lower than u=2, u=5, and u=7, so it receives the whole 29,200 bytes. Only after the hero drains does the scheduler send the script and then slice the thumbnails, which means visible page milestones finish before background work consumes capacity.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are RFC 9218 for Extensible Priorities for HTTP, RFC 9114 for HTTP/3, RFC 9000 for QUIC, and RFC 9204 for QPACK. Study QUIC stream loss recovery next to understand eligibility, QPACK dynamic tables to understand header blocking, and deficit round-robin to understand incremental sharing. Then compare this topic with browser rendering and largest-contentful-paint measurement so the priority policy is tied to user-visible outcomes.',
      ],
    },
  ],
};