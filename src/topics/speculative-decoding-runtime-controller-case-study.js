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
      heading: 'What it is',
      paragraphs: [
        'A speculative decoding runtime controller is the serving policy layer that decides whether a request should use a draft model, Medusa, EAGLE, Lookahead, n-gram or suffix speculation, or plain target decoding. It makes that decision from traffic shape and live metrics.',
        'Speculative Decoding Acceptance Ledger explains the token-level acceptance record. Medusa Tree Attention Candidate Mask Case Study, Lookahead Decoding N-Gram Pool Case Study, and EAGLE Feature Draft Tree Case Study explain method-specific proposal structures. This module explains the controller that chooses among them.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The controller stores a traffic-segment table, method registry, acceptance ledger, latency histogram, memory-pressure meter, quality gate, fallback reason table, and experiment assignment. A routing row maps model, temperature, prompt class, output schema, and traffic segment to a speculative method.',
        'The method registry should describe requirements: separate draft model, Medusa heads, EAGLE draft model, n-gram pool, suffix index, tree mask support, KV handoff, batching compatibility, and rollback behavior.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each request, the controller classifies traffic, checks current capacity, chooses a speculation method, runs target verification, logs accepted tokens per target pass, checks quality and tail latency, and updates the route. If metrics drift, it falls back to plain target decoding.',
        'This is a control-plane problem. The fastest method in a paper can be the wrong production method if it increases p99, consumes too much memory, breaks batching, or wins only on traffic that the service barely sees.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A serving endpoint handles JSON extraction, code generation, open-ended chat, and agent tool calls. JSON routes to Medusa because outputs are constrained and predictable. Code routes to EAGLE because feature drafting accepts longer branches. Tool-call text routes to Lookahead because repeated fragments hit the n-gram pool. High-temperature chat falls back to plain decoding because acceptance is low.',
        'The controller changes routes as metrics move. If EAGLE p99 rises under memory pressure, code temporarily falls back. If Lookahead pool hit rate drops after a product change, tool-call traffic switches to plain decoding until the pool relearns useful continuations.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The worst failure is silent regression: average speed improves while tail latency, memory pressure, or quality gets worse. The second failure is method lock-in: leaving a speculative path enabled after acceptance collapses. The controller needs explicit gates and reversible rollout.',
        'Do not compare methods on only accepted tokens per pass. Compare end-to-end latency, throughput, p99, memory, quality, scheduler impact, and operational complexity by traffic segment.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: vLLM speculative decoding at https://docs.vllm.ai/en/stable/features/speculative_decoding/, NVIDIA Triton speculative decoding at https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/tutorials/Feature_Guide/Speculative_Decoding/README.html, speculative decoding at https://arxiv.org/abs/2211.17192, Medusa at https://arxiv.org/abs/2401.10774, EAGLE at https://arxiv.org/abs/2401.15077, and Lookahead Decoding at https://arxiv.org/abs/2402.02057.',
        'Study next: Speculative Decoding Acceptance Ledger, Medusa Tree Attention Candidate Mask Case Study, EAGLE Feature Draft Tree Case Study, Lookahead Decoding N-Gram Pool Case Study, LLM Continuous Batching, Length-Aware Batching LLM Scheduler, and LLM Inference Scaling Playbook.',
      ],
    },
  ],
};
