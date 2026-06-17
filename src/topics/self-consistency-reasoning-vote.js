// Self-consistency: sample several reasoning paths, group them by final answer,
// and choose the answer with the most support instead of trusting one decode.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'self-consistency-reasoning-vote',
  title: 'Self-Consistency Reasoning Vote',
  category: 'AI & ML',
  summary: 'Sample multiple chain-of-thought paths, marginalize over their final answers, and use agreement as a cheap uncertainty signal.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['sample paths', 'answer marginalization'], defaultValue: 'sample paths' },
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

function voteGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'prompt', label: 'prompt', x: 0.7, y: 4.0, note: notes.prompt ?? 'problem' },
      { id: 'sample', label: 'sample', x: 2.4, y: 4.0, note: notes.sample ?? 'temperature' },
      { id: 'p1', label: 'path 1', x: 4.2, y: 1.7, note: notes.p1 ?? 'ans 11' },
      { id: 'p2', label: 'path 2', x: 4.2, y: 3.2, note: notes.p2 ?? 'ans 11' },
      { id: 'p3', label: 'path 3', x: 4.2, y: 4.8, note: notes.p3 ?? 'ans 14' },
      { id: 'p4', label: 'path 4', x: 4.2, y: 6.3, note: notes.p4 ?? 'ans 11' },
      { id: 'bucket', label: 'bucket', x: 6.3, y: 4.0, note: notes.bucket ?? 'by answer' },
      { id: 'vote', label: 'vote', x: 8.0, y: 4.0, note: notes.vote ?? 'majority' },
      { id: 'answer', label: 'answer', x: 9.3, y: 4.0, note: notes.answer ?? '11' },
    ],
    edges: [
      { id: 'e-prompt-sample', from: 'prompt', to: 'sample' },
      { id: 'e-sample-p1', from: 'sample', to: 'p1' },
      { id: 'e-sample-p2', from: 'sample', to: 'p2' },
      { id: 'e-sample-p3', from: 'sample', to: 'p3' },
      { id: 'e-sample-p4', from: 'sample', to: 'p4' },
      { id: 'e-p1-bucket', from: 'p1', to: 'bucket' },
      { id: 'e-p2-bucket', from: 'p2', to: 'bucket' },
      { id: 'e-p3-bucket', from: 'p3', to: 'bucket' },
      { id: 'e-p4-bucket', from: 'p4', to: 'bucket' },
      { id: 'e-bucket-vote', from: 'bucket', to: 'vote' },
      { id: 'e-vote-answer', from: 'vote', to: 'answer' },
    ],
  }, { title });
}

function confidencePlot() {
  return plotState({
    axes: { x: { label: 'samples' }, y: { label: 'majority share', min: 0.4, max: 1.0 } },
    series: [
      { id: 'clear', label: 'clear problem', points: [
        { x: 1, y: 1.00 }, { x: 3, y: 0.67 }, { x: 5, y: 0.80 }, { x: 9, y: 0.78 }, { x: 15, y: 0.80 },
      ] },
      { id: 'ambig', label: 'ambiguous problem', points: [
        { x: 1, y: 1.00 }, { x: 3, y: 0.67 }, { x: 5, y: 0.60 }, { x: 9, y: 0.56 }, { x: 15, y: 0.53 },
      ] },
    ],
    markers: [
      { id: 'stable', x: 15, y: 0.80, label: 'stable' },
      { id: 'weak', x: 15, y: 0.53, label: 'weak' },
    ],
  }, { title: 'Agreement is a signal, not a proof' });
}

