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
        'The urgency queues view traces how HTTP/3 priority parameters route response bytes into buckets and then through the sender. Active nodes are the resource or queue the scheduler is evaluating now. Found nodes are streams that have been selected for sending. Compare nodes show work that is deferred or idle.',
        {
          type: 'diagram',
          text: [
            'Priority flow:',
            '',
            '  browser --[req]--> Priority header --[u/i]--> control',
            '       |                                          |',
            '       +--[hints]---> link rel                    +--> u0 (CSS)    --+',
            '                                                  +--> u2 (hero)   --+--> sender --> QUIC',
            '                                                  +--> u5 (imgs,i) --+',
            '                                                  +--> u7 (bg)     --+',
          ].join('\n'),
          label: 'Urgency classes partition streams; the sender drains lower numbers first',
        },
        'The congestion budget view adds the three gates every stream must pass before bytes leave: congestion window (cwnd), stream/connection flow-control credit, and QPACK header readiness. Active nodes show the gate being checked. Removed nodes show a blocked gate. Found nodes show streams that pass all gates and reach the client.',
        'In matrix frames, active cells highlight current policy or parameter values. Compare cells mark the idle or deferred case. At each frame, ask: which stream was chosen, why it was eligible, and what would happen if the gate order changed.',
        {type:'callout', text:'HTTP/3 priority is a queueing policy over eligible bytes, not a way to bypass congestion, flow control, or header readiness.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'The order in which bytes arrive is user experience.',
          attribution: 'RFC 9218 design motivation',
        },
        'A modern web page is not one file. A typical e-commerce product page issues 80-120 HTTP requests: HTML, CSS, JavaScript bundles, fonts, a hero image, product thumbnails, API responses for recommendations and pricing, analytics beacons, ad scripts, and third-party widgets. HTTP/3 runs over QUIC, which gives each response its own stream. Losing a packet on one stream no longer blocks every other stream the way TCP head-of-line blocking did in HTTP/1.1 and HTTP/2.',
        'But stream independence does not mean unlimited capacity. The connection still has one congestion window, shared flow-control credit, round-trip latency, and server-side readiness constraints. When the congestion window allows 14 KB after the TLS handshake (a typical initial cwnd of 10 segments at ~1,460 bytes each), the scheduler must decide which of those 80+ streams gets the first bytes. Send a render-blocking stylesheet first and the page can begin layout. Send a background analytics beacon first and the user stares at a white screen for an extra round trip.',
        'HTTP/3 priority scheduling exists to solve this: given limited pipe capacity and unequal resource value, choose which eligible bytes leave next so that user-visible milestones (first paint, largest contentful paint, interaction readiness) happen as early as the network allows.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'HTTP/2 already had a priority system: a dependency tree where each stream declared a parent and a weight. The browser could express "this CSS stream is the parent of this image stream, so finish CSS first" by building a tree of dependencies.',
        {
          type: 'table',
          headers: ['Approach', 'Mechanism', 'Why teams reach for it'],
          rows: [
            ['FIFO', 'Send bytes in response-ready order', 'Zero complexity, no metadata to track'],
            ['Equal sharing', 'Round-robin across all active streams', 'Feels fair, easy to implement'],
            ['HTTP/2 dependency tree', 'Weighted tree of parent-child stream relationships', 'Expressive, already standardized in RFC 7540'],
          ],
        },
        'The dependency tree was expressive in theory. A browser could model complex relationships: "finish CSS before any images, but share bandwidth equally among images, and give JavaScript twice the weight of fonts." The tree could represent any scheduling policy.',
        'In practice, it failed. Building a correct dependency tree required the browser and server to agree on an implicit tree structure that was never clearly specified. Chrome, Firefox, and Safari built different trees for the same page. Intermediaries (CDNs, reverse proxies, load balancers) often could not represent or forward the tree faithfully. Many servers ignored the tree entirely and fell back to FIFO or equal sharing. Patrick Meenan measured in 2019 that fewer than 10% of HTTP/2 servers implemented priority correctly.',
        {
          type: 'note',
          text: 'The HTTP/2 dependency tree was not a bad idea poorly implemented. It was an idea whose complexity exceeded the coordination capacity of the ecosystem. Every hop in the request chain needed to maintain a per-connection tree, and no two implementations agreed on the shape.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Four failure modes block the obvious approaches.',
        {
          type: 'bullets',
          items: [
            'FIFO fails because availability is not importance. A large image may be ready before a 2 KB stylesheet, but the stylesheet blocks layout. Every byte of image data sent before the stylesheet delays first paint.',
            'Equal sharing fails because scarce early bytes have unequal value. During page load, 1 KB of CSS can be worth more than 1 KB of below-the-fold image data. Equal sharing ignores the browser\'s knowledge of the render dependency graph.',
            'Strict priority with no guardrails fails because lower-urgency streams can starve indefinitely. Progressive images, streaming API responses, and background tasks still need some progress. A user watching a page load sees thumbnails freeze while CSS and JavaScript monopolize the pipe.',
            'Sorting by priority without checking eligibility fails because a high-urgency stream may be blocked. Its QPACK header dependencies may not be decoded yet, its stream flow-control window may be exhausted, the application may not have produced body bytes, or QUIC congestion control may forbid more bytes in flight. Priority ranks eligible bytes; it does not make ineligible bytes sendable.',
          ],
        },
        'The HTTP/2 dependency tree suffered from all four: its complexity discouraged correct implementation, so most deployments fell back to FIFO or equal sharing. When it was implemented, the tree structure made it hard to express "finish this first, but give that some progress" without elaborate weight arithmetic.',
        {
          type: 'code',
          language: 'text',
          text: [
            'HTTP/2 dependency tree for a typical page (Chrome circa 2018):',
            '',
            '  stream 0 (root)',
            '    +-- stream 1 (CSS, weight 256)',
            '    |     +-- stream 3 (JS bundle, weight 220)',
            '    |     +-- stream 5 (font, weight 220)',
            '    +-- stream 7 (hero img, weight 220)',
            '    |     +-- stream 9 (thumb-1, weight 110)',
            '    |     +-- stream 11 (thumb-2, weight 110)',
            '    +-- stream 13 (analytics, weight 32)',
            '',
            'Firefox built a completely different tree for the same page.',
            'Most CDNs flattened the tree to equal sharing.',
            'Result: priority was a fiction the ecosystem could not sustain.',
          ].join('\n'),
          label: 'The dependency tree was correct in the browser and lost at the CDN',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {
          type: 'quote',
          text: 'Replace the dependency tree with two parameters that every implementation can preserve: urgency (an integer) and incremental (a boolean).',
          attribution: 'RFC 9218 design principle',
        },
        'RFC 9218 (Extensible Priorities for HTTP) defines a compact priority model. Urgency is an integer from 0 (most urgent) to 7 (least urgent), defaulting to 3. Incremental is a boolean (default false) that tells the sender whether partial delivery is useful for this response. Together, these two parameters replace the entire dependency tree.',
        {
          type: 'table',
          headers: ['Urgency', 'Typical mapping', 'Incremental?', 'Scheduling effect'],
          rows: [
            ['0', 'Render-blocking CSS, critical sync JS', 'No', 'Finish before anything else sends'],
            ['1', 'Likely LCP image, key font', 'No', 'Send immediately after u=0 drains'],
            ['2', 'Async JS, important API response', 'No', 'Next tier after LCP resources'],
            ['3 (default)', 'General images, deferred scripts', 'Sometimes', 'Fair share after higher tiers'],
            ['4', 'Below-the-fold content', 'Yes', 'Progressive delivery, share bandwidth'],
            ['5', 'Visible thumbnails, lazy images', 'Yes', 'Small slices so several advance together'],
            ['6', 'Speculative prefetch', 'No', 'Only when higher queues are empty'],
            ['7', 'Analytics, ads, background sync', 'No', 'Spare capacity only'],
          ],
        },
        'The key engineering decision: simplicity over expressiveness. The dependency tree could model any scheduling policy. Urgency plus incremental can model most useful policies and every intermediary can preserve two structured-header parameters without maintaining a per-connection tree. A CDN that receives "u=0" and "u=5, i" knows exactly what to do: finish the first before sharing bandwidth among the second.',
        'Reprioritization is built into the model. HTTP/3 defines PRIORITY_UPDATE frames on the control stream. If the browser discovers mid-load that an image is the LCP candidate, it sends a PRIORITY_UPDATE promoting that stream from u=3 to u=1. The scheduler moves the stream between urgency buckets without rebuilding a tree. The data structure is a set of queues, not a tree, so moves are O(1).',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The scheduler maintains one queue per urgency level (8 queues for u=0 through u=7) plus per-stream metadata.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Per-stream metadata in the scheduler',
            'const streamEntry = {',
            '  streamId:       42,',
            '  urgency:        2,          // 0-7, lower = more urgent',
            '  incremental:    false,       // partial delivery useful?',
            '  bytesQueued:    84200,       // app bytes waiting to send',
            '  bytesSent:      0,           // bytes already emitted',
            '  flowCredit:     65535,       // stream-level flow control',
            '  qpackReady:     true,        // headers decodable?',
            '  lastUpdateTime: 1719014400,  // last PRIORITY_UPDATE received',
            '  starvationMs:   0,           // time since last byte sent',
            '};',
          ].join('\n'),
          label: 'Each stream carries enough state for eligibility and fairness checks',
        },
        'On each send opportunity (when QUIC allows bytes in flight), the scheduler runs three checks in order:',
        {
          type: 'bullets',
          items: [
            'Capacity check: is the congestion window (cwnd) open? Is connection-level flow-control credit available? If not, no stream can send regardless of urgency.',
            'Eligibility check per stream: does this stream have application bytes queued? Is its stream-level flow-control credit positive? Are its QPACK header dependencies resolved? A stream that fails any check is skipped, not waited on.',
            'Selection: among eligible streams, pick from the lowest urgency number first. Within a class, non-incremental streams finish before incremental ones start sharing. Incremental streams within a class use deficit round-robin (DRR) with a configurable quantum so several progressive resources advance visibly.',
          ],
        },
        {
          type: 'diagram',
          text: [
            'Scheduler decision on each send opportunity:',
            '',
            '  cwnd open? ---no---> WAIT for ACKs',
            '      |',
            '     yes',
            '      |',
            '      v',
            '  conn flow credit? ---no---> WAIT for WINDOW_UPDATE',
            '      |',
            '     yes',
            '      |',
            '      v',
            '  for u = 0 to 7:',
            '    for each stream in queue[u]:',
            '      QPACK ready?  ---no---> skip',
            '      stream credit? ---no---> skip',
            '      app bytes?    ---no---> skip',
            '      |',
            '     yes to all',
            '      |',
            '      v',
            '  SEND DATA frames (up to quantum for incremental, full drain for non-incremental)',
            '  UPDATE accounting (bytesSent, flowCredit, starvation timers)',
          ].join('\n'),
          label: 'Priority selects among eligible streams; it never creates eligibility',
        },
        'QPACK blocking deserves special attention. HTTP/3 uses QPACK for header compression. QPACK can reference dynamic table entries sent on a unidirectional encoder stream. If a request stream needs a dynamic entry the decoder has not yet received, that stream is "blocked" at the QPACK level. This is not a transport stall (the network is fine) and not a priority issue (the stream may be u=0). It is a header-decoding dependency. A correct scheduler skips the QPACK-blocked stream and sends another eligible stream rather than idling the entire connection.',
        'PRIORITY_UPDATE handling: when the client sends a PRIORITY_UPDATE frame on the control stream, the scheduler removes the affected stream from its current urgency queue and inserts it into the new one. The update carries a Prioritized Element ID (the stream ID or push ID) and the new priority field value. If the update arrives after the stream has already finished, the scheduler discards it. If two updates arrive for the same stream, the later one wins. Every update should be logged: stream ID, old urgency, new urgency, timestamp, and trigger reason.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness of the scheduler rests on separating three decisions that naive approaches conflate.',
        {
          type: 'table',
          headers: ['Decision', 'Question answered', 'Mechanism', 'Owner'],
          rows: [
            ['Priority', 'Which byte would help the user most right now?', 'Urgency parameter (0-7) + incremental flag', 'Browser / application'],
            ['Eligibility', 'Which streams can actually send right now?', 'QPACK readiness, stream flow credit, app bytes available', 'Transport + application layer'],
            ['Capacity', 'How many bytes can leave right now?', 'Congestion window, connection flow-control credit', 'QUIC transport'],
          ],
        },
        'Separating these prevents a common scheduler bug: treating a blocked high-priority stream as a reason to idle the connection. If u=0 CSS is QPACK-blocked, a naive scheduler might wait for it since nothing else is "more important." A correct scheduler recognizes that eligibility and priority are orthogonal -- it sends u=2 hero image bytes instead of wasting the open congestion window.',
        'Urgency buckets also match the browser\'s imperfect but useful knowledge of the render graph. The browser knows which resources block rendering (CSS, sync JS), which images are likely LCP candidates (above-the-fold, large), and which requests are background work (analytics, prefetch). The server or CDN may know cache state, object size, and origin response time. Priority parameters are the meeting point. Neither party has complete information, but structured hints beat no hints.',
        {
          type: 'note',
          text: 'Incremental delivery solves a different problem from urgency. A stylesheet produces value only near completion -- the browser needs the full CSSOM. A progressive JPEG produces value as chunks arrive -- early chunks show a blurry preview that sharpens. Marking a stream as incremental tells the scheduler to give it small slices interleaved with other incremental streams, rather than finishing one before starting the next.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A product page requests 7 resources over one HTTP/3 connection. Initial cwnd is 14,600 bytes (10 segments). RTT is 50 ms.',
        {
          type: 'table',
          headers: ['Stream', 'Resource', 'Size', 'Priority', 'QPACK ready?'],
          rows: [
            ['S1', 'style.css', '12 KB', 'u=0', 'Yes'],
            ['S2', 'app.js (async)', '45 KB', 'u=2', 'Yes'],
            ['S3', 'hero.webp', '85 KB', 'u=1', 'Yes'],
            ['S4', 'thumb-1.jpg', '18 KB', 'u=5, i', 'Yes'],
            ['S5', 'thumb-2.jpg', '22 KB', 'u=5, i', 'No (QPACK blocked)'],
            ['S6', 'recs API', '3 KB', 'u=2', 'Yes'],
            ['S7', 'analytics.js', '8 KB', 'u=7', 'Yes'],
          ],
        },
        {
          type: 'code',
          language: 'text',
          text: [
            'RTT 0 (0 ms): cwnd = 14,600 B. Eligible: S1, S2, S3, S4, S6, S7. (S5 QPACK blocked.)',
            '  Lowest urgency number with eligible streams: u=0 (S1 = 12 KB).',
            '  S1 non-incremental: drain fully. Send 12,288 B of CSS.',
            '  Remaining cwnd: 14,600 - 12,288 = 2,312 B.',
            '  Next eligible u=1: S3 hero. Send 2,312 B of hero.',
            '  cwnd exhausted. Wait for ACKs.',
            '',
            'RTT 1 (50 ms): ACKs arrive. cwnd grows to ~21,900 B (slow start).',
            '  S1 complete. Remove from queues.',
            '  S5 QPACK resolved (encoder instructions arrived). Now eligible.',
            '  Lowest eligible: u=1 (S3 hero, 82,688 B remaining). Non-incremental: drain.',
            '  Send 21,900 B of hero. cwnd exhausted.',
            '',
            'RTT 2 (100 ms): cwnd ~32,850 B.',
            '  S3 hero: 60,788 B remaining. Still u=1, still highest eligible.',
            '  Send 32,850 B of hero. cwnd exhausted.',
            '',
            'RTT 3 (150 ms): cwnd ~49,275 B.',
            '  S3 hero: 27,938 B remaining. Send all 27,938 B. S3 complete.',
            '  Remaining cwnd: 21,337 B.',
            '  Next eligible: u=2 (S2 app.js 45 KB, S6 recs API 3 KB).',
            '  S6 is small, non-incremental: send 3,072 B. S6 complete.',
            '  Remaining: 18,265 B. Send to S2 app.js.',
            '',
            'RTT 4 (200 ms): CSS done, hero done, API done. LCP fires.',
            '  S2 app.js continues draining.',
            '  Once S2 complete, u=5 incremental streams share:',
            '  DRR quantum = 4 KB. S4 gets 4 KB, S5 gets 4 KB, alternate.',
            '  S7 analytics (u=7) waits until u=5 empties or starvation guard fires.',
          ].join('\n'),
          label: 'Each RTT: check eligibility, pick lowest urgency, drain or share, update accounting',
        },
        'Key observations: CSS finishes in RTT 0 because it is small and u=0. The hero image takes RTTs 0-3 because it is large and u=1. The API response slots in immediately after the hero because it is small and u=2. Thumbnails share bandwidth only after all higher-urgency non-incremental work completes. Analytics waits last. If the browser promotes thumb-1 to u=1 via PRIORITY_UPDATE (perhaps the user scrolled), thumb-1 would jump ahead of app.js at RTT 3.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Time cost', 'Space cost', 'What grows'],
          rows: [
            ['Stream insertion', 'O(1) -- append to urgency queue', '1 entry per active stream', 'Linear in concurrent streams'],
            ['Stream selection', 'O(1) amortized -- check queues 0-7 in order', 'None', 'Constant (8 urgency levels fixed)'],
            ['PRIORITY_UPDATE', 'O(1) -- remove from old queue, insert in new', 'None extra', 'Constant per update'],
            ['Eligibility check', 'O(1) per stream -- 3 boolean checks', 'Per-stream metadata', 'Linear in concurrent streams'],
            ['DRR within a class', 'O(1) amortized per round', 'Deficit counter per stream', 'Linear in streams at that urgency'],
            ['Full scheduling pass', 'O(S) worst case where S = active streams', 'Queue heads + metadata', 'Rarely exceeds ~100 streams per connection'],
          ],
        },
        'The scheduler itself is cheap. Eight queues, each a doubly-linked list, with O(1) insert, remove, and move operations. Per-stream metadata is a fixed-size record. The practical cost is not in scheduling but in the infrastructure around it: QPACK state tracking, flow-control window accounting, congestion-window management, and telemetry logging.',
        'Doubling the number of concurrent streams doubles the eligibility-check work per scheduling pass but does not change the urgency-selection cost (always 8 buckets). In practice, connections rarely sustain more than 100 concurrent streams, so the total scheduling overhead per send opportunity is negligible compared to packet I/O and TLS encryption.',
        {
          type: 'note',
          text: 'The real cost of HTTP/3 priority is organizational, not computational. Getting browsers, servers, CDNs, and intermediaries to all honor the same two-parameter signal across every hop requires coordination. The dependency tree failed not because tree operations are expensive but because the ecosystem could not agree on tree shape. Urgency and incremental succeed because two integers are hard to misinterpret.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'CDN page-load optimization: Cloudflare, Fastly, and Akamai implement RFC 9218 at their edge servers. When a browser sends urgency hints, the CDN scheduler protects CSS and LCP images during early round trips, measurably improving LCP. Cloudflare reported up to 37% LCP improvement on pages where priority was correctly applied versus equal-share fallback.',
            'Browser resource scheduling: Chrome (from version 105), Firefox (from version 113), and Safari assign urgency values based on resource type and render-criticality. Chrome uses u=0 for render-blocking CSS, u=1 for fonts and preloaded images, u=2 for async scripts, u=3 for general images with incremental, and u=7 for prefetch and background sync.',
            'Media streaming: a video player over HTTP/3 can mark manifest requests as u=0, active segment downloads as u=1 with incremental, and prefetched future segments as u=4. This ensures the player never stalls on a manifest while a prefetch is consuming bandwidth.',
            'Map tile loading: map applications mark viewport-center tiles as u=1 and peripheral tiles as u=4 with incremental. As the user pans, PRIORITY_UPDATE promotes newly-centered tiles and demotes tiles that have scrolled out of view.',
            'API-heavy SPAs: single-page applications that keep one HTTP/3 connection for API calls can mark user-triggered fetch responses as u=1 and background data refresh as u=5, ensuring interaction feedback is never delayed by polling.',
          ],
        },
        'Intermediaries are the stress test. A request may traverse browser, CDN edge, CDN shield, reverse proxy, and origin server. If any hop ignores or strips the Priority header, downstream scheduling is blind. Production systems need end-to-end priority tracing, not just local queue metrics.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Priority signal path through a CDN:',
            '',
            '  Browser                 CDN Edge              Origin',
            '  -------                 --------              ------',
            '  GET /style.css          receives u=0          may or may not',
            '  Priority: u=0           schedules u=0 first   honor the signal',
            '                          in its egress queue',
            '',
            '  GET /hero.webp          receives u=1          if origin ignores,',
            '  Priority: u=1           schedules after u=0   CDN still schedules',
            '                                                its cached copy correctly',
            '',
            '  PRIORITY_UPDATE         CDN must process      origin never sees this',
            '  stream=hero, u=0        and re-sort its       (PRIORITY_UPDATE is',
            '                          egress queue          hop-by-hop in HTTP/3)',
          ].join('\n'),
          label: 'PRIORITY_UPDATE is hop-by-hop: each intermediary must implement it independently',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Priority bugs rarely announce themselves. They surface as worse LCP, slow interaction feedback, uneven progressive image loading, or mysterious gaps in waterfall charts. The root causes are specific.',
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Root cause', 'Detection'],
          rows: [
            ['Inverted urgency', 'Analytics loads before CSS', 'Server or CDN maps resource types to wrong urgency values', 'Compare resource waterfall against expected urgency order'],
            ['Stale PRIORITY_UPDATE', 'No effect on load order', 'Update arrives after stream is already complete', 'Log update timestamps versus stream completion times'],
            ['Low-urgency starvation', 'Thumbnails never appear', 'Strict priority drains u=0-2 forever; no starvation guard', 'Track time-since-last-byte per stream per urgency class'],
            ['QPACK misattribution', 'High-priority stream delayed', 'Stream blocked on QPACK dynamic table, not on priority', 'Distinguish QPACK-blocked time from scheduler-deferred time in traces'],
            ['Intermediary stripping', 'Priority has no effect', 'A proxy in the chain drops or ignores Priority headers', 'End-to-end priority header echo test'],
            ['Overlarge DATA frames', 'Reprioritization is sluggish', 'Scheduler commits to large chunks before checking for updates', 'Measure time between PRIORITY_UPDATE receipt and byte-order change'],
          ],
        },
        'The deeper tradeoff is policy complexity versus debuggability. A simple scheduler (strict urgency, no starvation guard, no incremental slicing) is easy to reason about but wastes early bytes and starves low-urgency work. A heavily tuned scheduler (per-class quantums, starvation floors, incremental DRR, QPACK-aware skip logic) can measurably improve page metrics but becomes hard to debug when browser hints, CDN policy, cache state, and origin behavior interact.',
        {
          type: 'note',
          text: 'Fairness has several meanings in this context: fairness to streams (equal bytes per unit time), fairness to resources (finish critical objects first), fairness to user-visible milestones (LCP before TTI before full load), and fairness to tenants (multi-tenant CDN sharing a connection). The right policy depends on which outcome the system is optimizing for. A scheduler that improves waterfall traces but not p75 LCP is not done.',
        },
        'Evaluation must tie scheduler evidence to user-visible metrics. Track p75 and p95 LCP, INP, first contentful paint, critical-byte completion order, per-urgency bytes-over-time curves, starvation time by class, PRIORITY_UPDATE accept/reject counts, QPACK blocked-stream duration, cwnd utilization, and flow-control stalls. A/B test the scheduler against equal-share and FIFO baselines on real traffic.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'RFC 9218 -- Extensible Priorities for HTTP: https://datatracker.ietf.org/doc/rfc9218/ -- the canonical specification defining urgency, incremental, and PRIORITY_UPDATE.',
            'RFC 9114 -- HTTP/3: https://www.rfc-editor.org/info/rfc9114/ -- defines HTTP/3 framing, streams, and how priority parameters are carried.',
            'RFC 9000 -- QUIC: A UDP-Based Multiplexed and Secure Transport: https://datatracker.ietf.org/doc/rfc9000/ -- the transport layer that provides independent streams, congestion control, and flow control.',
            'RFC 9204 -- QPACK: Field Compression for HTTP/3: https://www.rfc-editor.org/info/rfc9204/ -- header compression with dynamic table, explaining why streams can be QPACK-blocked.',
            'Cloudflare blog -- Better HTTP/3 Prioritization for a Faster Web: https://blog.cloudflare.com/better-http-3-prioritization-for-a-faster-web/ -- production deployment results and implementation lessons.',
            'Robin Marx -- HTTP/3 prioritization analysis: https://h3.edm.uhasselt.be/ -- academic measurement of browser and server priority behavior across implementations.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Study next'],
          rows: [
            ['Prerequisite', 'TCP Congestion Control -- understand cwnd, slow start, and loss recovery before studying QUIC scheduling'],
            ['Prerequisite', 'Binary Heap / Priority Queue -- the data structure behind urgency bucket selection and DRR'],
            ['Transport layer', 'QUIC Transport Streams and Loss Recovery -- how QUIC provides the independent streams that HTTP/3 schedules'],
            ['Header compression', 'QPACK Dynamic Table -- why header dependencies can block streams independently of priority'],
            ['Browser rendering', 'Browser Critical Rendering Path -- how CSS, fonts, and JS blocking create the urgency hierarchy'],
            ['Scheduling pattern', 'Deficit Round-Robin -- the fair-queuing algorithm used within urgency classes for incremental streams'],
            ['Performance metric', 'Largest Contentful Paint -- the user-visible milestone that priority scheduling most directly affects'],
            ['Case study', 'Backpressure -- how flow-control signals propagate upstream when a receiver cannot consume fast enough'],
          ],
        },
      ],
    },
  ],
};

