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
  const reflectionTokenCount = 4; // Retrieve, Relevant, Supported, Utility
  const loopNodeCount = 7; // prompt, need, ret, gen, crit, select, answer
  const loopEdgeCount = 7; // edges in the loop graph
  const ragVariants = 4; // fixed RAG, Self-RAG, agent loop, eval harness

  yield {
    state: loopGraph('Self-RAG turns retrieval into a learned control decision'),
    highlight: { active: ['prompt', 'need', 'ret', 'gen', 'crit'], found: ['answer'] },
    explanation: `Standard RAG retrieves a fixed number of passages before every generation. Self-RAG trains the model to emit ${reflectionTokenCount} reflection tokens across ${loopNodeCount} pipeline stages that decide whether retrieval is needed, whether passages are relevant, and whether the generated segment is supported.`,
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
    explanation: `The ${reflectionTokenCount} special tokens (Retrieve, Relevant, Supported, Utility) act like internal control-plane signals. They are predicted as part of generation, so the model can be steered at inference time toward more retrieval, stricter support, or more concise answers.`,
    invariant: `All ${reflectionTokenCount} reflection tokens are policy signals; they still need external evaluation to verify calibration.`,
  };

  yield {
    state: loopGraph('Generation happens segment by segment'),
    highlight: { active: ['gen', 'crit', 'select', 'e-gen-crit', 'e-crit-select'], compare: ['ret'] },
    explanation: `Self-RAG scores generated segments as it goes through ${loopEdgeCount} graph edges. Segment-level critique lets the system reject or down-rank unsupported continuations before they become a polished but false final answer.`,
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
    explanation: `Self-RAG is not just a prompt pattern. Compared to ${ragVariants} retrieval paradigms (fixed, self, agent, eval), it changes model behavior by training it to produce retrieval and critique signals. That makes it powerful but harder to retrofit than a reranker.`,
  };
}

