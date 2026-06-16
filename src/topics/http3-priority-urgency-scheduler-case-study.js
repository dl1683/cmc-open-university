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
      heading: 'What it is',
      paragraphs: [
        'HTTP/3 priority scheduling is the layer that turns browser intent into an order for response bytes. QUIC gives HTTP/3 independent streams, but the server still has to decide whether the next congestion-window slot goes to CSS, a hero image, a progressive thumbnail, an API response, or background work.',
        'RFC 9218 defines an extensible HTTP priority scheme with an urgency parameter and an incremental parameter. Urgency ranges from 0 to 7, where 0 is most urgent. Incremental means the response can make useful progress when delivered in pieces instead of needing to finish before the next response receives bytes: https://datatracker.ietf.org/doc/rfc9218/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'A practical implementation is a small scheduling data structure: a stream table keyed by request stream id, one or more queues per urgency level, an incremental fair-share list inside each urgency class, and an eligibility check that consults app bytes, QPACK readiness, stream credit, connection credit, and congestion-window state.',
        'This is not the old HTTP/2 dependency tree. RFC 9114 notes that HTTP/3 itself does not provide the HTTP/2-style priority signaling mechanism, while priority remains important for performance: https://www.rfc-editor.org/info/rfc9114/. The modern scheme is simpler to encode and easier for intermediaries to forward or update.',
      ],
    },
    {
      heading: 'Complete case study: product page over HTTP/3',
      paragraphs: [
        'A product page has render-blocking CSS, a hero image, a font, six below-the-fold images, an interaction API response, and analytics. The browser sends initial priority signals and later reprioritizes the hero after layout discovers it is the LCP candidate. The edge server keeps urgency buckets and moves the hero stream from an incremental image bucket to a high-priority non-incremental bucket.',
        'The sender still obeys QUIC. RFC 9000 describes QUIC as providing flow-controlled streams for structured communication: https://datatracker.ietf.org/doc/rfc9000/. If connection flow control is exhausted, congestion says the pipe is full, or QPACK says a header block is waiting for a Required Insert Count, the scheduler must choose another eligible stream or stop.',
      ],
    },
    {
      heading: 'QPACK and priority',
      paragraphs: [
        'QPACK is a separate but adjacent source of stalls. RFC 9204 defines QPACK for HTTP/3 header compression and describes a design that reduces head-of-line blocking compared with HPACK: https://www.rfc-editor.org/info/rfc9204/. A high-urgency response whose headers wait on a missing dynamic-table insert is not schedulable yet.',
        'That is why the priority scheduler needs an eligibility check, not just sorted queues. If the top stream is QPACK-blocked, has no flow-control credit, or has no application bytes ready, the scheduler should continue with the next eligible stream rather than leaving capacity unused.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The common failures are inverted urgency, stale PRIORITY_UPDATE frames applied after a stream is done, intermediaries that ignore or overwrite priority, background work that starves forever, and observability that measures bytes but not the reason each stream was chosen. The result is a waterfall that looks random even though every layer is technically functioning.',
        'A good release gate tracks both user outcomes and scheduler evidence: p75 LCP, p75 INP, critical-resource start and finish times, QPACK blocked-stream counts, connection credit stalls, congestion-window reductions, accepted priority updates, and low-urgency starvation time.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study HTTP/3 over QUIC, QUIC Transport Streams & Loss Recovery, QPACK Dynamic Table HTTP/3, Resource Hints: Preload & Preconnect, Binary Heap, Backpressure & Flow Control, TCP Congestion Control, Tail Latency, and Browser Rendering next. For an operator view, Cloudflare has a practical explanation of HTTP/3 prioritization and the urgency/incremental choices behind page resources: https://blog.cloudflare.com/better-http-3-prioritization-for-a-faster-web/.',
      ],
    },
  ],
};
