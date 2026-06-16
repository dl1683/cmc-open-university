// Deep research evaluation harness: task suites, evidence stressors, trace
// replay, rubric scorers, and regression gates for research agents.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'deep-research-evaluation-harness-case-study',
  title: 'Deep Research Evaluation Harness Case Study',
  category: 'Systems',
  summary: 'Evaluate research agents with task suites, source/file stressors, claim-ledger scoring, contradiction gates, endurance tests, and replayable traces.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['rubric grid', 'stress harness'], defaultValue: 'rubric grid' },
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

function evalGraph(title) {
  return graphState({
    nodes: [
      { id: 'task', label: 'task', x: 0.7, y: 3.8, note: 'prompt' },
      { id: 'web', label: 'web', x: 2.2, y: 2.2, note: 'sources' },
      { id: 'files', label: 'files', x: 2.2, y: 5.2, note: 'uploads' },
      { id: 'trace', label: 'trace', x: 3.9, y: 3.8, note: 'tools' },
      { id: 'ledger', label: 'ledger', x: 5.6, y: 3.8, note: 'claims' },
      { id: 'rubric', label: 'rubric', x: 7.1, y: 2.2, note: 'criteria' },
      { id: 'score', label: 'score', x: 7.1, y: 5.2, note: 'matrix' },
      { id: 'report', label: 'report', x: 8.7, y: 3.8, note: 'answer' },
      { id: 'gate', label: 'gate', x: 9.8, y: 3.8, note: 'ship?' },
    ],
    edges: [
      { id: 'e-task-web', from: 'task', to: 'web' },
      { id: 'e-task-files', from: 'task', to: 'files' },
      { id: 'e-web-trace', from: 'web', to: 'trace' },
      { id: 'e-files-trace', from: 'files', to: 'trace' },
      { id: 'e-trace-ledger', from: 'trace', to: 'ledger' },
      { id: 'e-ledger-rubric', from: 'ledger', to: 'rubric' },
      { id: 'e-ledger-score', from: 'ledger', to: 'score' },
      { id: 'e-rubric-report', from: 'rubric', to: 'report' },
      { id: 'e-score-report', from: 'score', to: 'report' },
      { id: 'e-report-gate', from: 'report', to: 'gate' },
    ],
  }, { title });
}

function stressGraph(title) {
  return graphState({
    nodes: [
      { id: 'seed', label: 'seed', x: 0.8, y: 3.7, note: 'case' },
      { id: 'conflict', label: 'conflict', x: 2.5, y: 1.5, note: 'sources' },
      { id: 'stale', label: 'stale', x: 2.5, y: 3.2, note: 'dates' },
      { id: 'distract', label: 'distract', x: 2.5, y: 5.0, note: 'noise' },
      { id: 'file', label: 'file', x: 2.5, y: 6.5, note: 'long doc' },
      { id: 'runner', label: 'runner', x: 4.5, y: 3.9, note: 'replay' },
      { id: 'agentA', label: 'agent A', x: 6.2, y: 2.5, note: 'old' },
      { id: 'agentB', label: 'agent B', x: 6.2, y: 5.2, note: 'new' },
      { id: 'trace', label: 'trace', x: 7.8, y: 3.9, note: 'steps' },
      { id: 'gate', label: 'gate', x: 9.4, y: 3.9, note: 'regress?' },
    ],
    edges: [
      { id: 'e-seed-conflict', from: 'seed', to: 'conflict' },
      { id: 'e-seed-stale', from: 'seed', to: 'stale' },
      { id: 'e-seed-distract', from: 'seed', to: 'distract' },
      { id: 'e-seed-file', from: 'seed', to: 'file' },
      { id: 'e-conflict-runner', from: 'conflict', to: 'runner' },
      { id: 'e-stale-runner', from: 'stale', to: 'runner' },
      { id: 'e-distract-runner', from: 'distract', to: 'runner' },
      { id: 'e-file-runner', from: 'file', to: 'runner' },
      { id: 'e-runner-agentA', from: 'runner', to: 'agentA' },
      { id: 'e-runner-agentB', from: 'runner', to: 'agentB' },
      { id: 'e-agentA-trace', from: 'agentA', to: 'trace' },
      { id: 'e-agentB-trace', from: 'agentB', to: 'trace' },
      { id: 'e-trace-gate', from: 'trace', to: 'gate' },
    ],
  }, { title });
}

