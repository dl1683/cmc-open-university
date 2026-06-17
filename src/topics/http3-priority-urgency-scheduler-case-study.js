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
      heading: 'Why this exists',
      paragraphs: [
        `A modern page is not one file. It is a dependency graph of HTML, CSS, JavaScript, fonts, images, API responses, video chunks, analytics, ads, and background refreshes. HTTP/3 can put many of those responses on independent QUIC streams, avoiding the TCP-level head-of-line blocking that hurt older multiplexing designs. But independence does not mean unlimited capacity. The connection still has congestion control, flow control, packet loss, round trips, and server-side readiness.`,
        `The scheduler has one practical job: decide which eligible bytes leave next. If it sends a background image before render-blocking CSS, the page paints late. If it sends every active stream equally, a critical hero image can compete with thumbnails and analytics during the most important first round trips. If it treats priority as absolute, low-urgency streams can starve and progressive content can become jerky. HTTP/3 priority scheduling exists because byte order is user experience.`,
        `RFC 9218 gives HTTP a compact way to express that intent. A request or response can carry a Priority field with urgency and incremental parameters. HTTP/3 can also carry PRIORITY_UPDATE frames on the control stream so priority can change after a response has started. The scheduler turns those signals into queues, eligibility checks, and release policy.`,
      ],
    },
    {
      heading: 'The naive design and the wall',
      paragraphs: [
        `The simplest scheduler is first-in, first-out: send bytes in the order responses become available. That fails because availability is not importance. A large image may be ready before a stylesheet, but the stylesheet may block layout. An analytics request may be easy to send, but it should not consume early congestion window space ahead of user-visible work.`,
        `The next simple scheduler is equal sharing across streams. Equal sharing sounds fair, yet it spends scarce early bytes on work that has unequal value. During page load, a kilobyte of CSS can be worth more than a kilobyte of below-the-fold image data. During interaction, an API response that unblocks input feedback can be worth more than a decorative asset. Equal sharing ignores the browser's knowledge of the render graph.`,
        `The opposite mistake is strict priority with no guardrails. If urgency 0 always drains completely before urgency 1, and urgency 1 always drains before urgency 2, lower classes can stall for too long. That harms progressive images, streaming responses, and background tasks that still need some progress. A useful scheduler is biased, not blind. It protects critical bytes while making measured progress on incremental or lower-urgency work when capacity allows.`,
        `The final naive error is sorting by priority without asking whether a stream can actually send. A high-urgency stream may be blocked because its QPACK header dependencies are not ready, its stream flow-control window is exhausted, the application has not produced more body bytes, or QUIC congestion control says the connection cannot put more data in flight. Priority ranks eligible bytes; it does not make ineligible bytes sendable.`,
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        `RFC 9218 replaces the complicated dependency tree model associated with HTTP/2 priority with extensible priority parameters. The main parameter is urgency, an integer from 0 through 7, where 0 is most urgent and 7 is least urgent. The other central parameter is incremental, a boolean signal that partial delivery is useful. A stylesheet is usually not incremental: the browser needs enough of it to parse and apply rules. A progressive image, media chunk stream, or long response may benefit from partial progress.`,
        `A practical implementation keeps one or more queues per urgency class, plus stream metadata: request id, response id, urgency, incremental flag, bytes queued, bytes sent, flow-control state, QPACK readiness, last update time, and starvation accounting. The scheduler checks the most urgent eligible work first, then uses round robin, deficit round robin, or a related fair policy within a class. Incremental streams can receive smaller slices so several visible resources advance together instead of one object monopolizing the connection.`,
        `Reprioritization is part of the model. A browser may discover that an image is the largest contentful paint candidate, that a below-the-fold image is not needed yet, or that an interaction response is now urgent. HTTP/3 PRIORITY_UPDATE lets the client change priority for a live response. The data structure therefore cannot be a static sorted list built at request start. It has to support moves between urgency buckets, stale update rejection, and traceable policy decisions.`,
      ],
    },
    {
      heading: 'How the mechanism works',
      paragraphs: [
        `Suppose a product page opens with HTML, CSS, a JavaScript bundle, a hero image, six thumbnails, a recommendations API call, and analytics. The browser or intermediary assigns urgency values. CSS might be urgency 0 because it blocks rendering. The hero image might be urgency 1 or 2 because it affects largest contentful paint. Thumbnails might be urgency 5 with incremental delivery if visible progress is useful. Analytics might be urgency 7 because it should wait for spare capacity.`,
        `When QUIC allows the server to send, the scheduler builds an eligible set. A stream is eligible only if headers can be emitted or decoded safely, application bytes are available, connection and stream flow-control credit exist, and congestion control allows more bytes in flight. The scheduler then chooses from the lowest urgency number first, applies per-class fairness, emits HTTP/3 DATA frames, and updates its accounting.`,
        `QPACK deserves special attention. HTTP/3 header compression can reference dynamic table entries. If a stream depends on encoder instructions the decoder has not received, that stream can be blocked. This is not the same as the network being full and not the same as priority being low. It is an eligibility failure. A good scheduler skips the blocked stream and sends another eligible stream rather than idling the connection while waiting for header state.`,
        `PRIORITY_UPDATE turns this from a static queue into a live control system. If the browser promotes the hero image after layout identifies it as important, the scheduler moves that response to a higher urgency bucket. If thumbnails become less important after the user scrolls elsewhere, they move down. Every move should be auditable: old priority, new priority, triggering event, time received, time applied, and effect on byte order.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The design works because it separates three decisions that are often confused. Priority answers value: which byte would help the user most if it could be sent now. Eligibility answers feasibility: which streams are actually allowed to send now. Congestion and flow control answer capacity: how many bytes can leave now. Keeping these decisions separate prevents the scheduler from treating a blocked high-priority stream as a reason to waste the connection.`,
        `Urgency buckets also match the browser's imperfect but useful knowledge. The browser knows which resources block rendering, which responses are tied to input, which images are likely visible, and which requests are background work. The server or CDN may know cache state, object size, and origin readiness. Priority fields are the meeting point between those views. They are hints to scheduling, not a guarantee that the network will ignore physics.`,
        `Incremental delivery solves a different problem from urgency. Some resources produce value only near completion. Others produce value as chunks arrive. If the scheduler understands that distinction, it can finish non-incremental critical objects quickly while still giving progressive media enough slices to look smooth once the critical path is safe.`,
      ],
    },
    {
      heading: 'Where it is used',
      paragraphs: [
        `The obvious setting is browser page load, especially through CDNs and edge proxies that terminate HTTP/3. The scheduler can protect CSS, fonts, render-critical scripts, interaction responses, and likely LCP images while delaying thumbnails, prefetches, ads, and analytics. The same ideas apply to web applications that keep many streams active over one connection.`,
        `It also matters for media and document workloads. A news page with many images wants visible images before below-the-fold images. A map application wants tiles near the viewport before tiles outside it. A large download running beside an API response should not make the interface feel stuck. In each case the scheduler is enforcing a product policy using transport-level constraints.`,
        `Intermediaries make the case harder. A browser, CDN, reverse proxy, and origin server may not all interpret or preserve priority signals the same way. If one hop ignores PRIORITY_UPDATE or collapses all streams into equal treatment, the trace at the client can look wrong even though the browser sent good hints. Production systems need end-to-end evidence, not only local queue state.`,
      ],
    },
    {
      heading: 'Tradeoffs and failure modes',
      paragraphs: [
        `Priority bugs rarely announce themselves as priority bugs. They show up as worse LCP, slow interaction feedback, uneven progressive image loading, or mysterious gaps in packet captures. Common causes include inverted urgency mapping, stale updates applied after completion, starvation of low urgency streams, overlarge DATA slices that make reprioritization sluggish, QPACK stalls mislabeled as scheduler choices, and missing telemetry about why a stream was selected.`,
        `The tradeoff is policy complexity. A simple scheduler is easier to reason about but wastes important early bytes. A heavily tuned scheduler can improve page metrics but become hard to debug, especially when browser hints, CDN policy, cache state, and origin behavior interact. Fairness also has several meanings: fairness to streams, fairness to resources, fairness to user-visible milestones, and fairness to tenants. The right policy depends on which outcome is being protected.`,
        `Evaluation should be tied to user-visible gates and scheduler evidence. Track p75 and p95 LCP, INP, first contentful paint, critical-byte ordering, per-urgency bytes sent over time, starvation time by class, number and timing of PRIORITY_UPDATE frames, QPACK blocked-stream time, congestion-window utilization, flow-control stalls, and cases where a high-urgency stream was skipped. A scheduler that improves traces but not user metrics is not done.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: RFC 9218 at https://datatracker.ietf.org/doc/rfc9218/, HTTP/3 RFC 9114 at https://www.rfc-editor.org/info/rfc9114/, QUIC RFC 9000 at https://datatracker.ietf.org/doc/rfc9000/, QPACK RFC 9204 at https://www.rfc-editor.org/info/rfc9204/, and Cloudflare HTTP/3 prioritization notes at https://blog.cloudflare.com/better-http-3-prioritization-for-a-faster-web/. Study HTTP/3 over QUIC, QUIC Transport Streams & Loss Recovery, QPACK Dynamic Table HTTP/3, Resource Hints, Binary Heap, Backpressure, TCP Congestion Control, Tail Latency, and Browser Rendering next.`,
      ],
    },
  ],
};
