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
  const graph1 = rlhfGraph('RLHF turns demonstrations and comparisons into policy updates');
  const totalNodes = graph1.graph.nodes.length;
  const totalEdges = graph1.graph.edges.length;
  const baseNode = graph1.graph.nodes[0];
  const sftNode = graph1.graph.nodes[1];
  const alignedNode = graph1.graph.nodes[totalNodes - 1];

  yield {
    state: graph1,
    highlight: { active: ['base', 'sft', 'e-base-sft'], compare: ['prefs', 'rm', 'ppo'] },
    explanation: `Read the highlighted path left to right across all ${totalNodes} stages. Pretraining gives language ability (${baseNode.note}), supervised demonstrations teach the response shape (${sftNode.label}), and only then does preference optimization push behavior toward the ${alignedNode.label} stage.`,
  };

  const graph2 = rlhfGraph('Human preference data trains a reward model');
  const samplesNode = graph2.graph.nodes[2];
  const prefsNode = graph2.graph.nodes[3];
  const rmNode = graph2.graph.nodes[4];

  yield {
    state: graph2,
    highlight: { active: ['samples', 'prefs', 'rm', 'e-samples-prefs', 'e-prefs-rm'], compare: ['sft'] },
    explanation: `The ${samplesNode.label} node creates alternatives, the ${prefsNode.label} node records ${prefsNode.note}, and the ${rmNode.label} compresses those comparisons into a scalar score. That scalar is useful because PPO needs rewards, but it is still a proxy for human preference.`,
    invariant: `The ${rmNode.label} is a proxy for preference, not preference itself -- it ${rmNode.note} but does not embody judgment.`,
  };

  const graph3 = rlhfGraph('PPO optimizes reward while KL keeps the model near the reference');
  const ppoNode = graph3.graph.nodes[5];
  const klNode = graph3.graph.nodes[6];

  yield {
    state: graph3,
    highlight: { found: ['ppo', 'kl', 'aligned', 'e-rm-ppo', 'e-kl-ppo', 'e-ppo-aligned'] },
    explanation: `The ${ppoNode.label} node treats the language model as a ${ppoNode.note} over tokens and pushes outputs that the reward model scores highly. The ${klNode.label} node is the brake (${klNode.note}): without it, reward pressure can move the model away from the fluent supervised policy that collected the data.`,
  };

  const failureRows = [
    { id: 'rewardhack', label: 'reward hacking' },
    { id: 'bias', label: 'labeler bias' },
    { id: 'drift', label: 'KL drift' },
    { id: 'eval', label: 'eval overfit' },
  ];
  const failureCols = [
    { id: 'symptom', label: 'symptom' },
    { id: 'response', label: 'response' },
  ];
  const failureData = [
    ['model exploits reward model', 'red-team and refresh RM'],
    ['preferences encode policy choices', 'guidelines and audits'],
    ['language quality degrades', 'KL control'],
    ['wins benchmark, hurts users', 'held-out human evals'],
  ];

  yield {
    state: labelMatrix('RLHF failure modes', failureRows, failureCols, failureData),
    highlight: { active: ['rewardhack:response', 'drift:response', 'eval:response'], compare: ['bias:symptom'] },
    explanation: `Each of the ${failureRows.length} rows names a way the proxy can fail (${failureCols[0].label}) and the control that catches it (${failureCols[1].label}). RLHF optimizes the reward model, not true human welfare, so red-team data, label audits, KL checks, and held-out human evals are part of the algorithm.`,
  };
}

