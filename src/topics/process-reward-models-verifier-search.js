// Process reward models score intermediate reasoning steps, turning reasoning
// quality into a verifier-guided search problem instead of a single final vote.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'process-reward-models-verifier-search',
  title: 'Process Reward Models & Verifier Search',
  category: 'Papers',
  summary: 'A reasoning case study: outcome rewards judge final answers, process rewards judge steps, and verifier-guided search chooses better paths.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['step supervision', 'verifier search'], defaultValue: 'step supervision' },
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

function prmGraph(title) {
  return graphState({
    nodes: [
      { id: 'problem', label: 'problem', x: 0.8, y: 3.8, note: 'task' },
      { id: 'steps', label: 'steps', x: 2.8, y: 3.8, note: 'trace' },
      { id: 'stepLabels', label: 'step labels', x: 4.8, y: 2.3, note: '+/-' },
      { id: 'final', label: 'final answer', x: 4.8, y: 5.3, note: 'outcome' },
      { id: 'prm', label: 'PRM', x: 6.8, y: 2.3, note: 'process' },
      { id: 'orm', label: 'ORM', x: 6.8, y: 5.3, note: 'outcome' },
      { id: 'select', label: 'select', x: 8.7, y: 3.8, note: 'best path' },
    ],
    edges: [
      { id: 'e-problem-steps', from: 'problem', to: 'steps' },
      { id: 'e-steps-labels', from: 'steps', to: 'stepLabels' },
      { id: 'e-steps-final', from: 'steps', to: 'final' },
      { id: 'e-labels-prm', from: 'stepLabels', to: 'prm' },
      { id: 'e-final-orm', from: 'final', to: 'orm' },
      { id: 'e-prm-select', from: 'prm', to: 'select' },
      { id: 'e-orm-select', from: 'orm', to: 'select' },
    ],
  }, { title });
}

function searchGraph(title) {
  return graphState({
    nodes: [
      { id: 'prompt', label: 'prompt', x: 0.8, y: 3.6, note: 'question' },
      { id: 'sample', label: 'sample', x: 2.6, y: 3.6, note: 'paths' },
      { id: 'branchA', label: 'path A', x: 4.3, y: 1.8, note: 'plausible' },
      { id: 'branchB', label: 'path B', x: 4.3, y: 3.6, note: 'wrong step' },
      { id: 'branchC', label: 'path C', x: 4.3, y: 5.4, note: 'valid' },
      { id: 'verifier', label: 'verifier', x: 6.5, y: 3.6, note: 'score' },
      { id: 'rerank', label: 'rerank', x: 8.2, y: 3.6, note: 'choose' },
      { id: 'answer', label: 'answer', x: 9.5, y: 3.6, note: 'ship' },
    ],
    edges: [
      { id: 'e-prompt-sample', from: 'prompt', to: 'sample' },
      { id: 'e-sample-a', from: 'sample', to: 'branchA' },
      { id: 'e-sample-b', from: 'sample', to: 'branchB' },
      { id: 'e-sample-c', from: 'sample', to: 'branchC' },
      { id: 'e-a-verifier', from: 'branchA', to: 'verifier' },
      { id: 'e-b-verifier', from: 'branchB', to: 'verifier' },
      { id: 'e-c-verifier', from: 'branchC', to: 'verifier' },
      { id: 'e-verifier-rerank', from: 'verifier', to: 'rerank' },
      { id: 'e-rerank-answer', from: 'rerank', to: 'answer' },
    ],
  }, { title });
}

