// RLHF and preference optimization: turn human comparisons into a reward model
// or directly into a policy update.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'rlhf-preference-optimization',
  title: 'RLHF & Preference Optimization',
  category: 'AI & ML',
  summary: 'Instruction tuning, preference data, reward models, PPO, KL control, and the DPO shortcut for aligning language models.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['rlhf pipeline', 'dpo shortcut'], defaultValue: 'rlhf pipeline' },
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

function rlhfGraph(title) {
  return graphState({
    nodes: [
      { id: 'base', label: 'base LM', x: 0.6, y: 3.8, note: 'pretrained' },
      { id: 'sft', label: 'SFT model', x: 2.2, y: 3.8, note: 'demos' },
      { id: 'samples', label: 'sample outputs', x: 3.9, y: 2.3, note: 'candidates' },
      { id: 'prefs', label: 'human rankings', x: 5.4, y: 2.3, note: 'chosen vs rejected' },
      { id: 'rm', label: 'reward model', x: 6.9, y: 3.8, note: 'scores outputs' },
      { id: 'ppo', label: 'PPO update', x: 8.3, y: 3.8, note: 'policy gradient' },
      { id: 'kl', label: 'KL penalty', x: 8.3, y: 5.8, note: 'stay near SFT' },
      { id: 'aligned', label: 'aligned LM', x: 9.5, y: 3.8, note: 'post-trained' },
    ],
    edges: [
      { id: 'e-base-sft', from: 'base', to: 'sft', weight: 'supervised fine-tune' },
      { id: 'e-sft-samples', from: 'sft', to: 'samples', weight: 'generate' },
      { id: 'e-samples-prefs', from: 'samples', to: 'prefs', weight: 'rank' },
      { id: 'e-prefs-rm', from: 'prefs', to: 'rm', weight: 'train' },
      { id: 'e-rm-ppo', from: 'rm', to: 'ppo', weight: 'reward' },
      { id: 'e-kl-ppo', from: 'kl', to: 'ppo', weight: 'constraint' },
      { id: 'e-ppo-aligned', from: 'ppo', to: 'aligned', weight: 'update' },
    ],
  }, { title });
}

function dpoGraph(title) {
  return graphState({
    nodes: [
      { id: 'prompt', label: 'prompt', x: 0.7, y: 3.8, note: 'input' },
      { id: 'chosen', label: 'chosen response', x: 2.8, y: 2.5, note: 'preferred' },
      { id: 'reject', label: 'rejected response', x: 2.8, y: 5.1, note: 'less preferred' },
      { id: 'policy', label: 'policy LM', x: 5.0, y: 3.8, note: 'trainable' },
      { id: 'ref', label: 'reference LM', x: 5.0, y: 6.0, note: 'frozen' },
      { id: 'loss', label: 'DPO loss', x: 7.2, y: 3.8, note: 'classification' },
      { id: 'updated', label: 'updated LM', x: 9.0, y: 3.8, note: 'preference tuned' },
    ],
    edges: [
      { id: 'e-prompt-chosen', from: 'prompt', to: 'chosen', weight: 'pair' },
      { id: 'e-prompt-reject', from: 'prompt', to: 'reject', weight: 'pair' },
      { id: 'e-chosen-policy', from: 'chosen', to: 'policy', weight: 'log prob' },
      { id: 'e-reject-policy', from: 'reject', to: 'policy', weight: 'log prob' },
      { id: 'e-ref-loss', from: 'ref', to: 'loss', weight: 'KL anchor' },
      { id: 'e-policy-loss', from: 'policy', to: 'loss', weight: 'preference margin' },
      { id: 'e-loss-updated', from: 'loss', to: 'updated', weight: 'gradient' },
    ],
  }, { title });
}

function* rlhfPipeline() {
  yield {
    state: rlhfGraph('RLHF turns demonstrations and comparisons into policy updates'),
    highlight: { active: ['base', 'sft', 'e-base-sft'], compare: ['prefs', 'rm', 'ppo'] },
    explanation: 'RLHF usually starts with supervised fine-tuning on demonstrations. That creates a model that follows instructions better before reinforcement learning begins.',
  };

  yield {
    state: rlhfGraph('Human preference data trains a reward model'),
    highlight: { active: ['samples', 'prefs', 'rm', 'e-samples-prefs', 'e-prefs-rm'], compare: ['sft'] },
    explanation: 'Labelers compare candidate responses. A reward model learns to score outputs so preferred responses score higher than rejected responses. This turns human comparisons into a scalar training signal.',
    invariant: 'The reward model is a proxy for preference, not preference itself.',
  };

  yield {
    state: rlhfGraph('PPO optimizes reward while KL keeps the model near the reference'),
    highlight: { found: ['ppo', 'kl', 'aligned', 'e-rm-ppo', 'e-kl-ppo', 'e-ppo-aligned'] },
    explanation: 'Policy Gradients and PPO enter here. The language model is the policy, tokens are actions, the reward model scores whole responses, and a KL penalty discourages drifting too far from the supervised model.',
  };

  yield {
    state: labelMatrix(
      'RLHF failure modes',
      [
        { id: 'rewardhack', label: 'reward hacking' },
        { id: 'bias', label: 'labeler bias' },
        { id: 'drift', label: 'KL drift' },
        { id: 'eval', label: 'eval overfit' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'response', label: 'response' },
      ],
      [
        ['model exploits reward model', 'red-team and refresh RM'],
        ['preferences encode policy choices', 'guidelines and audits'],
        ['language quality degrades', 'KL control'],
        ['wins benchmark, hurts users', 'held-out human evals'],
      ],
    ),
    highlight: { active: ['rewardhack:response', 'drift:response', 'eval:response'], compare: ['bias:symptom'] },
    explanation: 'RLHF is a system of proxies. The model optimizes the reward model, not the true human good. Evaluation and data governance are part of the algorithm.',
  };
}

