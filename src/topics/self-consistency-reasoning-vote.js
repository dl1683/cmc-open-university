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
  {
    const hl = { active: ['prompt', 'sample', 'p1', 'p2', 'p3', 'p4'], found: ['vote'] };
    const pathCount = hl.active.filter(id => id.startsWith('p')).length;
    yield {
      state: voteGraph('Self-consistency replaces one path with a committee'),
      highlight: hl,
      explanation: `A single chain-of-thought decode can make an early arithmetic or commonsense mistake. Self-consistency samples ${pathCount} reasoning paths through ${hl.active.length} active nodes, then asks which final answer appears most consistently.`,
      invariant: 'The unit being voted on is the final answer, not the exact wording of the trace.',
    };
  }

  {
    const rows = [
      { id: 'p1', label: 'p1' },
      { id: 'p2', label: 'p2' },
      { id: 'p3', label: 'p3' },
      { id: 'p4', label: 'p4' },
      { id: 'p5', label: 'p5' },
    ];
    const cols = [
      { id: 'route', label: 'route' },
      { id: 'ans', label: 'ans' },
    ];
    const hl = { active: ['p1:ans', 'p2:ans', 'p4:ans'], compare: ['p3:ans', 'p5:ans'] };
    const agreeing = hl.active.map(c => c.split(':')[0]);
    yield {
      state: labelMatrix('Sampled paths', rows, cols, [
        ['5+6', '11'],
        ['2*3+5', '11'],
        ['bad sub', '14'],
        ['cans first', '11'],
        ['miss can', '8'],
      ]),
      highlight: hl,
      explanation: `Different paths can use different wording and intermediate arithmetic while landing on the same answer. The vote groups ${hl.active.length} paths (${agreeing.join(', ')}) under answer 11 across a ${rows.length}×${cols.length} matrix, while ${hl.compare.length} paths disagree.`,
    };
  }

  {
    const hl = { active: ['bucket', 'vote', 'answer', 'e-bucket-vote', 'e-vote-answer'], found: ['p1', 'p2', 'p4'], compare: ['p3'] };
    const winningPaths = hl.found.join(', ');
    yield {
      state: voteGraph('Bucket by answer before choosing'),
      highlight: hl,
      explanation: `The algorithm marginalizes over reasoning paths: sum support for each final answer, then choose the answer with the strongest support. Paths ${winningPaths} (${hl.found.length} of ${hl.found.length + hl.compare.length}) win the bucket while ${hl.compare.length} path disagrees. It is a decoding-time trick, not model retraining.`,
    };
  }

  {
    const hl = { active: ['clear', 'stable'], compare: ['ambig', 'weak'] };
    const stableSeries = hl.active.join(', ');
    const weakSeries = hl.compare.join(', ');
    yield {
      state: confidencePlot(),
      highlight: hl,
      explanation: `More samples can stabilize the majority on clear problems (series ${stableSeries}, ${hl.active.length} highlighted). If the vote remains split (series ${weakSeries}), the system has learned something useful too: this is a candidate for verifier search, retrieval, tool use, or human review.`,
    };
  }

  {
    const hl = { active: ['p1', 'p2', 'p4', 'vote', 'answer'], removed: ['p3'], compare: ['bucket'] };
    const wrongPaths = hl.active.filter(id => id.startsWith('p'));
    const removedPaths = hl.removed;
    yield {
      state: voteGraph('Correlated errors can still win the vote', { p1: 'wrong', p2: 'wrong', p3: 'right', p4: 'wrong', bucket: 'biased', answer: 'wrong' }),
      highlight: hl,
      explanation: `Self-consistency helps when errors are diverse. It fails when ${wrongPaths.length} paths (${wrongPaths.join(', ')}) share the same misconception while ${removedPaths.length} correct path (${removedPaths.join(', ')}) is outvoted. Agreement is evidence, not a correctness guarantee.`,
    };
  }
}