function* stepSupervision() {
  const labelCount = 800000;
  const datasetName = 'PRM800K';

  yield {
    state: prmGraph('Outcome supervision sees only the end'),
    highlight: { active: ['problem', 'steps', 'final', 'orm', 'e-problem-steps', 'e-steps-final', 'e-final-orm'], compare: ['stepLabels', 'prm'] },
    explanation: `Outcome supervision trains or scores from the final answer. That is cheap and sometimes enough, but it cannot tell whether a correct answer came from sound reasoning or a lucky wrong path. The ${datasetName} dataset with ${labelCount.toLocaleString()} labels was built to address this.`,
  };

  yield {
    state: prmGraph('Process supervision labels each intermediate step'),
    highlight: { active: ['steps', 'stepLabels', 'prm', 'e-steps-labels', 'e-labels-prm'], found: ['select'] },
    explanation: `Process supervision turns each intermediate step into feedback. A process reward model can reject a solution as soon as a step becomes invalid, even if later text tries to recover. ${datasetName} provides ${labelCount.toLocaleString()} step-level labels for this purpose.`,
    invariant: `The verifier learns the path, not only the destination — ${datasetName} captures this with per-step annotations.`,
  };

  yield {
    state: labelMatrix(
      'Outcome reward model versus process reward model',
      [
        { id: 'label', label: 'label' },
        { id: 'catches', label: 'catches' },
        { id: 'cost', label: 'cost' },
        { id: 'risk', label: 'risk' },
      ],
      [
        { id: 'orm', label: 'ORM' },
        { id: 'prm', label: 'PRM' },
      ],
      [
        ['final answer', 'each step'],
        ['wrong result', 'first bad move'],
        ['cheap labels', 'many labels'],
        ['lucky answers', 'annotator burden'],
      ],
    ),
    highlight: { active: ['catches:prm', 'risk:prm'], compare: ['catches:orm', 'risk:orm'] },
    explanation: `The tradeoff is label density. PRMs are more informative but more expensive to build — ${datasetName} required ${labelCount.toLocaleString()} annotations. ORMs are simpler but give sparse feedback and can reward brittle or accidental reasoning.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'human labels', min: 0, max: 800000 }, y: { label: 'verifier quality', min: 0, max: 100 } },
      series: [
        { id: 'random', label: 'random labels', points: [
          { x: 20000, y: 30 }, { x: 100000, y: 48 }, { x: 300000, y: 62 }, { x: 800000, y: 72 },
        ] },
        { id: 'active', label: 'active learning', points: [
          { x: 20000, y: 43 }, { x: 100000, y: 64 }, { x: 300000, y: 76 }, { x: 800000, y: 84 },
        ] },
      ],
      markers: [
        { id: 'prm800k', x: 800000, y: 84, label: 'PRM800K' },
        { id: 'early', x: 100000, y: 64, label: 'target hard cases' },
      ],
    }),
    highlight: { active: ['active', 'prm800k'], compare: ['random'] },
    explanation: `The OpenAI paper also emphasizes active learning. Step labels are expensive — ${datasetName} has ${labelCount.toLocaleString()} of them — so the data engine should ask humans to label steps that most improve the verifier instead of labeling easy cases blindly.`,
  };
}

function* verifierSearch() {
  const pathCount = 3;
  const searchPatterns = ['greedy CoT', 'self-consistency', 'tree search', 'PRM rerank', 'executable'];
  const patternCount = searchPatterns.length;

  yield {
    state: searchGraph('Generate many paths, then verify the paths'),
    highlight: { active: ['prompt', 'sample', 'branchA', 'branchB', 'branchC', 'e-prompt-sample', 'e-sample-a', 'e-sample-b', 'e-sample-c'], found: ['verifier'] },
    explanation: `Verifier-guided reasoning separates proposal from selection. The generator samples ${pathCount} candidate paths. The verifier scores path quality. The final answer is chosen by evidence, not by the first greedy decode.`,
  };

  yield {
    state: searchGraph('The verifier prunes a bad intermediate step'),
    highlight: { active: ['branchB', 'verifier', 'e-b-verifier'], removed: ['branchB'], found: ['branchC', 'rerank', 'answer'] },
    explanation: `A path can look fluent while hiding one invalid move. Among ${pathCount} candidate paths, a step verifier gives the search loop a place to prune, rerank, or ask for a repair before committing to the final answer.`,
    invariant: `Search quality is bounded by verifier quality — across ${pathCount} paths, every branch is scored by the same verifier.`,
  };

  yield {
    state: labelMatrix(
      'Reasoning search patterns',
      [
        { id: 'greedy', label: 'greedy CoT' },
        { id: 'self', label: 'self-consistency' },
        { id: 'tot', label: 'tree search' },
        { id: 'prm', label: 'PRM rerank' },
        { id: 'exec', label: 'executable' },
      ],
      [
        { id: 'mechanism', label: 'mechanism' },
        { id: 'weakness', label: 'weakness' },
      ],
      [
        ['one path', 'early mistake'],
        ['vote answers', 'same blind spot'],
        ['branch thoughts', 'judge bias'],
        ['score steps', 'verifier bias'],
        ['run tests', 'oracle scope'],
      ],
    ),
    highlight: { active: ['self:mechanism', 'tot:mechanism', 'prm:mechanism', 'exec:mechanism'], compare: ['greedy:weakness'] },
    explanation: `${patternCount} search patterns are compared. Self-consistency samples many chains and votes final answers. Tree of Thoughts searches over branches. PRM reranking scores intermediate steps. Executable verifiers, as in coding and AlphaEvolve-style systems, are strongest when an objective oracle exists.`,
  };

  yield {
    state: labelMatrix(
      'Deployment checklist',
      [
        { id: 'trace', label: 'trace format' },
        { id: 'labels', label: 'step labels' },
        { id: 'holdout', label: 'holdout' },
        { id: 'budget', label: 'budget' },
        { id: 'safety', label: 'safety' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['what is a step?', 'ambiguous supervision'],
        ['who judges?', 'rubric drift'],
        ['unseen paths?', 'verifier overfit'],
        ['how many samples?', 'latency blowup'],
        ['what can be exposed?', 'reasoning leakage'],
      ],
    ),
    highlight: { found: ['trace:question', 'labels:question', 'holdout:question', 'budget:question', 'safety:question'] },
    explanation: `A verifier search stack is an evaluation system. Across ${patternCount} search patterns and ${pathCount} candidate paths, it needs trace schemas, label rubrics, holdouts, budgets, and safety boundaries for what reasoning traces are stored, displayed, or used for training.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'step supervision') yield* stepSupervision();
  else if (view === 'verifier search') yield* verifierSearch();
  else throw new InputError('Pick a process-reward-model view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the first view as two grading paths for one reasoning trace. The outcome path judges only the final answer, while the process path adds labels on intermediate steps before selection.',
        'Active nodes are the part of the training or search loop doing work. Compare nodes are alternatives that the visual keeps visible so you can see what signal is missing.',
        {type: 'image', src: './assets/gifs/process-reward-models-verifier-search.gif', alt: 'Animated walkthrough of the process reward models verifier search visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Multi-step reasoning can fail before the final answer appears. A model may make a false algebra move, use a theorem outside its conditions, or copy a number incorrectly, then still end with a plausible answer.',
        {type: 'callout', text: 'A process reward model turns reasoning into a scored path, so search can reject a branch before the final answer hides the error.'},
        'An outcome reward model, or ORM, scores the final answer. A process reward model, or PRM, scores each step in the path, so the system can learn where reasoning stays valid and where it breaks.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to sample an answer and check the final result. In math, code, and closed-form questions, this is cheap because the label can be a number, a unit test result, or a multiple-choice answer.',
        'That approach is useful when only the destination matters. It also avoids storing long traces and avoids asking humans to inspect every intermediate sentence.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is credit assignment. A final label says the whole answer was right or wrong, but it does not say which step caused the outcome.',
        'Search inherits the same weakness. If ten traces reach three final answers, a vote can choose the common answer, but it cannot prove that the shared early move was valid.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to treat a reasoning trace as a path through partial states. Each step should preserve the problem facts and follow from earlier steps.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'A reasoning trace can be read as a directed path through partial states, with verifier scores deciding which edges survive. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Once steps have scores, generation becomes proposal and selection. The model proposes branches, the verifier scores partial work, and the search policy decides which branch deserves more compute.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Training begins by defining a step. A step might be one equation transform, one claim in a proof, one code edit, or one plan action.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'A learned verifier is still a model, so calibration and holdout slices matter as much as architecture. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
        'Humans, symbolic checkers, tests, or stronger models label candidate steps. The PRM learns a score from the problem, the previous trace, and the next proposed step.',
        'At inference time, the system samples several traces, scores their steps, and chooses a final answer by path evidence. A low step score can prune a branch, request a repair, or lower the whole trace during reranking.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is conditional on verifier quality. If a step is invalid, no later prose can make the earlier false statement logically valid.',
        'The invariant is path validity: every accepted step must follow from the problem and prior accepted steps. A PRM does not prove that invariant in general, but it gives search a denser test than the final answer alone.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost starts with labels. One final answer needs one label, while one worked solution may need ten or more step labels with a consistent rubric.',
        'Inference cost grows with the number of sampled paths and the number of checked steps. If a system samples 8 traces with 12 steps each, it may run 96 verifier evaluations before the final answer.',
        'The behavior changes when the search budget doubles. More samples can recover from one bad branch, but they also amplify verifier bias if the scorer rewards fluent wrong reasoning.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'PRMs fit contest math, proof tutoring, code planning, and agent workflows where partial work can be inspected. They are most useful when errors appear early and then poison the rest of the answer.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/MCTS_Algorithm.png/250px-MCTS_Algorithm.png', alt: 'Monte Carlo tree search phases of selection expansion simulation and backpropagation', caption: 'Verifier-guided reasoning borrows the same search intuition as tree search: propose branches, score evidence, then spend more work where it can change the choice. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:MCTS_Algorithm.png.'},
        'They also help evaluation. A wrong final answer with nine sound steps is a different failure from a trace that invents facts in line one.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A PRM fails when it learns the style of correctness instead of correctness. Polished wording, common theorem names, or familiar proof shapes can receive high scores while the actual step is false.',
        'The trace is also not guaranteed to expose every internal computation. Treat it as a supervised artifact and audit record, not a transparent window into the model.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a model solves 12x + 6 = 30. A valid trace subtracts 6 to get 12x = 24, then divides by 12 to get x = 2.',
        'A bad trace might divide the original equation by 6 and write 2x + 6 = 5. An ORM sees only whether the final x is correct, while a PRM can score that division step near zero because 6 / 6 became 6 instead of 1.',
        'Now sample 4 traces. If their weakest step scores are 0.92, 0.88, 0.31, and 0.74, verifier search can discard the third trace even if its final answer is fluent.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with OpenAI, "Let\'s Verify Step by Step", and the PRM800K dataset. Then study outcome reward models, RLHF, calibration curves, beam search, self-consistency, Tree of Thoughts, and executable verifiers for code.',
      ],
    },
  ],
};
