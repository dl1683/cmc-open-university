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
      heading: 'How to read the animation',
      paragraphs: [
        'The reflection-loop view traces one Self-RAG generation cycle. Active nodes mark the current decision point: should the model retrieve, is the passage relevant, is the generated text supported, is the segment useful? Found markers show the final answer once the loop completes. Compare markers highlight components that are idle during a given step -- retrieval is skipped when the model decides evidence is unnecessary.',
        'The control-and-scoring view shows what happens at inference time. The plot tracks the tradeoff between retrieval frequency and missed evidence as you move the threshold dial. The segment ledger shows how critique tokens score candidate continuations on support, relevance, and utility before selecting a winner.',
        'Watch for the moment the model decides not to retrieve. That is the move that separates Self-RAG from fixed RAG. In standard RAG, every prompt pays the same retrieval cost. Here, the model has learned when to skip.',
        {type: 'callout', text: 'Self-RAG turns retrieval from a fixed preprocessing step into a learned control signal checked at every generated segment.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Language models that rely only on parametric memory hallucinate. They produce fluent text that sounds right but cites nothing, and the user has no way to tell grounded claims from invented ones. Retrieval-augmented generation (RAG) addresses this by fetching passages from a corpus and placing them in the context window before generation. The model can now ground its answer in evidence.',
        'The trouble is that vanilla RAG treats retrieval as a fixed preprocessing step. Every prompt gets top-k passages, whether it needs them or not. A creative-writing prompt gets irrelevant Wikipedia paragraphs. A multi-hop factual question gets passages that answer the first hop but not the second. A long answer starts grounded, then drifts past its evidence without any signal that grounding has been lost.',
        {
          type: 'quote',
          text: 'Indiscriminate retrieval can impair the versatility of LLMs or lead to unhelpful response generation when retrieval is unnecessary or a retrieved passage is irrelevant.',
          attribution: 'Asai et al., "Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection", 2023',
        },
        {type: 'image', src: 'https://selfrag.github.io/static/images/teaser_self_rag_v8.png', alt: 'Self-RAG project teaser comparing fixed retrieval with adaptive retrieval, critique, and segment selection', caption: 'Self-RAG differs from fixed RAG by deciding when to retrieve, scoring evidence, and selecting supported segments during generation. Source: selfrag.github.io, Asai et al., CC BY-SA 4.0 website.'},
        'Self-RAG (Asai et al., ICLR 2024) reframes the problem. Instead of always retrieving, train the model to decide when to retrieve, judge whether what it retrieved is relevant, check whether its own output is supported by the evidence, and score how useful the segment is. Retrieval becomes a learned control decision inside generation, not a fixed step before it.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is fixed-k RAG: embed the query, retrieve the top-k most similar passages, concatenate them into the prompt, and generate. This is simple to build, easy to debug, and works well for single-hop factual questions where the retriever usually finds a relevant passage.',
        'A slightly better version adds a reranker -- a cross-encoder that rescores the retrieved passages before generation. This improves precision in the context window but still retrieves on every query, still retrieves only once (before generation starts), and still has no signal for whether the generated text actually uses the evidence.',
        'Both approaches treat retrieval as plumbing external to the model. The generator never sees a signal that says "you need evidence here" or "what you just wrote goes beyond the passage." It generates in one shot, and any grounding problems are only caught downstream by evaluation.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Fixed RAG breaks in three specific ways, all caused by the same root problem: the generator has no retrieval awareness.',
        {
          type: 'bullets',
          items: [
            'Unnecessary retrieval: "Write a haiku about rain" fetches five Wikipedia passages about precipitation. The passages add noise and latency without helping.',
            'Missing mid-generation retrieval: "Compare the GDP of France and Germany in 2023" retrieves passages about France but not Germany. The model answers the France half from evidence, then hallucinates the Germany half. No signal fires when grounding is lost.',
            'Unsupported but fluent output: The model generates a paragraph that sounds grounded but actually extrapolates beyond what the passage says. The passage mentions "revenue grew 12%" and the model writes "the company had a record year across all divisions." Nothing in the pipeline catches the unsupported claim.',
          ],
        },
        'The invariant that is missing: at each generation boundary, the system should know whether it needs evidence, whether the evidence it has is relevant, and whether what it just wrote is supported by that evidence. Fixed RAG has none of these signals. It retrieves blindly, generates blindly, and hopes for the best.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Self-RAG introduces four special reflection tokens into the model vocabulary. These are not prompt instructions -- they are tokens the model has been trained to predict as part of generation, just like ordinary words.',
        {type: 'image', src: 'https://selfrag.github.io/static/images/special_tokens.png', alt: 'Self-RAG special reflection tokens for retrieve, relevance, support, and utility decisions', caption: 'Reflection tokens make retrieval need, passage relevance, support, and utility visible as model-predicted control signals. Source: selfrag.github.io, Asai et al., CC BY-SA 4.0 website.'},
        {
          type: 'bullets',
          items: [
            'Retrieve asks whether the next segment needs external evidence. It can trigger retrieval, skip it, or continue with existing context before generating the segment.',
            'IsRel asks whether a retrieved passage is relevant to the query. It filters evidence after retrieval and before generation.',
            'IsSup asks whether generated text is supported by the passage. It marks fully supported, partially supported, or unsupported output after a segment is written.',
            'IsUse asks whether the segment is useful for the user query. It gives the selector a utility signal after generation.',
          ],
        },
        'Generation proceeds segment by segment. At each segment boundary, the model predicts a Retrieve token. If retrieval is triggered, the system fetches passages, and the model predicts IsRel for each one to filter irrelevant evidence. Then it generates a candidate segment and predicts IsSup (is the segment entailed by the passage?) and IsUse (does the segment help the user?). Multiple candidate segments can be scored and the best one selected.',
        {
          type: 'diagram',
          text: 'prompt --> [Retrieve?]\n              |\n        yes   |   no\n         |         |\n    [fetch passages]   [generate segment]\n         |                    |\n    [IsRel filter]            |\n         |                    |\n    [generate segment]        |\n         |                    |\n    [IsSup critique] <--------+\n         |\n    [IsUse score]\n         |\n    [select best segment] --> next segment or final answer',
          label: 'Self-RAG reflection token flow for one segment',
        },
        'Training works in two phases. First, a critic model (GPT-4 in the paper) labels a large instruction-output dataset with reflection tokens: where retrieval would have helped, which passages are relevant, which outputs are supported. These labeled sequences become training data. Second, the generator (Llama 2 in the paper) is fine-tuned on this data with the reflection tokens added to its vocabulary. The generator learns to predict both ordinary text and reflection tokens in the same forward pass.',
        {
          type: 'code',
          language: 'python',
          text: '# Simplified reflection-token decision logic at inference\ndef self_rag_segment(model, prompt, retriever, threshold=0.5):\n    # Step 1: Should we retrieve?\n    retrieve_prob = model.predict_token(prompt, token="Retrieve")\n    \n    if retrieve_prob > threshold:\n        # Step 2: Fetch and filter passages\n        passages = retriever.search(prompt, top_k=5)\n        scored = []\n        for p in passages:\n            relevance = model.predict_token(prompt + p, token="IsRel")\n            if relevance == "relevant":\n                scored.append(p)\n        context = scored[:3]  # keep top relevant passages\n    else:\n        context = []  # no retrieval needed\n    \n    # Step 3: Generate candidate segments\n    candidates = []\n    for _ in range(num_beams):\n        segment = model.generate(prompt, context)\n        support = model.predict_token(segment, token="IsSup")\n        utility = model.predict_token(segment, token="IsUse")\n        candidates.append((segment, support, utility))\n    \n    # Step 4: Select best segment by critique scores\n    best = max(candidates, key=lambda c: score(c[1], c[2]))\n    return best[0]',
        },
        {
          type: 'note',
          text: 'The reflection tokens are predicted by the same model that generates text. This is not a separate classifier bolted on after the fact -- the control signals and the output share weights, which is what makes adaptive retrieval possible without an external orchestrator.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on segment-level control flow. At each generation boundary, Self-RAG creates a decision point where the system can fetch evidence, filter it, and reject unsupported continuations before they become part of the final answer. This is the invariant: no segment passes into the output without a support and utility check.',
        'Retrieval tokens help because retrieval cost should be proportional to need, not constant. A factual claim needs evidence; a transition sentence does not. Relevance tokens help because embedding similarity is not the same as answer usefulness -- a passage about "machine learning" is similar to a question about "machine learning safety" but may not answer it. Support tokens help because fluent text can extrapolate beyond a passage without any surface signal of the gap. Utility tokens help because a supported, relevant segment can still be verbose or off-topic.',
        'The key limitation of this argument: all four tokens are model predictions. They are only as good as the critic supervision used during training. If the critic mislabels unsupported text as supported, the generator learns to emit confident IsSup scores for hallucinated content. The loop can select bad text with high confidence. External evaluation on held-out data is still the only way to verify that the reflection tokens are calibrated.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Training cost increases because you need critic-labeled data. The paper uses GPT-4 to generate reflection labels for ~150k instruction-output pairs. This is a one-time cost, but it ties data quality to the critic model.',
        {
          type: 'bullets',
          items: [
            'Retrieval calls: fixed RAG always retrieves k passages; Self-RAG can retrieve zero times, once, or repeatedly based on learned segment decisions.',
            'Training data: fixed RAG can use ordinary instruction data; Self-RAG needs critic-labeled sequences with reflection tokens.',
            'Inference compute: fixed RAG does one retrieval plus one generation; Self-RAG may do per-segment retrieval, critique scoring, and beam selection.',
            'Latency profile: fixed RAG has predictable overhead; Self-RAG is faster on skipped-retrieval prompts and slower on evidence-heavy prompts.',
            'Tracing complexity: fixed RAG logs query, passages, and answer; Self-RAG logs per-segment decisions, passages, critique scores, and selected or rejected segments.',
          ],
        },
        'Inference cost depends on task difficulty. Simple prompts that skip retrieval are faster than fixed RAG. Complex prompts that retrieve multiple times and score several candidate segments are slower. Latency becomes a distribution rather than a single number.',
        'Evaluation cost rises because you now need to measure retrieval necessity accuracy, passage relevance precision, support calibration, utility correlation with human judgments, and per-slice failure rates. A single end-to-end accuracy number hides whether the improvement comes from better retrieval decisions, better evidence filtering, or better segment selection.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Self-RAG fits workloads where retrieval need varies across queries and within a single answer. The paper reports gains on open-domain QA (PopQA, PubHealth, ARC-Challenge), biography generation, and fact verification -- tasks where some prompts need evidence and others do not.',
        {
          type: 'bullets',
          items: [
            'Naive RAG always retrieves top-k passages and has no critique mechanism, so it fits simple QA only when retrieval quality is already strong.',
            'CRAG retrieves and then evaluates with an external relevance evaluator, which helps when retrieval quality varies but still keeps retrieval as a separate stage.',
            'Self-RAG learns per-segment retrieval and critique tokens, so it fits mixed workloads and citation-heavy tasks where evidence need changes mid-answer.',
            'FLARE triggers retrieval from low-confidence token signals, which fits long-form generation where uncertainty can reveal missing evidence.',
          ],
        },
        {type: 'image', src: 'https://selfrag.github.io/static/images/analysis_result_1.png', alt: 'Self-RAG ablation and retrieval-threshold analysis plots', caption: 'The analysis figure makes the deployment dials concrete: retrieval frequency, support weighting, and component ablations change quality differently by task. Source: selfrag.github.io, Asai et al., CC BY-SA 4.0 website.'},
        'A fact-checking assistant benefits because it can skip retrieval on well-known definitions and retrieve aggressively on contested claims. A research assistant benefits because it can retrieve mid-answer when the topic shifts from a grounded claim to one that needs a citation. A customer-support system benefits because generic policy answers need no retrieval but account-specific billing questions do.',
        'Self-RAG also serves as a useful teaching bridge between vanilla RAG and full verifier-guided generation. It brings scoring signals into the decoding loop without requiring a separate reward model or tree search.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Reflection tokens are model predictions, not ground truth. A model can label an unsupported segment as "fully supported," mark an irrelevant passage as "relevant," or skip retrieval because training data made the retrieval policy overconfident on that topic. Self-reflection is not self-verification.',
        'Retriever quality is still a hard dependency. If the retriever returns poor passages, relevance filtering helps but cannot conjure good evidence from a bad corpus. Outdated corpora still produce stale answers. Prompt injection in retrieved text can still attack the generator -- reflection tokens do not defend against adversarial passages.',
        'Thresholds tuned on one domain transfer poorly. A retrieval threshold calibrated on short-form QA may over-retrieve on creative writing and under-retrieve on medical questions. Each deployment needs its own threshold tuning and slice-level evaluation.',
        {
          type: 'note',
          text: 'Self-RAG is harder to retrofit than a reranker or a post-hoc citation checker. It requires model fine-tuning with an expanded vocabulary. You cannot bolt it onto an existing API-served model without training access.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary paper: Asai et al., "Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection," ICLR 2024. https://arxiv.org/abs/2310.11511',
            'Official code and models: https://github.com/akariasai/self-rag',
            'Project page: https://selfrag.github.io/',
            'OpenReview discussion: https://openreview.net/forum?id=hSyW5go0v8',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Standard RAG pipelines -- retrieval, embedding, and context injection.',
            'Prerequisite: Beam search -- segment-level candidate selection.',
            'Prerequisite: Cross-encoder reranking -- passage relevance scoring.',
            'Related method: CRAG or Corrective RAG -- external retrieval evaluator.',
            'Related method: FLARE -- active retrieval triggered by low token confidence.',
            'Extension: Process reward models -- step-level verification in reasoning chains.',
            'Extension: Verifier-guided search -- tree search with learned value functions.',
            'Threat model: Prompt injection via retrieved passages.',
          ],
        },
        'The key mental move is to stop treating RAG as one box and start separating retrieval quality, generation quality, and critique quality. Self-RAG makes that separation explicit by giving each concern its own reflection token.',
      ],
    },
  ],
};
