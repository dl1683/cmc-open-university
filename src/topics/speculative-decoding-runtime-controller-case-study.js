// Speculative decoding runtime controller: choose a draft method per traffic
// segment, watch acceptance and tail latency, and fall back quickly.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'speculative-decoding-runtime-controller-case-study',
  title: 'Speculative Decoding Runtime Controller Case Study',
  category: 'Systems',
  summary: 'A production serving case study: route requests among draft models, Medusa, EAGLE, Lookahead, n-gram speculation, and fallback using acceptance and latency ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['method router', 'fallback gates'], defaultValue: 'method router' },
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

function runtimeGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.6, y: 3.4, note: 'traffic' },
      { id: 'seg', label: 'seg', x: 2.0, y: 3.4, note: 'class' },
      { id: 'draft', label: 'dft', x: 3.8, y: 1.3, note: 'model' },
      { id: 'med', label: 'med', x: 3.8, y: 2.7, note: 'heads' },
      { id: 'eagle', label: 'egl', x: 3.8, y: 4.1, note: 'feat' },
      { id: 'look', label: 'look', x: 3.8, y: 5.5, note: 'pool' },
      { id: 'ver', label: 'ver', x: 5.7, y: 3.4, note: 'target' },
      { id: 'met', label: 'met', x: 7.3, y: 2.2, note: 'stats' },
      { id: 'fb', label: 'fb', x: 7.3, y: 4.8, note: 'plain' },
      { id: 'out', label: 'out', x: 9.0, y: 3.4, note: 'tokens' },
    ],
    edges: [
      { id: 'e-req-seg', from: 'req', to: 'seg' },
      { id: 'e-seg-draft', from: 'seg', to: 'draft' },
      { id: 'e-seg-med', from: 'seg', to: 'med' },
      { id: 'e-seg-eagle', from: 'seg', to: 'eagle' },
      { id: 'e-seg-look', from: 'seg', to: 'look' },
      { id: 'e-draft-ver', from: 'draft', to: 'ver' },
      { id: 'e-med-ver', from: 'med', to: 'ver' },
      { id: 'e-eagle-ver', from: 'eagle', to: 'ver' },
      { id: 'e-look-ver', from: 'look', to: 'ver' },
      { id: 'e-ver-met', from: 'ver', to: 'met' },
      { id: 'e-met-fb', from: 'met', to: 'fb' },
      { id: 'e-ver-out', from: 'ver', to: 'out' },
      { id: 'e-fb-out', from: 'fb', to: 'out' },
    ],
  }, { title });
}

function* methodRouter() {
  yield {
    state: runtimeGraph('Speculative method router'),
    highlight: { active: ['req', 'seg', 'draft', 'med', 'eagle', 'look', 'e-req-seg', 'e-seg-draft', 'e-seg-med', 'e-seg-eagle', 'e-seg-look'], found: ['ver'] },
    explanation: 'A production server should not enable one speculative method globally. It routes by traffic segment, model, temperature, output shape, memory headroom, and observed acceptance.',
    invariant: 'Speculation is a serving policy, not a model identity.',
  };

  yield {
    state: labelMatrix(
      'Routing table',
      [
        { id: 'code', label: 'code' },
        { id: 'json', label: 'json' },
        { id: 'chat', label: 'chat' },
        { id: 'agent', label: 'agent' },
        { id: 'hot', label: 'hot' },
      ],
      [
        { id: 'method', label: 'meth' },
        { id: 'why', label: 'why' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['EAGLE', 'acc', 'p95'],
        ['Medusa', 'shape', 'mask'],
        ['draft', 'cheap', 'qual'],
        ['look', 'copy', 'hit'],
        ['plain', 'var', 'safe'],
      ],
    ),
    highlight: { active: ['code:method', 'json:method', 'agent:method'], compare: ['chat:method'], found: ['hot:method'] },
    explanation: 'Different traffic wants different speculation. Code may reward EAGLE; constrained JSON may reward Medusa heads or draft models; repetitive agent tool calls may reward Lookahead or suffix-style pooling.',
  };

  yield {
    state: runtimeGraph('All methods report into the same verifier ledger'),
    highlight: { active: ['draft', 'med', 'eagle', 'look', 'ver', 'met', 'e-draft-ver', 'e-med-ver', 'e-eagle-ver', 'e-look-ver', 'e-ver-met'], found: ['out'] },
    explanation: 'The acceptance ledger normalizes method-specific details into common metrics: accepted tokens per target pass, verifier latency, rejected work, KV handoff, quality gate, and tail latency.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'traffic entropy', min: 0, max: 1 }, y: { label: 'best accepted tokens/pass', min: 0.8, max: 4 } },
      series: [
        { id: 'medusa', label: 'Medusa', points: [{ x: 0.1, y: 3.0 }, { x: 0.3, y: 2.6 }, { x: 0.5, y: 2.0 }, { x: 0.7, y: 1.5 }, { x: 0.9, y: 1.2 }] },
        { id: 'eagle', label: 'EAGLE', points: [{ x: 0.1, y: 3.4 }, { x: 0.3, y: 3.1 }, { x: 0.5, y: 2.4 }, { x: 0.7, y: 1.7 }, { x: 0.9, y: 1.2 }] },
        { id: 'look', label: 'Lookahead', points: [{ x: 0.1, y: 2.2 }, { x: 0.3, y: 2.0 }, { x: 0.5, y: 1.6 }, { x: 0.7, y: 1.2 }, { x: 0.9, y: 0.9 }] },
      ],
      markers: [
        { id: 'route', x: 0.42, y: 2.5, label: 'route' },
      ],
    }),
    highlight: { active: ['eagle', 'route'], compare: ['medusa', 'look'] },
    explanation: 'Traffic predictability changes the winner. The controller should learn by segment instead of assuming the highest headline speedup applies to every request.',
  };
}

