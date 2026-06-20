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
    { title: 'The Curious Case of Neural Text Degeneration (Holtzman et al., 2020)', url: 'https://arxiv.org/abs/1904.09751' },
    { title: 'Closing the Curious Case of Neural Text Degeneration (Finlayson et al., 2024)', url: 'https://arxiv.org/abs/2310.01693' },
    { title: 'Hugging Face Generation Strategies', url: 'https://huggingface.co/docs/transformers/en/generation_strategies' },
    { title: 'Efficient Memory Management for Large Language Model Serving with PagedAttention (Kwon et al., 2023)', url: 'https://arxiv.org/abs/2309.06180' },
  ],
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation traces how a decoding policy transforms raw logits into billed output tokens. The "decoder knobs" view walks the sampling pipeline from logits through temperature, top-k, top-p, and stop rules to the cost ledger. The "budget ledger" view walks the cost-accounting loop from request classification through decoding, verification, and billing.',
        {
          type: 'bullets',
          items: [
            'Active nodes are the knob or stage being evaluated right now.',
            'Compare nodes are cost centers not yet resolved -- the retry or verification path still pending.',
            'Found nodes are outputs accepted by the quality gate: their cost is final and recorded.',
          ],
        },
        {
          type: 'note',
          text: 'Both views end at the same node: the cost ledger. The first view asks "what does each knob do to the token stream?" The second asks "what did the full policy cost per accepted answer?"',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Every token a language model emits costs compute. Output tokens are more expensive than input tokens on most API pricing tiers because each one requires a full forward pass through the model, extends the KV cache, adds streaming latency, and may trigger downstream verification. The sampling policy -- temperature, top-p, top-k, penalties, stop rules, max-token caps -- controls how many tokens the model emits and how much entropy each token carries.',
        {
          type: 'quote',
          text: 'Maximization-based decoding methods like beam search lead to text that is surprisingly degenerate -- bland, incoherent, and gets stuck in repetitive loops.',
          attribution: 'Holtzman et al., "The Curious Case of Neural Text Degeneration" (ICLR 2020)',
        },
        'The Holtzman result showed that greedy and beam-search decoding produce degenerate text, motivating stochastic sampling with top-p (nucleus sampling). But stochastic sampling introduces a new problem: the same knobs that improve text quality also change output length, retry rate, verification load, and cost. A temperature that produces creative marketing copy also produces verbose, hallucination-prone medical answers.',
        {
          type: 'table',
          headers: ['Cost center', 'What sampling policy controls', 'Typical impact'],
          rows: [
            ['Decode compute', 'Number of forward passes (one per output token)', '3-10x range between terse and verbose policies'],
            ['KV cache memory', 'Cache grows linearly with output length', 'Limits concurrent requests per GPU'],
            ['Streaming latency', 'Time-to-last-token scales with output length', 'p99 latency drives user-perceived quality'],
            ['Verification', 'Loose policies increase schema failures and hallucinations', 'Each failed generation may trigger a retry'],
            ['Retry spend', 'Retries re-run the full prompt + new output', 'Hidden multiplier on visible per-token cost'],
          ],
        },
        {
          type: 'note',
          text: 'Output tokens on GPT-4-class models cost 3-4x more than input tokens. A policy that adds 200 unnecessary output tokens per request costs more than a policy that adds 600 unnecessary input tokens through verbose prompting.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is a single global sampling configuration applied to every request:',
        {
          type: 'code',
          language: 'python',
          text: [
            '# Global defaults -- one policy for everything',
            'SAMPLING_CONFIG = {',
            '    "temperature": 0.7,',
            '    "top_p": 0.95,',
            '    "max_tokens": 4096,',
            '    "stop": ["\\n\\n"],',
            '    "frequency_penalty": 0.0,',
            '    "presence_penalty": 0.0,',
            '}',
          ].join('\n'),
          label: 'The typical starting point: one config dict used everywhere',
        },
        'This is not naive. A single config simplifies serving code, makes A/B tests comparable, and avoids the complexity of per-route policy management. For a prototype or single-task product, it works.',
        {
          type: 'bullets',
          items: [
            'Simple to reason about: one temperature, one top-p, one cap.',
            'Easy to compare experiments: only the prompt or model changes.',
            'No routing logic: every request hits the same decoding path.',
            'Familiar: mirrors the default parameters in most API documentation.',
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The global policy breaks because different tasks have incompatible uncertainty budgets. Consider a product that handles four request classes through the same model:',
        {
          type: 'table',
          headers: ['Request class', 'Needs from sampler', 'Global policy damage'],
          rows: [
            ['JSON extraction', 'Deterministic output, schema-valid, short', 'temp=0.7 causes field hallucinations; 4096 cap wastes budget on trailing tokens'],
            ['Code generation', 'Reproducible, testable, moderate length', 'High top-p admits unlikely tokens that break syntax'],
            ['Search answer', 'Grounded, cited, bounded elaboration', 'No stop rule; model elaborates past the evidence'],
            ['Creative draft', 'Diverse, exploratory, longer', 'freq_penalty=0 allows repetitive loops'],
          ],
        },
        {
          type: 'diagram',
          text: [
            '  Global policy: temp=0.7, top_p=0.95, max=4096',
            '  ',
            '  JSON extract  --> schema fail (18% rate) --> retry --> 2x cost',
            '  Code gen      --> rare syntax errors      --> test fail --> retry',
            '  Search answer --> unsupported claims      --> verifier reject --> retry',
            '  Creative      --> repetitive loops        --> human edit --> hidden cost',
            '  ',
            '  Each class pays the wrong tax.',
            '  The retry cost is invisible in per-token metrics.',
          ].join('\n'),
          label: 'One policy forces at least one request class into avoidable retries',
        },
        'The invariant that breaks: a sampling policy is optimal only relative to a task distribution. A policy that minimizes cost-per-accepted-answer for JSON extraction (low temperature, tight cap, schema stop) actively damages creative drafting (needs higher entropy, longer cap, no schema constraint). No single temperature minimizes total cost across incompatible tasks.',
        {
          type: 'note',
          text: 'The wall is not "one size does not fit all" in the abstract. It is measurable: trace your retry rate and cost-per-accepted-answer by request class. The class paying the highest retry tax under a global policy is the one where task-specific sampling saves the most money.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat sampling policy as a cost control, not a style preference. The production shape is a sampling profile registry paired with an output-token ledger.',
        {
          type: 'diagram',
          text: [
            '  REQUEST CLASSIFICATION',
            '         |',
            '         v',
            '  PROFILE REGISTRY',
            '    +-- extraction: temp=0.1, top_p=0.5, max=512, stop="}\\n"',
            '    +-- code:       temp=0.2, top_p=0.8, max=2048, stop=null',
            '    +-- search:     temp=0.3, top_p=0.9, max=1024, stop="Sources:"',
            '    +-- creative:   temp=0.9, top_p=0.95, max=4096, stop=null',
            '         |',
            '         v',
            '  DECODE  -->  VERIFY  -->  ACCEPT/RETRY',
            '         |',
            '         v',
            '  OUTPUT TOKEN LEDGER',
            '    request_id, profile, accepted_tokens, rejected_tokens,',
            '    stop_reason, retries, verifier_result, latency_ms, cost',
          ].join('\n'),
          label: 'Profile selects the policy; ledger records the outcome',
        },
        'The profile specifies what the decoder is allowed to do. The ledger records what the decoder actually did. Without the ledger, sampling changes are folklore -- a team lowers temperature, observes shorter outputs in a few examples, and declares victory without measuring retry rate, verification failures, or cost-per-accepted-answer.',
        {
          type: 'quote',
          text: 'Nucleus sampling (top-p) avoids text degeneration by sampling from the dynamic nucleus of the probability distribution, but the optimal nucleus size varies dramatically by context.',
          attribution: 'Holtzman et al., 2020 -- adapted',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The decoding pipeline applies knobs in sequence. Each knob reshapes the probability distribution the sampler sees, and each reshape has a cost consequence.',
        {
          type: 'table',
          headers: ['Knob', 'Mechanism', 'Distribution effect', 'Cost effect'],
          rows: [
            ['Temperature', 'Divides logits by T before softmax', 'T<1 sharpens (greedy-like); T>1 flattens (uniform-like)', 'Lower T: shorter, more deterministic. Higher T: longer, more diverse, more retries'],
            ['Top-k', 'Keeps only k highest-probability tokens', 'Fixed candidate pool regardless of distribution shape', 'Too large: admits noise. Too small: brittle on uncertain positions'],
            ['Top-p (nucleus)', 'Keeps smallest set of tokens covering probability mass p', 'Adaptive pool: tight when model is confident, wide when uncertain', 'High p on uncertain tokens: long-tail hallucinations'],
            ['Frequency penalty', 'Subtracts penalty * count(token) from logits', 'Suppresses repetition proportional to frequency', 'Too high: damages legitimate repetition (code, legal, product names)'],
            ['Presence penalty', 'Subtracts fixed penalty if token appeared at all', 'Encourages topic diversity', 'Can force topic drift in focused tasks'],
            ['Max tokens', 'Hard stop after N output tokens', 'Truncates at budget boundary', 'Too low: cuts valid answers. Too high: no cost bound'],
            ['Stop sequence', 'Halts generation when delimiter appears', 'Ends output at semantic boundary', 'False triggers if delimiter appears in content'],
          ],
        },
        {
          type: 'code',
          language: 'python',
          text: [
            '# Temperature rescaling: the core mechanism',
            'import numpy as np',
            '',
            'def apply_temperature(logits, temperature):',
            '    """Divide logits by T, then softmax."""',
            '    scaled = logits / temperature',
            '    exp = np.exp(scaled - np.max(scaled))  # numerical stability',
            '    return exp / exp.sum()',
            '',
            '# Example: logits = [2.0, 1.0, 0.5, 0.1]',
            '# T=0.3 -> probs = [0.94, 0.05, 0.01, 0.00]  (near-greedy)',
            '# T=1.0 -> probs = [0.47, 0.17, 0.10, 0.07]  (model default)',
            '# T=2.0 -> probs = [0.33, 0.20, 0.16, 0.13]  (near-uniform)',
          ].join('\n'),
          label: 'Temperature controls entropy: lower T concentrates probability on the top token',
        },
        {
          type: 'code',
          language: 'python',
          text: [
            '# Top-p (nucleus) sampling: adaptive candidate pool',
            'def top_p_filter(probs, p=0.9):',
            '    """Keep the smallest set of tokens whose mass >= p."""',
            '    sorted_idx = np.argsort(probs)[::-1]',
            '    cumulative = np.cumsum(probs[sorted_idx])',
            '    cutoff = np.searchsorted(cumulative, p) + 1',
            '    keep = sorted_idx[:cutoff]',
            '    filtered = np.zeros_like(probs)',
            '    filtered[keep] = probs[keep]',
            '    return filtered / filtered.sum()',
            '',
            '# Confident position: top token has 0.8 prob -> nucleus is 1-2 tokens',
            '# Uncertain position: top token has 0.1 prob -> nucleus is 15+ tokens',
            '# This adaptivity is why top-p replaced top-k in most production systems',
          ].join('\n'),
          label: 'Nucleus sampling adapts the candidate pool to the model confidence at each position',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The profile-plus-ledger pattern works because it makes the cost feedback loop explicit and measurable.',
        {
          type: 'bullets',
          items: [
            'The profile bounds the distribution: it constrains what the decoder can emit, limiting worst-case token spend and output shape.',
            'The ledger measures the outcome: it records what was actually emitted, what was accepted, what was rejected, and what it cost.',
            'The feedback loop closes the gap: compare profiles by cost-per-accepted-answer, not by raw token count or subjective quality.',
          ],
        },
        'The correctness argument is an invariant: for any request class, the optimal policy minimizes E[cost | quality >= threshold]. This expectation includes the retry multiplier. A policy that produces shorter outputs but fails verification 20% of the time has expected cost = 1.2 * (prompt_cost + output_cost) + 0.2 * verification_cost. A slightly longer policy with 2% failure rate may be cheaper overall.',
        {
          type: 'table',
          headers: ['Policy A (tight)', 'Policy B (moderate)', 'Metric'],
          rows: [
            ['128', '256', 'Avg output tokens'],
            ['18%', '3%', 'Schema failure rate'],
            ['1.21x', '1.03x', 'Effective retry multiplier'],
            ['$0.0031', '$0.0028', 'Cost per accepted answer'],
            ['820ms', '1,100ms', 'p50 latency'],
            ['2,400ms', '1,300ms', 'p99 latency (retry tail)'],
          ],
        },
        {
          type: 'note',
          text: 'Policy A looks cheaper by token count. Policy B is cheaper by accepted-answer cost because the retry tail dominates. The ledger makes this visible; raw token metrics hide it.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost of a sampling policy is not the token price. It is the total spend required to produce one accepted answer at a given quality bar.',
        {
          type: 'diagram',
          text: [
            '  VISIBLE COST                    HIDDEN COST',
            '  +-----------+                   +--------------------+',
            '  | output    |                   | rejected attempts  |',
            '  | tokens    |                   | retry prompts      |',
            '  | x $/token |                   | verifier calls     |',
            '  +-----------+                   | cache invalidation |',
            '                                  | human escalation   |',
            '                                  | latency-driven     |',
            '                                  |   user abandonment |',
            '                                  +--------------------+',
            '  ',
            '  True cost = visible + hidden',
            '  Most teams optimize visible. Winners optimize true.',
          ].join('\n'),
          label: 'The visible token bill is often less than half the true cost of a bad policy',
        },
        {
          type: 'table',
          headers: ['Knob change', 'Visible effect', 'Hidden effect to watch'],
          rows: [
            ['Lower temperature', 'Shorter, more deterministic output', 'Thin answers that trigger follow-up requests or escalations'],
            ['Raise temperature', 'More diverse, creative output', 'Longer answers, more hallucinations, higher retry rate'],
            ['Lower max_tokens', 'Hard cap on output spend', 'Truncated answers that fail validation or need continuation'],
            ['Raise max_tokens', 'No truncation risk', 'No cost bound; verbose answers waste KV cache and latency'],
            ['Tighter top_p', 'Fewer unlikely tokens sampled', 'Brittle outputs on uncertain positions; mode collapse'],
            ['Add stop sequence', 'Clean termination at delimiter', 'False triggers if delimiter appears in content'],
            ['Add frequency penalty', 'Reduced repetition loops', 'Damaged output for tasks with legitimate repetition'],
          ],
        },
        'KV cache pressure deserves special attention. Every output token extends the KV cache for the sequence. On serving systems using PagedAttention (vLLM, TGI), longer outputs consume more memory pages, reducing the number of concurrent sequences the GPU can serve. A policy that averages 500 output tokens instead of 200 does not just cost 2.5x in tokens -- it may cut throughput by 40% under memory pressure because fewer requests fit in the cache simultaneously.',
        {
          type: 'note',
          text: 'Latency scales linearly with output tokens for autoregressive models. A 200-token answer at 50 tokens/second streams in 4 seconds. A 1,000-token answer takes 20 seconds. The user waits for time-to-last-token, not time-to-first-token, when the answer must be complete before acting on it.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A customer-support platform routes five request types through the same model. The team starts with a global policy and discovers that JSON extraction is their most expensive request class despite producing the shortest outputs.',
        {
          type: 'table',
          headers: ['Request class', 'Volume', 'Global policy result', 'Problem'],
          rows: [
            ['Order field extraction', '40%', '~95 tokens, 22% schema failure', 'Retries dominate cost'],
            ['Refund explanation', '25%', '~340 tokens, 4% quality failure', 'Verbose but mostly OK'],
            ['Policy Q&A', '20%', '~280 tokens, 8% unsupported claims', 'Verifier rejects on citations'],
            ['Ticket classification', '10%', '~45 tokens, 1% failure', 'Overserved by high temp'],
            ['Escalation draft', '5%', '~420 tokens, 12% tone failure', 'Needs diversity but gets retries'],
          ],
        },
        'Step 1: the team instruments a ledger on every request.',
        {
          type: 'code',
          language: 'python',
          text: [
            'ledger_entry = {',
            '    "request_id": req.id,',
            '    "profile": "global-v1",        # which policy was used',
            '    "request_class": classify(req), # extraction, refund, policy, ...',
            '    "prompt_tokens": usage.prompt_tokens,',
            '    "output_tokens": usage.completion_tokens,',
            '    "accepted": verifier.passed,    # did the output pass quality gate?',
            '    "stop_reason": response.finish_reason,  # stop, length, tool_call',
            '    "retries": attempt_count - 1,',
            '    "verifier_calls": verifier.call_count,',
            '    "latency_ms": elapsed_ms,',
            '    "cost_usd": compute_cost(usage, model, retries=attempt_count),',
            '}',
          ].join('\n'),
          label: 'Every request records its full cost path, not just the final token count',
        },
        'Step 2: the ledger reveals that order extraction costs $0.0041 per accepted answer under the global policy -- higher than refund explanations at $0.0038, despite producing fewer tokens. The culprit is a 22% schema failure rate causing 1.28x retry multiplier.',
        'Step 3: the team creates a task-specific extraction profile.',
        {
          type: 'code',
          language: 'python',
          text: [
            'PROFILES = {',
            '    "extraction": {',
            '        "temperature": 0.1,',
            '        "top_p": 0.5,',
            '        "max_tokens": 512,',
            '        "stop": ["}\\n"],',
            '        "response_format": {"type": "json_object"},',
            '        "frequency_penalty": 0.0,',
            '    },',
            '    "refund": {',
            '        "temperature": 0.4,',
            '        "top_p": 0.85,',
            '        "max_tokens": 600,',
            '        "stop": ["---END---"],',
            '        "frequency_penalty": 0.1,',
            '    },',
            '    "policy_qa": {',
            '        "temperature": 0.3,',
            '        "top_p": 0.8,',
            '        "max_tokens": 800,',
            '        "stop": ["Sources:"],  # force citation block',
            '        "frequency_penalty": 0.0,',
            '    },',
            '    "classification": {',
            '        "temperature": 0.0,  # greedy -- deterministic label',
            '        "max_tokens": 10,',
            '    },',
            '    "escalation": {',
            '        "temperature": 0.7,',
            '        "top_p": 0.92,',
            '        "max_tokens": 1024,',
            '        "presence_penalty": 0.3,',
            '    },',
            '}',
          ].join('\n'),
          label: 'Five profiles replace one global config -- each tuned to its request class',
        },
        'Step 4: A/B test over two weeks. Results from the ledger:',
        {
          type: 'table',
          headers: ['Metric', 'Global policy', 'Per-class profiles', 'Change'],
          rows: [
            ['Extraction schema failure', '22%', '3%', '-86%'],
            ['Extraction cost/accepted', '$0.0041', '$0.0019', '-54%'],
            ['Refund quality failure', '4%', '3%', '-25%'],
            ['Refund avg tokens', '340', '245', '-28%'],
            ['Policy QA unsupported claims', '8%', '4%', '-50%'],
            ['Classification cost/accepted', '$0.0012', '$0.0003', '-75%'],
            ['Escalation tone failure', '12%', '9%', '-25%'],
            ['Overall cost/accepted answer', '$0.0034', '$0.0018', '-47%'],
            ['p99 latency (all classes)', '4,200ms', '2,100ms', '-50%'],
          ],
        },
        {
          type: 'note',
          text: 'The largest savings came from the simplest class: ticket classification dropped to greedy decoding with max_tokens=10. The extraction savings came from eliminating retries, not from shorter outputs -- the successful outputs were nearly the same length.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Sampling profiles earn their complexity when one serving system handles multiple task types and when cost-per-accepted-answer varies significantly by request class.',
        {
          type: 'table',
          headers: ['Application', 'Why per-class profiles matter', 'Key knob difference'],
          rows: [
            ['Customer support bot', 'Extraction, Q&A, drafting, classification are different decoding problems', 'Extraction uses near-greedy; drafting uses moderate entropy'],
            ['Code assistant', 'Code completion vs. explanation vs. refactoring vs. test generation', 'Completion uses low temp + long cap; test gen uses moderate temp + test-pass stop'],
            ['RAG pipeline', 'Retrieval summary vs. synthesis vs. citation generation', 'Summary uses tight cap + citation stop; synthesis allows longer output'],
            ['Content moderation', 'Classification (short, deterministic) vs. explanation (longer, grounded)', 'Classification is greedy with max_tokens=5; explanation uses moderate temp'],
            ['Multi-agent system', 'Planner vs. executor vs. critic have different entropy needs', 'Planner needs diversity (high temp); executor needs precision (low temp)'],
          ],
        },
        'Profiles also win in model-routing architectures. A small model with a tight extraction profile may produce better JSON than a large model with a loose global policy -- and cost 10x less per token. The profile and the model route are joint decisions, not independent ones.',
        {
          type: 'bullets',
          items: [
            'Verifier loops: a tighter upstream policy that reduces schema failures saves the cost of downstream verification retries.',
            'Streaming UX: shorter, faster outputs improve perceived responsiveness even when total quality is equivalent.',
            'Cache efficiency: shorter outputs free KV cache memory, increasing concurrent request throughput under PagedAttention.',
            'Safety filtering: lower-entropy outputs are less likely to trigger content filters, reducing the retry-after-filter cost.',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Per-class sampling profiles fail in predictable ways. Each failure mode is a team optimizing the wrong metric.',
        {
          type: 'table',
          headers: ['Failure mode', 'What happens', 'Root cause'],
          rows: [
            ['Optimizing token count alone', 'Short answers that trigger follow-ups, escalations, or user churn', 'Cost metric ignores downstream consequences'],
            ['Stale profiles after model upgrade', 'New model has different verbosity, entropy, stop-sequence behavior', 'Profiles are model-version-specific; must be re-evaluated'],
            ['Too many profiles', 'Combinatorial complexity; hard to A/B test; config sprawl', 'Start with 3-5 coarse classes, not per-endpoint profiles'],
            ['No ledger', 'No data on retry rate, verification cost, or true cost-per-accepted', 'Without measurement, profile tuning is guesswork'],
            ['Sampling as substitute for constrained decoding', 'Low temperature does not guarantee valid JSON', 'Use response_format or grammar-guided decoding for structural constraints'],
            ['Sampling as substitute for retrieval', 'No temperature setting creates grounded facts', 'If the model lacks evidence, the problem is the context, not the sampler'],
          ],
        },
        {
          type: 'note',
          text: 'The subtlest failure: a team tightens a profile until outputs are short and deterministic, then discovers that the model produces the same wrong answer every time. Low temperature amplifies the mode of the distribution. If the mode is wrong (due to a bad prompt or missing context), determinism makes the error consistent rather than occasional.',
        },
        'Sampling policy is also the wrong layer for prompt-design problems. If the system prompt asks for "a thorough, detailed explanation with examples," lowering max_tokens does not fix the verbosity -- it truncates it. The fix is to change the prompt to ask for what the user actually needs. Sampling controls the decoder; they cannot override the instruction the model is following.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        {
          type: 'table',
          headers: ['Component', 'What to build', 'Why it matters'],
          rows: [
            ['Profile registry', 'Named configs: task class, model route, temp, top_p, max_tokens, stop, penalties, validator', 'Product code selects a name, not raw knobs'],
            ['Request classifier', 'Maps incoming request to a profile name', 'Decouples routing logic from sampling parameters'],
            ['Output ledger', 'Records prompt_tokens, output_tokens, rejected_tokens, stop_reason, retries, verifier_result, latency, cost, profile_version', 'Makes cost-per-accepted-answer measurable'],
            ['Profile versioning', 'Tracks which profile version produced each output', 'Enables regression detection after config changes'],
            ['A/B test harness', 'Splits traffic between profile versions per request class', 'Prevents shipping a profile that regresses a hidden metric'],
            ['Fallback policy', 'Default profile for unclassified requests', 'Prevents requests from hitting no policy at all'],
          ],
        },
        {
          type: 'code',
          language: 'python',
          text: [
            '# Minimal profile registry pattern',
            'class SamplingRegistry:',
            '    def __init__(self):',
            '        self._profiles = {}',
            '        self._default = "general"',
            '',
            '    def register(self, name, version, params):',
            '        self._profiles[(name, version)] = params',
            '',
            '    def resolve(self, request_class, version="latest"):',
            '        key = (request_class, version)',
            '        if key not in self._profiles:',
            '            key = (self._default, version)',
            '        return self._profiles[key]',
            '',
            '# Usage in serving code:',
            '# profile = registry.resolve(classify(request))',
            '# response = model.generate(**prompt, **profile)',
            '# ledger.record(request, profile, response, verification)',
          ].join('\n'),
          label: 'Product code selects a profile by name; serving code applies the parameters',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Holtzman et al., "The Curious Case of Neural Text Degeneration" (2020)', 'Original nucleus sampling paper; shows why greedy/beam search degenerates'],
            ['Finlayson et al., "Closing the Curious Case" (2024)', 'Explains the softmax bottleneck behind degeneration; refines top-p theory'],
            ['Kwon et al., "PagedAttention" (2023)', 'KV cache management in production LLM serving; explains how output length affects throughput'],
            ['Hugging Face Generation Strategies guide', 'Practical reference for all decoding parameters with code examples'],
            ['OpenAI API reference: Create Chat Completion', 'Documents temperature, top_p, max_tokens, stop, penalties, response_format'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Softmax and Temperature -- understand how temperature rescales logits before reasoning about sampling.',
            'Prerequisite: Beam Search -- understand deterministic decoding before contrasting with stochastic sampling.',
            'Extension: Constrained Decoding and Grammar-Guided Generation -- when sampling alone cannot guarantee structural validity.',
            'Extension: Speculative Decoding -- uses a draft model to reduce decode latency; interacts with sampling policy.',
            'Case study: LLM Inference Cost Stacks -- broader view of where output-token cost fits in the full serving bill.',
            'Contrast: Prompt Engineering for Brevity -- upstream alternative to sampling controls for reducing output length.',
          ],
        },
      ],
    },
  ],
};

