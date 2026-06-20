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
      heading: 'Why this exists',
      paragraphs: [
        `DeepSeek-R1 is useful as a case study because it separates two questions that are often blurred together. DeepSeek-V3 is the base-model and architecture layer, with Mixture-of-Experts routing and Multi-Head Latent Attention. R1 is the post-training layer. It asks how a model can learn to spend more computation on reasoning when many tasks have answers that can be checked automatically.`,
        `The pressure comes from the cost of human demonstrations. Supervised fine-tuning can teach a model to imitate polished chains of thought, but high-quality reasoning traces are expensive, biased toward the annotator's style, and hard to scale across math, code, and STEM tasks. Reinforcement learning with verifiable rewards, or RLVR, tries to move the expensive part from "write the whole solution" to "check whether the result satisfies an objective rule." The DeepSeek-R1 paper argues that large-scale RL can incentivize self-verification, reflection, and strategy changes on verifiable tasks: https://arxiv.org/abs/2501.12948.`,
        {type:'callout', text:'The R1 architectural lesson is that verifiable rewards make reasoning trainable only where the verifier defines a real environment, not just a prettier imitation target.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/1/1b/Reinforcement_learning_diagram.svg', alt:'Reinforcement learning loop showing an agent taking actions in an environment and receiving state and reward feedback.', caption:'Reinforcement learning system diagram. Source: Wikimedia Commons, Megajuice, CC0.'},
      ],
    },
    {
      heading: 'The naive approach and the wall',
      paragraphs: [
        `The straightforward path is to collect excellent human solutions and fine-tune on them. That works when the target behavior is mostly style, instruction following, or domain format. It also gives readable outputs from the beginning. The problem is that imitation does not force the model to discover new search behavior. It can learn the surface shape of a solution without learning when to backtrack, verify, or try a different strategy.`,
        `The next straightforward path is standard PPO-style RLHF. PPO can optimize a reward, but for large language models it often carries an additional value model or critic, plus memory-heavy rollouts and careful KL control. DeepSeekMath introduced Group Relative Policy Optimization as a PPO variant that compares samples within a group and reduces the need for a separate value function: https://arxiv.org/abs/2402.03300. R1 applies that style of group-relative RL to reasoning domains where answers can be scored by rules, tests, or benchmark checkers.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that a group of completions for the same prompt contains its own local baseline. If one answer is correct and readable while other sampled answers fail the checker, the update can increase the probability of the better trajectory relative to its siblings. The model does not need a human to rank every pair or write the ideal solution. It needs a reward signal strong enough to say which sampled behaviors worked.`,
        `This changes the role of data. In ordinary supervised training, the dataset is the behavior to imitate. In RLVR, the prompt distribution plus verifier define an environment. The model explores by sampling, receives reward from the checker, and updates toward trajectories that solved the task. The verifier boundary is the whole trick and the whole danger. The method is strongest when correctness is mechanically checkable and weakest when the reward only measures a proxy for the real goal.`,
      ],
    },
    {
      heading: 'How the pipeline works',
      paragraphs: [
        `The R1 family has two teaching branches. DeepSeek-R1-Zero starts from the base model and applies RL directly, without a supervised fine-tuning stage first. The public repository describes emergent self-verification and reflection, but also endless repetition, poor readability, and language mixing: https://github.com/deepseek-ai/DeepSeek-R1. That branch proves that reward alone can discover some reasoning behavior, but it also proves that reward alone does not guarantee product-quality traces.`,
        `DeepSeek-R1 adds a more engineered pipeline. It uses cold-start data to seed readable long reasoning, runs reasoning-oriented RL, uses rejection sampling to keep better trajectories, mixes in broader supervised data, and applies another RL stage for more general scenarios. The repository summarizes this as two RL stages and two SFT stages. The final family also includes distilled dense students based on Qwen and Llama, so the large trained reasoner becomes a teacher for cheaper deployments.`,
        `GRPO is the update loop inside the RL stages. For each prompt, the current policy samples a group of completions. Rewards score answer correctness and sometimes formatting or language consistency. The group mean and variance become the local baseline. A completion above the group baseline receives positive advantage; one below receives negative advantage. A KL term keeps the policy near a reference model so reward optimization does not destroy language quality or chase a brittle exploit.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The training-pipeline view shows that R1 is not one magic update. The V3 base supplies capability and efficient inference machinery. R1-Zero tests pure RL. R1 adds cold-start traces, RLVR, rejection sampling, supervised mixing, a final RL pass, and distillation. The graph teaches where each signal enters and what failure it addresses: base pretraining supplies language and knowledge, verifiable reward supplies task pressure, cold-start data supplies readable format, and distillation supplies deployable students.`,
        `The GRPO view shows why the algorithm is group-relative. A prompt fans out to several answers. Rule and style rewards flow into group statistics. Advantage is computed relative to sibling completions, then restrained by a KL anchor before the policy update. The visual is not claiming that all rewards are reliable. It is making the dependency explicit: if the verifier scores the wrong property, GRPO will optimize the wrong property efficiently.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The method works when reward correlates with the behavior you actually want. In math, code, and many STEM benchmarks, a final answer, unit test, or structured checker can reject many wrong solutions without a human preference model. If repeated sampling produces a mix of successes and failures, group-relative advantage gives the optimizer a usable direction: increase the trajectories that pass the verifier and reduce nearby alternatives that fail.`,
        `The KL anchor matters for correctness in a broader systems sense. A pure reward maximizer can move into unreadable text, reward-format hacks, or degenerate repetition if those patterns exploit the scorer. KL control and cold-start data preserve the base model's language prior while RL pushes on task success. The pipeline is therefore not "RL instead of data." It is a staged contract between pretrained capability, curated seed behavior, automatic checking, filtering, and final alignment pressure.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `RLVR shifts cost away from dense human demonstrations and toward sampling, verification, and infrastructure. Training needs many completions per prompt, reward computation, rollout storage, filtering, and careful monitoring. A cheap verifier is not free when it is run across enormous sample volumes. The memory benefit of GRPO over critic-based PPO helps, but the system is still a large-scale RL pipeline.`,
        `Serving cost can rise too. Reasoning models often produce longer outputs. If the product uses self-consistency, verifier reranking, or tool checks at inference time, one user request can become many model calls. That connects R1 directly to KV cache, continuous batching, PagedAttention, prefill/decode scheduling, transformer roofline analysis, and cost-stack accounting. Post-training can create a model users want, but serving data structures decide whether it can be delivered at acceptable latency and price.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `R1-style RLVR fits tasks with reliable checkers and enough diversity in sampled attempts: olympiad-style math, code competitions, theorem-like STEM questions, symbolic manipulation, structured data tasks, and tool-verified agent subtasks. It also fits teacher-student pipelines. A costly teacher can sample long reasoning traces, and smaller students can learn from filtered outputs when direct RL on the small model is weaker.`,
        `It is also a strong curriculum case study because it ties together many topics. GRPO is a policy-gradient method. RLVR is a reward-design choice. Rejection sampling is data filtering. Distillation is deployment compression. Evaluation harnesses decide whether the claimed gains are real. Architecture and serving topics decide whether long reasoning is affordable.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Do not read R1 as proof that reinforcement learning creates general reasoning in every domain. It shows that RL with strong verifiers can incentivize useful behaviors on checkable tasks. Open-ended writing, legal judgment, medical advice, product support, and policy work rarely have a simple correctness oracle. Those domains fall back to rubric judges, process reward models, human preference data, or task-specific audits.`,
        `The method can also overfit benchmarks, learn reward quirks, generate long traces that waste tokens, or imitate reflective language because the reward pipeline favors that style. Open weights and a paper are not full reproducibility. Exact data provenance, filtering rules, prompt distributions, infrastructure details, benchmark contamination controls, pass-at-k calculation, and safety slices still matter. A serious audit compares RLVR against simpler baselines such as rejection sampling alone, self-consistency, supervised cold-start tuning, and distillation-only training.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources are DeepSeek-R1 at https://arxiv.org/abs/2501.12948 and https://github.com/deepseek-ai/DeepSeek-R1, DeepSeekMath and GRPO at https://arxiv.org/abs/2402.03300, and DeepSeek-V3 at https://arxiv.org/abs/2412.19437. Study policy gradients, PPO, RLHF and preference optimization, process reward models, verifier search, knowledge distillation, benchmark variance, evaluation harnesses, RL experiment reproducibility ledgers, Mixture of Experts, Multi-Head Latent Attention, KV cache, transformer inference rooflines, and LLM inference cost stacks next.`,
      ],
    },
  ],
};
