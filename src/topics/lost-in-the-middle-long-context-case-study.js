// Lost in the Middle: long-context position bias, needle benchmarks, and why
// bigger context windows still need retrieval, ranking, and prompt packing.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'lost-in-the-middle-long-context-case-study',
  title: 'Lost in the Middle: Long-Context Failure Modes',
  category: 'AI & ML',
  summary: 'Why LLMs can miss evidence in the middle of long contexts, how needle benchmarks expose the problem, and how RAG/context engineering mitigates it.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['position bias', 'benchmark design'], defaultValue: 'position bias' },
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

function promptGraph(title, needleAt = 'middle') {
  const nodes = [
    { id: 'question', label: 'question', x: 0.8, y: 1.6, note: 'ask' },
    { id: 'lead', label: 'lead', x: 2.2, y: 3.6, note: 'early' },
    { id: 'd1', label: 'distractor', x: 3.6, y: 3.6, note: 'noise' },
    { id: 'mid', label: 'middle', x: 5.0, y: 3.6, note: needleAt === 'middle' ? 'needle' : 'noise' },
    { id: 'd2', label: 'distractor', x: 6.4, y: 3.6, note: 'noise' },
    { id: 'tail', label: 'tail', x: 7.8, y: 3.6, note: needleAt === 'tail' ? 'needle' : 'late' },
    { id: 'model', label: 'model', x: 8.9, y: 1.6, note: 'answer' },
    { id: 'verdict', label: 'verdict', x: 9.4, y: 5.4, note: needleAt === 'middle' ? 'fragile' : 'easier' },
  ];
  if (needleAt === 'lead') nodes[1].note = 'needle';

  return graphState({
    nodes,
    edges: [
      { id: 'e-question-lead', from: 'question', to: 'lead' },
      { id: 'e-lead-d1', from: 'lead', to: 'd1' },
      { id: 'e-d1-mid', from: 'd1', to: 'mid' },
      { id: 'e-mid-d2', from: 'mid', to: 'd2' },
      { id: 'e-d2-tail', from: 'd2', to: 'tail' },
      { id: 'e-tail-model', from: 'tail', to: 'model' },
      { id: 'e-question-model', from: 'question', to: 'model' },
      { id: 'e-model-verdict', from: 'model', to: 'verdict' },
    ],
  }, { title });
}

function* positionBias() {
  yield {
    state: plotState({
      axes: { x: { label: 'relevant evidence position', min: 0, max: 108 }, y: { label: 'answer accuracy', min: 0, max: 1 } },
      series: [
        { id: 'accuracy', label: 'actual', points: [{ x: 0, y: 0.88 }, { x: 10, y: 0.82 }, { x: 25, y: 0.66 }, { x: 50, y: 0.42 }, { x: 75, y: 0.63 }, { x: 90, y: 0.8 }, { x: 96, y: 0.86 }] },
        { id: 'wish', label: 'ideal', points: [{ x: 0, y: 0.82 }, { x: 20, y: 0.82 }, { x: 40, y: 0.82 }, { x: 60, y: 0.82 }, { x: 80, y: 0.82 }, { x: 96, y: 0.82 }] },
      ],
      markers: [
        { id: 'trough', x: 50, y: 0.42, label: 'middle trough' },
      ],
    }),
    highlight: { active: ['accuracy', 'trough'], compare: ['wish'] },
    explanation: 'The ideal line is flat, but the measured curve dips in the middle. That means the same evidence can be easier to use near the beginning or end of a prompt than in the middle. The context window is large enough; position still changes recall.',
  };

  yield {
    state: promptGraph('The same needle becomes harder when buried', 'middle'),
    highlight: { active: ['question', 'mid', 'model', 'verdict', 'e-question-model', 'e-model-verdict'], compare: ['lead', 'tail'] },
    explanation: 'A long prompt is not a uniform database scan. Recency, primacy, position encodings, attention competition, distractor similarity, and instruction placement can all change whether the model uses the right passage.',
    invariant: 'A longer context window is capacity, not guaranteed recall.',
  };

  yield {
    state: labelMatrix(
      'Why evidence in the middle gets fragile',
      [
        { id: 'primacy', label: 'primacy' },
        { id: 'recency', label: 'recency' },
        { id: 'distractors', label: 'distractors' },
        { id: 'position', label: 'position code' },
        { id: 'attention', label: 'attention' },
      ],
      [
        { id: 'mechanism', label: 'mechanism' },
        { id: 'symptom', label: 'symptom' },
      ],
      [
        ['early text anchors', 'lead wins'],
        ['latest tokens salient', 'tail wins'],
        ['similar chunks compete', 'wrong quote'],
        ['extrapolation drift', 'far facts fade'],
        ['many keys score', 'middle diluted'],
      ],
    ),
    highlight: { active: ['distractors:mechanism', 'attention:mechanism', 'position:mechanism'], compare: ['primacy:symptom', 'recency:symptom'] },
    explanation: 'The failure is not one bug. It is an interaction between model training, position representations, attention scores, prompt templates, and evaluation data. That is why testing only one length or one insertion point is misleading.',
  };

  yield {
    state: promptGraph('Edge placement can hide a broken long-context system', 'tail'),
    highlight: { active: ['tail', 'model', 'verdict', 'e-tail-model', 'e-model-verdict'], removed: ['mid'], compare: ['lead'] },
    explanation: 'The removed middle needle is the warning. If a product or benchmark always puts key evidence near an easy edge position, it may look stronger than it is on real layouts where important spans are buried among distractors.',
  };
}