function* samplePaths() {
  yield {
    state: voteGraph('Self-consistency replaces one path with a committee'),
    highlight: { active: ['prompt', 'sample', 'p1', 'p2', 'p3', 'p4'], found: ['vote'] },
    explanation: 'A single chain-of-thought decode can make an early arithmetic or commonsense mistake. Self-consistency samples several reasoning paths, then asks which final answer appears most consistently.',
    invariant: 'The unit being voted on is the final answer, not the exact wording of the trace.',
  };

  yield {
    state: labelMatrix(
      'Sampled paths',
      [
        { id: 'p1', label: 'p1' },
        { id: 'p2', label: 'p2' },
        { id: 'p3', label: 'p3' },
        { id: 'p4', label: 'p4' },
        { id: 'p5', label: 'p5' },
      ],
      [
        { id: 'route', label: 'route' },
        { id: 'ans', label: 'ans' },
      ],
      [
        ['5+6', '11'],
        ['2*3+5', '11'],
        ['bad sub', '14'],
        ['cans first', '11'],
        ['miss can', '8'],
      ],
    ),
    highlight: { active: ['p1:ans', 'p2:ans', 'p4:ans'], compare: ['p3:ans', 'p5:ans'] },
    explanation: 'Different paths can use different wording and intermediate arithmetic while landing on the same answer. The vote groups paths p1, p2, and p4 under answer 11.',
  };

  yield {
    state: voteGraph('Bucket by answer before choosing'),
    highlight: { active: ['bucket', 'vote', 'answer', 'e-bucket-vote', 'e-vote-answer'], found: ['p1', 'p2', 'p4'], compare: ['p3'] },
    explanation: 'The algorithm marginalizes over reasoning paths: sum support for each final answer, then choose the answer with the strongest support. It is a decoding-time trick, not model retraining.',
  };

  yield {
    state: confidencePlot(),
    highlight: { active: ['clear', 'stable'], compare: ['ambig', 'weak'] },
    explanation: 'More samples can stabilize the majority on clear problems. If the vote remains split, the system has learned something useful too: this is a candidate for verifier search, retrieval, tool use, or human review.',
  };

  yield {
    state: voteGraph('Correlated errors can still win the vote', { p1: 'wrong', p2: 'wrong', p3: 'right', p4: 'wrong', bucket: 'biased', answer: 'wrong' }),
    highlight: { active: ['p1', 'p2', 'p4', 'vote', 'answer'], removed: ['p3'], compare: ['bucket'] },
    explanation: 'Self-consistency helps when errors are diverse. It fails when samples share the same misconception, prompt bias, or missing fact. Agreement is evidence, not a correctness guarantee.',
  };
}