function* answerMarginalization() {
  {
    const rows = [
      { id: 'a11', label: '11' },
      { id: 'a14', label: '14' },
      { id: 'a8', label: '8' },
    ];
    const cols = [
      { id: 'count', label: 'count' },
      { id: 'share', label: 'share' },
    ];
    const hl = { found: ['a11:count', 'a11:share'], compare: ['a14:share', 'a8:share'] };
    const winnerLabel = rows[0].label;
    yield {
      state: labelMatrix('Marginalize answers', rows, cols, [
        ['3', '60%'],
        ['1', '20%'],
        ['1', '20%'],
      ]),
      highlight: hl,
      explanation: `After sampling five paths, answer ${winnerLabel} gets three votes across a ${rows.length}×${cols.length} matrix with ${hl.found.length} winning cells highlighted. The model did not prove ${winnerLabel}; it gave ${winnerLabel} more independent support while ${hl.compare.length} cells show minority answers.`,
    };
  }

  {
    const hl = { active: ['sample', 'bucket', 'vote'], found: ['answer'] };
    const pipelineNodes = hl.active.join(' -> ');
    yield {
      state: voteGraph('Self-consistency is a cheap uncertainty wrapper', { sample: 'N paths', bucket: 'counts', vote: 'margin', answer: 'route?' }),
      highlight: hl,
      explanation: `The vote margin becomes an operational signal across the ${hl.active.length}-node pipeline (${pipelineNodes}) leading to ${hl.found.length} output node (${hl.found.join(', ')}). A 9 of 10 majority can go through a cheap path. A 4-3-3 split should trigger a verifier, a retrieval pass, or a larger budget.`,
      invariant: 'Use disagreement to route work, not just to pick an answer.',
    };
  }

  {
    const rows = [
      { id: 'strong', label: 'strong' },
      { id: 'split', label: 'split' },
      { id: 'unsafe', label: 'unsafe' },
      { id: 'costly', label: 'costly' },
    ];
    const cols = [
      { id: 'signal', label: 'signal' },
      { id: 'next', label: 'next' },
    ];
    const hl = { active: ['split:next', 'unsafe:next'], found: ['strong:next'] };
    const escalationRows = hl.active.map(c => c.split(':')[0]);
    yield {
      state: labelMatrix('Routing policy', rows, cols, [
        ['high margin', 'ship'],
        ['low margin', 'verify'],
        ['high stakes', 'escalate'],
        ['budget cap', 'stop'],
      ]),
      highlight: hl,
      explanation: `A production system with ${rows.length} routing tiers and ${cols.length} columns should not blindly increase samples. The ${escalationRows.join(', ')} cases (${hl.active.length} cells) need escalation, while ${hl.found.length} cell (${hl.found.join(', ')}) marks the ship path.`,
    };
  }

  {
    const rows = [
      { id: 'greedy', label: 'greedy' },
      { id: 'beam', label: 'beam' },
      { id: 'self', label: 'self-con' },
      { id: 'tot', label: 'ToT' },
    ];
    const cols = [
      { id: 'keeps', label: 'keeps' },
      { id: 'selects', label: 'selects' },
    ];
    const hl = { active: ['self:keeps', 'self:selects'], compare: ['greedy:keeps', 'tot:keeps'] };
    const selfLabel = rows.find(r => r.id === 'self').label;
    const comparedMethods = hl.compare.map(c => c.split(':')[0]);
    yield {
      state: labelMatrix('Compared with other search', rows, cols, [
        ['1 path', 'top prob'],
        ['k prefix', 'score'],
        ['N paths', 'vote'],
        ['tree', 'value'],
      ]),
      highlight: hl,
      explanation: `${selfLabel} does not guide generation step by step across ${rows.length} methods. It samples full paths independently, then votes (${hl.active.length} cells highlighted). Compare with ${comparedMethods.join(' and ')} (${hl.compare.length} cells): Tree of Thoughts goes further by evaluating intermediate states and deciding where to branch next.`,
    };
  }

  {
    const hl = { active: ['bucket', 'vote'], found: ['answer'] };
    const coreNodes = hl.active.join(', ');
    yield {
      state: voteGraph('The data structure is simple: map answer -> support'),
      highlight: hl,
      explanation: `The implementation can be a hash map from normalized answer to count or weighted score, driven by ${hl.active.length} core nodes (${coreNodes}) producing ${hl.found.length} output (${hl.found.join(', ')}). The hard parts are answer normalization, sample diversity, and deciding when agreement is strong enough.`,
    };
  }
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
      heading: 'How to read the animation',
      paragraphs: [
        'Each path in the animation is one sampled attempt to solve the same prompt. The path text may differ, but the value that matters to the vote is the normalized final answer.',
        {type: 'image', src: './assets/gifs/self-consistency-reasoning-vote.gif', alt: 'Animated walkthrough of the self consistency reasoning vote visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Active state marks a sample being generated, found state marks an answer bucket, and compare state marks buckets competing by count or score. The safe inference is narrow: agreement is evidence about the model samples, not proof about the world.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A model can produce one fluent reasoning chain that makes an early arithmetic error or hidden assumption. Greedy decoding then gives that one path complete control over the final answer.',
        'Self-consistency exists to reduce that brittleness at decoding time. It samples several reasoning paths, normalizes their final answers, and chooses the answer with the strongest support.',
        {type: 'callout', text: 'Self-consistency improves a decode by voting over final answers, but the vote is only useful when sampled errors are diverse.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to ask once and take the highest-probability completion. That is cheap and often good enough for simple prompts.',
        'Beam search is another familiar approach, but it keeps high-probability prefixes. In reasoning tasks, a plausible prefix can still lead to a wrong final answer, and diverse paths can matter more than similar high-probability wording.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is path dependence. If one sampled chain takes a wrong turn, the answer may be wrong even when other valid routes would have found the right result.',
        'A second wall is correlated error. If every sample shares the same missing fact or bad premise, majority vote simply makes the wrong answer look more confident.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat reasoning paths as latent variables and final answers as buckets. Instead of trusting one path, estimate which answer receives the most support under the model\'s sampling distribution.',
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/2203.11171/assets/x1.png', alt: 'Self-consistency overview sampling multiple reasoning paths and marginalizing final answers', caption: 'The method samples diverse reasoning paths, then chooses the answer bucket with the strongest support. Source: ar5iv rendering of Wang et al., 2022.'},
        'The method helps when wrong paths fail in different ways while correct paths converge. The vote margin also becomes an uncertainty signal for escalation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Generate k independent solutions with a nonzero temperature or another diversity mechanism. Extract the final answer from each solution and normalize surface forms such as 11, eleven, and there are 11.',
        'Build a map from normalized answer to count or weight. Return the highest-support answer if it clears the threshold; otherwise route to a verifier, retrieval step, tool call, larger sample budget, or human review.',
        'A production system logs the prompt version, sample count, temperature, answer buckets, vote margin, and fallback path. Without those fields, the vote cannot be audited or improved.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Self-consistency works when independent samples provide different noisy views of the same problem. If the correct solution is easier to reach from many paths than any one wrong solution, aggregation increases the chance that the correct answer wins.',
        'This is a form of marginalization over reasoning traces. The system sums support for final answers instead of selecting the single most likely trace.',
        'The method is not a correctness proof. It becomes weak when samples are not diverse, answer extraction is poor, or all paths share the same false premise.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost scales roughly with k, the number of samples. Ten paths usually mean about ten generations, although batching and shorter traces can reduce wall-clock overhead.',
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/2203.11171/assets/x2.png', alt: 'Self-consistency accuracy rising with more sampled reasoning paths on MultiArith', caption: 'Sampling more paths can improve accuracy on some reasoning benchmarks, but every added sample spends more inference budget. Source: ar5iv rendering of Wang et al., 2022.'},
        'Doubling k roughly doubles token spend but does not guarantee doubled accuracy. The useful behavior is diminishing returns: early samples often reveal disagreement, while later samples mostly refine the margin.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Self-consistency fits bounded reasoning tasks with compact final answers: arithmetic word problems, multiple-choice reasoning, short planning, and small logic puzzles. The final answer must be easy to normalize.',
        'It also works as a routing layer. A 9-of-10 vote can take the cheap path, while a 4-3-3 split should trigger a stronger check.',
        'Agent systems can use the vote map diagnostically. Losing buckets often expose ambiguity, missing context, prompt defects, or cases that deserve a tool rather than more sampling.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails on fresh facts, missing facts, biased prompts, and tasks where the answer cannot be normalized cleanly. A majority of unsupported samples is still unsupported.',
        'It should not replace execution for code, calculators for arithmetic, sources for factual claims, or formal proof checks when those verifiers exist. Voting is weaker than observing the thing being checked.',
        'Temperature also creates a tradeoff. Too little diversity repeats the same path; too much diversity creates noise that splits the vote for reasons unrelated to correctness.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose five samples answer a word problem with final outputs 11, 11, 14, 11, and 8. The answer buckets are 11: three votes, 14: one vote, and 8: one vote.',
        'The winner is 11 with 3 / 5 = 60 percent support. If the system threshold is 60 percent, it returns 11; if the threshold is 80 percent, it escalates.',
        'Now suppose ten samples answer a factual question and all say the same outdated date. The vote share is 100 percent, but the evidence is still absent, so retrieval or a source check is the right next step.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Self-Consistency Improves Chain of Thought Reasoning in Language Models at https://arxiv.org/abs/2203.11171. The paper frames the method as sampling diverse reasoning paths and marginalizing final answers.',
        'Study softmax temperature, beam search, chain-of-draft reasoning, uncertainty quantification, Tree of Thoughts, verifier search, and evaluation harnesses. The central follow-up question is when agreement actually predicts correctness.',
      ],
    },
  ],
};
