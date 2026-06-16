// Self-RAG: train a model to decide when to retrieve, generate with evidence,
// and critique its own passages through special reflection tokens.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'self-rag-adaptive-retrieval-critique',
  title: 'Self-RAG: Adaptive Retrieval and Critique',
  category: 'Papers',
  summary: 'A retrieval-augmented generation architecture where the model learns reflection tokens for retrieve, relevance, support, and utility decisions.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['reflection loop', 'control and scoring'], defaultValue: 'reflection loop' },
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

function loopGraph(title) {
  return graphState({
    nodes: [
      { id: 'prompt', label: 'prompt', x: 0.7, y: 3.5, note: 'task' },
      { id: 'need', label: 'need?', x: 2.3, y: 3.5, note: 'retrieve' },
      { id: 'ret', label: 'retrieve', x: 4.0, y: 2.25, note: 'passages' },
      { id: 'gen', label: 'generate', x: 4.0, y: 4.75, note: 'segment' },
      { id: 'crit', label: 'critique', x: 6.0, y: 3.5, note: 'tokens' },
      { id: 'select', label: 'select', x: 7.8, y: 3.5, note: 'utility' },
      { id: 'answer', label: 'answer', x: 9.2, y: 3.5, note: 'final' },
    ],
    edges: [
      { id: 'e-prompt-need', from: 'prompt', to: 'need' },
      { id: 'e-need-ret', from: 'need', to: 'ret', weight: 'yes' },
      { id: 'e-need-gen', from: 'need', to: 'gen', weight: 'no' },
      { id: 'e-ret-gen', from: 'ret', to: 'gen' },
      { id: 'e-gen-crit', from: 'gen', to: 'crit' },
      { id: 'e-crit-select', from: 'crit', to: 'select' },
      { id: 'e-select-answer', from: 'select', to: 'answer' },
    ],
  }, { title });
}

