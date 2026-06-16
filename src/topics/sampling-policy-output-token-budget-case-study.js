// Sampling policy as a cost control: decoding knobs change quality, retry
// rate, output length, verifier load, and ultimately dollars per useful answer.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'sampling-policy-output-token-budget-case-study',
  title: 'Sampling Policy Output Token Budget Case Study',
  category: 'AI & ML',
  summary: 'A decoding-policy case study: temperature, top-p, max tokens, stop rules, and penalties are product cost controls, not only style knobs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['decoder knobs', 'budget ledger'], defaultValue: 'decoder knobs' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function policyGraph(title) {
  return graphState({
    nodes: [
      { id: 'logits', label: 'logits', x: 0.7, y: 3.6, note: 'model' },
      { id: 'temp', label: 'temp', x: 2.4, y: 1.7, note: 'entropy' },
      { id: 'topk', label: 'top-k', x: 2.4, y: 3.1, note: 'fixed' },
      { id: 'topp', label: 'top-p', x: 2.4, y: 4.5, note: 'nucleus' },
      { id: 'stop', label: 'stop', x: 2.4, y: 5.9, note: 'end' },
      { id: 'sampler', label: 'sampler', x: 4.8, y: 3.6, note: 'policy' },
      { id: 'tokens', label: 'tokens', x: 6.8, y: 3.6, note: 'output' },
      { id: 'ledger', label: 'ledger', x: 8.7, y: 3.6, note: 'cost' },
    ],
    edges: [
      { id: 'e-logits-temp', from: 'logits', to: 'temp' },
      { id: 'e-logits-topk', from: 'logits', to: 'topk' },
      { id: 'e-logits-topp', from: 'logits', to: 'topp' },
      { id: 'e-stop-sampler', from: 'stop', to: 'sampler' },
      { id: 'e-temp-sampler', from: 'temp', to: 'sampler' },
      { id: 'e-topk-sampler', from: 'topk', to: 'sampler' },
      { id: 'e-topp-sampler', from: 'topp', to: 'sampler' },
      { id: 'e-sampler-tokens', from: 'sampler', to: 'tokens' },
      { id: 'e-tokens-ledger', from: 'tokens', to: 'ledger' },
    ],
  }, { title });
}

function* decoderKnobs() {
  yield {
    state: policyGraph('Decoding policy sits after the model'),
    highlight: { active: ['logits', 'temp', 'topk', 'topp', 'stop', 'sampler'], found: ['tokens', 'ledger'] },
    explanation: 'The model emits logits. The decoding policy turns those logits into output tokens using temperature, top-k, top-p, repetition penalties, stop rules, and max-token caps. Those settings change both behavior and cost.',
  };

  yield {
    state: labelMatrix(
      'Knob semantics',
      [
        { id: 'temp', label: 'temp' },
        { id: 'topk', label: 'top-k' },
        { id: 'topp', label: 'top-p' },
        { id: 'penalty', label: 'penalty' },
        { id: 'stop', label: 'stop' },
      ],
      [
        { id: 'moves', label: 'moves' },
        { id: 'cost risk', label: 'cost risk' },
      ],
      [
        ['entropy', 'ramble'],
        ['fixed pool', 'too broad'],
        ['mass pool', 'tail cut'],
        ['repeat prob', 'overcorrect'],
        ['end rule', 'early cut'],
      ],
    ),
    highlight: { active: ['temp:moves', 'topp:moves', 'stop:cost risk'], compare: ['penalty:cost risk'] },
    explanation: 'Temperature changes entropy. Top-k keeps a fixed number of candidates. Top-p keeps enough candidates to cover a probability mass. Stop rules and max tokens are direct output-length controls.',
    invariant: 'Sampling policy changes the distribution seen by the cost meter.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'policy looseness', min: 0, max: 1 }, y: { label: 'relative metric', min: 0, max: 1.2 } },
      series: [
        { id: 'diversity', label: 'diversity', points: [{ x: 0.1, y: 0.20 }, { x: 0.3, y: 0.44 }, { x: 0.5, y: 0.68 }, { x: 0.8, y: 0.92 }, { x: 1.0, y: 1.0 }] },
        { id: 'length', label: 'length', points: [{ x: 0.1, y: 0.45 }, { x: 0.3, y: 0.55 }, { x: 0.5, y: 0.72 }, { x: 0.8, y: 0.98 }, { x: 1.0, y: 1.12 }] },
        { id: 'retries', label: 'retry risk', points: [{ x: 0.1, y: 0.50 }, { x: 0.3, y: 0.35 }, { x: 0.5, y: 0.30 }, { x: 0.8, y: 0.50 }, { x: 1.0, y: 0.75 }] },
      ],
      markers: [
        { id: 'sweet', x: 0.5, y: 0.72, label: 'sweet' },
      ],
    }),
    highlight: { active: ['diversity', 'length', 'sweet'], compare: ['retries'] },
    explanation: 'There is usually a policy knee. Too strict can create refusals or brittle outputs that need retries. Too loose can lengthen outputs, increase hallucinations, and load verifiers.',
  };

  yield {
    state: labelMatrix(
      'Policy by task',
      [
        { id: 'json', label: 'JSON' },
        { id: 'code', label: 'code' },
        { id: 'search', label: 'search' },
        { id: 'creative', label: 'creative' },
      ],
      [
        { id: 'policy', label: 'policy' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['low entropy', 'schema'],
        ['low temp', 'tests'],
        ['moderate', 'citations'],
        ['higher', 'length cap'],
      ],
    ),
    highlight: { active: ['json:policy', 'json:guard', 'code:guard'], found: ['creative:guard'] },
    explanation: 'A product should not use one global sampling policy. Structured extraction, code, search answers, and creative drafting need different entropy and guard settings.',
  };
}

