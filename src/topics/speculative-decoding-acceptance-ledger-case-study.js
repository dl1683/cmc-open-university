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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as one speculative decoding round. The prefix is the text already accepted, the draft path proposes cheap future tokens, the target model verifies them, and the runtime either accepts a prefix or repairs the first rejection. Active nodes are doing the current step, compare nodes are discarded guesses, and found nodes are emitted target-compatible tokens.',
        'The ledger matrix is the important artifact. It records draft probability, target probability, random draw when sampling is used, action, repair token, latency, and cache movement. The safe inference is that target KV cache can advance only over tokens justified by the target path.',
        {type:'callout', text:'The ledger protects exactness by making every draft token either target-approved, target-repaired, or discarded before the cache advances.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Autoregressive decoding produces text one token at a time. The target model is the large model whose output contract the service wants to preserve. Each new token normally needs one expensive target forward pass, so decode latency grows with output length.',
        'Speculative decoding exists to reduce target passes without replacing the target model. A cheaper proposal path guesses several future tokens. The target model verifies those guesses in parallel and keeps only the prefix allowed by the decoding rule.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious way to go faster is to serve a smaller model. That reduces latency, but it changes quality, calibration, and output distribution. It is substitution, not exact acceleration.',
        'Another obvious path is to let a helper guess tokens and keep them when they look plausible. That is unsafe because plausible text may not match the target decoder. The service needs a verifier rule that preserves the target contract.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is exactness under latency pressure. The target decoder owns the distribution, but the runtime wants to advance several tokens per target pass. If a rejected draft token leaks into output or cache, the system has silently changed the decoder.',
        'The production wall is traffic variation. Low-temperature code may accept long draft prefixes, while creative chat rejects quickly. A single draft length can create speedup on one slice and p99 regression on another.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate proposal from authority. The draft path proposes k tokens, and the target path decides how many form a valid prefix. After the first rejection, later draft tokens are discarded because they depend on an invalid prefix.',
        'The acceptance ledger is the data structure that makes this exact. It records every proposed token, verification probability, acceptance decision, repair token, emitted count, and cache update. The ledger turns a speed trick into an auditable serving protocol.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A round starts from the current accepted prefix. The drafter generates k candidate tokens cheaply. The target model scores the prefix plus those candidates in one verifier pass, which reveals whether each proposed next token can be accepted under greedy or stochastic rules.',
        'For greedy decoding, the accepted prefix matches the target choices until the first mismatch. For stochastic speculative sampling, acceptance uses draft and target probabilities so the final distribution remains the target distribution. The first rejection is repaired by drawing from a target-compatible correction path.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is that the target model remains the only authority for emitted tokens. Accepted draft tokens are kept only when the verifier rule permits them. Rejected positions are replaced by target-compatible tokens, and later draft guesses are discarded.',
        'Speedup comes from advancing more than one output position per target pass. If a round accepts three draft tokens and emits one target repair or bonus token, one expensive verifier pass advances four positions. The ledger proves that latency changed while the target contract did not.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost depends on acceptance rate and draft overhead. With k = 4 and average accepted prefix 3, the target may advance about 4 tokens per verifier pass including a repair or bonus token. If average accepted prefix falls to 0.4, the drafter spends most of its work on discarded guesses.',
        'Memory and batching also change behavior. The verifier may handle longer candidate sequences, draft KV may be wasted, and continuous batching can fragment when requests reject at different positions. The right metric is milliseconds per output token plus p99 latency and memory, not average tokens per second alone.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Speculative decoding is useful for predictable decode-heavy workloads: low-temperature code, boilerplate, repeated assistant phrasing, schema-like output, and long completions where target decode dominates. It is a serving optimization for the decode phase.',
        'Variants such as draft models, Medusa heads, EAGLE feature prediction, and lookahead methods differ in proposal generation. The common contract is cheap proposals, target verification, target-compatible output, and fallback when the economics break.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the drafter is weak, temperature is high, prompts move out of domain, schema masks are expensive, or memory pressure hurts batching. Average speedup can hide p99 damage if a few slices reject constantly.',
        'Implementation bugs are dangerous. Target KV must reflect accepted or target-emitted tokens, not unverified draft guesses. A cache handoff error can produce fluent text from the wrong state and be hard to spot without ledger tests.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the prefix is The and the drafter proposes four tokens: cat, sat, quickly, down. The target verifier accepts cat with target probability 0.70, accepts sat with 0.42, rejects quickly because target probability is 0.08, and emits on as the repair token.',
        'The ledger stores k = 4, accepted = 2, rejection_index = 2, repair_token = on, target_pass_ms = 18, draft_ms = 4, and emitted_tokens = 3. Baseline target decoding would need three target passes for cat sat on. This round used one target pass plus draft work, while discarding quickly and down.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Fast Inference from Transformers via Speculative Decoding, Accelerating Large Language Model Decoding with Speculative Sampling, Medusa, EAGLE, and implementation docs from current serving stacks. Exact defaults and support status change, so verify product behavior against live documentation.',
        'Study KV cache, transformer inference rooflines, continuous batching, multi-token decoding, constrained decoding, knowledge distillation, and runtime controllers next. The ledger makes sense when cache state and decode economics are understood together.',
      ],
    },
  ],
};
