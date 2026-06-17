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
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sampling policy is the set of decoding decisions that turns model logits into emitted tokens. Temperature, top-p, top-k, repetition penalties, max-token caps, and stop sequences are often introduced as style controls. In a production AI product, they are also cost controls. They decide how much uncertainty the model is allowed to spend, how long it may continue, and how often the system must repair or retry its own output.',
        'This matters because output tokens are not free decoration. They cost decode time, GPU capacity, streaming latency, KV cache memory, verifier work, moderation work, and sometimes another model call. A verbose answer may look helpful in a demo and still damage p99 latency or cost per accepted answer. A very strict policy may reduce tokens while increasing invalid outputs and retries.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious implementation is one global default. Pick a moderate temperature, set top-p to a familiar value, choose a generous maximum token cap, add a stop sequence, and use that everywhere. The appeal is real. Product code stays simple, experiments are easier to compare, and every request goes through the same serving path.',
        'The wall is that tasks do not share the same uncertainty budget. JSON extraction wants validity and determinism. Code generation wants reproducibility, tests, and fewer creative surprises. Search answers need citation discipline and bounded elaboration. Brainstorming can use more diversity, but even brainstorming needs an output budget. One sampler makes at least one class of work pay the wrong tax.',
      ],
    },
    {
      heading: 'The hidden budget problem',
      paragraphs: [
        'The visible cost is the final answer length. The hidden cost is everything needed to reach an acceptable answer. If a loose sampler produces a long answer that fails a schema check, the retry counts too. If a strict sampler produces a short but incomplete answer, the follow-up request or human escalation counts too. If a policy increases verifier calls, that cost belongs to the policy even if the final answer is short.',
        'For that reason, the right unit is not tokens per raw generation. It is cost per accepted answer at a target quality bar. Accepted-answer cost includes prompt tokens, cached tokens where priced differently, output tokens, rejected generations, retries, tool calls, evaluator calls, latency, and the route chosen by the control plane.',
      ],
    },
    {
      heading: 'Core idea',
      paragraphs: [
        'The production shape is a sampling profile plus an output-token ledger. The profile names the decoding knobs for a request class: temperature, top-p or top-k, penalties, maximum length, stop rules, structured-output constraints, verifier policy, and fallback route. The ledger records what actually happened: accepted tokens, rejected tokens, stop reason, retries, validation result, latency, and cost.',
        'This moves the conversation away from taste. The question is not whether a temperature feels creative or whether a max-token cap looks generous. The question is which profile buys enough quality for this request class at the lowest accepted-answer cost, without damaging latency, safety, or user trust.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The model produces logits for the next token. Temperature rescales those logits before sampling. Lower temperature sharpens the distribution, making high-probability tokens more dominant. Higher temperature flattens the distribution, giving lower-probability tokens more chance. Top-k keeps a fixed number of candidates. Top-p, or nucleus sampling, keeps the smallest set of tokens whose cumulative probability reaches a threshold.',
        'Stop rules and max-token caps act directly on length. A stop sequence can end output when a delimiter, JSON boundary, or answer marker appears. A max-token cap prevents runaway generation, but it can also truncate a valid answer. Repetition and presence penalties change the probability of tokens that have already appeared. They can reduce loops, but they can also damage tasks that legitimately repeat identifiers, legal citations, code symbols, or product names.',
        'A cost-aware system attaches these knobs to request classes. Extraction might use low entropy, schema-constrained decoding, short caps, and strict validation. Code help might use low temperature, a larger cap, and test feedback. Search answers might use moderate entropy, source checks, and a cap on unsupported elaboration. Creative drafting might allow more diversity while still recording accepted length and stop reason.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The useful invariant is that the policy bounds the distribution and the ledger measures the outcome. The profile says what the decoder is allowed to do. The ledger says what the decoder actually did, what the validators accepted, and how much the accepted answer cost. Without the ledger, sampling changes become folklore.',
        'The feedback loop is the mechanism. Change one profile, run an A/B test or offline replay, and compare accepted tokens, invalid-output rate, retry rate, quality score, p50 and p99 latency, and cost per accepted answer. Keep the change only if it improves the real objective for that request class. A cheaper raw generation that creates more retries is not cheaper.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Lower entropy often reduces rambling and improves reproducibility. It can also create thin answers, generic phrasing, repeated safe language, or brittle refusals. Higher entropy can improve ideation and avoid repetitive text, but it can increase answer length, hallucination risk, verifier load, and tail latency.',
        'Candidate filtering has its own tradeoff. Top-k gives a fixed candidate pool even when the probability mass is concentrated or spread out. Top-p adapts the pool to the distribution, but a high threshold can admit long-tail tokens in uncertain contexts. Both are controls over diversity, not guarantees of truth.',
        'Length controls are blunt but necessary. Hard caps protect worst-case spend, yet they can cut off an answer before it reaches the required conclusion. Stop sequences reduce boilerplate, but they can fire too early if the marker appears in content. The right policy usually combines caps, stops, validators, and task-specific prompts rather than trusting one knob.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Sampling profiles win when one serving system handles several tasks. A customer-support assistant, for example, may classify tickets, extract order fields, draft replies, answer policy questions, and escalate complex cases. Those are different decoding problems. Treating them as one sampler hides avoidable cost and avoidable quality loss.',
        'They also win when verifier loops are expensive. If a looser policy causes more schema failures, unsupported citations, or safety rejections, the model may spend more total tokens even if the first answer feels more natural. A profile lets the team tune the upstream sampler to reduce downstream repairs.',
        'The best win condition is lower cost per accepted answer at the same quality bar. That improvement can come from fewer output tokens, fewer invalid generations, fewer retries, earlier stop reasons, smaller model routing for easy classes, or a policy that makes verifier success more likely.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'This approach fails when teams optimize token count alone. A short answer that creates follow-up questions, verifier rejects, or support escalations has moved cost rather than removed it. It also fails when teams keep old profiles after changing models. A model upgrade can change entropy, verbosity, refusal behavior, and stop-sequence reliability.',
        'Sampling policy is the wrong layer for some problems. If the task requires exact JSON, constrained decoding or a schema-aware parser may be better than hoping low temperature behaves. If the system lacks retrieval evidence, no sampler setting will create reliable facts. If the prompt asks for unnecessary prose, lowering max tokens only hides the product-design problem.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A support bot generates refund explanations. The old global policy uses moderate temperature, high top-p, and a large max-token cap. It often produces friendly but long answers with extra caveats. The answers pass human spot checks, but traces show high output-token spend, slower streaming completion, and occasional verifier rejects because the model adds policy details that do not apply.',
        'The team creates a support-answer profile. It lowers temperature, tightens top-p, sets a smaller max-token cap, stops after the answer block, and requires a verifier to check that the refund reason, order state, and next action appear. The profile also records stop reason, accepted tokens, rejected tokens, verifier calls, retry count, model route, and latency.',
        'In replay, output tokens fall by a meaningful margin and p99 improves. The team still does not ship from that alone. It checks whether retry rate, escalation rate, refund-policy accuracy, and protected customer slices remain stable. The profile ships only because cost per accepted answer improves without weakening the quality bar. That is the difference between a token-saving trick and a production sampling policy.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'A practical implementation starts with a small registry of profiles, not dozens of knobs scattered through product code. Each profile should name the task class, model route, decoding parameters, max-token cap, stop rules, validation requirements, fallback behavior, and owner. Product code chooses a profile by request class; serving code applies it consistently.',
        'The ledger should be joinable with traces and evaluations. Record prompt tokens, cached input tokens, output tokens, rejected-output tokens when available, stop reason, validation result, retry count, verifier cost, latency, model version, and profile version. Without profile versioning, a cost regression after a release becomes difficult to explain.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references include the Hugging Face generation strategies guide at https://huggingface.co/docs/transformers/en/generation_strategies, The Curious Case of Neural Text Degeneration at https://arxiv.org/abs/1904.09751, and Closing the Curious Case of Neural Text Degeneration at https://arxiv.org/abs/2310.01693.',
        'Study softmax and temperature first, then greedy decoding, beam search, top-k sampling, nucleus sampling, constrained decoding, and verifier-guided inference. After the mechanics are clear, study LLM inference cost stacks and trace-led token ledgers. The mature lesson is that decoding is not only language style; it is a product control loop with measurable spend, quality, and risk.',
      ],
    },
  ],
};
