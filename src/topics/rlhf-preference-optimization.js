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
    explanation: 'Read the highlighted path left to right. Pretraining gives language ability, supervised demonstrations teach the response shape, and only then does preference optimization push behavior. SFT is the naive baseline and the reference RLHF must avoid damaging.',
  };

  yield {
    state: rlhfGraph('Human preference data trains a reward model'),
    highlight: { active: ['samples', 'prefs', 'rm', 'e-samples-prefs', 'e-prefs-rm'], compare: ['sft'] },
    explanation: 'The samples node creates alternatives, the preference node records chosen versus rejected outputs, and the reward model compresses those comparisons into a scalar score. That scalar is useful because PPO needs rewards, but it is still a proxy for human preference.',
    invariant: 'The reward model is a proxy for preference, not preference itself.',
  };

  yield {
    state: rlhfGraph('PPO optimizes reward while KL keeps the model near the reference'),
    highlight: { found: ['ppo', 'kl', 'aligned', 'e-rm-ppo', 'e-kl-ppo', 'e-ppo-aligned'] },
    explanation: 'The PPO node treats the language model as a policy over tokens and pushes outputs that the reward model scores highly. The KL node is the brake: without it, reward pressure can move the model away from the fluent supervised policy that collected the data.',
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
    explanation: 'Each row names a way the proxy can fail and the control that catches it. RLHF optimizes the reward model, not true human welfare, so red-team data, label audits, KL checks, and held-out human evals are part of the algorithm.',
  };
}