function* rubricGrid() {
  yield {
    state: labelMatrix(
      'Research rubric',
      [
        { id: 'synth', label: 'synth' },
        { id: 'critique', label: 'crit' },
        { id: 'endure', label: 'long run' },
        { id: 'files', label: 'files' },
        { id: 'flow', label: 'workflow' },
      ],
      [
        { id: 'good', label: 'good' },
        { id: 'failure', label: 'bad' },
        { id: 'artifact', label: 'proof' },
      ],
      [
        ['links', 'pile', 'graph'],
        ['pushes', 'bias', 'counter'],
        ['steady', 'drift', 'trace'],
        ['spans', 'skim', 'map'],
        ['loops', 'one-shot', 'log'],
      ],
    ),
    highlight: { active: ['synth:artifact', 'critique:artifact', 'endure:artifact', 'files:artifact', 'flow:artifact'], compare: ['synth:failure', 'critique:failure'] },
    explanation: 'The local deep-research notes reduce product quality to five axes: synthesis, critical reasoning, endurance, file handling, and workflow reliability. Each axis needs an artifact the harness can inspect.',
    invariant: 'Research quality is measurable only when the evidence path survives.',
  };

  yield {
    state: evalGraph('A research eval harness scores artifacts, not vibes'),
    highlight: { active: ['task', 'web', 'files', 'trace', 'ledger', 'rubric', 'score', 'e-task-web', 'e-task-files', 'e-trace-ledger'], found: ['gate'] },
    explanation: 'A deep research eval is a replay system. It runs the same task through agent variants, preserves tool traces and source ledgers, then scores the final report against explicit rubrics.',
  };

  yield {
    state: labelMatrix(
      'Research task record',
      [
        { id: 'prompt', label: 'prompt' },
        { id: 'sources', label: 'sources' },
        { id: 'files', label: 'files' },
        { id: 'tools', label: 'tools' },
        { id: 'answer', label: 'answer' },
        { id: 'budget', label: 'budget' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'tests', label: 'tests' },
      ],
      [
        ['exact ask', 'scope drift'],
        ['seed set', 'source choice'],
        ['page spans', 'real reading'],
        ['web+code', 'tool use'],
        ['claim ids', 'support'],
        ['time+cost', 'endurance'],
      ],
    ),
    highlight: { active: ['prompt:stores', 'sources:stores', 'files:stores', 'tools:stores', 'answer:stores', 'budget:stores'], found: ['answer:tests'] },
    explanation: 'The task record should freeze the prompt, allowed tools, seed sources, uploaded files, expected answer properties, and budget. Otherwise two runs are not comparable.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'session length', min: 0, max: 6 }, y: { label: 'research quality', min: 0, max: 1 } },
      series: [
        { id: 'shallow', label: 'shallow', points: [{ x: 0.5, y: 0.62 }, { x: 1.5, y: 0.65 }, { x: 3, y: 0.54 }, { x: 6, y: 0.41 }] },
        { id: 'harness', label: 'harnessed', points: [{ x: 0.5, y: 0.60 }, { x: 1.5, y: 0.70 }, { x: 3, y: 0.78 }, { x: 6, y: 0.82 }] },
      ],
      markers: [
        { id: 'drift', x: 3, y: 0.54, label: 'drift' },
        { id: 'replay', x: 6, y: 0.82, label: 'replay' },
      ],
    }),
    highlight: { active: ['harness', 'replay'], compare: ['shallow', 'drift'] },
    explanation: 'Endurance is the hidden metric. A weak research tool can look good for a short run and degrade later. Trace replay, file maps, and ledger checks are what keep long sessions honest.',
  };

  yield {
    state: evalGraph('Contradiction gates reopen the plan'),
    highlight: { active: ['ledger', 'rubric', 'score', 'task', 'web', 'e-ledger-rubric', 'e-ledger-score', 'e-task-web'], removed: ['report'], found: ['gate'] },
    explanation: 'A contradiction should not be smoothed into balanced prose too early. The harness should detect unsupported claims, stale sources, and conflicting evidence before report generation.',
  };

  yield {
    state: labelMatrix(
      'Metric to scorer',
      [
        { id: 'synth', label: 'synthesis' },
        { id: 'critique', label: 'critique' },
        { id: 'endure', label: 'endurance' },
        { id: 'file', label: 'file use' },
        { id: 'flow', label: 'workflow' },
      ],
      [
        { id: 'scorer', label: 'scorer' },
        { id: 'evidence', label: 'evidence' },
      ],
      [
        ['claim judge', 'cross links'],
        ['counter judge', 'weak claims'],
        ['trace diff', 'late turns'],
        ['span check', 'page ids'],
        ['run audit', 'handoffs'],
      ],
    ),
    highlight: { active: ['synth:scorer', 'critique:scorer', 'endure:scorer', 'file:scorer', 'flow:scorer'], found: ['file:evidence'] },
    explanation: 'Each metric needs a scorer and evidence source. Citation support can use span checks; critique can count counterclaims; endurance can compare early and late trace quality; workflow reliability can audit handoffs.',
  };
}