function* controlAndScoring() {
  const thresholdDataPoints = 5; // 0.1, 0.3, 0.5, 0.7, 0.9
  const candidateSegments = 4; // A, B, C, D
  const scoringDimensions = 3; // support, relevance, utility
  const deploymentChecks = 4; // training data, retriever, thresholds, evals

  yield {
    state: plotState({
      axes: { x: { label: 'retrieval threshold', min: 0, max: 1 }, y: { label: 'relative rate', min: 0, max: 1 } },
      series: [
        { id: 'calls', label: 'retrieval calls', points: [{ x: 0.1, y: 0.92 }, { x: 0.3, y: 0.72 }, { x: 0.5, y: 0.50 }, { x: 0.7, y: 0.31 }, { x: 0.9, y: 0.12 }] },
        { id: 'miss', label: 'missed evidence', points: [{ x: 0.1, y: 0.08 }, { x: 0.3, y: 0.14 }, { x: 0.5, y: 0.24 }, { x: 0.7, y: 0.43 }, { x: 0.9, y: 0.70 }] },
      ],
    }),
    highlight: { active: ['calls'], compare: ['miss'] },
    explanation: `At inference time, reflection tokens can be thresholded across ${thresholdDataPoints} sampled points from 0.1 to 0.9. Retrieve aggressively and cost/noise rise; retrieve conservatively and missed evidence rises. The threshold is a product-risk dial.`,
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
    explanation: `The critique tokens create a local scoring ledger across ${candidateSegments} candidate segments, each rated on ${scoringDimensions} dimensions. A segment can sound relevant but be unsupported, or be supported but not useful for the user question.`,
  };

  yield {
    state: loopGraph('Self-RAG connects retrieval, generation, and verification'),
    highlight: { active: ['ret', 'gen', 'crit', 'select', 'e-ret-gen', 'e-gen-crit', 'e-crit-select'], found: ['answer'] },
    explanation: `This is why Self-RAG belongs beside RAG evaluation and verifier search. It brings ${scoringDimensions} evaluation dimensions (support, relevance, utility) into the generation loop, while still needing external golden sets to prove reliability.`,
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
    explanation: `Self-RAG is a trained system, not a simple middleware toggle. All ${deploymentChecks} components -- model, retriever, thresholds, and evaluation suite -- have to be designed together.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation follows one Self-RAG generation loop. Self-RAG means self-reflective retrieval-augmented generation: the model predicts control tokens that decide when to retrieve, whether evidence is relevant, whether output is supported, and whether the segment is useful.',
        'Active state marks the current control decision, found state marks a selected segment, and compare state marks candidates or passages being judged. The safe inference is: a segment should enter the answer only after the loop has made a retrieval, relevance, support, and utility decision for that segment.',
        'Watch the skip-retrieval case. Fixed RAG retrieves before every answer; Self-RAG can decide that evidence is unnecessary for a given segment and avoid the retrieval cost.',
        {type: 'callout', text: 'Self-RAG turns retrieval from a fixed preprocessing step into a learned control signal checked at every generated segment.'},
      
        {type: 'image', src: './assets/gifs/self-rag-adaptive-retrieval-critique.gif', alt: 'Animated walkthrough of the self rag adaptive retrieval critique visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Retrieval-augmented generation, or RAG, gives a language model external passages before it answers. That helps with facts, citations, and private corpora, but standard RAG retrieves once up front whether the prompt needs evidence or not.',
        {type: 'image', src: 'https://selfrag.github.io/static/images/teaser_self_rag_v8.png', alt: 'Self-RAG project teaser comparing fixed retrieval with adaptive retrieval, critique, and segment selection', caption: 'Self-RAG differs from fixed RAG by deciding when to retrieve, scoring evidence, and selecting supported segments during generation. Source: selfrag.github.io, Asai et al., CC BY-SA 4.0 website.'},
        'Self-RAG exists because evidence need changes inside an answer. A definition may need no retrieval, a disputed claim may need a source, and a later sentence can drift beyond the passage that supported the first sentence.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is fixed-k RAG: embed the user query, retrieve the top k passages, put them in the prompt, and generate once. It is simple, debuggable, and useful for many single-hop factual questions.',
        'A reranker improves the retrieved set by rescoring candidate passages, but it still treats retrieval as a preprocessing stage. The generator does not decide mid-answer that it needs new evidence.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Fixed RAG has no retrieval awareness. It can fetch irrelevant passages for a creative prompt, miss evidence for the second half of a multi-hop answer, or produce fluent text that goes beyond the passage.',
        'The missing invariant is segment-level grounding. At each generation boundary, the system should know whether evidence is needed, whether the retrieved passage is relevant, and whether the proposed text is supported.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Self-RAG turns retrieval and critique into tokens the model predicts during generation. These reflection tokens expose control decisions that fixed RAG leaves outside the model.',
        'The key boundary is per segment, not per whole answer. The model can retrieve for one segment, skip retrieval for another, and score candidate segments before selecting the final continuation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Self-RAG adds special reflection tokens for retrieval need, passage relevance, output support, and segment utility. These are trained tokens in the model vocabulary, not comments added after generation.',
        {type: 'image', src: 'https://selfrag.github.io/static/images/special_tokens.png', alt: 'Self-RAG special reflection tokens for retrieve, relevance, support, and utility decisions', caption: 'Reflection tokens make retrieval need, passage relevance, support, and utility visible as model-predicted control signals. Source: selfrag.github.io, Asai et al., CC BY-SA 4.0 website.'},
        'At a segment boundary, the model predicts whether to retrieve. If retrieval happens, passages are fetched and scored for relevance; candidate segments are generated, scored for support and utility, and the best segment is kept.',
        'Training uses critic-labeled examples that show where retrieval and critique tokens should appear. The generator then learns to emit ordinary answer text and reflection tokens in one sequence.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The control-flow argument is that unsupported text gets more chances to be caught before it becomes final. Retrieval need, relevance, support, and utility are checked close to the segment they govern.',
        'This works only if the reflection tokens are calibrated. They are model predictions learned from critic supervision, so a bad critic or domain shift can teach the model to mark unsupported text as supported.',
        'The method improves over fixed RAG by making retrieval cost proportional to need. It does not remove the need for a good retriever, current corpus, and external evaluation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Training cost rises because the model needs labeled reflection-token data. The Self-RAG paper uses critic supervision to create these labels before fine-tuning the generator.',
        'Inference cost becomes variable. Easy prompts may skip retrieval and run faster than fixed RAG, while evidence-heavy prompts may retrieve, critique, and score multiple candidate segments.',
        'Evaluation also becomes more detailed. Teams must measure retrieval-need accuracy, relevance precision, support calibration, utility quality, answer accuracy, latency, and per-domain failure slices.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Self-RAG fits mixed workloads where some prompts need evidence and others do not. Open-domain QA, fact verification, biography generation, research assistance, and customer support all have that shape.',
        {type: 'image', src: 'https://selfrag.github.io/static/images/analysis_result_1.png', alt: 'Self-RAG ablation and retrieval-threshold analysis plots', caption: 'The analysis figure makes the deployment dials concrete: retrieval frequency, support weighting, and component ablations change quality differently by task. Source: selfrag.github.io, Asai et al., CC BY-SA 4.0 website.'},
        'It is useful when the answer can change evidence needs midstream. A research assistant might retrieve for a claim, skip a transition sentence, then retrieve again when the topic shifts.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Self-reflection is not self-verification. The same model family can overestimate support, mark irrelevant passages as useful, or skip retrieval when the domain requires evidence.',
        'Retriever quality remains a hard dependency. If the corpus is stale, missing, poisoned, or poorly indexed, the reflection loop cannot create good evidence from bad retrieval results.',
        'It is harder to retrofit than a reranker. The method requires training access and an expanded vocabulary, so it cannot be bolted onto every closed model API.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Prompt: compare France and Germany GDP in 2023. Fixed RAG retrieves five passages up front; suppose four mention France and one mentions Europe generally.',
        'Self-RAG can retrieve for the France segment, score support, then reach the Germany segment and predict retrieval again. If the new passage is relevant and supports the Germany number, the segment can be selected; if not, the system can abstain or retrieve again.',
        'Cost changes with need. A simple definition may use zero retrieval calls, while this comparison might use two retrieval calls and several candidate segment scores.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary paper: Asai et al., Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection, ICLR 2024, https://arxiv.org/abs/2310.11511. Project page: https://selfrag.github.io/.',
        'Study standard RAG, embeddings, reranking, beam search, verifier-guided generation, FLARE-style active retrieval, CRAG, citation checking, and retrieval evaluation. The core production skill is measuring whether reflection tokens improve grounded answers rather than only adding trace fields.',
      ],
    },
  ],
};