function* dpoShortcut() {
  const dGraph1 = dpoGraph('DPO trains directly from chosen/rejected pairs');
  const dpoNodes = dGraph1.graph.nodes;
  const dpoEdges = dGraph1.graph.edges;
  const chosenNode = dpoNodes[1];
  const rejectNode = dpoNodes[2];
  const lossNode = dpoNodes[3 + 2]; // index 5 = 'DPO loss'

  yield {
    state: dGraph1,
    highlight: { active: ['chosen', 'reject', 'policy', 'loss', 'e-chosen-policy', 'e-reject-policy', 'e-policy-loss'], compare: ['ref'] },
    explanation: `DPO keeps the preference pair and removes the explicit reward-model/PPO loop across ${dpoNodes.length} nodes. The ${chosenNode.label} and ${rejectNode.label} feed one ${lossNode.note}-style loss: raise the chosen response relative to the rejected one for the same prompt.`,
  };

  const dGraph2 = dpoGraph('The frozen reference model anchors the update');
  const refNode = dGraph2.graph.nodes[4];
  const updatedNode = dGraph2.graph.nodes[6];

  yield {
    state: dGraph2,
    highlight: { active: ['ref', 'e-ref-loss'], found: ['loss', 'updated'] },
    explanation: `The ${refNode.label} (${refNode.note}) is the anchor line in the graph. It tells the loss how far the trainable policy has moved, so preference tuning has both direction (chosen over rejected) and restraint (do not drift without bound toward the ${updatedNode.label}).`,
    invariant: `Preference tuning needs both direction and restraint -- the ${refNode.label} stays ${refNode.note} to provide the restraint.`,
  };

  const compRows = [
    { id: 'data', label: 'preference data' },
    { id: 'rm', label: 'reward model' },
    { id: 'online', label: 'online sampling' },
    { id: 'control', label: 'drift control' },
  ];
  const compCols = [
    { id: 'ppo', label: 'PPO-style RLHF' },
    { id: 'dpo', label: 'DPO' },
  ];
  const compData = [
    ['needed', 'needed'],
    ['separate model', 'implicit in loss'],
    ['yes', 'no for basic training'],
    ['KL penalty', 'reference likelihood ratio'],
  ];

  yield {
    state: labelMatrix('RLHF versus DPO', compRows, compCols, compData),
    highlight: { found: ['rm:dpo', 'online:dpo'], compare: ['rm:ppo', 'online:ppo'] },
    explanation: `The table compares ${compCols.length} approaches across ${compRows.length} dimensions. DPO removes the ${compRows[1].label} (${compData[1][1]}) and basic ${compRows[2].label} loop. It does not remove the identification problem; the ${compRows[0].label} still defines what behavior the model will learn.`,
  };

  const checkRows = [
    { id: 'prompts', label: 'prompt coverage' },
    { id: 'rubric', label: 'labeling rubric' },
    { id: 'disagree', label: 'disagreement' },
    { id: 'safety', label: 'safety slices' },
  ];
  const checkCols = [
    { id: 'check', label: 'check' },
    { id: 'risk', label: 'risk if weak' },
  ];
  const checkData = [
    ['real user distribution', 'overfit toy prompts'],
    ['explicit tradeoffs', 'inconsistent labels'],
    ['measure labeler variance', 'false certainty'],
    ['separate evals', 'capability-safety tradeoff hidden'],
  ];

  yield {
    state: labelMatrix('Preference data quality checklist', checkRows, checkCols, checkData),
    highlight: { found: ['prompts:check', 'rubric:check', 'disagree:check', 'safety:check'] },
    explanation: `The checklist covers ${checkRows.length} quality dimensions, each with a ${checkCols[0].label} and a ${checkCols[1].label}. ${checkRows[0].label}, a clear ${checkRows[1].label}, measured ${checkRows[2].label}, and ${checkRows[3].label} decide whether the loss learns the intended behavior or only labeler habits and missing edge cases.`,
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
        'The animation shows post-training for a language model. A pretrained model is first shaped by supervised fine-tuning, then preference data tells the optimizer which completions humans preferred for the same prompt.',
        {type: 'callout', text: 'Preference optimization works by turning comparative human judgment into a gradient while keeping the policy near a trusted reference.'},
        'A policy is the model being updated. A reference model is a frozen copy used as an anchor, and a reward model is a learned scorer that predicts which response a human would prefer.',
        'Read the DPO frame as the shorter path. Direct Preference Optimization skips a separately trained reward model and updates the policy from chosen-versus-rejected pairs while still comparing against the reference model.',
        {type: 'image', src: './assets/gifs/rlhf-preference-optimization.gif', alt: 'Animated walkthrough of the rlhf preference optimization visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Pretraining teaches a model to predict the next token. That objective can produce fluent text, but it does not directly encode helpfulness, harmlessness, honesty, or instruction following.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'A pretrained language model is still a neural network trained on token prediction; RLHF changes the post-training objective, not the basic model substrate. Source: https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
        'RLHF means reinforcement learning from human feedback. It exists because many desired behaviors are easier for people to compare than to specify as a token-level training target.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is supervised fine-tuning on good answers. Collect prompts with ideal responses, train the model to imitate them, and deploy the resulting instruction model.',
        'This is not a bad start. It teaches format, task style, and many refusal patterns, but it only tells the model what one chosen answer looked like rather than how to rank many plausible answers.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that human preference is comparative and context-dependent. Two answers can both be grammatically likely, while one is clearer, safer, more complete, or more honest.',
        'Writing a scalar reward function for that judgment is brittle. If the reward model or optimizer finds a shortcut, the policy can become more rewarded without becoming more useful.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A preference pair contains one prompt, one chosen answer, and one rejected answer. The learning signal is the direction between the two answers, not an absolute truth score.',
        'Preference optimization turns that direction into a gradient. The model is pushed to assign higher probability to chosen answers than rejected answers, while a reference penalty limits how far it drifts from the trusted starting policy.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The classical RLHF pipeline has four stages. Train a base model, fine-tune it on demonstrations, train a reward model from preference pairs, then optimize the policy with an algorithm such as PPO while penalizing distance from the reference model.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'The RLHF pipeline is a directed training graph: demonstrations, samples, labels, proxy reward, constrained update, and final policy. Source: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'PPO means Proximal Policy Optimization, a reinforcement-learning method that limits update size. The KL penalty measures how different the new policy distribution is from the reference distribution, so it acts like a leash.',
        'DPO changes the mechanism. Instead of training a reward model and running reinforcement learning, it uses a loss that directly increases the log-probability gap between chosen and rejected responses relative to the reference model.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness target is not mathematical truth; it is consistency with the preference data under the training objective. If chosen responses repeatedly receive higher probability than rejected ones, the model becomes more likely to emit behaviors represented by chosen responses.',
        'The reference constraint is the stabilizer. It prevents the optimizer from satisfying preferences by destroying language quality, collapsing diversity, or exploiting reward-model quirks far from the pretrained distribution.',
        'The argument depends on label quality. If labels are noisy, biased, or inconsistent, the trained policy learns those patterns too, because the objective can only optimize the comparisons it receives.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The expensive part is not just GPU time. Human preference labels require prompt design, sampling, reviewer time, quality control, disagreement handling, and repeated data refresh as the model changes.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg', alt: 'Normal curve with standard deviation regions', caption: 'Preference labels are sampled judgments with variance; disagreement measurement is part of the training signal, not an afterthought. Source: https://commons.wikimedia.org/wiki/File:Standard_deviation_diagram.svg.'},
        'Training cost scales with model size, response length, and number of preference pairs. Doubling average response length roughly doubles token processing per batch, and PPO adds generation plus reward-model scoring before the policy update.',
        'Behaviorally, stronger optimization increases both alignment gains and over-optimization risk. A small update may barely change the model, while a large update can make it chase the reward signal instead of the user goal.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Instruction-following assistants use preference optimization to make answers more useful than raw next-token continuation. The access pattern is broad: many prompts have no single gold answer, but humans can often prefer one response over another.',
        'It is also used for refusal behavior, style control, summarization quality, code-helpfulness ranking, and tool-use policies. The fit is strongest when the product has repeated examples of better-versus-worse behavior and a human review process that can label them consistently.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Preference optimization cannot make bad labels good. If reviewers reward confident falsehoods, excessive flattery, or hidden policy shortcuts, the model learns those tendencies.',
        'It can also hide capability regressions. A model may sound more aligned while becoming worse at rare domains, long reasoning, calibration, or refusal boundary cases that were under-sampled in the preference data.',
        'Reward hacking is the central failure mode. The optimizer learns to satisfy the proxy signal, and the proxy is only a compressed, imperfect measurement of what users actually need.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a prompt has two answers. The chosen answer has policy log-probability -12 under the trainable model and -11 under the reference, while the rejected answer has policy log-probability -10 and reference log-probability -10.',
        'Relative to the reference, the chosen answer is down by 1 and the rejected answer is unchanged, so the policy currently favors the wrong answer. A DPO-style loss pushes the chosen log-probability up or the rejected log-probability down until the chosen response has the larger reference-adjusted margin.',
        'With beta 0.1, a margin change of 5 log-probability points contributes only 0.5 to the scaled preference logit. That number shows why many small preference updates are needed and why beta controls how aggressively the policy moves away from the reference.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Christiano et al., Deep reinforcement learning from human preferences, 2017; Ouyang et al., Training language models to follow instructions with human feedback, 2022; Rafailov et al., Direct Preference Optimization, 2023.',
        'Study next by mechanism. Read Cross-Entropy Loss for supervised fine-tuning, KL Divergence for the reference penalty, PPO for classical RLHF, Bradley-Terry Models for pairwise preference math, and Evaluation Harnesses for detecting regressions after alignment training.',
      ],
    },
  ],
};