function* fallbackGates() {
  yield {
    state: runtimeGraph('Fallback gates protect latency and correctness'),
    highlight: { active: ['ver', 'met', 'fb', 'out', 'e-ver-met', 'e-met-fb', 'e-fb-out'], compare: ['draft', 'med', 'eagle', 'look'] },
    explanation: 'Speculation must fail closed. If quality, latency, memory, or acceptance metrics leave the allowed band, the controller routes to plain target decoding.',
  };

  yield {
    state: labelMatrix(
      'Gate ledger',
      [
        { id: 'acc', label: 'acc' },
        { id: 'p95', label: 'p95' },
        { id: 'p99', label: 'p99' },
        { id: 'mem', label: 'mem' },
        { id: 'qual', label: 'qual' },
      ],
      [
        { id: 'now', label: 'now' },
        { id: 'min', label: 'min' },
        { id: 'act', label: 'act' },
      ],
      [
        ['2.4', '1.5', 'keep'],
        ['80', '120', 'keep'],
        ['280', '250', 'fb'],
        ['hot', 'ok', 'fb'],
        ['pass', 'pass', 'keep'],
      ],
    ),
    highlight: { active: ['acc:act', 'p95:act', 'qual:act'], removed: ['p99:act', 'mem:act'] },
    explanation: 'The controller should watch p95 and p99 separately. A method can improve average speed while hurting tail latency or memory pressure.',
  };

  yield {
    state: labelMatrix(
      'Complete case: mixed API traffic',
      [
        { id: 'a', label: 'JSON' },
        { id: 'b', label: 'code' },
        { id: 'c', label: 'chat' },
        { id: 'd', label: 'tool' },
      ],
      [
        { id: 'route', label: 'route' },
        { id: 'metric', label: 'metric' },
        { id: 'act', label: 'act' },
      ],
      [
        ['med', '2.1', 'keep'],
        ['egl', '3.0', 'keep'],
        ['dft', '1.2', 'plain'],
        ['look', '2.4', 'keep'],
      ],
    ),
    highlight: { active: ['a:act', 'b:act', 'd:act'], compare: ['c:route'], found: ['c:act'] },
    explanation: 'JSON, code, chat, and tool-call traffic get different speculation policies. Chat has low acceptance at high temperature, so the controller falls back to plain decoding for that segment.',
  };

  yield {
    state: runtimeGraph('Runtime decisions become training data for serving'),
    highlight: { active: ['met', 'seg', 'e-req-seg', 'e-ver-met'], found: ['out'], compare: ['fb'] },
    explanation: 'The controller ledger becomes the dataset for future routing: segment, method, acceptance, tail latency, memory pressure, quality checks, and fallback reason. Serving policy should be observable and reversible.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'method router') yield* methodRouter();
  else if (view === 'fallback gates') yield* fallbackGates();
  else throw new InputError('Pick a speculative-decoding runtime view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the router graph as a serving control plane. A request is classified into a traffic segment, routed to a speculation method, verified by the target model, measured, and either kept on that route or sent to fallback. Active nodes are live routing decisions, compare nodes are alternative methods, and found nodes are emitted tokens or metrics.',
        'The gate view shows that speculation is reversible. Accepted tokens per pass, p95, p99, memory, and quality flags decide whether a route stays enabled. The safe inference is that a failed gate returns the request class to plain target decoding.',
        {type:'callout', text:'The controller treats speculation as a reversible route, spending draft work only on traffic slices where acceptance and tail latency justify it.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A speculative decoding algorithm decides how one round accepts draft tokens. A runtime controller decides whether speculation should be used for this request at all. That distinction matters because production traffic is not one benchmark prompt.',
        'JSON extraction, code completion, chat, summarization, and tool-call scaffolds have different predictability. The controller exists to spend draft work only where the acceptance rate and latency budget justify it. It treats speculation as a serving policy rather than a model identity.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious production move is to enable the fastest method globally. A demo may show higher average tokens per second, and a single flag is easy to ship. This can work on a narrow traffic slice.',
        'It breaks under mixed traffic. A method that helps constrained JSON can waste work on high-temperature chat. A route that improves average latency can still hurt p99 by adding memory pressure or batch fragmentation.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that speculation has multiple bottlenecks. Proposal compute, verifier shape, memory footprint, cache handoff, scheduler behavior, and quality gates all matter. Accepted tokens per pass is necessary but not sufficient.',
        'The second wall is drift. A product change can alter schemas, prompt templates, or temperature settings. Yesterday route may keep running after its acceptance rate collapses unless the controller measures by segment and falls back quickly.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat every speculative method as a route with preconditions, parameters, metrics, and rollback. The route can choose draft length, method, enablement percentage, verifier batch shape, and fallback. It can also turn itself off when the measured slice no longer pays for speculation.',
        'Different methods become proposal engines behind the same verifier contract. Draft models, Medusa, EAGLE, Lookahead, and suffix speculation all need the target path to protect output semantics. The controller compares their economics under current service conditions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The request classifier reads model, endpoint, prompt shape, temperature, schema constraints, estimated output length, risk tier, and live capacity. It maps those features to a routing table row. The row selects a method and parameters if the gate is healthy.',
        'After generation, the acceptance ledger updates rolling metrics for that segment. If acceptance drops below threshold, p99 exceeds budget, memory gets hot, or quality checks fail, the controller lowers draft length, reduces enablement, switches method, or falls back. These are request-boundary decisions, so they are observable and reversible.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The controller works because acceptance clusters by traffic shape. Low-temperature boilerplate and structured outputs are more predictable than open-ended creative text. Segmenting traffic lets the system exploit predictability where it exists instead of averaging it away.',
        'Correctness comes from preserving the target verifier boundary. The controller may change the proposal method, but it does not let proposals bypass target acceptance. Fallback is correct because ordinary target decoding remains the baseline path.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost model includes proposal compute, extra model heads or draft model memory, verifier sequence shape, cache bookkeeping, batching effects, and operations work. A method that saves 30 ms on p50 but adds 80 ms to p99 is a bad route for user-facing traffic.',
        'With 10,000 requests per minute, a route that improves 70 percent of requests by 20 ms but hurts 5 percent by 300 ms can still look good on average. The controller must track slice-level p95 and p99, not only blended throughput. The behavior users feel is often the tail.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A runtime controller fits high-volume LLM serving where traffic has repeatable slices. It is useful for structured extraction, code generation, repeated tool-call formats, templated agents, and long decode-heavy responses.',
        'It also supports experiments and canaries. Teams can enable EAGLE for 5 percent of code traffic, Medusa for a JSON endpoint, and plain decoding for hot or risky traffic. The ledger becomes training data for the next routing policy.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when measurements are too coarse. A blended dashboard can hide the fact that enterprise JSON improved while consumer chat regressed. A route can also stay enabled because average acceptance is good even though one high-value segment is failing.',
        'It may be overkill for small models, short completions, prefill-bound workloads, or services already constrained by memory. The controller adds artifacts, dashboards, route rules, incident paths, and compatibility tests. If decode is not the bottleneck, this control plane optimizes the wrong layer.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A serving endpoint handles 40 percent JSON extraction, 30 percent code, 20 percent chat, and 10 percent tool-call scaffolds. The controller routes JSON to Medusa with k = 3, code to EAGLE with k = 4, tool scaffolds to Lookahead, and chat to plain target decoding above temperature 0.8.',
        'During one hour, JSON accepts 2.2 tokens per target pass at p99 180 ms, code accepts 3.1 at p99 240 ms, chat accepts 1.1 and falls back, and tool scaffolds accept 2.4. A schema change later drops tool acceptance to 0.9, so the controller disables Lookahead for that slice until the n-gram pool refreshes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with current vLLM and NVIDIA Triton speculative decoding docs, plus the Medusa, EAGLE, Lookahead, and speculative decoding papers. Serving support changes quickly, so verify available methods, batching interactions, and defaults in live documentation.',
        'Study the speculative decoding acceptance ledger, continuous batching, KV cache management, transformer inference rooflines, traffic segmentation, rollout gates, and canary analysis next. The controller is where algorithm papers meet production service behavior.',
      ],
    },
  ],
};
