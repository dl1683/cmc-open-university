// Speculative decoding in production: draft proposals, target verification,
// exact acceptance records, speedup math, cache handoff, and rollout gates.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'speculative-decoding-acceptance-ledger-case-study',
  title: 'Speculative Decoding Acceptance Ledger',
  category: 'AI & ML',
  summary: 'A production speculative-decoding case study: draft tokens, verify with the target model, preserve output distribution, track acceptance, and gate speedup.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['accept ledger', 'speed model', 'variants'], defaultValue: 'accept ledger' },
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

function specGraph(title) {
  return graphState({
    nodes: [
      { id: 'prefix', label: 'prefix', x: 0.7, y: 3.8, note: 'KV' },
      { id: 'draft', label: 'draft', x: 2.4, y: 3.8, note: 'cheap' },
      { id: 'props', label: 'tokens', x: 4.0, y: 2.4, note: 'k=4' },
      { id: 'target', label: 'target', x: 5.8, y: 3.8, note: 'verify' },
      { id: 'accept', label: 'accept', x: 7.6, y: 2.4, note: 'prefix' },
      { id: 'reject', label: 'reject', x: 7.6, y: 5.2, note: 'repair' },
      { id: 'emit', label: 'emit', x: 9.3, y: 3.8, note: 'exact' },
      { id: 'trace', label: 'trace', x: 10.7, y: 3.8, note: 'ledger' },
    ],
    edges: [
      { id: 'e-prefix-draft', from: 'prefix', to: 'draft', weight: 'state' },
      { id: 'e-draft-props', from: 'draft', to: 'props', weight: 'guess' },
      { id: 'e-props-target', from: 'props', to: 'target', weight: 'parallel' },
      { id: 'e-target-accept', from: 'target', to: 'accept', weight: 'match' },
      { id: 'e-target-reject', from: 'target', to: 'reject', weight: 'diff' },
      { id: 'e-accept-emit', from: 'accept', to: 'emit', weight: 'keep' },
      { id: 'e-reject-emit', from: 'reject', to: 'emit', weight: 'target tok' },
      { id: 'e-emit-trace', from: 'emit', to: 'trace', weight: 'metrics' },
    ],
  }, { title });
}

