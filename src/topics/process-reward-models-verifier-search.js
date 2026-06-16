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
  yield {
    state: prmGraph('Outcome supervision sees only the end'),
    highlight: { active: ['problem', 'steps', 'final', 'orm', 'e-problem-steps', 'e-steps-final', 'e-final-orm'], compare: ['stepLabels', 'prm'] },
    explanation: 'Outcome supervision trains or scores from the final answer. That is cheap and sometimes enough, but it cannot tell whether a correct answer came from sound reasoning or a lucky wrong path.',
  };

  yield {
    state: prmGraph('Process supervision labels each intermediate step'),
    highlight: { active: ['steps', 'stepLabels', 'prm', 'e-steps-labels', 'e-labels-prm'], found: ['select'] },
    explanation: 'Process supervision turns each intermediate step into feedback. A process reward model can reject a solution as soon as a step becomes invalid, even if later text tries to recover.',
    invariant: 'The verifier learns the path, not only the destination.',
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
    explanation: 'The tradeoff is label density. PRMs are more informative but more expensive to build. ORMs are simpler but give sparse feedback and can reward brittle or accidental reasoning.',
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
    explanation: 'The OpenAI paper also emphasizes active learning. Step labels are expensive, so the data engine should ask humans to label steps that most improve the verifier instead of labeling easy cases blindly.',
  };
}

function* verifierSearch() {
  yield {
    state: searchGraph('Generate many paths, then verify the paths'),
    highlight: { active: ['prompt', 'sample', 'branchA', 'branchB', 'branchC', 'e-prompt-sample', 'e-sample-a', 'e-sample-b', 'e-sample-c'], found: ['verifier'] },
    explanation: 'Verifier-guided reasoning separates proposal from selection. The generator samples candidate paths. The verifier scores path quality. The final answer is chosen by evidence, not by the first greedy decode.',
  };

  yield {
    state: searchGraph('The verifier prunes a bad intermediate step'),
    highlight: { active: ['branchB', 'verifier', 'e-b-verifier'], removed: ['branchB'], found: ['branchC', 'rerank', 'answer'] },
    explanation: 'A path can look fluent while hiding one invalid move. A step verifier gives the search loop a place to prune, rerank, or ask for a repair before committing to the final answer.',
    invariant: 'Search quality is bounded by verifier quality.',
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
    explanation: 'Self-consistency samples many chains and votes final answers. Tree of Thoughts searches over branches. PRM reranking scores intermediate steps. Executable verifiers, as in coding and AlphaEvolve-style systems, are strongest when an objective oracle exists.',
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
    explanation: 'A verifier search stack is an evaluation system. It needs trace schemas, label rubrics, holdouts, budgets, and safety boundaries for what reasoning traces are stored, displayed, or used for training.',
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
      heading: 'What it is',
      paragraphs: [
        'Process reward models, or PRMs, score intermediate reasoning steps instead of only scoring the final answer. They are the verifier side of step-by-step reasoning systems. An outcome reward model asks whether the final answer is right. A process reward model asks whether each step is valid, useful, and consistent with the problem.',
        'The central case study is OpenAI\'s Let\'s Verify Step by Step. The paper compares outcome supervision with process supervision on mathematical reasoning and reports that process supervision significantly outperforms outcome supervision for training models on challenging MATH problems: https://arxiv.org/abs/2305.20050. OpenAI also released PRM800K, a dataset of 800,000 step-level correctness labels: https://github.com/openai/prm800k.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A generator produces a step-by-step solution. Human labelers, rules, symbolic checks, or other verifiers label the intermediate steps. A PRM learns to predict whether a step is correct. At inference time, the system can sample several candidate paths and use the verifier to rerank them, prune bad branches, or ask the generator for a repair.',
        'This changes reasoning from a single left-to-right decode into a search problem. Self-Consistency Reasoning Vote samples multiple chain-of-thought paths and chooses the most common final answer: https://arxiv.org/abs/2203.11171. Tree of Thoughts Search Case Study generalizes this by branching, evaluating, and backtracking over coherent thought units: https://arxiv.org/abs/2305.10601. Monte Carlo Tree Search & UCT Primer supplies the classical version of budgeted tree exploration. A PRM adds a learned step-level scoring function to that family of search methods.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Process supervision buys denser feedback but costs more labels. A final-answer label is cheap: one problem, one result. Step labels require a trace schema, trained labelers, rubric consistency, active learning, and disagreement handling. The OpenAI process-supervision blog emphasizes rewarding each correct step rather than simply rewarding the correct final answer: https://openai.com/index/improving-mathematical-reasoning-with-process-supervision/.',
        'Inference can also become expensive. Sampling many paths, scoring every step, and searching branches increases latency and token cost. The practical architecture often uses a cascade: cheap generation first, cheap checks next, PRM reranking for ambiguous cases, and executable or human verification for high-stakes outputs.',
      ],
    },
    {
      heading: 'Case-study connections',
      paragraphs: [
        'This topic links RLHF & Preference Optimization to LLM Evaluation Harnesses. RLHF teaches that reward models are proxies. LLM eval harnesses teach that scorers need rubrics, holdouts, and slice analysis. PRMs combine both lessons: the reward model is not judging style preference, but step-level reasoning correctness, and it still needs calibration and independent evaluation.',
        'It also links to Self-RAG, AlphaEvolve Case Study, Code World Models Case Study, Verifier-Guided Inference Control Plane Case Study, and Execution-as-a-Service Verifier Economy Case Study. Self-RAG brings retrieve/relevance/support/utility critique into RAG generation. In code, an executable suite is often a stronger verifier than a learned PRM. In math or open-ended reasoning, exact verifiers may be unavailable, so step-level human feedback or learned verifiers fill the gap. The general pattern is propose many candidates, verify the process, route the branch, and select the best path.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not assume a visible reasoning trace is the model\'s complete internal reasoning. Treat traces as supervised artifacts and evaluation records, not guaranteed windows into all computation. Also, a PRM can be wrong. If the verifier rewards plausible but invalid steps, search will amplify that error. Verifier overfitting is especially dangerous when the generator learns the verifier\'s blind spots.',
        'A second misconception is that more search always helps. If all sampled paths share the same misconception, self-consistency can confidently choose the wrong answer. If the verifier is biased, tree search can explore the wrong branches. Budget, diversity, calibration, and held-out evaluation matter as much as the search algorithm.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Let\'s Verify Step by Step at https://arxiv.org/abs/2305.20050, PRM800K at https://github.com/openai/prm800k, OpenAI process-supervision blog at https://openai.com/index/improving-mathematical-reasoning-with-process-supervision/, Self-Consistency at https://arxiv.org/abs/2203.11171, Tree of Thoughts at https://arxiv.org/abs/2305.10601, and Self-RAG at https://arxiv.org/abs/2310.11511. Study RLHF & Preference Optimization, LLM Evaluation Harnesses: Golden Sets and Judges, RAG Evaluation, Self-RAG, Agentic AI Patterns: Planning, Tools, Memory, Self-Consistency Reasoning Vote, Chain of Draft Reasoning Token Budget Case Study, Tree of Thoughts Search Case Study, Monte Carlo Tree Search & UCT Primer, Verifier-Guided Inference Control Plane Case Study, AlphaEvolve Case Study, Code World Models Case Study, Execution-as-a-Service Verifier Economy Case Study, LLM Inference Scaling Playbook, Beam Search, Calibration Curves, Threshold Optimization, and Uncertainty Quantification next.',
      ],
    },
  ],
};
