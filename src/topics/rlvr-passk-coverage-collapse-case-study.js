// RLVR reasoning coverage: pass@1 can rise while pass@k and solution-support
// coverage shrink as probability mass concentrates on rewarded paths.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'rlvr-passk-coverage-collapse-case-study',
  title: 'RLVR Pass@k Coverage Collapse Case Study',
  category: 'AI & ML',
  summary: 'A reasoning-RL diagnostic: RLVR can improve pass@1 by concentrating probability on rewarded paths while reducing pass@k coverage and exploration breadth.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pass-k frontier', 'coverage ledger'], defaultValue: 'pass-k frontier' },
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

function reasoningGraph(title, { narrow = false } = {}) {
  return graphState({
    nodes: [
      { id: 'prompt', label: 'prompt', x: 0.7, y: 3.5, note: 'task' },
      { id: 'base', label: 'base', x: 2.2, y: 2.0, note: 'wide' },
      { id: 'rl', label: 'RLVR', x: 2.2, y: 5.0, note: narrow ? 'narrow' : 'tuned' },
      { id: 'pathA', label: 'A', x: 4.2, y: 1.1, note: 'correct' },
      { id: 'pathB', label: 'B', x: 4.2, y: 2.7, note: 'maybe' },
      { id: 'pathC', label: 'C', x: 4.2, y: 4.4, note: 'wrong' },
      { id: 'pathD', label: 'D', x: 4.2, y: 6.0, note: 'rare good' },
      { id: 'reward', label: 'reward', x: 6.2, y: 3.5, note: 'verify' },
      { id: 'pass1', label: 'p@1', x: 8.0, y: 2.4, note: 'sample' },
      { id: 'passk', label: 'p@k', x: 8.0, y: 4.8, note: 'coverage' },
      { id: 'audit', label: 'audit', x: 9.4, y: 3.5, note: 'gate' },
    ],
    edges: [
      { id: 'e-prompt-base', from: 'prompt', to: 'base' },
      { id: 'e-prompt-rl', from: 'prompt', to: 'rl' },
      { id: 'e-base-a', from: 'base', to: 'pathA', weight: narrow ? 'less' : 'some' },
      { id: 'e-base-b', from: 'base', to: 'pathB', weight: 'some' },
      { id: 'e-base-c', from: 'base', to: 'pathC', weight: 'some' },
      { id: 'e-base-d', from: 'base', to: 'pathD', weight: 'rare' },
      { id: 'e-rl-a', from: 'rl', to: 'pathA', weight: narrow ? 'much' : 'more' },
      { id: 'e-rl-c', from: 'rl', to: 'pathC', weight: narrow ? 'some' : 'less' },
      { id: 'e-pathA-reward', from: 'pathA', to: 'reward', weight: '+' },
      { id: 'e-pathD-reward', from: 'pathD', to: 'reward', weight: '+' },
      { id: 'e-reward-pass1', from: 'reward', to: 'pass1' },
      { id: 'e-reward-passk', from: 'reward', to: 'passk' },
      { id: 'e-pass1-audit', from: 'pass1', to: 'audit' },
      { id: 'e-passk-audit', from: 'passk', to: 'audit' },
    ],
  }, { title });
}