function* stressHarness() {
  yield {
    state: stressGraph('Stress cases inject realistic research failures'),
    highlight: { active: ['seed', 'conflict', 'stale', 'distract', 'file', 'runner', 'e-seed-conflict', 'e-seed-stale', 'e-seed-distract', 'e-seed-file'], found: ['gate'] },
    explanation: 'A research harness should not only ask clean questions. It should inject conflicting sources, stale pages, distractors, long files, and budget pressure so failures become visible.',
  };

  yield {
    state: labelMatrix(
      'Stress dimensions',
      [
        { id: 'authority', label: 'authority' },
        { id: 'fresh', label: 'freshness' },
        { id: 'conflict', label: 'conflict' },
        { id: 'longfile', label: 'long file' },
        { id: 'tool', label: 'tool use' },
        { id: 'flow', label: 'workflow' },
      ],
      [
        { id: 'stress', label: 'stress' },
        { id: 'catches', label: 'catches' },
      ],
      [
        ['weak blogs', 'bad weight'],
        ['old docs', 'stale claim'],
        ['two truths', 'false merge'],
        ['page 47', 'skim fail'],
        ['calc needed', 'no verify'],
        ['multi-turn', 'lost state'],
      ],
    ),
    highlight: { active: ['authority:stress', 'fresh:stress', 'conflict:stress', 'longfile:stress', 'tool:stress'], compare: ['flow:catches'] },
    explanation: 'These dimensions come directly from real deep-research work: source weighting, freshness, contradiction handling, file reading, tool verification, and multi-turn continuity.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'sources reviewed', min: 0, max: 100 }, y: { label: 'usable insight', min: 0, max: 1 } },
      series: [
        { id: 'coverage', label: 'coverage', points: [{ x: 5, y: 0.25 }, { x: 15, y: 0.54 }, { x: 30, y: 0.73 }, { x: 60, y: 0.84 }, { x: 100, y: 0.87 }] },
        { id: 'noise', label: 'noise', points: [{ x: 5, y: 0.10 }, { x: 15, y: 0.18 }, { x: 30, y: 0.30 }, { x: 60, y: 0.58 }, { x: 100, y: 0.86 }] },
      ],
      markers: [
        { id: 'knee', x: 30, y: 0.73, label: 'enough' },
      ],
    }),
    highlight: { active: ['coverage', 'knee'], compare: ['noise'] },
    explanation: 'More sources are useful only until they become redundant or low authority. The harness should score source selection and synthesis, not reward source count by itself.',
  };

  yield {
    state: labelMatrix(
      'Regression gate',
      [
        { id: 'facts', label: 'facts' },
        { id: 'cites', label: 'citations' },
        { id: 'conflict', label: 'conflict' },
        { id: 'files', label: 'files' },
        { id: 'p95', label: 'p95' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'old', label: 'old' },
        { id: 'new', label: 'new' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['88', '91', 'pass'],
        ['84', '78', 'block'],
        ['72', '80', 'pass'],
        ['90', '88', 'pass'],
        ['14m', '11m', 'pass'],
        ['$3.20', '$2.70', 'pass'],
      ],
    ),
    highlight: { found: ['facts:new', 'conflict:new', 'p95:new'], removed: ['cites:gate'] },
    explanation: 'A faster or cheaper agent should still fail release if citation support drops. Research products need multi-metric gates because the failure that matters is often hidden behind a better average.',
  };

  yield {
    state: stressGraph('Replay traces turn failures into new fixtures'),
    highlight: { active: ['runner', 'agentA', 'agentB', 'trace', 'gate', 'e-runner-agentA', 'e-runner-agentB', 'e-agentA-trace', 'e-agentB-trace', 'e-trace-gate'], found: ['seed'] },
    explanation: 'Every failed run should become a fixture: preserve the prompt, sources, file spans, tool calls, final report, and judge rationale. That turns one bad answer into a regression test.',
  };

  yield {
    state: labelMatrix(
      'Research source map',
      [
        { id: 'webgpt', label: 'WebGPT' },
        { id: 'storm', label: 'STORM' },
        { id: 'gaia', label: 'GAIA' },
        { id: 'dr', label: 'DeepResearch' },
        { id: 'local', label: 'local rubric' },
      ],
      [
        { id: 'tests', label: 'tests' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['browse refs', 'cite trail'],
        ['pre-write', 'outline first'],
        ['tool tasks', 'real chores'],
        ['web+files', 'long loop'],
        ['five axes', 'work fit'],
      ],
    ),
    highlight: { active: ['webgpt:lesson', 'storm:lesson', 'gaia:lesson', 'dr:lesson', 'local:lesson'] },
    explanation: 'The harness can borrow from all of these: WebGPT for references, STORM for pre-writing structure, GAIA for real tool-use tasks, system cards for browsing/file capabilities, and the local rubric for product fit.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'rubric grid') yield* rubricGrid();
  else if (view === 'stress harness') yield* stressHarness();
  else throw new InputError('Pick a deep-research-eval view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A deep research evaluation harness is a replayable test system for research agents. It does not ask whether the final report sounds smart. It asks whether the agent found the right evidence, read files accurately, handled contradictions, cited exact support, stayed coherent over a long run, used tools correctly, and produced a report whose claims can be audited.',
        'The local deep-research notes in the provided corpus identify five practical quality axes: synthesis depth, critical reasoning, speed and endurance, file handling, and workflow reliability. This module turns those axes into data structures and release gates.',
      ],
    },
    {
      heading: 'Harness data model',
      paragraphs: [
        'Each task record should store the exact prompt, allowed tools, seed sources, uploaded files, expected answer properties, budget, time sensitivity, risk class, and slice tags. The run record should store the plan, searches, pages opened, file spans read, tool calls, extracted claims, citations, contradictions, final answer, and scorer rationales.',
        'The core link is Claim Graph & Source Ledger. A judge cannot reliably grade citation support if the system never preserved claim ids, source ids, support spans, dates, authority labels, and contradiction edges. Deep research evaluation is therefore a provenance problem as much as a model-quality problem.',
      ],
    },
    {
      heading: 'Complete case study: technical market report',
      paragraphs: [
        'A benchmark task asks an agent to assess whether a new storage architecture matters for AI inference. The harness includes official docs, vendor claims, a long uploaded PDF, stale blog posts, a contradictory benchmark, and a small calculation requiring Python. A shallow agent can pass a style judge by writing a polished summary. A serious harness checks whether it identified primary sources, flagged the stale claims, read the relevant PDF pages, ran the throughput calculation, and linked each conclusion to evidence.',
        'The gate then scores synthesis, critique, file use, workflow, citation support, contradiction handling, latency, and cost separately. If the new agent is faster and cheaper but loses citation support, it should not ship. That is the difference between a research product and a report generator.',
      ],
    },
    {
      heading: 'Primary-source connections',
      paragraphs: [
        'WebGPT is an early browsing-and-reference system: it used a text-based browser and required references to support long-form answers, making evaluation easier for humans: https://arxiv.org/abs/2112.09332. STORM focuses on the pre-writing stage: discovering perspectives, asking perspective-guided questions, grounding answers in trusted sources, and building an outline before writing: https://arxiv.org/abs/2402.14207 and https://storm-project.stanford.edu/research/storm/.',
        'GAIA is useful because it tests real assistant tasks requiring reasoning, multimodality, web browsing, and tool use, while being conceptually simple for humans: https://arxiv.org/abs/2311.12983. OpenAI\'s Deep Research system card describes training for browsing, file interpretation, Python analysis, and synthesis over many websites: https://cdn.openai.com/deep-research-system-card.pdf. Anthropic\'s multi-agent research writeup describes a lead agent that plans and delegates parallel source discovery to subagents: https://www.anthropic.com/engineering/multi-agent-research-system.',
      ],
    },
    {
      heading: 'Scoring and controls',
      paragraphs: [
        'The harness should combine exact checks, span checks, rubric judges, human audits, and trace analysis. Exact checks catch final factual answers. Span checks catch citation bluffing. Rubric judges score synthesis and critique. Human audits calibrate the judges. Trace analysis catches file-skimming, tool misuse, repeated source loops, and late-session drift.',
        'Do not reward source count directly. Do not let a judge grade citation support without source spans. Do not collapse freshness, authority, contradiction handling, and factuality into one average. Do not tune on the sealed holdout. Do not ignore workflow reliability: a research agent that cannot survive handoffs, follow-ups, and file updates is not production-ready.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Deep Research Agent Architecture, Claim Graph & Source Ledger, LLM Evaluation Harnesses, Human Evaluation Labeling Queue Case Study, RAG Evaluation, STORM-style outline building, WebGPT-style reference collection, GAIA-style tool-use benchmarks, Agent Memory & Context Engineering, Multi-Agent Orchestration Topologies, Blackboard Architecture Agent Coordination, Prompt Injection Threat Model, Distributed Tracing, Temporal Workflow Case Study, Zanzibar Authorization Case Study, and Verifier-Guided Inference Control Plane Case Study next.',
      ],
    },
  ],
};
