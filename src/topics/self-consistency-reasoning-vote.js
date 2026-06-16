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
      heading: 'What it is',
      paragraphs: [
        'Self-consistency is a decoding strategy for chain-of-thought reasoning. Instead of taking one greedy reasoning path, sample several diverse paths and choose the final answer that appears most consistently. The data structure is a small vote table: normalized answer -> support.',
        'The method is useful because complex reasoning problems often have multiple valid routes to the same answer. If independent paths converge, the answer has more evidence than a single fluent trace. If paths disagree, the disagreement is itself a signal for more search or verification.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Prompt the model for step-by-step solutions several times, usually with nonzero temperature. Extract or normalize each final answer. Count or weight the answers. Pick the answer with the largest support, optionally routing low-margin cases to a verifier, calculator, retrieval pass, or human review.',
        'This is different from Beam Search. Beam search keeps the best partial prefixes according to model probability. Self-consistency samples full reasoning paths and marginalizes over final answers. It is also simpler than Tree of Thoughts because it does not evaluate intermediate states while generating.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose a word problem has answer 11. Five samples produce answers 11, 11, 14, 11, and 8. The exact reasoning text differs, but the final-answer bucket for 11 has three votes. The system returns 11 with a 60 percent vote share or sends it to another verifier if the threshold requires more agreement.',
        'In a coding task, self-consistency might sample several explanations or patch plans, then group by final diagnosis. It should not replace execution. Code World Models Case Study and Process Reward Models & Verifier Search both show why executable or step-level verifiers are stronger when available.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost scales roughly linearly with the number of samples. Ten paths cost about ten generations unless batching or shorter traces reduce overhead. Answer normalization can be surprisingly important: 11, eleven, and "there are 11 balls" should map to the same bucket when the task allows it.',
        'The biggest failure mode is correlated error. If all samples share the same missing fact or prompt-induced misconception, the wrong answer can win confidently. Self-consistency is a cheap uncertainty wrapper, not a proof system.',
      ],
    },
    {
      heading: 'Primary sources and study next',
      paragraphs: [
        'Primary source: Self-Consistency Improves Chain of Thought Reasoning in Language Models at https://arxiv.org/abs/2203.11171. The paper reports gains on arithmetic and commonsense benchmarks by sampling diverse reasoning paths and selecting the most consistent answer.',
        'Study Softmax & Temperature for sample diversity, Beam Search for prefix-level search, Chain of Draft Reasoning Token Budget Case Study for compact reasoning traces, Uncertainty Quantification for committee-style confidence, Tree of Thoughts Search Case Study for intermediate-state search, Process Reward Models & Verifier Search for step scoring, and LLM Evaluation Harnesses for judging whether agreement actually improves correctness.',
      ],
    },
  ],
};
