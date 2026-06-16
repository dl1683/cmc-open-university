// DeepSeek-R1 as an RLVR case study: GRPO samples groups of completions,
// scores them with verifiable rewards, and trains reasoning behavior at scale.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'deepseek-r1-grpo-rlvr-case-study',
  title: 'DeepSeek-R1: GRPO and RLVR Case Study',
  category: 'Papers',
  summary: 'How DeepSeek-R1 connects V3 architecture, GRPO, verifiable rewards, cold-start data, rejection sampling, and distillation.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['training pipeline', 'GRPO loop'], defaultValue: 'training pipeline' },
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

function pipelineGraph(title) {
  return graphState({
    nodes: [
      { id: 'v3', label: 'V3 base', x: 0.7, y: 3.8, note: 'MLA+MoE' },
      { id: 'zero', label: 'R1-Zero', x: 2.3, y: 2.1, note: 'pure RL' },
      { id: 'cold', label: 'cold start', x: 2.3, y: 5.4, note: 'readable CoT' },
      { id: 'rlvr', label: 'RLVR', x: 4.2, y: 3.8, note: 'math/code' },
      { id: 'sample', label: 'filter', x: 5.9, y: 2.2, note: 'keep correct' },
      { id: 'sft', label: 'SFT mix', x: 6.0, y: 5.4, note: 'general data' },
      { id: 'finalrl', label: 'broad RL', x: 7.7, y: 3.8, note: 'final pass' },
      { id: 'r1', label: 'R1', x: 9.45, y: 3.8, note: 'reasoner' },
      { id: 'distill', label: 'student', x: 9.45, y: 6.0, note: '1.5B-70B' },
    ],
    edges: [
      { id: 'e-v3-zero', from: 'v3', to: 'zero' },
      { id: 'e-v3-cold', from: 'v3', to: 'cold' },
      { id: 'e-zero-rlvr', from: 'zero', to: 'rlvr' },
      { id: 'e-cold-rlvr', from: 'cold', to: 'rlvr' },
      { id: 'e-rlvr-sample', from: 'rlvr', to: 'sample' },
      { id: 'e-rlvr-sft', from: 'rlvr', to: 'sft' },
      { id: 'e-sample-finalrl', from: 'sample', to: 'finalrl' },
      { id: 'e-sft-finalrl', from: 'sft', to: 'finalrl' },
      { id: 'e-finalrl-r1', from: 'finalrl', to: 'r1' },
      { id: 'e-r1-distill', from: 'r1', to: 'distill' },
    ],
  }, { title });
}

function grpoGraph(title) {
  return graphState({
    nodes: [
      { id: 'prompt', label: 'prompt', x: 0.8, y: 3.8, note: 'question' },
      { id: 'group', label: 'group', x: 2.5, y: 3.8, note: 'k answers' },
      { id: 'rewardA', label: 'rule score', x: 4.3, y: 2.2, note: 'correct?' },
      { id: 'rewardB', label: 'style score', x: 4.3, y: 5.3, note: 'readable?' },
      { id: 'baseline', label: 'group stats', x: 6.2, y: 3.8, note: 'mean/std' },
      { id: 'adv', label: 'advantage', x: 7.8, y: 3.8, note: 'relative' },
      { id: 'kl', label: 'KL anchor', x: 7.8, y: 6.0, note: 'reference' },
      { id: 'update', label: 'policy update', x: 9.4, y: 3.8, note: 'GRPO' },
    ],
    edges: [
      { id: 'e-prompt-group', from: 'prompt', to: 'group' },
      { id: 'e-group-rule', from: 'group', to: 'rewardA' },
      { id: 'e-group-style', from: 'group', to: 'rewardB' },
      { id: 'e-rule-baseline', from: 'rewardA', to: 'baseline' },
      { id: 'e-style-baseline', from: 'rewardB', to: 'baseline' },
      { id: 'e-baseline-adv', from: 'baseline', to: 'adv' },
      { id: 'e-adv-update', from: 'adv', to: 'update' },
      { id: 'e-kl-update', from: 'kl', to: 'update' },
    ],
  }, { title });
}