function* benchmarkDesign() {
  yield {
    state: labelMatrix(
      'Long-context benchmark families',
      [
        { id: 'multidoc', label: 'multi-doc QA' },
        { id: 'kv', label: 'key-value' },
        { id: 'niah', label: 'NIAH' },
        { id: 'nolima', label: 'NoLiMa' },
        { id: 'uniah', label: 'U-NIAH' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'catches', label: 'catches' },
        { id: 'blind', label: 'blind spot' },
      ],
      [
        ['gold document', 'doc order bias', 'realism noise'],
        ['exact pair', 'position use', 'synthetic simple'],
        ['literal needle', 'basic recall', 'lexical match'],
        ['latent link', 'semantic recall', 'narrow setup'],
        ['RAG vs LLM', 'retrieval noise', 'synthetic world'],
      ],
    ),
    highlight: { active: ['nolima:signal', 'nolima:catches', 'uniah:catches'], compare: ['niah:blind'] },
    explanation: 'Needle-in-a-haystack tests are useful, but easy needles can become string matching. NoLiMa makes the model infer a latent association between question and needle, and U-NIAH compares long-context LLMs against RAG under controlled retrieval settings.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'context length', min: 0, max: 138 }, y: { label: 'task accuracy', min: 0, max: 1 } },
      series: [
        { id: 'literal', label: 'literal', points: [{ x: 1, y: 0.96 }, { x: 4, y: 0.93 }, { x: 8, y: 0.9 }, { x: 16, y: 0.86 }, { x: 32, y: 0.8 }, { x: 64, y: 0.72 }, { x: 122, y: 0.65 }] },
        { id: 'associative', label: 'latent', points: [{ x: 1, y: 0.96 }, { x: 4, y: 0.8 }, { x: 8, y: 0.66 }, { x: 16, y: 0.55 }, { x: 32, y: 0.39 }, { x: 64, y: 0.28 }, { x: 122, y: 0.18 }] },
      ],
      markers: [
        { id: 'drop', x: 32, y: 0.39, label: '32K cliff' },
      ],
    }),
    highlight: { active: ['associative', 'drop'], compare: ['literal'] },
    explanation: 'NoLiMa reports that models can look strong on short contexts and literal-match needles, then degrade sharply when the needle and question share little surface vocabulary. A long window does not imply semantic retrieval across the window.',
  };

  yield {
    state: labelMatrix(
      'Mitigation playbook',
      [
        { id: 'rerank', label: 'rerank' },
        { id: 'chunk', label: 'chunk order' },
        { id: 'quote', label: 'quote first' },
        { id: 'rag', label: 'RAG' },
        { id: 'pack', label: 'prompt pack' },
        { id: 'eval', label: 'eval grid' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['rank relevant high', 'false confidence'],
        ['cluster evidence', 'order bias'],
        ['extract spans', 'miss nuance'],
        ['retrieve fewer tokens', 'retrieval miss'],
        ['trim noise', 'over-drop'],
        ['vary length+position', 'sample too small'],
      ],
    ),
    highlight: { active: ['rerank:move', 'rag:move', 'pack:move', 'eval:move'], compare: ['rag:risk', 'pack:risk'] },
    explanation: 'The practical response is not "never use long context." It is: retrieve and rerank, quote exact spans, group related evidence, vary insertion position in evaluations, and keep a source ledger so the answer can be checked.',
  };

  yield {
    state: promptGraph('RAG can help by moving evidence into a smaller pack', 'lead'),
    highlight: { active: ['question', 'lead', 'model', 'verdict', 'e-question-lead', 'e-question-model'], compare: ['mid', 'd1', 'd2'], found: ['tail'] },
    explanation: 'RAG often helps because it changes the problem from "attend across everything" to "select a compact, high-signal context pack." U-NIAH reports that RAG can mitigate lost-in-the-middle for smaller models, while retrieval noise and chunk ordering can still hurt.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'position bias') yield* positionBias();
  else if (view === 'benchmark design') yield* benchmarkDesign();
  else throw new InputError('Pick a long-context failure view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read this as a position test for long-context recall. Active markers show where the relevant evidence sits, compare lines show ideal uniform recall, and found points show where the model actually answers correctly.',
      {type:'callout', text:'A long context window is capacity, not recall; reliable systems must foreground and test evidence across position, length, and distractor pressure.'},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Lost in the middle is a long-context failure where a language model uses evidence near the beginning or end of a prompt but misses the same evidence in the middle. The text is present, yet the answer behaves as if it were absent.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to paste the whole document into the prompt. It feels reasonable because the model accepts the input and attention can score tokens across the context window.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is that attention is not a database index. Position encoding, primacy, recency, distractor similarity, instruction placement, and attention competition affect which spans control the answer.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Long context must be tested by position, not only by length. The system goal is to find, foreground, cite, and reason over controlling evidence under length and distractor pressure.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A diagnostic holds the question, evidence, and distractors fixed while moving only the evidence position. A production system mitigates the failure with retrieval, reranking, careful context packing, quote extraction, and source ledgers.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument for the diagnostic is controlled comparison. If input content is constant and only insertion position changes, then accuracy changes expose positional sensitivity.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The cost of failure is silent incorrectness because the model can answer fluently while ignoring the decisive clause. Mitigation cost is paid in indexing, reranking, packing, citation checks, and position-varied evals.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'This matters in contract review, medical record analysis, compliance audits, codebase question answering, research agents, and incident response. In each case, a small buried passage can override a large surrounding narrative.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Retrieval can miss the decisive span when query terms differ from document terms. Reranking can prefer fluent distractors, compression can drop qualifiers, and literal needle tests can overstate semantic recall.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A 120-page contract asks whether vendor staff may use customer data for model training. The decisive clause is on page 67 under service improvement and allows training only on aggregated data after opt-out review.',
      'A full-context prompt answers from an end-page data-processing addendum and says training is forbidden. A retrieval-first system searches training, improvement, analytics, and defined terms, quotes page 67, and returns the conditional answer.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Study Lost in the Middle at https://aclanthology.org/2024.tacl-1.9/ and https://arxiv.org/abs/2307.03172, the repository at https://github.com/nelson-liu/lost-in-the-middle, NoLiMa at https://arxiv.org/abs/2502.05167, and U-NIAH at https://arxiv.org/abs/2503.00353.',
      'Next, study attention, multi-head attention, positional encoding, RoPE, KV cache, RAG pipeline, multi-index RAG, maximal marginal relevance, cross-encoder reranking, context packing, source ledgers, and RAG evaluation.',
    ] },
  ],
};