function* reflectionLoop() {
  yield {
    state: loopGraph('Self-RAG turns retrieval into a learned control decision'),
    highlight: { active: ['prompt', 'need', 'ret', 'gen', 'crit'], found: ['answer'] },
    explanation: 'Standard RAG retrieves a fixed number of passages before every generation. Self-RAG trains the model to emit reflection tokens that decide whether retrieval is needed, whether passages are relevant, and whether the generated segment is supported.',
  };

  yield {
    state: labelMatrix(
      'Reflection token roles',
      [
        { id: 'retrieve', label: 'Retrieve' },
        { id: 'relevant', label: 'Relevant' },
        { id: 'support', label: 'Supported' },
        { id: 'utility', label: 'Utility' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'controls', label: 'controls' },
      ],
      [
        ['need external evidence?', 'skip or fetch'],
        ['is passage useful?', 'filter evidence'],
        ['is claim grounded?', 'citation trust'],
        ['is segment good?', 'beam selection'],
      ],
    ),
    highlight: { active: ['retrieve:controls', 'relevant:controls', 'support:controls', 'utility:controls'] },
    explanation: 'The special tokens act like internal control-plane signals. They are predicted as part of generation, so the model can be steered at inference time toward more retrieval, stricter support, or more concise answers.',
    invariant: 'Reflection tokens are policy signals; they still need external evaluation.',
  };

  yield {
    state: loopGraph('Generation happens segment by segment'),
    highlight: { active: ['gen', 'crit', 'select', 'e-gen-crit', 'e-crit-select'], compare: ['ret'] },
    explanation: 'Self-RAG scores generated segments as it goes. Segment-level critique lets the system reject or down-rank unsupported continuations before they become a polished but false final answer.',
  };

  yield {
    state: labelMatrix(
      'What changes from ordinary RAG',
      [
        { id: 'fixed', label: 'fixed RAG' },
        { id: 'self', label: 'Self-RAG' },
        { id: 'agent', label: 'agent loop' },
        { id: 'eval', label: 'eval harness' },
      ],
      [
        { id: 'retrieval', label: 'retrieval' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['always top-k', 'noise and cost'],
        ['on demand', 'training complexity'],
        ['tool decision', 'loop failures'],
        ['offline scoring', 'judge drift'],
      ],
    ),
    highlight: { active: ['self:retrieval', 'self:risk'], compare: ['fixed:risk'] },
    explanation: 'Self-RAG is not just a prompt pattern. It changes the model behavior by training it to produce retrieval and critique signals. That makes it powerful but harder to retrofit than a reranker.',
  };
}

function* controlAndScoring() {
  yield {
    state: plotState({
      axes: { x: { label: 'retrieval threshold', min: 0, max: 1 }, y: { label: 'relative rate', min: 0, max: 1 } },
      series: [
        { id: 'calls', label: 'retrieval calls', points: [{ x: 0.1, y: 0.92 }, { x: 0.3, y: 0.72 }, { x: 0.5, y: 0.50 }, { x: 0.7, y: 0.31 }, { x: 0.9, y: 0.12 }] },
        { id: 'miss', label: 'missed evidence', points: [{ x: 0.1, y: 0.08 }, { x: 0.3, y: 0.14 }, { x: 0.5, y: 0.24 }, { x: 0.7, y: 0.43 }, { x: 0.9, y: 0.70 }] },
      ],
    }),
    highlight: { active: ['calls'], compare: ['miss'] },
    explanation: 'At inference time, reflection tokens can be thresholded. Retrieve aggressively and cost/noise rise; retrieve conservatively and missed evidence rises. The threshold is a product-risk dial.',
  };

  yield {
    state: labelMatrix(
      'Segment selection ledger',
      [
        { id: 'segA', label: 'segment A' },
        { id: 'segB', label: 'segment B' },
        { id: 'segC', label: 'segment C' },
        { id: 'segD', label: 'segment D' },
      ],
      [
        { id: 'support', label: 'support' },
        { id: 'relevance', label: 'relevance' },
        { id: 'utility', label: 'utility' },
      ],
      [
        ['high', 'high', 'keep'],
        ['low', 'high', 'reject'],
        ['high', 'low', 'maybe'],
        ['medium', 'high', 'revise'],
      ],
    ),
    highlight: { found: ['segA:utility'], removed: ['segB:utility'], active: ['segD:utility'] },
    explanation: 'The critique tokens create a local scoring ledger for generation. A segment can sound relevant but be unsupported, or be supported but not useful for the user question.',
  };

  yield {
    state: loopGraph('Self-RAG connects retrieval, generation, and verification'),
    highlight: { active: ['ret', 'gen', 'crit', 'select', 'e-ret-gen', 'e-gen-crit', 'e-crit-select'], found: ['answer'] },
    explanation: 'This is why Self-RAG belongs beside RAG evaluation and verifier search. It brings some evaluation signals into the generation loop, while still needing external golden sets to prove reliability.',
  };

  yield {
    state: labelMatrix(
      'Deployment checklist',
      [
        { id: 'data', label: 'training data' },
        { id: 'retriever', label: 'retriever' },
        { id: 'thresholds', label: 'thresholds' },
        { id: 'eval', label: 'evals' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'failure', label: 'failure if weak' },
      ],
      [
        ['reflection labels', 'tokens meaningless'],
        ['fresh passages', 'bad grounding'],
        ['task-specific dials', 'over/under retrieve'],
        ['slice-level checks', 'false confidence'],
      ],
    ),
    highlight: { active: ['data:need', 'retriever:need', 'thresholds:need', 'eval:need'] },
    explanation: 'Self-RAG is a trained system, not a simple middleware toggle. The model, retriever, thresholds, and evaluation suite have to be designed together.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'reflection loop') yield* reflectionLoop();
  else if (view === 'control and scoring') yield* controlAndScoring();
  else throw new InputError('Pick a Self-RAG view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Self-RAG, or Self-Reflective Retrieval-Augmented Generation, trains a language model to retrieve, generate, and critique through special reflection tokens. Ordinary RAG often retrieves a fixed top-k set no matter whether the task needs evidence. Self-RAG makes retrieval adaptive: the model can request passages, skip retrieval, judge passage relevance, judge support, and score utility during generation.',
        'The paper frames the problem as indiscriminate retrieval: fixed retrieval can add irrelevant context, reduce versatility, and still fail to improve factuality. Self-RAG learns retrieval-on-demand and self-reflection inside a single generation process: https://arxiv.org/abs/2310.11511. The project page summarizes the method and results at https://selfrag.github.io/.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Self-RAG extends the model vocabulary with reflection tokens. During training, the generator sees text interleaved with retrieved passages and critic-produced tokens. During inference, the model emits signals for whether to retrieve, whether retrieved passages are relevant, whether generated claims are supported, and how useful a segment is. Those signals can guide segment-wise generation and selection.',
        'The official implementation describes Self-RAG as learning to retrieve, generate, and critique through self-reflection, with segment-wise beam search that selects outputs according to utility preferences: https://github.com/akariasai/self-rag. The OpenReview page records the ICLR 2024 paper: https://openreview.net/forum?id=hSyW5go0v8.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The upside is controllability. A fact-heavy question can trigger retrieval, while a creative or self-contained answer can skip retrieval. Unsupported segments can be rejected before they become final output. The cost is training complexity, inference complexity, and threshold tuning. You need labels or critic outputs for reflection tokens, a retriever that returns useful passages, and an evaluation suite that catches when the model learns the wrong retrieval policy.',
        'Self-RAG also changes latency accounting. It may retrieve multiple times during generation, retrieve zero times, or run segment-wise selection. That makes average latency less informative than a distribution by task type. RAG Evaluation: RAGAS, ARES, and the RAG Triad should score retrieval necessity, passage relevance, faithfulness, answer relevance, and citation quality separately.',
      ],
    },
    {
      heading: 'Complete case study: fact-checking assistant',
      paragraphs: [
        'A fact-checking assistant receives mixed requests. Some ask for definitions the model already knows. Others ask whether a current claim is supported by a source. Fixed RAG wastes retrieval on the first group and may retrieve too little on the second. Self-RAG can learn to emit a retrieval token only when external grounding is needed, then critique whether the retrieved passage supports the generated segment.',
        'The production design still needs ordinary retrieval infrastructure. Multi-Index RAG can provide candidate passages. Cross-Encoder Reranker can improve passage quality. Semantic Cache for LLMs can avoid repeated answers when safe. LLM Evaluation Harnesses and RAG Evaluation must remain outside the model because self-critique is not proof of correctness.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat self-reflection as a guarantee. A model can confidently emit the wrong support token. Reflection tokens are learned signals, not ground truth. Do not deploy Self-RAG without tracing: teams need to see when retrieval was requested, which passages were used, which claims were judged supported, and which segments were rejected.',
        'Do not confuse Self-RAG with an agent loop. An agent may choose tools with external control logic. Self-RAG bakes retrieval and critique signals into language-model generation. The two can be combined, but the failure modes differ: agent loops fail through planning and tool errors; Self-RAG fails through learned policy, retrieval, and critique errors.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Self-RAG paper at https://arxiv.org/abs/2310.11511, ICLR PDF at https://proceedings.iclr.cc/paper_files/paper/2024/file/25f7be9694d7b32d5cc670927b8091e1-Paper-Conference.pdf, project page at https://selfrag.github.io/, official repository at https://github.com/akariasai/self-rag, OpenReview page at https://openreview.net/forum?id=hSyW5go0v8, and IBM research page at https://research.ibm.com/publications/self-rag-learning-to-retrieve-generate-and-critique-through-self-reflection. Study RAG Pipeline, Multi-Index RAG, RAG Evaluation, Agentic AI Patterns, Beam Search, Process Reward Models & Verifier Search, and Prompt Injection Threat Model next.',
      ],
    },
  ],
};