function* dpoShortcut() {
  yield {
    state: dpoGraph('DPO trains directly from chosen/rejected pairs'),
    highlight: { active: ['chosen', 'reject', 'policy', 'loss', 'e-chosen-policy', 'e-reject-policy', 'e-policy-loss'], compare: ['ref'] },
    explanation: 'Direct Preference Optimization uses preference pairs without training a separate reward model and without running an online RL loop. It turns the preference problem into a classification-style loss over chosen versus rejected responses.',
  };

  yield {
    state: dpoGraph('The frozen reference model anchors the update'),
    highlight: { active: ['ref', 'e-ref-loss'], found: ['loss', 'updated'] },
    explanation: 'DPO still needs an anchor. The frozen reference model keeps the tuned policy from simply increasing probabilities indiscriminately. The objective favors chosen responses relative to rejected ones while controlling drift.',
    invariant: 'Preference tuning needs both direction and restraint.',
  };

  yield {
    state: labelMatrix(
      'RLHF versus DPO',
      [
        { id: 'data', label: 'preference data' },
        { id: 'rm', label: 'reward model' },
        { id: 'online', label: 'online sampling' },
        { id: 'control', label: 'drift control' },
      ],
      [
        { id: 'ppo', label: 'PPO-style RLHF' },
        { id: 'dpo', label: 'DPO' },
      ],
      [
        ['needed', 'needed'],
        ['separate model', 'implicit in loss'],
        ['yes', 'no for basic training'],
        ['KL penalty', 'reference likelihood ratio'],
      ],
    ),
    highlight: { found: ['rm:dpo', 'online:dpo'], compare: ['rm:ppo', 'online:ppo'] },
    explanation: 'DPO is simpler operationally because it removes the separate reward-model optimization loop. That does not remove the hard part: collecting preference data that actually represents the target behavior.',
  };

  yield {
    state: labelMatrix(
      'Preference data quality checklist',
      [
        { id: 'prompts', label: 'prompt coverage' },
        { id: 'rubric', label: 'labeling rubric' },
        { id: 'disagree', label: 'disagreement' },
        { id: 'safety', label: 'safety slices' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'risk', label: 'risk if weak' },
      ],
      [
        ['real user distribution', 'overfit toy prompts'],
        ['explicit tradeoffs', 'inconsistent labels'],
        ['measure labeler variance', 'false certainty'],
        ['separate evals', 'capability-safety tradeoff hidden'],
      ],
    ),
    highlight: { found: ['prompts:check', 'rubric:check', 'disagree:check', 'safety:check'] },
    explanation: 'Preference optimization quality is capped by the preference dataset. The loss can be elegant while the labels encode shallow style preferences, policy mistakes, or missing edge cases.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'rlhf pipeline') yield* rlhfPipeline();
  else if (view === 'dpo shortcut') yield* dpoShortcut();
  else throw new InputError('Pick an RLHF view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'RLHF, reinforcement learning from human feedback, is the post-training pipeline that made instruction-following language models more useful. It combines supervised fine-tuning, human preference comparisons, reward modeling, policy optimization, and drift control.',
        'Direct Preference Optimization is a later simplification. It uses chosen/rejected response pairs directly in a classification-style objective, avoiding a separate reward model and online PPO loop for the basic training step.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In classic RLHF, a base language model is supervised-fine-tuned on demonstrations. The SFT model generates candidate responses. Humans rank or compare those responses. A reward model is trained to assign higher scores to preferred responses. PPO then updates the language model to maximize reward while a KL penalty keeps it close to the reference model.',
        'DPO starts from the same preference-pair data but derives a direct objective that increases the relative likelihood of chosen responses over rejected responses, anchored by a frozen reference model. It is simpler to implement and more stable for many fine-tuning workflows.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The expensive part is not only GPU time. Preference optimization needs prompt coverage, labeler guidelines, disagreement measurement, safety slices, red-team examples, and held-out human evaluations. Reward models can be gamed. DPO can still overfit to narrow preferences. A KL anchor controls drift but does not guarantee truthfulness or safety.',
        'There is also a data flywheel risk. If preference data mostly comes from model-written outputs, the model learns the style and blind spots of its own previous generations. If labelers reward smoothness over correctness, the model becomes smoother. If refusals dominate safety labels, the model may learn broad refusal instead of precise risk handling. Preference optimization amplifies the rubric.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RLHF and DPO are used for chat assistants, summarization, coding assistants, tool-using agents, style tuning, refusal behavior, safety tuning, and domain-specific assistants. The topic connects Policy Gradients, PPO, Knowledge Distillation, Calibration Curves, Data Leakage, and Fairness Metrics.',
        'Production systems often combine several post-training stages: supervised fine-tuning for format and task behavior, preference optimization for helpfulness, targeted safety data for policy boundaries, and evaluation suites that measure factuality, refusal precision, coding ability, and regressions. The alignment method is only one part of that release process.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Preference optimization is not a truth machine. It aligns the model to the observed preference signal. If labelers prefer confident nonsense, the model can learn confident nonsense. If the reward model misses edge cases, the policy can exploit those blind spots. Evaluation must remain independent from the training preference data.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: InstructGPT / training language models with human feedback at https://arxiv.org/abs/2203.02155, Deep Reinforcement Learning from Human Preferences at https://arxiv.org/abs/1706.03741, and Direct Preference Optimization at https://arxiv.org/abs/2305.18290. Study Human Evaluation Labeling Queue Case Study, Policy Gradients, PPO, RL Experiment Reproducibility Ledger, Knowledge Distillation, Calibration Curves, Fairness Metrics, and Data Leakage next.',
      ],
    },
  ],
};
