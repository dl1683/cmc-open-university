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
      heading: 'Why this exists',
      paragraphs: [
        'Autoregressive decoding is latency-bound because the target model normally produces one token per expensive forward pass. The next pass cannot start until the previous token is known, so the largest model sits on the critical path for every output token.',
        'Speculative decoding tries to shorten that path without changing the target model contract. A cheaper draft path proposes several future tokens, and the target path verifies those tokens in one parallel pass.',
      ],
    },
    {
      heading: 'The obvious approach and wall',
      paragraphs: [
        'The naive approach is to use a smaller model directly. That is faster, but it changes quality, calibration, and distribution. It is model substitution, not an exact acceleration of the target model.',
        'Another naive approach is to let a helper guess several tokens and keep them when they look plausible. That breaks the serving contract unless the target model verifies acceptance under the same decoding rule the baseline would have used.',
        'The wall is exactness under real traffic. Creative high-temperature prompts, schema masks, weak drafters, memory pressure, and batch fragmentation can turn speculation from a speedup into wasted work or worse p99 latency.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate proposing from verifying. The drafter guesses a short continuation. The target evaluates that continuation. The runtime keeps the accepted prefix, repairs the first rejection with a target token, and discards any later draft guesses.',
        'The acceptance ledger is the operational data structure around that loop. It records proposed tokens, draft probabilities, target probabilities, random draws for stochastic acceptance, accepted length, repair token, KV-cache decisions, latency, memory pressure, and fallback reason.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'A round starts from the current prefix and target KV state. The draft path proposes k tokens cheaply. The target model scores the prefix plus the proposed tokens in one pass, so it can verify several positions that would otherwise require several target passes.',
        'In greedy decoding, acceptance is a prefix match against target choices. In stochastic speculative sampling, token i is accepted with a rule based on draft probability and target probability, and the first rejection is repaired from a corrected target distribution. The goal is unchanged output distribution, not merely similar-looking text.',
      ],
    },
    {
      heading: 'Algorithm',
      paragraphs: [
        'For each round, choose a draft length k, run the draft model, run the target verifier over the proposed continuation, accept the longest valid prefix, emit either the accepted draft tokens plus a bonus target token or a repaired target token at the first rejection, and advance the target KV cache only over tokens justified by the target path.',
        'The ledger should log draft length, proposed tokens, draft probabilities, target probabilities, acceptance decisions, repair token, accepted-prefix length, target latency, draft latency, memory footprint, batch shape, and whether fallback was used.',
        'Fallback is part of the algorithm in production. If acceptance falls below the gate, verifier latency spikes, memory pressure rises, or quality checks fail, the runtime should return to ordinary target decoding immediately.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The speedup comes from accepted tokens per target pass. If the target accepts three draft tokens and emits one repair or bonus token, one expensive verifier pass may advance several output positions instead of one.',
        'The exact algorithms matter because the target model remains the authority. Accepted draft tokens are accepted only when the verifier permits them, and rejected positions are sampled from the target-compatible correction path. Latency may change; the target distribution or quality contract should not.',
        'The ledger makes that authority auditable. If a deployment claims exact acceleration, the record should show which tokens were proposed, which were accepted, which token repaired the first rejection, and how the target cache advanced. Without that record, speedup claims are hard to separate from decoder changes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the drafter proposes four tokens: the, cat, sat, quickly. The target verifier accepts the first three and rejects quickly. The runtime emits the accepted prefix, draws or chooses the repair token from the target path, discards later draft state, and starts the next round from the repaired prefix.',
        'The ledger row is what makes the event auditable: k=4, accepted=3, rejection_index=3, repair_token=on, target_ms, draft_ms, target_KV_appended=4 tokens if the repair advances one position, draft_KV_discarded after rejection, and fallback=false.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'A longer draft length increases upside only when accepted prefixes are often long. When acceptance is low, the drafter spends cycles on tokens that are thrown away and the verifier may carry extra memory or batching cost for little progress.',
        'The real ship metric is not a single demo tokens-per-second number. Use accepted length distribution, milliseconds per output token, p50 and p99 latency, draft and target memory, batch fragmentation, fallback rate, and protected-slice quality or distribution checks.',
        'Batching complicates the math. One request with high acceptance can run quickly while another request in the same batch rejects early and fragments the verifier work. Production evaluation should measure batch-level throughput and tail latency, not only single-request traces.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Speculation fails when the drafter is too weak, temperature is high, prompts shift domains, constraint masks dominate verifier cost, memory pressure reduces batch efficiency, or p99 worsens even while average throughput improves.',
        'It also fails when implementation state leaks across the verification boundary. Target KV must reflect accepted or target-emitted tokens, not unverified draft guesses. A cache handoff bug can silently turn exact acceleration into a different decoder.',
      ],
    },
    {
      heading: 'Useful contexts',
      paragraphs: [
        'Speculative decoding is strongest on predictable low-temperature traffic: code continuations, copied boilerplate, chat completions with repetitive phrasing, and structured outputs where the draft path often matches the target.',
        'Variants such as Medusa, EAGLE, lookahead methods, and multi-token heads change how proposals are produced, but the production contract is the same: propose cheaply, verify with the target path, preserve the output contract, and measure acceptance under real workload slices.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the accept-ledger view, read each row as a token-level audit record. The important field is not just keep or reject; it is the relationship between draft probability, target probability, random draw, repair token, and KV-cache action.',
        'In the speed-model view, compare k=2, k=4, and k=8 by acceptance rate. The larger draft is not automatically better; it wins only when enough proposed tokens survive verification. In the variants view, treat each method as a different proposal engine behind the same verifier contract.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Ship speculation by traffic slice, not by aggregate demo speed. Track accepted tokens per target pass, rejection index distribution, draft latency, target latency, memory pressure, fallback rate, p99 latency, and quality checks for code, chat, schema, and creative traffic separately.',
        'Make fallback boring. A serving stack should disable speculation automatically when acceptance drops, verifier errors rise, memory is tight, or protected quality checks fail. Speculation is an optimization layer; ordinary target decoding must remain the reliable path.',
        'Keep the configuration visible: draft model or head version, draft length, temperature policy, tokenizer assumptions, cache handoff rule, and verifier batch policy. If any of those change, acceptance metrics from the previous rollout may no longer predict behavior.',
      ],
    },
    {
      heading: 'Testing the ledger',
      paragraphs: [
        'Test deterministic cases where the drafter always matches the target, always mismatches at position zero, and mismatches in the middle of the draft. The accepted prefix, repair token, emitted token count, and target KV state should match the expected ledger exactly.',
        'For stochastic sampling, compare output distributions against the non-speculative target decoder on controlled prompts. The speed path is only acceptable if the probability contract survives the acceptance and repair logic.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Fast Inference from Transformers via Speculative Decoding at https://arxiv.org/abs/2211.17192, Accelerating Large Language Model Decoding with Speculative Sampling at https://arxiv.org/abs/2302.01318, Medusa at https://arxiv.org/abs/2401.10774, EAGLE at https://arxiv.org/abs/2401.15077, and EAGLE-2 at https://arxiv.org/abs/2406.16858.',
        'Study Speculative Decoding, Multi-Token Decoding, Early-Exit Transformer Layer Skipping, JSON Schema Constrained Decoding Token Mask, Knowledge Distillation, KV Cache, Transformer Inference Roofline, LLM Continuous Batching, and LLM Inference Scaling Playbook next.',
      ],
    },
  ],
};