function* budgetLedger() {
  yield {
    state: labelMatrix(
      'Output token cost ledger',
      [
        { id: 'max', label: 'max tokens' },
        { id: 'stop', label: 'stop seq' },
        { id: 'style', label: 'style' },
        { id: 'verify', label: 'verify' },
        { id: 'retry', label: 'retry' },
      ],
      [
        { id: 'records', label: 'records' },
        { id: 'why', label: 'why' },
      ],
      [
        ['hard cap', 'bill bound'],
        ['end marker', 'trim tail'],
        ['brevity', 'less decode'],
        ['score', 'avoid bad path'],
        ['count', 'hidden cost'],
      ],
    ),
    highlight: { active: ['max:why', 'stop:why', 'retry:why'], found: ['verify:records'] },
    explanation: 'The ledger treats decoding policy as spend policy. It logs caps, stop reasons, style hints, verifier calls, retries, and final accepted tokens.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'request', label: 'request', x: 0.8, y: 3.5, note: 'class' },
        { id: 'policy', label: 'policy', x: 2.6, y: 3.5, note: 'knobs' },
        { id: 'decode', label: 'decode', x: 4.6, y: 2.3, note: 'tokens' },
        { id: 'verify', label: 'verify', x: 4.6, y: 4.8, note: 'score' },
        { id: 'stop', label: 'stop', x: 6.5, y: 3.5, note: 'reason' },
        { id: 'bill', label: 'bill', x: 8.3, y: 3.5, note: '$/answer' },
      ],
      edges: [
        { id: 'e-request-policy', from: 'request', to: 'policy' },
        { id: 'e-policy-decode', from: 'policy', to: 'decode' },
        { id: 'e-decode-verify', from: 'decode', to: 'verify' },
        { id: 'e-verify-stop', from: 'verify', to: 'stop' },
        { id: 'e-decode-stop', from: 'decode', to: 'stop' },
        { id: 'e-stop-bill', from: 'stop', to: 'bill' },
      ],
    }, { title: 'Budget policy closes the decoding loop' }),
    highlight: { active: ['policy', 'decode', 'stop', 'bill', 'e-policy-decode', 'e-stop-bill'], compare: ['verify'] },
    explanation: 'A cost-aware sampler can stop because it hit a cap, emitted a valid stop sequence, passed a verifier, or crossed a marginal-value threshold. The stop reason should be visible.',
  };

  yield {
    state: labelMatrix(
      'A/B test slices',
      [
        { id: 'length', label: 'length' },
        { id: 'quality', label: 'quality' },
        { id: 'invalid', label: 'invalid' },
        { id: 'cost', label: 'cost' },
        { id: 'p99', label: 'p99' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'regression', label: 'regression' },
      ],
      [
        ['accepted tokens', 'ramble'],
        ['task score', 'thin answer'],
        ['schema fail', 'retry'],
        ['$/accepted', 'hidden retry'],
        ['stream delay', 'tail spike'],
      ],
    ),
    highlight: { found: ['length:metric', 'quality:metric', 'cost:metric', 'p99:metric'] },
    explanation: 'Sampling changes should be evaluated by accepted output tokens, quality, invalid-output rate, retries, cost per accepted answer, and p99. A cheaper answer that causes more retries is not cheaper.',
  };

  yield {
    state: policyGraph('The policy becomes a reusable product profile'),
    highlight: { active: ['sampler', 'tokens', 'ledger', 'e-sampler-tokens', 'e-tokens-ledger'], found: ['temp', 'topp', 'stop'] },
    explanation: 'The mature shape is a policy registry: structured extraction profile, code profile, citation profile, creative profile, and high-risk profile. Each profile has a quality gate and a cost ledger.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'decoder knobs') yield* decoderKnobs();
  else if (view === 'budget ledger') yield* budgetLedger();
  else throw new InputError('Pick a sampling-policy view.');
}