function* answerMarginalization() {
  yield {
    state: labelMatrix(
      'Marginalize answers',
      [
        { id: 'a11', label: '11' },
        { id: 'a14', label: '14' },
        { id: 'a8', label: '8' },
      ],
      [
        { id: 'count', label: 'count' },
        { id: 'share', label: 'share' },
      ],
      [
        ['3', '60%'],
        ['1', '20%'],
        ['1', '20%'],
      ],
    ),
    highlight: { found: ['a11:count', 'a11:share'], compare: ['a14:share', 'a8:share'] },
    explanation: 'After sampling five paths, answer 11 gets three votes. The model did not prove 11; it gave 11 more independent support under this sampling distribution.',
  };

  yield {
    state: voteGraph('Self-consistency is a cheap uncertainty wrapper', { sample: 'N paths', bucket: 'counts', vote: 'margin', answer: 'route?' }),
    highlight: { active: ['sample', 'bucket', 'vote'], found: ['answer'] },
    explanation: 'The vote margin becomes an operational signal. A 9 of 10 majority can go through a cheap path. A 4-3-3 split should trigger a verifier, a retrieval pass, or a larger budget.',
    invariant: 'Use disagreement to route work, not just to pick an answer.',
  };

  yield {
    state: labelMatrix(
      'Routing policy',
      [
        { id: 'strong', label: 'strong' },
        { id: 'split', label: 'split' },
        { id: 'unsafe', label: 'unsafe' },
        { id: 'costly', label: 'costly' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'next', label: 'next' },
      ],
      [
        ['high margin', 'ship'],
        ['low margin', 'verify'],
        ['high stakes', 'escalate'],
        ['budget cap', 'stop'],
      ],
    ),
    highlight: { active: ['split:next', 'unsafe:next'], found: ['strong:next'] },
    explanation: 'A production system should not blindly increase samples. It should route by confidence, stakes, cost, and the availability of stronger checks such as tests, calculators, or domain validators.',
  };

  yield {
    state: labelMatrix(
      'Compared with other search',
      [
        { id: 'greedy', label: 'greedy' },
        { id: 'beam', label: 'beam' },
        { id: 'self', label: 'self-con' },
        { id: 'tot', label: 'ToT' },
      ],
      [
        { id: 'keeps', label: 'keeps' },
        { id: 'selects', label: 'selects' },
      ],
      [
        ['1 path', 'top prob'],
        ['k prefix', 'score'],
        ['N paths', 'vote'],
        ['tree', 'value'],
      ],
    ),
    highlight: { active: ['self:keeps', 'self:selects'], compare: ['greedy:keeps', 'tot:keeps'] },
    explanation: 'Self-consistency does not guide generation step by step. It samples full paths independently, then votes. Tree of Thoughts goes further by evaluating intermediate states and deciding where to branch next.',
  };

  yield {
    state: voteGraph('The data structure is simple: map answer -> support'),
    highlight: { active: ['bucket', 'vote'], found: ['answer'] },
    explanation: 'The implementation can be a hash map from normalized answer to count or weighted score. The hard parts are answer normalization, sample diversity, and deciding when agreement is strong enough.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'sample paths') yield* samplePaths();
  else if (view === 'answer marginalization') yield* answerMarginalization();
  else throw new InputError('Pick a self-consistency view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A single chain-of-thought can sound confident while making an early mistake. If the model commits to one path, the whole answer inherits that path\'s arithmetic error, missing fact, or bad assumption.',
        'Self-consistency exists to make reasoning less brittle at decoding time. Instead of trusting one path, sample several paths and choose the final answer that appears most consistently.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is greedy decoding: ask once and take the top path. That is cheap, but it gives one sampled reasoning route total control over the answer.',
        'Beam search is another familiar option, but it keeps high-probability prefixes. For reasoning, the most probable wording is not always the most reliable route to the right final answer.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is uncertainty without proof. Agreement can be useful, but it is not correctness. If all samples share the same misconception or missing fact, the wrong answer can win by majority.',
        'The method also costs more. Ten samples are roughly ten generations unless batching or shorter traces reduce overhead.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat final answers as buckets and reasoning paths as noisy evidence. The implementation can be a hash map from normalized answer to count or weighted score.',
        'If independent paths converge, the answer has more support than a single trace. If paths split, disagreement becomes a routing signal for verification, retrieval, a calculator, or human review.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `In the sample-paths view, each path is one independent attempt to solve the same problem. The path text can differ; the important data structure is the answer bucket. Paths p1, p2, and p4 all supporting 11 matter more than their wording matching exactly.`,
        `In the answer-marginalization view, read the vote margin as an uncertainty signal, not as proof. A strong majority can justify a cheap path. A split vote should trigger a verifier, tool call, retrieval pass, larger sample budget, or human review depending on stakes.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Prompt the model for step-by-step solutions several times, usually with nonzero temperature. Extract or normalize each final answer. Count or weight the answers. Pick the answer with the largest support.',
        'A production system should not blindly increase samples forever. It should route by vote margin, task stakes, sample cost, and availability of stronger checks.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works when errors are diverse and correct routes converge. Different paths can use different wording or intermediate steps while landing on the same answer.',
        'It also works as a cheap uncertainty wrapper. A 9-of-10 vote and a 4-3-3 split should not be treated the same way.',
        'The statistical intuition is marginalization over latent reasoning paths. Instead of betting on one path, the method estimates which final answer has the most support under the model sampling distribution. That helps only when sampling diversity reveals real alternatives rather than repeating the same bias.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost scales roughly with the number of samples. Answer normalization can be surprisingly important: 11, eleven, and "there are 11 balls" should map to the same bucket when the task allows it.',
        'The biggest failure mode is correlated error. Self-consistency is evidence, not proof.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Self-consistency is useful for arithmetic, commonsense reasoning, short planning, and other tasks where multiple independent solution paths can converge on a compact final answer.',
        'It is also helpful as a triage mechanism: high agreement can use the cheap path, while low agreement gets routed to stronger tools.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails on missing facts, biased prompts, ambiguous questions, and tasks where final answers are hard to normalize. It should not replace execution for code, math proofs, or high-stakes decisions when a verifier exists.',
        'In coding, sampling several patch plans can help identify likely diagnoses, but tests and execution remain stronger than a vote.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose a word problem has answer 11. Five samples produce answers 11, 11, 14, 11, and 8. The exact reasoning text differs, but the final-answer bucket for 11 has three votes.',
        'The system returns 11 with a 60 percent vote share or sends it to another verifier if the threshold requires more agreement.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Define answer normalization before sampling. Numeric answers, units, dates, multiple-choice letters, and short text answers each need different canonicalization. Without normalization, the vote map can split identical answers across surface forms.',
        'Track sample count, temperature, prompt version, normalized answer, vote margin, abstention threshold, and fallback path. A self-consistency system should know when it returned a strong majority and when it barely chose among weak alternatives.',
        'Use verifiers where they exist. For arithmetic, call a calculator. For code, run tests. For retrieval questions, check sources. Voting is most useful when verification is unavailable, expensive, or used as a second stage.',
      ],
    },
    {
      heading: 'Worked failure case',
      paragraphs: [
        'A prompt asks for a fact that is missing from the model context. Ten sampled chains may all infer the same plausible but false answer because they share the same training bias. The vote margin looks strong, but the evidence base is empty.',
        'That is why disagreement is useful but agreement is not proof. High agreement can justify confidence only when the task is one where independent reasoning paths are likely to reveal mistakes. For factual freshness, retrieval is usually a better next step.',
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        'Use self-consistency for bounded reasoning tasks with compact final answers and diverse possible solution paths. Use it as a routing signal for uncertainty.',
        'Do not use it to launder unsupported claims. A majority of unsupported samples is still unsupported.',
        'A good system treats the vote as evidence about the model distribution, not evidence about the world. When the world can be checked with a tool, source, execution, or database lookup, do that instead of only sampling more text.',
        'The cleanest deployments pair voting with escalation. High-margin answers can return quickly; low-margin or high-stakes answers move to a verifier, retrieval step, tool call, or human review with the vote map attached.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Set a budget before sampling. Decide the maximum number of paths, early-stop rule, minimum vote margin, and fallback route. Without those controls, self-consistency can become an expensive way to delay admitting uncertainty.',
        'Use diversity carefully. Temperature that is too low repeats the same path. Temperature that is too high creates noisy answers that vote against each other. The useful range depends on task type and answer normalization.',
        'Log disagreements. The losing answers often reveal ambiguity, prompt defects, or missing context. A vote map is not just a decision object; it is a diagnostic object for improving the task.',
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        'The pattern matters in agent systems because it is cheap to add around an existing model call. It can improve math-word-problem style tasks, multiple-choice reasoning, and short planning without training a new model.',
        'It also matters as a design warning. If a product needs correctness, a voting wrapper is not a substitute for verifiers, retrieval, constraints, or execution. It is one uncertainty tool in a larger control system.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary source: Self-Consistency Improves Chain of Thought Reasoning in Language Models at https://arxiv.org/abs/2203.11171. The paper reports gains on arithmetic and commonsense benchmarks by sampling diverse reasoning paths and selecting the most consistent answer.',
        'Study Softmax & Temperature for sample diversity, Beam Search for prefix-level search, Chain of Draft Reasoning Token Budget Case Study for compact reasoning traces, Uncertainty Quantification for committee-style confidence, Tree of Thoughts Search Case Study for intermediate-state search, Process Reward Models & Verifier Search for step scoring, and LLM Evaluation Harnesses for judging whether agreement actually improves correctness.',
      ],
    },
  ],
};
