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
    explanation: 'Lost in the Middle is the long-context failure where the same relevant evidence is easier to use near the beginning or end of a prompt than in the middle. The context window is large enough; the model just does not use all positions equally well.',
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
    explanation: 'If a product always puts key evidence at the end, it may look stronger than it really is. If a benchmark always places needles at convenient positions, it can overestimate long-context ability.',
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
    {
      heading: 'What it is',
      paragraphs: [
        'Lost in the Middle is a long-context failure mode: a language model may answer correctly when relevant evidence appears near the beginning or end of its context, but miss the same evidence when it appears in the middle. The point is not that the context window is too small. The point is that usable recall can be position-dependent even inside the advertised window.',
        'The TACL paper "Lost in the Middle" tested multi-document question answering and key-value retrieval while moving relevant information to different positions in the input. It found that performance often peaks near the beginning or end and drops when the relevant item is in the middle: https://aclanthology.org/2024.tacl-1.9/ and https://arxiv.org/abs/2307.03172. The accompanying repository includes data and experiment scripts: https://github.com/nelson-liu/lost-in-the-middle.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'Long context is easy to oversell. A 128K or 1M token window is a storage budget, not a promise that every token is used equally well. Attention Mechanism shows that every query scores against keys, but the model still has to decide which keys matter. Positional Encoding determines how order enters the geometry. KV Cache makes serving long prompts possible, but it does not make the model robust to distractors, stale instructions, or buried evidence.',
        'This matters for legal review, medical records, research agents, incident response, codebase analysis, and any workflow where a tiny clause in a large document can change the answer. If evaluation only checks convenient document orders, a system can appear reliable while failing on realistic layouts. If prompt engineering always places citations near the end, teams may confuse template luck with long-context understanding.',
      ],
    },
    {
      heading: 'Benchmark design',
      paragraphs: [
        'Needle-in-a-haystack tests insert a relevant fact into a long body of distractor text and ask the model to retrieve it. They are valuable because they sweep context length and insertion position. But simple needles often share literal words with the question, so a model can exploit string-like matching. That is useful for basic recall, but it can overstate the ability to connect semantically related evidence.',
        'NoLiMa extends this idea by minimizing lexical overlap between the question and the needle, forcing the model to infer latent associations instead of matching exact words. Its arXiv abstract reports that 11 evaluated models fell below 50 percent of their strong short-context baselines at 32K tokens, and even strong models degraded under longer contexts: https://arxiv.org/abs/2502.05167. The official code and results are at https://github.com/adobe-research/NoLiMa.',
      ],
    },
    {
      heading: 'Complete case study: policy clause buried in a contract',
      paragraphs: [
        'A contract-review assistant receives a 120-page vendor agreement and must answer whether customer data may be used to train vendor models. The key clause is not in the data-processing addendum; it is a middle-page carveout under "service improvement." A naive long-context system sends the whole contract to the model and asks for an answer. It works when the clause is near the end in a test fixture, then fails when a real contract places it in the middle between unrelated security exhibits.',
        'A stronger system treats the problem as retrieval plus verification. It chunks the contract, indexes definitions and obligations, retrieves candidate spans for "training," "improvement," "analytics," "model," and defined terms, reranks candidate clauses, quotes the exact span, and then asks the model to reason over a compact pack. The final answer cites the clause and preserves uncertainty if the retrieved span conflicts with another section. Multi-Index RAG, Maximal Marginal Relevance, RAG Context Packing Token Budget, Cross-Encoder Reranker, Agent Memory & Context Engineering Case Study, and RAG Evaluation all become practical tools, not optional extras.',
      ],
    },
    {
      heading: 'Mitigations and limits',
      paragraphs: [
        'Mitigations include retrieval before reasoning, reranking, quote extraction, evidence grouping, recency-safe prompt templates, source ledgers, and evaluation grids that vary length, insertion position, distractor similarity, chunk order, and question wording. RAG is not magic: U-NIAH reports that retrieval noise and reverse chunk ordering can degrade performance, while RAG can still mitigate lost-in-the-middle for smaller models in controlled settings: https://arxiv.org/abs/2503.00353.',
        'The important test is not "can the model answer one needle prompt?" It is "does accuracy stay stable as the answer moves, context grows, distractors become semantically similar, and the question stops sharing literal terms with the evidence?" If not, use long context as one ingredient in a larger system: retrieve, compress, isolate, cite, and audit.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Lost in the Middle in TACL at https://aclanthology.org/2024.tacl-1.9/, arXiv version at https://arxiv.org/abs/2307.03172, Lost in the Middle repository at https://github.com/nelson-liu/lost-in-the-middle, NoLiMa at https://arxiv.org/abs/2502.05167, NoLiMa repository at https://github.com/adobe-research/NoLiMa, and U-NIAH at https://arxiv.org/abs/2503.00353.',
        'Study Attention Mechanism, Multi-Head Attention, Positional Encoding, RoPE, KV Cache, RAG Pipeline, Multi-Index RAG, Maximal Marginal Relevance, RAG Context Packing Token Budget, Cross-Encoder Reranker, Agent Memory & Context Engineering Case Study, LLM Evaluation Harnesses, and RAG Evaluation next.',
      ],
    },
  ],
};
