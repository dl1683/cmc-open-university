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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the pipeline view as post-training state, not as model architecture. Active nodes show which training stage is producing data or rewards; the GRPO view shows a group of sampled answers for the same prompt and compares each answer to the group average. The safe inference is that a reward update is meaningful only where the verifier can score the sampled answer.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'DeepSeek-R1 is a case study in training reasoning behavior after a strong base model already exists. The base model supplies language and general capability; reinforcement learning with verifiable rewards, or RLVR, supplies pressure to search, check, and correct on tasks where answers can be judged. GRPO, or Group Relative Policy Optimization, is the update rule that compares sampled answers within a prompt group instead of training a separate value model.',
        {type:'callout', text:'The R1 architectural lesson is that verifiable rewards make reasoning trainable only where the verifier defines a real environment, not just a prettier imitation target.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/1/1b/Reinforcement_learning_diagram.svg', alt:'Reinforcement learning loop showing an agent taking actions in an environment and receiving state and reward feedback.', caption:'Reinforcement learning system diagram. Source: Wikimedia Commons, Megajuice, CC0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is supervised fine-tuning on polished reasoning traces. That works when humans can write many high-quality examples and when the target style is more important than external correctness. It is still the cleanest way to teach formatting, tone, and readable step-by-step solutions.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that imitation does not create an environment. A model can copy the surface form of reasoning while still guessing the answer, and human-written traces are expensive to scale. For math and code, the answer can often be checked automatically, so the bottleneck becomes sampling and reward assignment rather than writing demonstrations.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use verifiable tasks as a training environment. For one prompt, sample several candidate answers, score each with an objective rule, and update the policy toward candidates that beat the group baseline. The group baseline reduces variance and avoids the cost of a separate critic model, which is the practical appeal of GRPO.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline has a cold-start phase, an RLVR phase, a rejection-sampling phase, and a broader alignment phase. Cold-start data makes reasoning readable enough for training to stay usable. RLVR rewards correct verifiable answers, rejection sampling keeps higher-quality traces, and distillation transfers the behavior to smaller models.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is not that RL magically teaches truth. It works only when the reward is a valid proxy for the task result, such as a unit test, exact answer, proof checker, or executable judge. GRPO then preserves the local ordering: within a prompt group, answers with higher verified reward receive positive advantage and answers below the group mean are pushed down.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'GRPO spends inference to buy training signal. If each prompt samples 8 answers of 1,000 tokens, one prompt consumes about 8,000 generated tokens before any update. Doubling the group size roughly doubles sampling cost, while removing the critic saves the memory and compute of running a separate value model during training.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits math, programming contests, theorem steps with checkers, structured tool use, and narrow scientific tasks with objective validators. It is useful when a cheap verifier can reject bad answers more reliably than a human can write demonstrations. The same idea also helps produce teacher traces for smaller distilled models.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'RLVR fails when the verifier is weak, incomplete, or easy to exploit. A unit test suite can miss edge cases, an exact-answer checker can reward lucky guesses, and a learned judge can inherit preference-model bias. It also raises inference cost because longer reasoning traces and multiple samples are part of the training loop.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take one algebra prompt and sample 4 answers. The verifier scores them as 1, 0, 1, and 0, so the group mean reward is 0.5. The two correct answers have advantage +0.5, and the two wrong answers have advantage -0.5 before KL control pulls the update back toward the reference model.',
        'Now add cost. If each answer is 600 tokens, the group costs 2,400 generated tokens for one prompt. If the same training batch has 1,024 prompts, the sampling pass emits about 2.46 million tokens, so the system must decide whether the verifier quality justifies that spend.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read the DeepSeek-R1 paper at https://arxiv.org/abs/2501.12948 and the DeepSeek-V3 paper for the base-model context. Study PPO, KL regularization, rejection sampling, distillation, and verifier design before treating GRPO as a general recipe. Then compare this page with reinforcement learning, beam search, unit-test-based code generation, and speculative decoding controllers.',
      ],
    },
  ],
};