function* passKFrontier() {
  yield {
    state: reasoningGraph('Base policy has wider reasoning support'),
    highlight: { active: ['prompt', 'base', 'pathA', 'pathB', 'pathC', 'pathD', 'e-base-a', 'e-base-d'], compare: ['rl'] },
    explanation: 'Before RLVR, the base model may sample many reasoning paths. Some are wrong, some are weak, and some rare paths solve problems that a narrow policy will almost never reach.',
  };

  yield {
    state: reasoningGraph('RLVR concentrates probability on rewarded paths', { narrow: true }),
    highlight: { active: ['rl', 'pathA', 'reward', 'pass1', 'e-rl-a', 'e-pathA-reward', 'e-reward-pass1'], compare: ['pathD'] },
    explanation: 'RLVR can improve pass@1 by making the model more likely to sample paths that received verifiable rewards. That is valuable, but it is not the same claim as expanding the model ability frontier.',
    invariant: 'Sampling efficiency and capability coverage are different metrics.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'samples k', min: 1, max: 256 }, y: { label: 'pass@k', min: 0, max: 1 } },
      series: [
        { id: 'base', label: 'base', points: [{ x: 1, y: 0.28 }, { x: 8, y: 0.52 }, { x: 32, y: 0.71 }, { x: 128, y: 0.84 }, { x: 256, y: 0.89 }] },
        { id: 'rl', label: 'RLVR', points: [{ x: 1, y: 0.46 }, { x: 8, y: 0.61 }, { x: 32, y: 0.67 }, { x: 128, y: 0.72 }, { x: 256, y: 0.74 }] },
      ],
      markers: [
        { id: 'cross', x: 32, y: 0.69, label: 'cross' },
      ],
    }),
    highlight: { active: ['rl', 'cross'], compare: ['base'] },
    explanation: 'The conceptual curve matches the diagnostic concern in recent RLVR papers: the trained model can win at small k while the base model wins at large k because the base still explores more distinct solution paths.',
  };

  yield {
    state: labelMatrix(
      'Metric split',
      [
        { id: 'p1', label: 'p@1' },
        { id: 'pk', label: 'p@k' },
        { id: 'maj', label: 'maj@k' },
        { id: 'ent', label: 'ent' },
        { id: 'sup', label: 'sup' },
      ],
      [
        { id: 'asks', label: 'asks' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['first', 'head'],
        ['any', 'hide'],
        ['vote', 'mode'],
        ['wide', 'drop'],
        ['paths', 'lost'],
      ],
    ),
    highlight: { active: ['p1:asks', 'pk:asks', 'ent:asks', 'sup:asks'], compare: ['p1:risk'] },
    explanation: 'A good RLVR report separates first-sample success, large-budget coverage, majority-vote behavior, entropy, and support. Reporting only pass@1 hides exploration collapse.',
  };
}