function* dpoShortcut() {
  yield {
    state: dpoGraph('DPO trains directly from chosen/rejected pairs'),
    highlight: { active: ['chosen', 'reject', 'policy', 'loss', 'e-chosen-policy', 'e-reject-policy', 'e-policy-loss'], compare: ['ref'] },
    explanation: 'DPO keeps the preference pair and removes the explicit reward-model/PPO loop. The chosen and rejected responses feed one classification-style loss: raise the chosen response relative to the rejected one for the same prompt.',
  };

  yield {
    state: dpoGraph('The frozen reference model anchors the update'),
    highlight: { active: ['ref', 'e-ref-loss'], found: ['loss', 'updated'] },
    explanation: 'The reference model is the anchor line in the graph. It tells the loss how far the trainable policy has moved, so preference tuning has both direction (chosen over rejected) and restraint (do not drift without bound).',
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
    explanation: 'The table shows the operational simplification: DPO removes the separate reward model and basic online sampling loop. It does not remove the identification problem; the preference pairs still define what behavior the model will learn.',
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
    explanation: 'The checklist is the data-quality gate. Prompt coverage, a clear rubric, measured disagreement, and safety slices decide whether the loss learns the intended behavior or only labeler habits and missing edge cases.',
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
      heading: 'Why this exists',
      paragraphs: [
        'Pretrained language models learn to predict text. That gives them broad knowledge and fluent continuation, but it does not by itself make them useful assistants. The model may answer the wrong question, follow the style of bad training text, ignore safety boundaries, or optimize for plausible continuation rather than helpful completion.',
        'Supervised fine-tuning helps by showing demonstrations of desired behavior. It teaches format, tone, task shape, and refusal patterns. But demonstrations are expensive, and they do not capture many tradeoffs: which of two answers is clearer, whether a refusal is too broad, whether a coding answer is useful, or whether a summary preserves what matters.',
        'RLHF and preference optimization exist to turn comparative human judgment into a training signal. Instead of asking humans to write every ideal answer, the system asks which candidate is better and then trains the model to prefer that kind of response.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to fine-tune only on demonstrations. That can work for narrow tasks, but it asks labelers to produce perfect answers rather than judge relative quality. It also wastes information: a rejected answer teaches what not to do, but plain imitation usually discards it.',
        'A second shortcut is to train a reward model and maximize it as hard as possible. That creates a new proxy gap. The policy can learn to exploit the reward model, become verbose because verbosity was rewarded, hide uncertainty because confidence was rewarded, or drift away from the base model\'s language competence.',
        'A third shortcut is to treat preference tuning as a moral guarantee. It is not. It aligns the model to observed preference data under a particular rubric, labeler population, prompt distribution, and optimization method. If those are narrow or biased, the trained behavior will be narrow or biased too.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is direction plus restraint. Preference data says which way to move: make chosen responses more likely than rejected responses for the same prompt. The reference model says how far to move: do not destroy the language model while chasing the preference signal.',
        'Classic RLHF creates an explicit reward model from comparisons, then uses policy optimization to increase reward while a KL penalty keeps the policy near a reference model. DPO folds the comparison and reference constraint into a direct loss, raising the chosen response relative to the rejected one without a separate reward-model and PPO loop.',
        'Both methods are ways of converting human comparisons into gradients. The hard part is not only the math. The hard part is deciding what the comparisons mean, collecting them across the real task distribution, measuring disagreement, and keeping the proxy from becoming the target.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A typical RLHF pipeline starts with a pretrained model, then supervised-fine-tunes it on demonstrations. The SFT model samples several responses for the same prompt. Humans rank or compare those responses. A reward model learns to score responses so chosen outputs receive higher reward than rejected outputs.',
        'Policy optimization then updates the model to produce higher-reward responses. PPO-style RLHF treats the language model as a policy: tokens are actions, the prompt is context, and the reward model scores the completed response. The KL penalty discourages the tuned policy from moving too far from the reference SFT model.',
        'DPO starts from the same chosen/rejected pairs but uses a direct objective. For each prompt, it increases the relative likelihood of the chosen answer and decreases the relative likelihood of the rejected answer, measured against a frozen reference model. The result is simpler operationally, but the preference data still defines the behavior.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The RLHF pipeline view proves that human judgment is not used directly at inference time. It is converted into training artifacts: demonstrations, preference pairs, a reward model, policy updates, and evaluation gates. The reward model is a proxy for preference, not preference itself.',
        'The KL node in the visual is not decorative. It is the restraint term that prevents the optimizer from chasing the reward model so hard that language quality, calibration, or safety behavior collapses. Preference tuning without restraint can become reward hacking with better branding.',
        'The DPO view proves the simplification. Chosen and rejected responses feed one loss, and the frozen reference model anchors the comparison. DPO removes a large operational loop, but it does not remove the need for good prompts, clean labels, disagreement tracking, safety slices, or held-out evaluation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Preference learning works because comparisons are often easier and more reliable than absolute scores. A labeler may struggle to assign a helpfulness number, but can often tell which of two answers is clearer, safer, more complete, or less misleading.',
        'The reward model or DPO loss turns that comparison into a gradient. Over many prompts and pairs, the model learns patterns of preferred behavior: answer the actual question, preserve constraints, explain enough but not too much, avoid unsupported claims, refuse dangerous requests when appropriate, and stay useful when refusing.',
        'The reference constraint works because the base or SFT model already contains broad language competence. Preference optimization should steer that competence, not replace it. The anchor makes the update local enough that the model keeps grammar, world knowledge, coding syntax, and general task ability while shifting behavior.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The expensive part is not only GPU time. Preference optimization needs prompt coverage, labeler guidelines, disagreement measurement, safety slices, red-team examples, reward-model validation, and held-out human evaluations. A cheap preference dataset can be worse than no preference dataset if it teaches the model the wrong proxy.',
        'RLHF with PPO is operationally heavy: sampling, reward-model serving, policy rollouts, KL tuning, instability controls, and evaluation loops. DPO is simpler and often more stable for fine-tuning, but it can still overfit narrow data, amplify labeler habits, and trade factuality for preferred style.',
        'There is also a data flywheel risk. If preference data mostly comes from model-written outputs, the model learns the style and blind spots of its own previous generations. If labelers reward smoothness over correctness, the model becomes smoother. If refusals dominate safety labels, the model may learn broad refusal instead of precise risk handling.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'RLHF and DPO win when the task is hard to specify as a single target but easy to compare. Chat helpfulness, summarization quality, coding assistance, tool-use discipline, refusal precision, style transfer, domain tone, and support workflows all benefit from comparative feedback.',
        'They are especially useful after supervised fine-tuning has already taught the basic task format. Preference optimization is a steering phase: it shifts the model from merely imitating demonstrations toward making better choices among plausible responses.',
        'Production systems usually combine several stages: supervised fine-tuning for format and task behavior, preference optimization for helpfulness, targeted safety data for policy boundaries, adversarial data for failure modes, and evaluation suites that measure factuality, refusal precision, coding ability, latency, cost, and regressions.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Preference optimization is not a truth machine. It aligns the model to the observed preference signal. If labelers prefer confident nonsense, the model can learn confident nonsense. If the reward model misses edge cases, the policy can exploit those blind spots.',
        'Labeler bias is a structural risk. Different users value brevity, caution, detail, creativity, speed, and safety differently. A single rubric may erase important disagreement. Good pipelines measure disagreement rather than pretending every preference pair is equally obvious.',
        'Evaluation leakage is another failure. If the same prompt styles, rubrics, or judge models drive training and evaluation, the release score can rise while real behavior stagnates. Held-out human review, task-specific evals, red-team prompts, and slice-level regression checks are part of the method, not paperwork after the method.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: InstructGPT / training language models with human feedback at https://arxiv.org/abs/2203.02155, Deep Reinforcement Learning from Human Preferences at https://arxiv.org/abs/1706.03741, and Direct Preference Optimization at https://arxiv.org/abs/2305.18290. Study Human Evaluation Labeling Queue Case Study, Policy Gradients, PPO, RL Experiment Reproducibility Ledger, Knowledge Distillation, Calibration Curves, Fairness Metrics, and Data Leakage next.',
      ],
    },
  ],
};