function* trainingPipeline() {
  yield {
    state: pipelineGraph('DeepSeek-R1 separates architecture from post-training'),
    highlight: { active: ['v3', 'zero', 'cold', 'e-v3-zero', 'e-v3-cold'], compare: ['r1', 'distill'] },
    explanation: 'The base model already has an efficient architecture: DeepSeek-V3 uses Mixture-of-Experts and Multi-Head Latent Attention. R1 is the post-training case study layered on top of that base.',
  };

  yield {
    state: pipelineGraph('R1-Zero shows what pure RL can discover'),
    highlight: { active: ['zero', 'rlvr', 'e-zero-rlvr'], found: ['r1'], compare: ['cold'] },
    explanation: 'R1-Zero applies reinforcement learning directly to the base model. The paper reports emergent reflection and verification behavior, but also poor readability and language mixing.',
    invariant: 'A reward signal can discover behavior, but it does not automatically make that behavior product-ready.',
  };

  yield {
    state: pipelineGraph('R1 adds cold start, rejection sampling, and a second RL stage'),
    highlight: { active: ['cold', 'rlvr', 'sample', 'sft', 'finalrl', 'r1', 'e-cold-rlvr', 'e-rlvr-sample', 'e-rlvr-sft', 'e-sample-finalrl', 'e-sft-finalrl', 'e-finalrl-r1'] },
    explanation: 'DeepSeek-R1 uses a small cold-start set for readable reasoning, then RL on verifiable tasks, then rejection sampling plus supervised data, then another RL stage for broader scenarios.',
  };

  yield {
    state: labelMatrix(
      'What each stage optimizes',
      [
        { id: 'v3', label: 'V3 base' },
        { id: 'zero', label: 'R1-Zero' },
        { id: 'cold', label: 'cold start' },
        { id: 'rlvr', label: 'RLVR' },
        { id: 'distill', label: 'distill' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['next-token data', 'base blind spots'],
        ['verifiable reward', 'chaotic traces'],
        ['readable CoT', 'format prior'],
        ['math/code correctness', 'reward scope'],
        ['R1 samples', 'teacher artifacts'],
      ],
    ),
    highlight: { active: ['zero:signal', 'rlvr:signal', 'distill:signal'], compare: ['zero:risk', 'rlvr:risk', 'distill:risk'] },
    explanation: 'Each stage has a different data structure for supervision: tokens, rewardable answers, curated traces, accepted samples, and teacher-generated reasoning data. The failure mode changes with the signal.',
  };
}

function* grpoLoop() {
  yield {
    state: grpoGraph('GRPO trains from group-relative rewards'),
    highlight: { active: ['prompt', 'group', 'rewardA', 'baseline', 'adv', 'update', 'e-prompt-group', 'e-group-rule', 'e-rule-baseline', 'e-baseline-adv', 'e-adv-update'], compare: ['kl'] },
    explanation: 'GRPO samples multiple outputs for the same prompt, scores them, and computes an advantage relative to the group. That removes the need for a separate value model the size of the policy.',
  };

  yield {
    state: labelMatrix(
      'Reward types in reasoning RL',
      [
        { id: 'answer', label: 'answer' },
        { id: 'format', label: 'format' },
        { id: 'process', label: 'process' },
        { id: 'human', label: 'human' },
      ],
      [
        { id: 'example', label: 'example' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['exact math/code check', 'narrow coverage'],
        ['language consistency', 'style over truth'],
        ['step verifier', 'verifier bias'],
        ['preference data', 'labeler variance'],
      ],
    ),
    highlight: { found: ['answer:example', 'format:example'], compare: ['process:failure', 'human:failure'] },
    explanation: 'RLVR is strongest where the answer can be checked automatically. Once the task becomes open-ended, the system drifts back toward learned judges, process reward models, or human preference data.',
  };

  yield {
    state: grpoGraph('KL control keeps the model near a reference policy'),
    highlight: { active: ['adv', 'kl', 'update', 'e-adv-update', 'e-kl-update'], compare: ['rewardA', 'rewardB'] },
    explanation: 'The update is not simply maximize reward forever. A KL term anchors the trained policy to a reference policy so optimization does not destroy language quality or chase the reward in a brittle way.',
    invariant: 'Reward needs restraint; otherwise the proxy becomes the target.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'post-training compute and samples', min: 0, max: 100 }, y: { label: 'reasoning capability', min: 0, max: 100 } },
      series: [
        { id: 'smallrl', label: 'small model RL', points: [
          { x: 5, y: 20 }, { x: 20, y: 35 }, { x: 45, y: 48 }, { x: 80, y: 56 },
        ] },
        { id: 'largedistill', label: 'large RL then distill', points: [
          { x: 8, y: 32 }, { x: 25, y: 55 }, { x: 55, y: 73 }, { x: 90, y: 82 },
        ] },
      ],
      markers: [
        { id: 'teacher', x: 80, y: 78, label: 'R1 teacher' },
        { id: 'student', x: 45, y: 69, label: 'distilled student' },
      ],
    }),
    highlight: { active: ['largedistill', 'teacher', 'student'], compare: ['smallrl'] },
    explanation: 'The R1 paper reports that distilling reasoning patterns from a stronger model can beat applying RL directly to a smaller model. Treat that as an empirical recipe to test, not a law of nature.',
  };

  yield {
    state: labelMatrix(
      'Case-study audit checklist',
      [
        { id: 'verifier', label: 'verifier' },
        { id: 'eval', label: 'eval' },
        { id: 'latency', label: 'latency' },
        { id: 'data', label: 'data' },
        { id: 'safety', label: 'safety' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['what can be checked?', 'reward boundary'],
        ['sealed holdouts?', 'benchmark overfit'],
        ['tokens per answer?', 'serving cost'],
        ['sample provenance?', 'distill leakage'],
        ['policy slices?', 'capability is not alignment'],
      ],
    ),
    highlight: { active: ['verifier:question', 'eval:question', 'latency:question', 'data:question', 'safety:question'] },
    explanation: 'A production lesson from R1 is not just "use RL." The real checklist is verifier scope, eval design, inference cost, sample provenance, and safety behavior under longer reasoning traces.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'training pipeline') yield* trainingPipeline();
  else if (view === 'GRPO loop') yield* grpoLoop();
  else throw new InputError('Pick a DeepSeek-R1 view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'DeepSeek-R1 is a reasoning-model case study about post-training, not only about model architecture. DeepSeek-V3 supplies the efficient base architecture: a Mixture-of-Experts model with Multi-Head Latent Attention. R1 then asks a different question: how do you train a model to spend more computation on math, code, and STEM reasoning when many answers can be checked automatically?',
        'The core idea is reinforcement learning with verifiable rewards, often shortened to RLVR. Instead of paying humans to label every reasoning trajectory, the system samples candidate answers for tasks where a rule, unit test, exact answer, or benchmark checker can score correctness. DeepSeek-R1-Zero showed that large-scale RL from the base model could produce reflection and verification behaviors, while DeepSeek-R1 added cold-start data and a multi-stage pipeline to make the behavior more readable and broadly useful: https://arxiv.org/abs/2501.12948.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The training loop uses Group Relative Policy Optimization, or GRPO. For each prompt, the old policy samples a group of completions. Each completion receives rewards, such as answer correctness and sometimes readability or language-consistency rewards. The update compares each sample against the group average instead of learning a separate critic or value model. DeepSeekMath introduced GRPO as a PPO variant that reduces the memory and compute burden of training an additional value function: https://arxiv.org/abs/2402.03300.',
        'DeepSeek-R1 has several stages. R1-Zero applies RL directly to DeepSeek-V3-Base. R1 adds thousands of cold-start long-chain-of-thought examples, performs reasoning-oriented RL, uses rejection sampling to keep correct and readable trajectories, mixes in broader supervised data, and then runs another RL stage for general scenarios. The project also distilled reasoning behavior into smaller Qwen and Llama based dense models, which is why this topic links to Knowledge Distillation: https://github.com/deepseek-ai/DeepSeek-R1.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'RLVR is powerful because the reward can be cheap and objective, but that strength has a boundary. It works best when the task has a clear verifier: math answer checks, code tests, contest problems, structured STEM tasks, or other properties that can be scored without a subjective judge. For open-ended writing, legal analysis, medical advice, or product support, the reward usually becomes a rubric judge, a process reward model, or human preference data again.',
        'The system also shifts cost into sampling and serving. A reasoning model may generate long traces, sample many candidates during training, and spend many more tokens at inference. That means architecture topics like DeepSeek Multi-Head Latent Attention, Mixture of Experts, KV Cache, Transformer Inference Roofline, and LLM Inference Cost Stack matter. The post-training method and the serving data structures are part of one system.',
      ],
    },
    {
      heading: 'Case-study connections',
      paragraphs: [
        'This topic links Process Reward Models & Verifier Search to RLHF & Preference Optimization. GRPO is a policy-gradient method, but the reward source is usually more objective than human preference comparison. It also links to LLM Evaluation Harnesses because R1-style claims only mean anything when the benchmark protocol, sampling policy, pass@1 calculation, holdouts, and contamination controls are clear.',
        'DeepSeek-V3 matters because R1 inherits the base model. The V3 technical report describes a 671B-total-parameter MoE model with 37B activated parameters per token, plus MLA for efficient inference: https://arxiv.org/abs/2412.19437. That is the base capability and efficiency layer. R1 is the post-training layer. Distilled R1 models are the deployment layer for users who want some reasoning behavior without serving the full teacher.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not read R1 as proof that "RL creates general reasoning" in all domains. It shows that RL with strong, cheap verifiers can incentivize useful reasoning behaviors on checkable tasks. The system can still overfit benchmarks, exploit reward quirks, produce long but unnecessary traces, or learn behavior that looks reflective because the reward process favors that style.',
        'A second misconception is that open weights equal full reproducibility. The paper, repository, and weights are valuable, but exact training data, filtering decisions, infrastructure details, and evaluation choices still matter. A serious reproduction needs provenance checks, sealed evals, latency accounting, safety slices, and comparisons against simpler baselines such as rejection sampling, self-consistency, and distillation-only training.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: DeepSeek-R1 at https://arxiv.org/abs/2501.12948 and https://github.com/deepseek-ai/DeepSeek-R1, DeepSeekMath and GRPO at https://arxiv.org/abs/2402.03300, and DeepSeek-V3 at https://arxiv.org/abs/2412.19437. Study DeepSeek Multi-Head Latent Attention, Mixture of Experts, Process Reward Models & Verifier Search, RLHF & Preference Optimization, Policy Gradients, RL Experiment Reproducibility Ledger, Knowledge Distillation, LLM Evaluation Harnesses: Golden Sets and Judges, Benchmark Variance & Model Selection, and LLM Inference Cost Stack next.',
      ],
    },
  ],
};