function* acceptLedger() {
  yield {
    state: specGraph('Draft, verify, accept, repair'),
    highlight: { active: ['prefix', 'draft', 'props', 'target', 'e-prefix-draft', 'e-draft-props', 'e-props-target'], found: ['trace'] },
    explanation: 'Speculative decoding is a controlled handoff. The draft model proposes several tokens cheaply. The target model scores the proposed continuation in one parallel pass and decides how many tokens are accepted.',
    invariant: 'Speculation changes latency, not the target model output distribution.',
  };

  yield {
    state: labelMatrix(
      'Acceptance ledger',
      [
        { id: 't0', label: 'tok0' },
        { id: 't1', label: 'tok1' },
        { id: 't2', label: 'tok2' },
        { id: 't3', label: 'tok3' },
        { id: 'bonus', label: 'bonus' },
      ],
      [
        { id: 'draft', label: 'draft' },
        { id: 'pD', label: 'pD' },
        { id: 'pT', label: 'pT' },
        { id: 'u', label: 'u' },
        { id: 'act', label: 'act' },
      ],
      [
        ['the', '.80', '.76', '.31', 'keep'],
        ['cat', '.62', '.70', '.44', 'keep'],
        ['sat', '.48', '.42', '.36', 'keep'],
        ['quickly', '.44', '.08', '.40', 'reject'],
        ['on', '', '.51', '', 'emit'],
      ],
    ),
    highlight: { active: ['t0:act', 't1:act', 't2:act'], compare: ['t3:act'], found: ['bonus:act'] },
    explanation: 'The ledger records draft probability, target probability, randomness for sampling, and action. Greedy verification is simpler; stochastic speculative sampling uses a modified rejection rule so the target distribution is preserved.',
  };

  yield {
    state: specGraph('A rejection still advances one target token'),
    highlight: { active: ['target', 'reject', 'emit', 'e-target-reject', 'e-reject-emit'], found: ['accept'], compare: ['draft'] },
    explanation: 'When the first mismatch appears, the system keeps the accepted prefix, discards later draft tokens, and emits a token from the target distribution. Even a failed round usually advances by at least one token.',
  };

  yield {
    state: labelMatrix(
      'KV handoff',
      [
        { id: 'draftkv', label: 'draft KV' },
        { id: 'targetkv', label: 'target KV' },
        { id: 'accepted', label: 'accepted' },
        { id: 'rejected', label: 'rejected' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['draft path', 'wasted'],
        ['target KV', 'stale'],
        ['append', 'slot bug'],
        ['discard', 'leak'],
        ['k,acc,lat', 'blind'],
      ],
    ),
    highlight: { active: ['targetkv:stores', 'accepted:stores', 'trace:stores'], compare: ['rejected:risk'] },
    explanation: 'KV cache state must follow accepted target tokens, not unverified draft guesses. The runtime should log proposed length, accepted length, repair token, target latency, and draft latency.',
  };
}

function* speedModel() {
  yield {
    state: plotState({
      axes: { x: { label: 'accept rate', min: 0, max: 1 }, y: { label: 'speedup', min: 1, max: 4.2 } },
      series: [
        { id: 'k2', label: 'k=2', points: [
          { x: 0.2, y: 1.1 }, { x: 0.4, y: 1.35 }, { x: 0.6, y: 1.75 }, { x: 0.8, y: 2.2 }, { x: 0.95, y: 2.6 },
        ] },
        { id: 'k4', label: 'k=4', points: [
          { x: 0.2, y: 1.05 }, { x: 0.4, y: 1.45 }, { x: 0.6, y: 2.15 }, { x: 0.8, y: 3.05 }, { x: 0.95, y: 3.8 },
        ] },
        { id: 'k8', label: 'k=8', points: [
          { x: 0.2, y: 0.95 }, { x: 0.4, y: 1.25 }, { x: 0.6, y: 2.0 }, { x: 0.8, y: 3.4 }, { x: 0.95, y: 4.1 },
        ] },
      ],
      markers: [
        { id: 'gate', x: 0.65, y: 2.2, label: 'ship' },
      ],
    }),
    highlight: { active: ['k4', 'gate'], compare: ['k8'] },
    explanation: 'Acceptance rate is the main speedup variable. Larger draft length only helps when accepted prefixes are long enough; otherwise the drafter and verification path spend work on tokens that are thrown away.',
  };

  yield {
    state: labelMatrix(
      'Draft length policy',
      [
        { id: 'creative', label: 'creative' },
        { id: 'code', label: 'code' },
        { id: 'json', label: 'schema' },
        { id: 'copy', label: 'copy' },
      ],
      [
        { id: 'temp', label: 'temp' },
        { id: 'k', label: 'k' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['high', '2', 'rejects'],
        ['low', '4', 'syntax'],
        ['low', '3', 'mask cost'],
        ['very low', '8', 'memory'],
      ],
    ),
    highlight: { active: ['code:k', 'json:k', 'copy:k'], compare: ['creative:risk'] },
    explanation: 'Draft length should be traffic-aware. Predictable code, copied boilerplate, and low-temperature JSON often accept longer drafts. Creative high-temperature generation rejects more and needs shorter speculation.',
  };

  yield {
    state: labelMatrix(
      'Exit metrics',
      [
        { id: 'acc', label: 'acc' },
        { id: 'lat', label: 'lat' },
        { id: 'mem', label: 'mem' },
        { id: 'qual', label: 'qual' },
        { id: 'tail', label: 'p99' },
      ],
      [
        { id: 'metric', label: 'm' },
        { id: 'ship', label: 'gate' },
      ],
      [
        ['mean', '>1.8'],
        ['ms/tok', 'down'],
        ['GB', 'fits'],
        ['dist', 'pass'],
        ['p99', 'ok'],
      ],
    ),
    highlight: { active: ['acc:metric', 'lat:metric', 'qual:metric'], compare: ['mem:ship'], found: ['tail:ship'] },
    explanation: 'The launch metric is accepted tokens per target pass at unchanged quality and acceptable p99. Reporting only average speedup hides memory pressure and tail regressions.',
  };
}

function* variants() {
  yield {
    state: labelMatrix(
      'Speculation variants',
      [
        { id: 'classic', label: 'classic' },
        { id: 'medusa', label: 'Medusa' },
        { id: 'eagle', label: 'EAGLE' },
        { id: 'look', label: 'Lookahead' },
      ],
      [
        { id: 'draft', label: 'draft' },
        { id: 'verify', label: 'verify' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['small LM', 'target', '2 models'],
        ['heads', 'tree', 'train heads'],
        ['features', 'target', 'aux model'],
        ['n-gram', 'target', 'more FLOPs'],
      ],
    ),
    highlight: { active: ['classic:draft', 'medusa:draft', 'eagle:draft'], compare: ['look:cost'] },
    explanation: 'The family has one shared contract: propose cheap future tokens, verify with the target path, and accept only what preserves the intended distribution or quality contract.',
  };

  yield {
    state: specGraph('Production needs a fallback path'),
    highlight: { active: ['trace', 'emit'], compare: ['draft'], found: ['target'] },
    explanation: 'If acceptance drops, draft latency rises, memory pressure spikes, or the verifier path faults, the system should fall back to ordinary target decoding immediately. Speculation is an optimization, not the only serving path.',
  };

  yield {
    state: labelMatrix(
      'Failure ledger',
      [
        { id: 'weak', label: 'draft' },
        { id: 'temp', label: 'temp' },
        { id: 'mem', label: 'OOM' },
        { id: 'mask', label: 'mask' },
        { id: 'batch', label: 'skew' },
      ],
      [
        { id: 'symptom', label: 'sym' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['short', 'distill'],
        ['reject', 'k--'],
        ['full', 'small'],
        ['slow', 'cfg'],
        ['p99', 'off'],
      ],
    ),
    highlight: { active: ['weak:fix', 'temp:fix', 'batch:fix'], compare: ['mask:symptom'] },
    explanation: 'Speculative decoding incidents are measurable: short accepted prefixes, high rejection rate, memory pressure, constraint-mask overhead, and batch fragmentation. Each needs a different repair.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'accept ledger') yield* acceptLedger();
  else if (view === 'speed model') yield* speedModel();
  else if (view === 'variants') yield* variants();
  else throw new InputError('Pick a speculative ledger view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Speculative decoding accelerates autoregressive generation by separating proposing from verifying. A cheap drafter proposes multiple future tokens. The target model evaluates that proposed continuation in one parallel pass. Accepted tokens advance the output; the first rejected position is repaired by the target model. The acceptance ledger records exactly what happened.',
        'The key promise is exactness. The original speculative decoding and speculative sampling papers show how to accelerate generation without changing the output distribution. That makes speculation different from approximation: speed is allowed to change, but the target model contract is not.',
      ],
    },
    {
      heading: 'Acceptance ledger',
      paragraphs: [
        'A production implementation should log the draft length, proposed tokens, draft probabilities, target probabilities, acceptance decision, repair token, target latency, draft latency, and accepted-prefix length. This is the data structure that turns a speedup claim into an inspectable serving event.',
        'KV cache handling is critical. Draft KV state can be temporary, but target KV state should advance only for accepted or target-emitted tokens. If unverified draft tokens leak into target state, the generation is no longer the target model path.',
      ],
    },
    {
      heading: 'Speed model',
      paragraphs: [
        'Speedup depends on accepted tokens per expensive target pass. A longer draft length helps only when the accepted prefix is often long. If the draft model is weak, the temperature is high, or constraints create frequent mismatches, the system spends work proposing tokens that are thrown away.',
        'The correct ship metric is not raw tokens per second in a friendly demo. Use accepted length distributions, milliseconds per output token, target p99, draft memory, fallback rate, and quality or distribution-equivalence checks on real traffic slices.',
      ],
    },
    {
      heading: 'Variants',
      paragraphs: [
        'Classic speculative decoding uses a separate small language model. Medusa adds extra future-token heads and verifies candidate trees with tree attention. EAGLE shifts drafting into feature prediction. Lookahead and other multi-token methods create candidate continuations without a separate full draft model. They differ in training cost, memory, kernel complexity, and acceptance behavior, but share the draft-then-verify shape.',
        'The fallback path should stay simple: ordinary target decoding. Speculation should be disabled automatically when acceptance drops, draft latency rises, memory pressure threatens batching, schema masks dominate, or protected quality slices regress.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Fast Inference from Transformers via Speculative Decoding at https://arxiv.org/abs/2211.17192, Accelerating Large Language Model Decoding with Speculative Sampling at https://arxiv.org/abs/2302.01318, Medusa at https://arxiv.org/abs/2401.10774, EAGLE at https://arxiv.org/abs/2401.15077, and EAGLE-2 at https://arxiv.org/abs/2406.16858.',
        'Study Speculative Decoding, Multi-Token Decoding, Early-Exit Transformer Layer Skipping, JSON Schema Constrained Decoding Token Mask, Knowledge Distillation, KV Cache, Transformer Inference Roofline, LLM Continuous Batching, and LLM Inference Scaling Playbook next.',
      ],
    },
  ],
};
