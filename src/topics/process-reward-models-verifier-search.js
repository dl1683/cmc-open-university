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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/process-reward-models-verifier-search.gif', alt: 'Animated walkthrough of the process reward models verifier search visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Multi-step reasoning fails in a way ordinary final-answer grading hides. A model can make a false algebra move, cancel the wrong term, invent a lemma, or misread a condition, then still land on the correct answer by luck. It can also write a beautiful trace that ends with a wrong answer because one early step poisoned the rest. If the only label is "final answer correct," the training signal cannot say where the reasoning changed from valid to invalid.`,
        {type: 'callout', text: 'A process reward model turns reasoning into a scored path, so search can reject a branch before the final answer hides the error.'},
        `Process reward models exist to put feedback at the same granularity as reasoning. An outcome reward model asks whether the destination is right. A process reward model asks whether each step is locally valid, relevant, and consistent with the previous steps. OpenAI's Let's Verify Step by Step paper compared these two supervision styles on mathematical reasoning and released PRM800K, a dataset of 800,000 step-level correctness labels for model-generated MATH solutions: https://arxiv.org/abs/2305.20050 and https://github.com/openai/prm800k.`,
      ],
    },
    {
      heading: 'The naive approach and the wall',
      paragraphs: [
        `The obvious approach is outcome supervision. Give the model many problems, sample solutions, check the final answer, and reward outputs that finish correctly. That approach is not foolish. For tasks with exact answers, final labels are cheap, easy to scale, and easy to audit. A final-answer verifier also avoids exposing or storing long reasoning traces when the only product requirement is a correct response.`,
        `The wall is credit assignment. A final-answer label is a one-bit judgment over an entire path. It cannot distinguish a correct method from a lucky guess, a nearly correct solution from a broken one, or a repairable path from a path that should be abandoned immediately. Search has the same problem. If a generator samples ten reasoning traces, a final-answer vote can choose the most common answer, but it may still miss the first invalid move shared by many traces. The system needs a way to score partial work before the end.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that reasoning traces are search paths, not just strings. If each intermediate step can be judged, the search procedure can prune a bad branch when the error appears, rerank several plausible paths by their weakest or average steps, and spend more compute on branches that still preserve the problem's constraints. The verifier becomes the scoring function for a tree of partial solutions.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'A reasoning trace can be read as a directed path through partial states, with verifier scores deciding which edges survive. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        `That turns "generate one chain of thought" into a proposal-and-selection system. The generator proposes candidate steps. The process reward model estimates whether the current path remains valid. The selector chooses whether to continue, repair, branch, or stop. This is the same broad idea behind self-consistency, Tree of Thoughts, Monte Carlo search, and executable verification in code, but the PRM supplies a learned step-level score when no exact programmatic oracle exists.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A PRM training pipeline starts by defining what counts as a step. That sounds administrative, but it is a real modeling choice. A step might be one equation transformation, one natural-language claim, one code edit, or one theorem application. If steps are too small, annotation becomes noisy and expensive. If steps are too large, the label again hides the exact error.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'A learned verifier is still a model, so calibration and holdout slices matter as much as architecture. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
        `Next, a data engine collects solution traces and labels their steps. Humans can label them directly. A symbolic checker can validate some algebra. Unit tests can score code. A stronger model can assist, but then the dataset needs independent audits because model judges import their own biases. The PRM learns a function from problem, previous context, and candidate step to a score such as correct, incorrect, or uncertain. At inference time, the server samples one or more candidate traces, evaluates steps with the PRM, and uses those scores to choose the final answer or allocate more search budget.`,
        `The OpenAI paper also makes active learning part of the mechanism. Step labels are expensive, so the system should not spend humans on obvious easy examples forever. It should route uncertain, high-impact, or disagreement-heavy steps to labelers. That is why the plot view compares random labeling with active learning: the data structure around the verifier matters as much as the neural scoring model.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The first view separates outcome supervision from process supervision. The outcome path flows from problem to steps to final answer to outcome reward. The process path diverts through step labels and a PRM before selection. The important difference is not cosmetic. The process path creates an earlier decision point, so the system can catch the first bad move instead of waiting for the final answer.`,
        `The verifier-search view shows the search consequence. Several candidate paths can be fluent and plausible, but one contains a bad intermediate step. A step verifier gives the scheduler a reason to discard or repair that branch. The matrix of search patterns then places PRM reranking next to greedy chain-of-thought, self-consistency, tree search, and executable verification. The visual claim is that a PRM is not a full reasoning system by itself. It is a scoring component that changes which branches survive.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness argument is conditional, not absolute. If a step label accurately identifies whether a partial solution still preserves truth, then pruning an invalid partial path is safe because no later fluent prose can make the earlier false step valid. If the PRM assigns higher scores to locally valid steps, reranking by process score raises the chance of selecting a trace whose whole chain is valid.`,
        `The invariant is path validity. Each accepted step must follow from the problem statement and the previous accepted steps. A PRM approximates that invariant. It can never prove general correctness unless the step checker is exact, but it gives search a denser signal than final-answer grading. This is why process supervision can help most on tasks where errors appear early and propagate, such as contest math, symbolic reasoning, and multi-step code planning.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The training cost is label density. A final-answer dataset needs one label per solution. A process dataset may need many labels per solution, a detailed rubric, labeler qualification, quality-control examples, disagreement resolution, and active-learning infrastructure. PRM800K is useful precisely because building such a dataset is expensive. The cost is not only dollars. It is also schema design: the dataset must represent steps consistently enough that the model can learn the boundary.`,
        `Inference cost rises when PRMs are used for search. Sampling ten paths and scoring each step can multiply token generation, verifier calls, latency, and memory pressure. A production system usually needs a cascade: cheap generation first, deterministic checks where available, PRM reranking for ambiguous reasoning, and human or executable verification for high-stakes decisions. The PRM should buy accuracy where the extra compute matters, not become a default tax on every prompt.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `PRMs fit domains where partial work has visible structure but exact final verification is incomplete. Math proofs, symbolic derivations, tutoring, theorem-style explanations, code reasoning before execution, and agent plans all have intermediate claims that can be checked for consistency. They are also useful for evaluation: a failed final answer with a mostly sound path is a different model error from a hallucinated path that happens to end in the right number.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/MCTS_Algorithm.png/250px-MCTS_Algorithm.png', alt: 'Monte Carlo tree search phases of selection expansion simulation and backpropagation', caption: 'Verifier-guided reasoning borrows the same search intuition as tree search: propose branches, score evidence, then spend more work where it can change the choice. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:MCTS_Algorithm.png.'},
        `They also connect naturally to retrieval and tool systems. Self-RAG-style systems judge relevance and support before answering. Code agents can use tests as executable verifiers and learned models for parts tests do not cover. In a verifier-guided inference control plane, a PRM can decide which requests deserve more samples, which branches should be repaired, and which outputs should be escalated to a stronger checker.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `A PRM fails when the verifier learns the appearance of good reasoning instead of the invariant. Polished prose, familiar theorem names, or common proof templates can receive high scores even when the content is false. Search then amplifies the verifier's blind spot because every branch is selected through that same biased scorer. This is reward hacking with reasoning-shaped artifacts.`,
        `A visible trace is also not guaranteed to be the model's complete internal reasoning. Treat traces as supervised outputs and audit records, not transparent access to all computation. More search is not automatically better either. If all samples share the same misconception, self-consistency can confidently pick the wrong answer. If the verifier is miscalibrated, tree search can spend more compute exploring the wrong region. Diversity, calibration, sealed holdouts, and slice analysis are part of the method, not afterthoughts.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study RLHF and preference optimization first, because PRMs are still reward models and inherit proxy-risk problems. Then study LLM evaluation harnesses, calibration curves, threshold optimization, and uncertainty quantification so verifier scores are treated as measured signals rather than truth. For search, study self-consistency, Tree of Thoughts, beam search, Monte Carlo Tree Search and UCT, and agent planning. For stronger verification, study AlphaEvolve-style executable scoring, code world models, RAG evaluation, Self-RAG, and execution-as-a-service verifier systems.`,
      ],
    },
  ],
};
