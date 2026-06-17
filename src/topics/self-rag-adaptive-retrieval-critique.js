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
      heading: 'Why This Exists',
      paragraphs: [
        'Self-RAG exists because retrieval-augmented generation solves one problem and creates another. A language model that relies only on parametric memory can answer with stale or false claims. A standard RAG pipeline reduces that risk by retrieving passages and placing them in the context window. The naive version retrieves a fixed top-k set before generation, no matter what the prompt asks. That helps fact-heavy questions, but it can add noise to tasks that do not need evidence, waste latency on simple instructions, and still fail when the retrieved passages are irrelevant or the answer is not supported by them. Self-RAG, or Self-Reflective Retrieval-Augmented Generation, changes retrieval from a fixed middleware step into a learned control decision inside generation.',
      ],
    },
    {
      heading: 'The Naive Approach',
      paragraphs: [
        'The reasonable first attempt is fixed RAG: retrieve the same number of passages for every query, then ask the model to answer using that context. It is simple, easy to instrument, and often enough for question answering. The wall is that retrieval need is not constant. A creative writing prompt may not need retrieval at all. A fact-checking prompt may need several retrieval points as the answer develops. A long-form answer may start grounded and then drift. A retrieved passage may be topically similar but not answer the question. Fixed RAG has no internal signal for these differences. It pushes all control into retriever settings and prompts, then asks the generator to behave as if the right evidence is already present.',
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        'The core insight is to train the model to emit special reflection tokens along with ordinary text. These tokens answer control questions: should the model retrieve now, is a retrieved passage relevant, is the generated segment supported by the evidence, and how useful is the segment for the user request. The token stream becomes a small control plane. It does not replace the retriever, the passage store, or external evaluation. It gives the generator a learned way to decide when evidence is needed and a learned way to score the local continuation. The invariant is that retrieval and critique happen at segment boundaries, before unsupported text becomes a polished final answer. That creates chances to skip, fetch, reject, revise, or select.',
      ],
    },
    {
      heading: 'How Training Works',
      paragraphs: [
        'Training has three moving parts in the paper design: a retriever, a critic, and a generator. The critic is trained to produce reflection labels for retrieved passages and generated segments. Those labels are then inserted into instruction-output data. The generator is fine-tuned with an expanded vocabulary so it learns ordinary next-token prediction and reflection-token prediction in the same sequence. The important detail is that the generator is not merely prompted to say whether evidence is relevant. It has been trained to produce control tokens such as Retrieve, ISREL for relevance, ISSUP for support, and ISUSE for utility. The paper uses critic-generated supervision because hand-labeling every segment and passage would be expensive. That design makes the method scalable enough to study, but it also makes data quality and critic quality part of the system risk.',
      ],
    },
    {
      heading: 'How Inference Works',
      paragraphs: [
        'At inference time the model generates in segments. Before or during a segment, it predicts whether retrieval is needed. If retrieval is triggered, the system queries the retriever and places candidate passages into the generation path. The model then predicts relevance tokens for those passages, generates a candidate segment, predicts support tokens that judge whether the segment is entailed by the evidence, and predicts utility. Decoding can use these token probabilities as preferences. A stricter product can raise the retrieval threshold or reward supported segments more heavily. A lower-latency product can retrieve less often and accept more parametric answers. Segment-level beam search can keep several continuations and select the one with better utility and support signals. The method turns generation into a loop of request evidence, draft text, critique text, select.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'Self-RAG works when the learned reflection tokens are correlated with the decisions the system needs. Retrieval tokens help because not every prompt should pay the same evidence cost. Relevance tokens help because top-k similarity is not the same as answer usefulness. Support tokens help because a fluent sentence can go beyond the passage. Utility tokens help because supported text can still be verbose, incomplete, or off task. The proof sketch is a control-flow argument, not a guarantee of truth. If the reflection model reliably marks missing evidence, irrelevant passages, unsupported segments, and low-utility continuations, then decoding can prefer outputs that are more grounded and useful. If those tokens are wrong, the loop can confidently select bad text. External evaluation is still needed.',
      ],
    },
    {
      heading: 'What the Visual Proves',
      paragraphs: [
        'The reflection-loop view shows the move that separates Self-RAG from ordinary RAG. The prompt does not flow through retrieval once and then disappear into generation. It reaches a retrieval decision, optional passage retrieval, segment generation, critique, selection, and final answer. The reflection-token matrix names the control signals so the learner can see which decision each token affects. The scoring plot shows the product dial: lower retrieval thresholds increase evidence calls and cost, while higher thresholds increase missed evidence. The segment ledger shows the local failure cases. A segment can be relevant but unsupported, supported but not useful, or good enough to keep. The deployment checklist makes the system boundary visible: model, retriever, thresholds, and eval set must be designed together.',
      ],
    },
    {
      heading: 'Costs and Tradeoffs',
      paragraphs: [
        'Self-RAG shifts cost from fixed retrieval into learned control. It can skip retrieval on self-contained prompts, but it can also retrieve multiple times during one answer. Latency becomes a distribution by task type rather than one average number. Training cost rises because reflection supervision has to be generated and filtered. Inference cost rises when segment-level selection keeps several candidates. Tracing cost rises because teams need to record retrieval decisions, passages, reflection tokens, rejected segments, thresholds, and final answers. Evaluation becomes more demanding. You should measure retrieval necessity, passage relevance, answer support, citation quality, answer utility, and failure by slice. A high support score on easy queries does not prove the system works on current events, long-form synthesis, or adversarial retrieval.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'Self-RAG fits mixed workloads where retrieval should be conditional. A fact-checking assistant receives both simple definitions and source-sensitive claims. A research assistant may answer one paragraph from memory, then need evidence for a named study. A customer-support agent may skip retrieval for generic policy wording but fetch the account-specific article for a billing claim. A long-form citation assistant can use support tokens to avoid drifting away from evidence. The access pattern is segment-level uncertainty: the system learns that some continuations need external grounding and some do not. Self-RAG is also a good teaching bridge between RAG and verifier-guided generation because it brings scoring signals into the decoding loop while still depending on external tests.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'The largest misconception is that self-reflection equals truth. Reflection tokens are model predictions. A model can label an unsupported segment as supported, mark a bad passage as relevant, or skip retrieval because training data made the policy overconfident. Poor retrievers still return poor evidence. Outdated corpora still make answers stale. Prompt injection in retrieved text can still attack the generator. Thresholds tuned on one domain can over-retrieve in another and under-retrieve in a high-risk slice. Self-RAG is also harder to retrofit than adding a reranker because it depends on model training. It is not the same as an agent loop. Agent failures come from planning, tool use, permissions, and state. Self-RAG failures come from learned retrieval policy, passage quality, critique calibration, and decoding choices.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary sources are the Self-RAG arXiv paper at https://arxiv.org/abs/2310.11511, the ICLR 2024 paper PDF at https://proceedings.iclr.cc/paper_files/paper/2024/file/25f7be9694d7b32d5cc670927b8091e1-Paper-Conference.pdf, the project page at https://selfrag.github.io/, the official repository at https://github.com/akariasai/self-rag, the OpenReview record at https://openreview.net/forum?id=hSyW5go0v8, and the IBM research page at https://research.ibm.com/publications/self-rag-learning-to-retrieve-generate-and-critique-through-self-reflection. Study standard RAG pipelines, multi-index retrieval, cross-encoder reranking, beam search, verifier search, process reward models, RAG evaluation, citation faithfulness, semantic caching, and prompt injection threat models next. The next mental step is to separate retrieval quality, generation quality, and critique quality instead of treating RAG as one black box.',
      ],
    },
  ],
};
