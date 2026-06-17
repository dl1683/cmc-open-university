// Research contradiction resolution graph: classify source disagreement by
// time, scope, method, metric, definition, and incentive before synthesis.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'research-contradiction-resolution-graph-case-study',
  title: 'Research Contradiction Resolution Graph',
  category: 'AI & ML',
  summary: 'Represent source disagreements as typed graph edges so deep research can explain conflicts instead of smoothing them into false balance.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['conflict graph', 'resolution rubric'], defaultValue: 'conflict graph' },
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

function conflictGraph(title) {
  return graphState({
    nodes: [
      { id: 'claim', label: 'claim', x: 0.8, y: 3.8, note: 'target' },
      { id: 'srcA', label: 'src A', x: 2.8, y: 2.0, note: 'new' },
      { id: 'srcB', label: 'src B', x: 2.8, y: 5.6, note: 'old' },
      { id: 'spanA', label: 'span A', x: 4.4, y: 2.0, note: 'quote' },
      { id: 'spanB', label: 'span B', x: 4.4, y: 5.6, note: 'quote' },
      { id: 'conflict', label: 'conf', x: 5.9, y: 3.8, note: 'typed' },
      { id: 'class', label: 'class', x: 7.3, y: 2.2, note: 'why' },
      { id: 'test', label: 'test', x: 7.3, y: 5.4, note: 'probe' },
      { id: 'ledger', label: 'ledger', x: 8.8, y: 3.8, note: 'record' },
      { id: 'answer', label: 'answer', x: 10.0, y: 3.8, note: 'scoped' },
    ],
    edges: [
      { id: 'e-claim-srcA', from: 'claim', to: 'srcA' },
      { id: 'e-claim-srcB', from: 'claim', to: 'srcB' },
      { id: 'e-srcA-spanA', from: 'srcA', to: 'spanA' },
      { id: 'e-srcB-spanB', from: 'srcB', to: 'spanB' },
      { id: 'e-spanA-conflict', from: 'spanA', to: 'conflict', weight: 'says' },
      { id: 'e-spanB-conflict', from: 'spanB', to: 'conflict', weight: 'diff' },
      { id: 'e-conflict-class', from: 'conflict', to: 'class' },
      { id: 'e-conflict-test', from: 'conflict', to: 'test' },
      { id: 'e-class-ledger', from: 'class', to: 'ledger' },
      { id: 'e-test-ledger', from: 'test', to: 'ledger' },
      { id: 'e-ledger-answer', from: 'ledger', to: 'answer' },
    ],
  }, { title });
}

function* conflictGraphView() {
  yield {
    state: conflictGraph('Contradictions should be first-class graph nodes'),
    highlight: { active: ['claim', 'srcA', 'srcB', 'spanA', 'spanB', 'conflict', 'e-claim-srcA', 'e-claim-srcB', 'e-spanA-conflict', 'e-spanB-conflict'], compare: ['answer'] },
    explanation: 'The naive baseline is to smooth disagreement into neutral prose. A contradiction graph treats disagreement as a typed relation between exact source spans, preserving both sides and the unresolved question before synthesis.',
  };

  yield {
    state: labelMatrix(
      'Conflict types',
      [
        { id: 'time', label: 'time' },
        { id: 'scope', label: 'scope' },
        { id: 'method', label: 'method' },
        { id: 'metric', label: 'metric' },
        { id: 'defn', label: 'defn' },
        { id: 'bias', label: 'bias' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'move', label: 'move' },
      ],
      [
        ['chg', 'new'],
        ['slice', 'narrow'],
        ['meth', 'why'],
        ['score', 'norm'],
        ['term', 'def'],
        ['bias', 'down'],
      ],
    ),
    highlight: { active: ['time:move', 'scope:move', 'metric:move', 'defn:move'], compare: ['bias:move'] },
    explanation: 'Most disagreements have a reason: time, scope, method, metric, definition, or incentives. Classifying the reason lets the report explain the difference instead of averaging incompatible claims.',
    invariant: 'Do not average incompatible claims.',
  };

  yield {
    state: conflictGraph('The resolver may need a probe or calculation'),
    highlight: { active: ['conflict', 'test', 'ledger', 'e-conflict-test', 'e-test-ledger'], compare: ['class'], found: ['answer'] },
    explanation: 'Some conflicts cannot be resolved by reading another page. They need a probe: reproduce a calculation, compare benchmark settings, inspect release dates, or check whether two sources define the term differently.',
  };

  yield {
    state: conflictGraph('Resolution creates a scoped answer, not a winner'),
    highlight: { active: ['class', 'test', 'ledger', 'answer', 'e-class-ledger', 'e-test-ledger', 'e-ledger-answer'], compare: ['srcA', 'srcB'] },
    explanation: 'The output is often not "source A wins." It is a scoped statement: for this version, workload, jurisdiction, metric, and date, this claim is best supported; outside that scope, the conflict remains open.',
  };
}