export const article = {
  references: [
    { title: 'Hugging Face Generation Strategies', url: 'https://huggingface.co/docs/transformers/en/generation_strategies' },
    { title: 'The Curious Case of Neural Text Degeneration', url: 'https://arxiv.org/abs/1904.09751' },
    { title: 'Closing the Curious Case of Neural Text Degeneration', url: 'https://arxiv.org/abs/2310.01693' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['Sampling policy is the set of decoding choices that turn logits into emitted tokens. Product teams often treat temperature, top-p, top-k, repetition penalties, max tokens, and stop sequences as style controls. In production inference, they are also cost controls.', 'The local inference-scaling document notes that sampling policy can change output length by a meaningful margin. That matters because every extra output token costs decode time, KV state, verifier work, and user-visible latency.'] },
    { heading: 'How it works', paragraphs: ['Temperature rescales logits. Top-k keeps a fixed number of candidates. Top-p, or nucleus sampling, keeps the smallest high-probability set whose cumulative mass crosses a threshold. Stop sequences and max-token caps bound length directly. Penalties reduce repetition but can overcorrect. The policy controls which uncertainty the sampler is allowed to spend.', 'A mature system does not use one global policy. Extraction and JSON prefer low entropy and constrained decoding. Code prefers reproducibility and test feedback. Search answers need citation support and bounded verbosity. Creative drafting can spend more entropy but still needs a length cap.'] },
    { heading: 'Complete case study', paragraphs: ['A support bot is generating refund explanations. The default policy is verbose and often emits extra caveats. The team adds a support-answer profile: lower temperature, top-p cap, max token limit, stop sequence after the answer block, and a verifier that checks whether required policy facts appear. Output tokens fall, p99 improves, and retries stay flat because the verifier catches thin answers before release.', 'The important artifact is the output-token ledger: prompt class, sampling profile, accepted tokens, rejected tokens, stop reason, verifier calls, retries, latency, and cost per accepted answer.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not lower temperature blindly. A stricter sampler can produce shorter but brittle answers that trigger more retries or escalations. Do not raise top-p blindly for creativity when factuality matters. Do not optimize token count without measuring quality and invalid-output rate.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Hugging Face generation strategies at https://huggingface.co/docs/transformers/en/generation_strategies, Nucleus Sampling at https://arxiv.org/abs/1904.09751, and follow-up theory at https://arxiv.org/abs/2310.01693. Study Softmax & Temperature, Beam Search vs Greedy, Constrained Decoding, Chain of Draft Reasoning Token Budget Case Study, LLM Inference Cost Stack, and LLM Inference Scaling Playbook next.'] },
  ],
};
