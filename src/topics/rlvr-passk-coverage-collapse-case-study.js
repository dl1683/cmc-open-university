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
    {
      heading: 'Why this exists',
      paragraphs: [
        'RLVR means reinforcement learning with verifiable rewards. It is used when a model can produce an answer and an automatic checker can decide whether the answer is correct. Math, code, theorem proving, and structured tool tasks are natural fits. If the verifier is reliable, the reward is cleaner than a vague preference label. The model can sample reasoning traces, receive a reward, and shift probability toward traces that pass.',
        'This case study exists because that shift can be misunderstood. A model can become better at producing a correct first answer while becoming worse at covering the full set of correct solution strategies. Pass@1 can rise while pass@k flattens or falls relative to the base model. That is not a contradiction. It means the policy became more concentrated.',
        'The distinction matters for reasoning systems. A product user may care most about the first answer. A research team may care whether the model still contains broad problem-solving support. An agent system may care whether self-consistency, verifier search, or fallback sampling can still discover rare correct paths. RLVR can improve sampling efficiency, but efficiency is not the same as expanded capability.',
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'The naive evaluation is to report pass@1 before and after RLVR. If the trained model answers more prompts correctly on the first sample, the report says the model learned to reason better. This is tempting because pass@1 is easy to explain, cheap to measure, and close to the experience of a user who asks once and expects one answer.',
        'The problem is that pass@1 only measures the head of the sampling distribution. It does not measure how much correct reasoning remains in the tail. A base model might assign moderate probability to several strategies: one algebraic, one geometric, one brute-force, one rare but robust. RLVR might push most of the probability mass onto the strategy that the verifier rewarded most often. The first sample improves. The rare strategy may almost disappear.',
        'A second naive move is to treat pass@k as a pure product metric. It is not. Most users do not want 256 completions. Pass@k is better understood as a diagnostic for reachable support. If a correct solution appears somewhere among many samples, the model still has that solution in its policy support. If it no longer appears even with large k, the training process may have pruned it away.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to separate sampling efficiency from capability coverage. Sampling efficiency asks how likely the model is to give a good answer under a small budget. Capability coverage asks what correct paths remain reachable when the budget is large enough to explore. RLVR can improve the first while damaging the second.',
        'A helpful mental model is probability mass over reasoning paths. The base policy has a distribution over many traces. Some are wrong. Some are redundant. Some are rare but important. RLVR changes the distribution by rewarding traces that pass the verifier. That can clean up weak behavior, but it can also collapse diversity when the reward favors one narrow route or when training repeatedly samples from the same successful region.',
        'This is why a coverage ledger is the right data structure. For each task slice, record base pass@1, base pass@k, RLVR pass@1, RLVR pass@k, majority vote, entropy, distinct correct paths, lost correct paths, gained correct paths, and serving cost. The ledger prevents one aggregate number from hiding three different claims: first-answer quality, large-budget support, and robustness under voting or search.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An RLVR loop starts with a base model and a task distribution. The model samples completions. A verifier checks the final answer, unit test, proof condition, or other automatically checkable outcome. The training algorithm increases probability for rewarded traces and decreases probability for unrewarded traces, often with constraints that keep the policy from moving too far from the starting model.',
        'The verifier is powerful because it gives clear feedback at scale. It is also narrow. It may check the final answer without checking whether the reasoning was robust. It may reward one style of solution more often because that style is easier to verify. It may miss alternate correct forms. It may create incentives for shortcutting, formatting games, or brittle traces that pass the current checker but fail nearby tasks.',
        'The evaluation should therefore sample at several budgets. At k = 1, measure first-sample accuracy. At small k, measure whether the model became easier to use with light sampling. At large k, measure whether broad correct support remains. Majority vote checks whether the distribution has a stable answer mode. Entropy and distinct-path counts check whether the model is becoming narrower. Slice metrics check whether rare task families were harmed.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The first graph proves that the base model can have wider reasoning support. The base node fans out into several paths. Some are wrong, but some rare paths are correct. The RLVR node shifts mass toward the rewarded path. That is useful when the rewarded path is reliable, but the dim rare-good path is the warning: probability concentration can make a correct route hard to sample.',
        'The pass@k plot proves that curves can cross. RLVR can win at low k because its head is stronger. The base model can win at high k because its tail still contains more distinct correct paths. If a report only shows pass@1, it hides the crossing. If it only shows large-k coverage, it may understate a real user-facing gain. Both metrics are needed because they answer different questions.',
        'The coverage-ledger view proves the release invariant. A narrower policy should not be called more capable until the team measures what it stopped sampling. The entropy plot is not a verdict by itself. Falling entropy can mean useful pruning. It becomes an alarm when entropy falls, pass@1 rises, and slice-level pass@k or distinct-path coverage drops in important areas.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The coverage method works because it treats the model as a distribution, not as a single deterministic solver. A sampled answer is one draw from that distribution. Training changes the distribution. Evaluating several k values lets you see whether training moved probability mass in a healthy way or simply packed it into a smaller region.',
        'Pass@k is useful because it estimates whether at least one correct answer remains reachable under repeated independent samples. It is not perfect. Samples may be correlated, decoders may produce near duplicates, and a high pass@k can still be too expensive to serve. But as a diagnostic, it exposes support that pass@1 cannot see.',
        'The ledger adds the missing qualitative layer. Two models can have the same pass@k and very different path sets. One may solve a task three ways. Another may solve it one way with many paraphrases. Recording distinct reasoning families, verifier outcomes, and task slices makes the coverage claim reviewable instead of rhetorical.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Large-k evaluation is expensive. It requires many completions per task, and each completion may need a verifier, unit test, symbolic checker, sandbox, or judge. It also generates storage and review costs because useful coverage analysis needs traces, not only final answers. That expense is the price of seeing the tail.',
        'Lower entropy can be good when RLVR removes junk paths and makes correct answers cheaper to sample. It becomes risky when the narrower policy loses rare correct strategies. Strong KL constraints, entropy bonuses, rejection sampling, distillation, and verifier design all move this tradeoff; none removes the need to measure coverage.',
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        'This diagnostic matters for math models, code models, theorem provers, agents that call tools, automated repair systems, and benchmark training pipelines. Any place with a verifier can benefit from RLVR, and any place with a verifier can accidentally overfit to what the verifier sees.',
        'In code, a model may learn test-passing patterns that improve first attempts but lose alternative algorithms that generalize to hidden cases. In math, it may overuse a common template and stop sampling rare transformations. In tool-use agents, it may learn the shortest verified path while losing fallback behavior needed when an API changes. In theorem proving, it may concentrate on tactics rewarded by the current proof environment while dropping exploratory paths that matter for harder statements.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure mode is reward hacking. If the verifier is too shallow, the model can learn to satisfy the checker without learning the intended reasoning. The second is path duplication. A large-k sample set can look diverse while containing many surface variants of the same reasoning path. The third is slice collapse, where aggregate pass@1 improves but rare task families lose support.',
        'The fourth failure mode is confusing majority vote with truth. Majority vote can become stronger after RLVR because the model repeats one answer more often. That is helpful when the answer is correct and harmful when the model becomes confidently wrong. The fifth is prompt or decoder dependence. A coverage claim measured with one temperature, top-p setting, or prompt format may not hold under another serving policy.',
        'The fix is not to reject RLVR. The fix is to evaluate it honestly. Measure pass@1, pass@k, entropy, majority vote, distinct correct paths, and slices. Keep examples of lost and gained paths. Decide whether lost support matters for the product. Then tune training, verifier design, sampling, and release gates around the actual risk.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study DeepSeek-R1: GRPO and RLVR for the useful side of verifier-driven training. Then study Process Reward Models and Verifier Search, Self-Consistency Reasoning Vote, Tree of Thoughts, Best-of-N Sampling, Beam Search, and RL Experiment Reproducibility Ledger. The common thread is search over reasoning paths under a budget.',
        'For primary reading, start with Does Reinforcement Learning Really Incentivize Reasoning Capacity in LLMs Beyond the Base Model? at https://arxiv.org/abs/2504.13837 and DeepSeek-R1 at https://arxiv.org/abs/2501.12948. When reading any RLVR result, keep the same questions open: what did pass@1 do, what did large-k coverage do, what paths were lost, what paths were gained, and what verifier incentives shaped the movement?',
      ],
    },
  ],
};
