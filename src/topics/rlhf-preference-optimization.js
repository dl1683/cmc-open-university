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
      heading: 'How to read the animation',
      paragraphs: [
        'The RLHF pipeline view shows the full training path left to right. Each node is a stage: pretrained model, SFT model, sample outputs, human rankings, reward model, PPO update, KL penalty, and aligned model. Active (highlighted) nodes mark the current training stage. Compare nodes show stages that inform or constrain the active step.',
        {type: 'callout', text: 'Preference optimization works by turning comparative human judgment into a gradient while keeping the policy near a trusted reference.'},
        'The DPO shortcut view shows the simplified path: chosen and rejected responses feed a single loss that updates the policy directly, anchored by a frozen reference model. Found markers indicate components whose values are fixed.',
        'Preference pairs are the raw material. A pair is one prompt with two completions and a human label saying which is better. Reward scores are the numbers the reward model assigns to each completion. Policy updates are the gradient steps that make the language model more likely to produce preferred-style outputs.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Pretrained language models learn to predict the next token. That gives them broad knowledge and fluent continuation, but next-token prediction does not distinguish helpful from harmful, truthful from false, or clear from confusing. The model matches the distribution of all training text, good and bad.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'A pretrained language model is still a neural network trained on token prediction; RLHF changes the post-training objective, not the basic model substrate. Source: https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
        'The alignment problem: you want the model to follow instructions, refuse dangerous requests, give accurate answers, and be genuinely useful. None of these goals can be written as a simple loss function over tokens. You cannot specify "be helpful" the way you specify "predict the next word."',
        'Christiano et al. (2017) introduced deep RL from human preferences for Atari and robotics. Stiennon et al. (2020) applied it to text summarization. Ouyang et al. (2022) scaled it to InstructGPT, showing that a 1.3B parameter model aligned with RLHF was preferred by humans over the unaligned 175B parameter GPT-3. The method turned comparative human judgment into a training signal that steers model behavior without requiring a hand-written objective.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Supervised fine-tuning (SFT) on curated examples. Collect demonstrations of ideal responses, pair each prompt with its gold-standard answer, and train the model with standard cross-entropy loss. This teaches the model the format, tone, and task shape of good responses.',
        'SFT works well as a starting point. It turns a text completer into something that looks like an assistant. Ask a question, get an answer shaped like an answer rather than a continuation of the question.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'SFT teaches format but not judgment. It can show the model what a good answer looks like, but it cannot encode the full space of what makes one answer better than another. You would need demonstrations covering every possible prompt, every possible failure mode, every tradeoff between brevity and thoroughness, every edge case in safety.',
        'Demonstrations are expensive. Expert annotators cost $15-50/hour, and you need thousands of examples per task type. Worse, even perfect demonstrations throw away information: they show the model one right answer but say nothing about why other answers are wrong or how to choose between two plausible alternatives.',
        'Humans can compare outputs far more easily than they can write ideal outputs. Picking the better of two summaries is 3-10x faster than writing a perfect summary from scratch. RLHF exists to exploit this asymmetry: use comparisons as the training signal instead of demonstrations.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Phase 1: Supervised fine-tuning. Train the pretrained model on demonstration data to produce a model that can follow instructions. This SFT model becomes both the starting policy and the reference for later KL constraints.',
        'Phase 2: Reward model training. The SFT model generates multiple responses to the same prompt. Human labelers compare pairs and mark which response is better. A separate model (the reward model) learns to assign scalar scores to responses so that chosen outputs score higher than rejected ones. The comparison follows the Bradley-Terry model: the probability that response A is preferred over B is sigmoid(r(A) - r(B)), where r is the reward model\'s score.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'The RLHF pipeline is a directed training graph: demonstrations, samples, labels, proxy reward, constrained update, and final policy. Source: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Phase 3: Policy optimization with PPO. The language model is treated as a policy over tokens. For each prompt, it generates a response, the reward model scores it, and the policy gradient pushes the model toward higher-reward outputs. A KL divergence penalty is added to the reward: total_reward = reward_model_score - beta * KL(policy || reference). The beta coefficient controls how far the policy can drift from the SFT reference. Without it, the optimizer exploits reward model weaknesses instead of genuinely improving.',
        'DPO (Rafailov et al. 2023) is a simpler alternative that skips the reward model entirely. Given preference pairs, it directly optimizes: increase the log-probability ratio of chosen over rejected responses, measured against a frozen reference model. The loss is L = -log sigmoid(beta * (log pi(chosen)/pi_ref(chosen) - log pi(rejected)/pi_ref(rejected))). Same theoretical objective as RLHF, no RL loop, no separate reward model, no PPO instability. Used by Llama 2, Llama 3, and many open-weight models.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Humans are better at comparing than generating. A labeler may struggle to write the perfect answer to a medical question, but can reliably tell which of two candidate answers is more accurate, more complete, or safer. RLHF converts this comparative ability into a continuous training signal.',
        'The reward model generalizes preferences beyond the specific pairs it was trained on. After seeing 50,000 comparisons, it learns patterns: answer the actual question, stay concise, cite evidence when relevant, refuse dangerous requests precisely rather than broadly. These patterns transfer to new prompts the reward model has never seen.',
        'The KL constraint prevents collapse. The SFT model already has broad language competence: grammar, world knowledge, coding syntax, reasoning ability. Preference optimization should steer that competence, not destroy it. The KL penalty keeps each update local enough that the model improves on the preference axis without losing everything else.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Preference data collection is the bottleneck. InstructGPT used roughly 50,000 comparison labels. At GPT-4 scale, estimates range from $10,000-50,000 for preference data alone, plus substantial costs for prompt design, labeler guidelines, disagreement measurement, and safety-specific annotation.',
        'Reward model training is standard supervised learning: a classification-style loss on preference pairs. Comparable in cost to fine-tuning the base model.',
        'PPO is the expensive phase. It requires four models in GPU memory simultaneously: the policy being trained, the reference policy (frozen), the reward model, and the value function (critic). For a 7B parameter model, this means roughly 4x the memory of inference. The training loop is also unstable: reward can spike, KL can oscillate, and hyperparameters (beta, learning rate, batch size, number of PPO epochs) require careful tuning.',
        'DPO cuts the operational cost substantially. It needs only two models (policy and frozen reference), uses a standard supervised training loop, and is generally more stable. The tradeoff: DPO cannot do online sampling during training, which limits its ability to explore and improve beyond the initial preference data distribution.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'ChatGPT and InstructGPT: RLHF turned GPT-3 from a text completer into a conversational assistant. The aligned 1.3B model was preferred over the unaligned 175B model, demonstrating that alignment quality matters more than raw scale.',
        'Claude uses RLHF and constitutional AI (Bai et al. 2022) for helpfulness and safety alignment. Llama 2 (Touvron et al. 2023) used RLHF with over 1 million preference annotations. Gemini applies preference optimization across its model family.',
        'The method wins whenever the task is hard to specify but easy to compare: chat helpfulness, summarization quality, code generation style, refusal precision, and domain-specific tone. It is especially effective as a steering phase after SFT has already taught the basic task format.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Reward hacking. The policy finds outputs that score high on the reward model but are not genuinely good. Common exploits: excessive hedging, sycophantic agreement, verbose padding that correlates with labeler preference for thoroughness. The model optimizes the proxy, not the real objective.',
        'Preference inconsistency. Different labelers value different things: brevity versus detail, caution versus directness, creativity versus accuracy. A single rubric may erase important disagreement. If the preference data is noisy, the reward model learns noise.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg', alt: 'Normal curve with standard deviation regions', caption: 'Preference labels are sampled judgments with variance; disagreement measurement is part of the training signal, not an afterthought. Source: https://commons.wikimedia.org/wiki/File:Standard_deviation_diagram.svg.'},
        'Annotator disagreement is structural, not noise. On safety-sensitive prompts, reasonable people disagree about whether a response should be a refusal, a careful answer, or a direct answer. Treating majority vote as ground truth hides real uncertainty.',
        'KL penalty sensitivity. Too low: reward hacking, mode collapse, language quality degrades. Too high: the model barely moves from SFT, wasting the preference data. The right beta is task-dependent and often found by expensive sweeps.',
        'Evaluation leakage. If the same prompt styles, rubrics, or LLM judges drive both training and evaluation, scores rise while real behavior stagnates. Held-out human evaluation, red-team prompts, and slice-level regression checks are essential safeguards.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Prompt: "Explain gravity to a child." Completion A: "Gravity is the force that pulls things down. Drop a ball and it falls because Earth is pulling it toward the ground. The bigger something is, the harder it pulls." Completion B: "Gravitational force is described by Newton\'s law of universal gravitation, which states that F = G * m1 * m2 / r^2, where G is the gravitational constant, m1 and m2 are the masses, and r is the distance between them."',
        'A human labeler picks A: it matches the audience, explains the mechanism simply, and gives a concrete example. The reward model trains on this pair and learns r(prompt, A) = 0.85, r(prompt, B) = 0.3. The Bradley-Terry probability of preferring A is sigmoid(0.85 - 0.3) = sigmoid(0.55) = 0.63, consistent with a clear but not overwhelming preference.',
        'During PPO, the policy generates a new response to a similar prompt. The reward model scores it 0.72. The policy gradient increases the probability of token sequences that led to this score. The KL penalty checks drift: if the policy\'s token distribution has moved more than beta allows from the SFT reference, the penalty reduces the effective reward, pulling the model back toward broad competence. Over thousands of such updates, the model learns to produce child-appropriate explanations without losing its ability to give technical answers when asked.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Christiano et al. 2017, "Deep Reinforcement Learning from Human Preferences" (https://arxiv.org/abs/1706.03741) -- RLHF foundations for Atari and MuJoCo. Stiennon et al. 2020, "Learning to Summarize from Human Feedback" (https://arxiv.org/abs/2009.01325) -- RLHF applied to text summarization. Ouyang et al. 2022, "Training Language Models to Follow Instructions with Human Feedback" (https://arxiv.org/abs/2203.02155) -- InstructGPT. Rafailov et al. 2023, "Direct Preference Optimization: Your Language Model Is Secretly a Reward Model" (https://arxiv.org/abs/2305.18290) -- DPO. Bai et al. 2022, "Constitutional AI: Harmlessness from AI Feedback" (https://arxiv.org/abs/2212.08073) -- Constitutional AI.',
        'Prerequisites: PPO and policy gradient methods (the RL algorithm), cross-entropy loss (the SFT objective), transformer architecture (the model being aligned). Extensions: constitutional AI (replacing human labelers with AI self-critique), DPO and its variants (IPO, KTO, ORPO), reward model ensembles for reducing hacking. Related ideas: value iteration, transfer learning, LoRA for efficient fine-tuning of the SFT step.',
      ],
    },
  ],
};