function* coverageLedger() {
  yield {
    state: reasoningGraph('Coverage audit compares base and RLVR path sets'),
    highlight: { active: ['base', 'rl', 'pathA', 'pathD', 'passk', 'audit'], compare: ['pass1'] },
    explanation: 'The audit asks which problems and paths remain reachable after training. A path can be low probability and still matter if it solves a rare task family.',
  };

  yield {
    state: labelMatrix(
      'Coverage row',
      [
        { id: 'task', label: 'task' },
        { id: 'base', label: 'base' },
        { id: 'rl', label: 'RLVR' },
        { id: 'lost', label: 'lost' },
        { id: 'gain', label: 'gain' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'action', label: 'action' },
      ],
      [
        ['id', 'slice'],
        ['p@256', 'upper'],
        ['p@256', 'check'],
        ['paths', 'rescue'],
        ['paths', 'verify'],
      ],
    ),
    highlight: { active: ['base:value', 'rl:value', 'lost:value'], found: ['lost:action'] },
    explanation: 'Each row records a task slice, base-model large-k coverage, RLVR large-k coverage, lost correct paths, gained correct paths, and the rescue action if the loss matters.',
    invariant: 'Do not call a narrower policy smarter until you measure what it stopped sampling.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'train steps', min: 0, max: 10 }, y: { label: 'entropy', min: 0, max: 1 } },
      series: [
        { id: 'ent', label: 'entropy', points: [{ x: 0, y: 0.86 }, { x: 2, y: 0.73 }, { x: 4, y: 0.61 }, { x: 6, y: 0.48 }, { x: 8, y: 0.39 }, { x: 10, y: 0.33 }] },
        { id: 'p1', label: 'p@1', points: [{ x: 0, y: 0.29 }, { x: 2, y: 0.37 }, { x: 4, y: 0.44 }, { x: 6, y: 0.49 }, { x: 8, y: 0.51 }, { x: 10, y: 0.52 }] },
      ],
      markers: [
        { id: 'gate', x: 6, y: 0.48, label: 'entropy gate' },
      ],
    }),
    highlight: { active: ['ent', 'gate'], compare: ['p1'] },
    explanation: 'Entropy falling while pass@1 rises is not automatically bad. It is a trigger to check whether the model is pruning wrong paths or also pruning rare correct paths.',
  };

  yield {
    state: labelMatrix(
      'Release gate',
      [
        { id: 'p1', label: 'p@1' },
        { id: 'pk', label: 'p@k' },
        { id: 'maj', label: 'maj' },
        { id: 'slice', label: 'slice' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'must', label: 'must' },
        { id: 'why', label: 'why' },
      ],
      [
        ['up', 'UX'],
        ['flat', 'scope'],
        ['up', 'vote'],
        ['no loss', 'tail'],
        ['known', 'serve'],
      ],
    ),
    highlight: { active: ['p1:must', 'pk:must', 'slice:must'], found: ['cost:must'] },
    explanation: 'Ship a reasoning-RL policy only when pass@1 improves without unacceptable pass@k or slice coverage loss, and when the added tokens and verifier costs fit the serving budget.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pass-k frontier') yield* passKFrontier();
  else if (view === 'coverage ledger') yield* coverageLedger();
  else throw new InputError('Pick an RLVR coverage view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'RLVR, reinforcement learning with verifiable rewards, can make a language model more likely to emit correct reasoning traces on tasks where answers are automatically checkable. The subtle risk is that the trained policy may concentrate probability mass on rewarded paths while losing broader solution coverage.',
        'The paper Does Reinforcement Learning Really Incentivize Reasoning Capacity in LLMs Beyond the Base Model? reports the diagnostic pattern directly: RLVR-trained models can outperform base models at small k while base models outperform at large pass@k, suggesting improved sampling efficiency but narrower reasoning coverage: https://arxiv.org/abs/2504.13837.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The right data structure is a coverage ledger over sampled reasoning paths. For each task slice, record base pass@1, base pass@k, RLVR pass@1, RLVR pass@k, majority vote, entropy, lost correct paths, gained correct paths, and serving cost. That separates three claims that are often collapsed: first-sample accuracy, large-budget capability coverage, and answer robustness under voting.',
        'DeepSeek-R1 is an important companion case study because it shows the useful side of RLVR: verifiable rewards can improve math and code reasoning, especially when combined with cold-start data, rejection sampling, and distillation: https://arxiv.org/abs/2501.12948. The coverage warning does not say RLVR is useless; it says the claim must be measured at more than one sampling budget.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Large-k evaluation is expensive because it samples many completions and often runs verifiers. That expense is the point. If the product relies on reasoning breadth, rare task families, or self-consistency, a pass@1-only report can green-light a model that is faster to be confidently wrong outside the reward-supported region.',
        'The operational tradeoff is policy entropy. Lower entropy can reduce wasted samples and improve user-facing accuracy. Too much collapse can erase rare correct strategies. Release gates should include entropy, path diversity, large-k coverage, and slice-level regressions, not only aggregate benchmark gains.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This matters for math, code, theorem proving, tool-use agents, and any workflow where a verifier rewards only a subset of useful behavior. It also matters for distillation: a distilled student may acquire paths from a stronger teacher, while RLVR on a smaller base may mostly reweight paths already present in that smaller model.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not equate pass@1 gain with new reasoning ability. Do not equate pass@k with deployed utility either; a user normally does not want 256 samples. Use pass@k as a diagnostic for support and exploration, then decide the serving policy separately. Recent pass@k analysis also warns that pass@k is better treated as an exploration diagnostic than as a direct optimization objective: https://arxiv.org/abs/2511.16231.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: RLVR coverage paper at https://arxiv.org/abs/2504.13837, DeepSeek-R1 at https://arxiv.org/abs/2501.12948, and Pass@k Metric for RLVR at https://arxiv.org/abs/2511.16231. Study DeepSeek-R1: GRPO and RLVR, Process Reward Models & Verifier Search, Self-Consistency Reasoning Vote, Tree of Thoughts, and RL Experiment Reproducibility Ledger next.',
      ],
    },
  ],
};