function* resolutionRubric() {
  yield {
    state: labelMatrix(
      'Resolution ledger',
      [
        { id: 'c1', label: 'c1' },
        { id: 'c2', label: 'c2' },
        { id: 'c3', label: 'c3' },
        { id: 'c4', label: 'c4' },
        { id: 'c5', label: 'c5' },
      ],
      [
        { id: 'type', label: 'type' },
        { id: 'probe', label: 'probe' },
        { id: 'scope', label: 'scope' },
        { id: 'act', label: 'act' },
      ],
      [
        ['time', 'date', 'v2', 'new'],
        ['metric', 'calc', 'p95', 'norm'],
        ['scope', 'slice', 'EU', 'narrow'],
        ['method', 'read', 'lab', 'split'],
        ['bias', 'rank', 'vend', 'warn'],
      ],
    ),
    highlight: { active: ['c1:act', 'c2:probe', 'c3:scope'], compare: ['c5:act'], found: ['c4:type'] },
    explanation: 'Each conflict ledger row stores the type, probe, scope, selected action, and residual uncertainty. This gives reviewers something concrete to inspect.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'conflicts examined', min: 0, max: 12 }, y: { label: 'answer confidence', min: 0, max: 1 } },
      series: [
        { id: 'polish', label: 'ignore conflicts', points: [{ x: 1, y: 0.78 }, { x: 3, y: 0.76 }, { x: 6, y: 0.72 }, { x: 12, y: 0.65 }] },
        { id: 'resolve', label: 'resolve graph', points: [{ x: 1, y: 0.5 }, { x: 3, y: 0.62 }, { x: 6, y: 0.76 }, { x: 12, y: 0.86 }] },
      ],
      markers: [
        { id: 'turn', x: 6, y: 0.76, label: 'scope fixed' },
      ],
    }),
    highlight: { active: ['resolve', 'turn'], compare: ['polish'] },
    explanation: 'Ignoring contradictions can make early prose sound confident. Resolving them may lower initial certainty, but it produces a stronger answer once scope, method, and freshness are explicit.',
  };

  yield {
    state: labelMatrix(
      'Synthesis moves',
      [
        { id: 'prefer', label: 'prefer' },
        { id: 'split', label: 'split' },
        { id: 'range', label: 'range' },
        { id: 'defer', label: 'defer' },
        { id: 'remove', label: 'remove' },
      ],
      [
        { id: 'when', label: 'when' },
        { id: 'text', label: 'text' },
      ],
      [
        ['newer', 'as of'],
        ['scope', 'in X'],
        ['metric', 'range'],
        ['weak', 'open'],
        ['nocit', 'omit'],
      ],
    ),
    highlight: { active: ['prefer:text', 'split:text', 'range:text'], compare: ['defer:text'], removed: ['remove:text'] },
    explanation: 'The resolver does not only pick evidence. It chooses a writing move: prefer current evidence, split by scope, report a range, defer conclusion, or remove an unsupported claim.',
  };

  yield {
    state: conflictGraph('Contradiction handling links back into planning'),
    highlight: { active: ['ledger', 'conflict', 'class', 'test', 'e-conflict-class', 'e-conflict-test'], found: ['answer'], compare: ['claim'] },
    explanation: 'If the conflict cannot be resolved, the research DAG should reopen with a new question. A good agent says what would settle the issue instead of manufacturing a settled answer.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'conflict graph') yield* conflictGraphView();
  else if (view === 'resolution rubric') yield* resolutionRubric();
  else throw new InputError('Pick a contradiction-resolution view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Research systems fail when they smooth disagreement into neutral prose. Two sources conflict, and the answer says "experts disagree" without explaining whether the difference comes from date, scope, method, metric, definition, or incentive. That is not synthesis. It is abdication.',
        'A contradiction resolution graph exists to keep disagreement explicit until it is understood. It stores claims, exact source spans, conflict types, probes, scope decisions, and final writing moves. The graph lets the report explain why sources differ instead of averaging incompatible statements.',
        'This is a critical data structure for deep research, market reports, benchmark analysis, legal summaries, medical literature reviews, and any agent that must answer from multiple sources without laundering uncertainty into confidence.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to choose the newest or most authoritative-looking source and discard the other. Sometimes that is correct, but it is not reasoning. Older sources may still be right for historical context. A lower-authority source may use the better metric. A vendor source may be current but biased.',
        'Another obvious approach is false balance: present both claims side by side and refuse to decide. That can sound fair while leaving the reader with no usable answer. The better move is to explain the disagreement, scope the claim, and say what evidence would change the conclusion.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that contradictions often are not direct contradictions. One source may discuss the 2024 model while another discusses the 2026 model. One may report p50 latency while another reports p99. One may define "open source" as weights available while another requires training data and license freedoms.',
        'The second wall is that source spans matter. Whole-document disagreement is too vague. A resolver needs exact quoted or paraphrased spans tied to claims, dates, methods, and metrics. Without span-level evidence, the agent cannot tell whether the sources disagree or the summary introduced the conflict.',
        'The third wall is that some conflicts require action, not reading. You may need to rerun a calculation, normalize units, compare benchmark settings, inspect release dates, or ask whether two claims use different populations.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat contradictions as first-class nodes. A conflict node links the target claim to the source spans that disagree. It stores a type, the reason for the conflict, the probe needed to resolve it, and the scoped writing action.',
        'The graph should not immediately ask "which source wins?" It should first ask "what kind of disagreement is this?" A temporal conflict is resolved differently from a metric conflict. A scope conflict may require splitting the answer rather than choosing one source.',
        'The output is often not a winner. It is a scoped statement: under this date, method, workload, jurisdiction, definition, or metric, this claim is best supported. Outside that scope, the uncertainty remains visible.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The conflict-graph view shows one target claim connected to two source spans and then to a typed conflict node. The important move is preserving the disagreement before synthesis. A good system does not overwrite the conflict with a polished sentence too early.',
        'The resolution-rubric view shows the ledger row that makes the conflict auditable: type, probe, scope, action. A reviewer can see why the answer preferred one source, split by scope, reported a range, deferred, or removed the claim.',
        'The confidence plot teaches a counterintuitive point. Ignoring contradictions can make a draft look confident early. Resolving contradictions may lower immediate certainty, but it produces a stronger final answer because scope and method are explicit.',
      ],
    },
    {
      heading: 'How the graph is built',
      paragraphs: [
        'Start with claims and source spans. A claim is a statement the report may make. A span is exact supporting or conflicting evidence from a source. The graph links claims to spans with support, contradict, narrow, supersede, define, or weaken edges.',
        'When two spans conflict, create a conflict node instead of collapsing the issue into prose. Store metadata: source date, author or institution, method, metric, geography, product version, population, incentives, and confidence. Then classify the conflict.',
        'Useful conflict types include temporal change, scope mismatch, method mismatch, metric mismatch, definition mismatch, sampling difference, and incentive bias. Each type implies a different resolution move. That type system is the educational heart of the page.',
      ],
    },
    {
      heading: 'Resolution moves',
      paragraphs: [
        'Prefer is appropriate when one source clearly supersedes another for a time-sensitive fact or uses a stronger method. Split is appropriate when both are true under different scopes. Range is appropriate when measurements vary but are comparable. Defer is appropriate when evidence is insufficient. Remove is appropriate when no source supports the claim.',
        'A conflict about cost might become a range. A conflict about benchmark score might become a metric-normalized comparison. A conflict about product capability might become "as of June 2026, version X supports this; older sources describe version Y."',
        'The resolver should record residual uncertainty. A scoped answer is not a claim of omniscience. It is a claim that the report knows exactly what its evidence supports.',
      ],
    },
    {
      heading: 'Worked example: long context versus RAG',
      paragraphs: [
        'A user asks whether long-context models make RAG obsolete. One vendor post says a large context window removes retrieval engineering for many document tasks. A benchmark paper shows lost-in-the-middle behavior and distractor sensitivity. A third source shows long-context models improving whole-document workflows. A practitioner report says retrieval is still needed for freshness and access control.',
        'A shallow answer says "opinions differ." A contradiction graph says the conflict type is scope and method. Long context can reduce retrieval needs for stable whole-document tasks. RAG remains useful when sources are fresh, access-controlled, cited, filtered, or too large to include directly.',
        'The final answer is scoped, not tribal: long context changes the retrieval design space, but it does not eliminate retrieval as an evidence-selection, governance, and freshness mechanism. That conclusion is stronger because it explains why each source sounded different.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because most disagreement has structure. Sources differ across time, scope, method, metric, definition, sample, or incentives. Naming that structure prevents the system from flattening evidence.',
        'It also works because the graph is auditable. A reviewer can inspect which span created the conflict, which type was assigned, what probe was run, and why the writing move followed. That is much better than trusting a paragraph that sounds reasonable.',
        'Finally, it works because it feeds research planning. If a conflict cannot be resolved, the graph can generate the next question: what data, source, benchmark, calculation, or expert definition would settle this?',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is slower synthesis. A contradiction graph forces the system to stop and classify disagreement before writing. That can feel inefficient, but it prevents a more expensive failure: publishing a clean answer that hides incompatible evidence.',
        'The system needs good extraction. If claim spans are wrong, conflict classification will be wrong. If source metadata is missing, temporal and method conflicts become guesswork. If the resolver overuses LLM judgment without calculations or span checks, it can invent false syntheses.',
        'The behavior should be conservative. The graph should make unsupported certainty harder, not easier. When evidence is weak, the correct output may be a deferred conclusion and a precise statement of what would resolve the issue.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Contradiction graphs win in market reports, benchmark comparisons, policy analysis, legal research, medical literature review, technical due diligence, and multi-source research agents. They are especially useful when source freshness and metric definitions matter.',
        'They also win as teaching tools. They show students that "synthesis" is not a tone. It is a set of evidence operations: compare scope, normalize metrics, inspect methods, identify incentives, and write only what the evidence supports.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The graph fails if it becomes bureaucracy. Not every minor wording difference deserves a conflict node. The system should focus on disagreements that change the answer, recommendation, risk, or conclusion.',
        'It also fails when conflict types are assigned mechanically without domain understanding. A metric mismatch in AI benchmarks differs from a jurisdiction mismatch in law or a population mismatch in medicine. The rubric must be adapted to the domain.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Do not average incompatible claims. Classify the disagreement first.',
        'A good answer may prefer, split, range, defer, or remove. The best move depends on why the sources differ.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Relevant sources and adjacent methods: WebGPT at https://openai.com/index/webgpt/ and https://arxiv.org/abs/2112.09332, STORM at https://storm-project.stanford.edu/research/storm/ and https://arxiv.org/abs/2402.14207, W3C PROV-DM at https://www.w3.org/TR/prov-dm/, OpenLineage object model at https://openlineage.io/docs/spec/object-model/, ReAct at https://arxiv.org/abs/2210.03629, Anthropic multi-agent research system at https://www.anthropic.com/engineering/multi-agent-research-system, and NIST AI RMF at https://www.nist.gov/itl/ai-risk-management-framework.',
        'Study Claim Graph & Source Ledger, Deep Research Question Decomposition DAG, Source Authority Triage Priority Queue, Evidence Freshness Refresh Scheduler, RAG Claim Verification Support Ledger, Deep Research Evaluation System, Benchmark Variance & Model Selection, and Lost in the Middle next.',
      ],
    },
  ],
};
