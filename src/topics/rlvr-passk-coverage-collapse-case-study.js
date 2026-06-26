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
    explanation: 'The base node fans out to several reasoning paths. That breadth is messy because some paths are wrong, but it is also valuable because rare correct paths can still be sampled when k is large.',
  };

  yield {
    state: reasoningGraph('RLVR concentrates probability on rewarded paths', { narrow: true }),
    highlight: { active: ['rl', 'pathA', 'reward', 'pass1', 'e-rl-a', 'e-pathA-reward', 'e-reward-pass1'], compare: ['pathD'] },
    explanation: 'RLVR shifts probability toward the rewarded path, so the first sample is more likely to be correct. The dim rare-good path is the warning: concentrating probability can improve sampling efficiency while shrinking the set of reachable solutions.',
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
    explanation: 'Read the crossing point carefully. RLVR wins when only a few samples are allowed, but the base curve wins at large k because wider support keeps finding distinct correct paths. That is a coverage claim, not just an accuracy claim.',
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
    explanation: 'Each row asks a different question. Pass@1 measures the head of the distribution, pass@k measures reachable coverage, majority vote measures answer concentration, entropy measures breadth, and support tracks which paths disappeared.',
  };
}

function* coverageLedger() {
  yield {
    state: reasoningGraph('Coverage audit compares base and RLVR path sets'),
    highlight: { active: ['base', 'rl', 'pathA', 'pathD', 'passk', 'audit'], compare: ['pass1'] },
    explanation: 'The audit compares the base and RLVR path sets, not only their top answers. A low-probability path still matters when it is the only route through a rare task slice.',
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
    explanation: 'This schema turns coverage into reviewable evidence. For each slice, record large-k coverage before and after RLVR, which correct paths were lost or gained, and what rescue action restores important support.',
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
    explanation: 'The plot is a release alarm, not a verdict. Falling entropy can mean useful pruning, but when it falls while pass@1 rises, check whether rare correct paths are being pruned with the wrong ones.',
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
    explanation: 'The gate separates product value from coverage debt. Ship only when first-sample gains do not hide unacceptable pass@k, majority-vote, slice, or cost regressions.',
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
    { heading: 'How to read the animation', paragraphs: [
      'Read the graph as a distribution over reasoning paths. Active paths receive probability mass, compare paths are alternatives that may disappear, and the pass@k nodes ask whether a correct path remains reachable under repeated sampling.',
      'The safe inference rule is metric separation. If pass@1 rises but large-k coverage or distinct correct paths fall on important slices, the model became more efficient at first answers while losing some reachable strategies.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'RLVR means reinforcement learning with verifiable rewards. It is used when an automatic checker can tell whether an answer, test result, proof step, or tool outcome is correct.',
      'This case study exists because verifier-driven training can concentrate probability. A model can become more likely to answer correctly on the first sample while becoming less likely to sample rare correct strategies when given many attempts.',
      {type:'callout', text:'RLVR can improve pass@1 while narrowing the reachable set of correct strategies, so capability claims need coverage metrics as well as first-answer accuracy.'},
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious evaluation is pass@1, the fraction of tasks solved by the first sampled answer. It is easy to explain and matches a user who asks once and expects one response.',
      'The problem is that pass@1 only measures the head of the sampling distribution. It does not tell whether the model still contains alternate correct routes that can be found with search or verifier sampling.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is support collapse. Support means the set of outputs or reasoning paths with nontrivial probability under the model.',
      'RLVR can shift mass toward one rewarded path and away from rare paths that still matter. The trained model can win at k = 1 while the base model wins at k = 128 because its wider tail still contains more correct alternatives.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Separate sampling efficiency from capability coverage. Sampling efficiency asks how often a small budget finds a correct answer; coverage asks what correct solutions remain reachable when the budget is large.',
      'A coverage ledger records base pass@1, base pass@k, RLVR pass@1, RLVR pass@k, majority vote, entropy, distinct correct paths, lost paths, gained paths, slice labels, and serving cost.',
    ] },
    { heading: 'How it works', paragraphs: [
      'An RLVR loop samples completions from a base model, checks each completion with a verifier, and updates the policy to increase probability for rewarded traces. A verifier can be a unit test, final-answer checker, symbolic proof checker, or tool-result validator.',
      'The same update that rewards good traces can reduce exploration. KL penalties, entropy bonuses, diverse sampling, process rewards, and verifier design can slow collapse, but none removes the need to measure it.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'Pass@k works as a diagnostic because it estimates whether at least one correct answer remains reachable under repeated independent samples. It is not a serving promise; it is a probe of policy support.',
      'Entropy and distinct-path review add the missing structure. Two models can have the same pass@k, but one may solve a task three ways while the other repeats one answer with surface variation.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Large-k evaluation is expensive. A benchmark with 1000 tasks and k = 256 produces 256000 completions, and each may need a verifier, sandbox, unit test, or judge.',
      'The cost changes behavior because it reveals the tail. A model that looks cheaper at k = 1 may be more expensive for agent systems that rely on fallback search when the first route fails.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'This diagnostic matters for math models, code models, theorem provers, tool agents, automated repair systems, and benchmark training pipelines. Any domain with a verifier can gain first-answer accuracy and still lose useful search support.',
      'It is especially important when a product uses best-of-n sampling, self-consistency, verifier search, or fallback retries. Those systems depend on the tail of the distribution.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'The diagnostic fails when samples are near duplicates. A high pass@k from paraphrases of one path is weaker than high pass@k from distinct correct strategies.',
      'It also fails when the verifier is shallow. If the verifier rewards formatting, leaked tests, or brittle final-answer patterns, both pass@1 and pass@k can rise while real reasoning gets worse.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A base model solves 28 percent at pass@1, 71 percent at pass@32, and 89 percent at pass@256. After RLVR, pass@1 rises to 46 percent and pass@32 lands at 67 percent, but pass@256 reaches only 74 percent.',
      'A slice audit finds the reason. On algebra tasks, RLVR concentrated mass on a common manipulation and improved first answers. On geometry tasks, a rare construction path dropped from 8 percent sample frequency to below 0.5 percent, so large-k sampling no longer finds it reliably.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Does Reinforcement Learning Really Incentivize Reasoning Capacity in LLMs Beyond the Base Model? at https://arxiv.org/abs/2504.13837 and DeepSeek-R1 at https://arxiv.org/abs/2501.12948.',
      'Study DeepSeek-R1: GRPO and RLVR, Process Reward Models and Verifier Search, Self-Consistency Reasoning Vote, Tree of Thoughts, Best-of-N Sampling, Beam Search, RL Experiment Reproducibility Ledger, and Benchmark Variance and Model Selection next.',
    ] },
  ],
};
