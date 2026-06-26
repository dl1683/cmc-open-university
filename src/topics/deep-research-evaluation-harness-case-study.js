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
    explanation: 'A style judge can reward a polished report that never did the work. This rubric turns product quality into inspectable artifacts: synthesis links, counterclaims, long-run traces, file spans, and workflow logs.',
    invariant: 'Research quality is measurable only when the evidence path survives.',
  };

  yield {
    state: evalGraph('A research eval harness scores artifacts, not vibes'),
    highlight: { active: ['task', 'web', 'files', 'trace', 'ledger', 'rubric', 'score', 'e-task-web', 'e-task-files', 'e-trace-ledger'], found: ['gate'] },
    explanation: 'A deep research eval is a replay system, not a one-off prompt. It runs the same task through agent variants, preserves tool traces and source ledgers, then scores the final report against explicit rubrics.',
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
    explanation: 'A contradiction should not be smoothed into balanced prose too early. The harness should block unsupported claims, stale sources, and conflicting evidence before the report generator turns uncertainty into finished-sounding text.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as an evaluation pipeline, not as a grader staring at one answer. Active nodes are task records, run traces, claim ledgers, scorer checks, and regression gates. Found nodes are evidence that can be replayed: source spans, tool outputs, accepted claims, rejected claims, and scorer rationales.',
        'The safe inference rule is artifact before score. A pass is meaningful only if the harness can reconstruct what the agent saw, what it did, which claims it made, which evidence supported them, and why the scorer accepted the result. Without that trail, a score is just an opinion about polished text.',
        {type:'callout', text:'Deep research quality becomes measurable only when the evidence path is logged as durable task records, claim ledgers, trace events, and regression gates.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A deep research evaluation harness tests agents that browse, read files, run tools, compare sources, and write long answers. The output is not just a paragraph; it is the final product of a process. The harness exists to decide whether that process did the research work the user needed.',
        'A final answer can look good while missing a primary document, citing a stale page, ignoring a contradiction, or guessing a calculation. A harness needs to evaluate the answer and the path that produced it. That requires durable records, not only judge-model impressions.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is prompt, answer, judge. Store the task and final response, then ask a model or human to grade the response against a rubric. This is cheap and often catches style failures or obvious factual mistakes.',
        'The next obvious approach is to add citations to the final answer. That helps, but it still may not reveal whether the agent read the right spans, skipped uploaded files, used a weak secondary source, or ignored a stronger contradictory source. Citations are outputs, not the whole evidence path.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is process ambiguity. Two agents can produce similar reports, but one may have read the primary PDF and the other may have summarized a blog post about it. A final-answer judge may score both as plausible because the missing work is invisible.',
        'The second wall is regression. A team can improve fluency while hurting source quality, file use, freshness, or tool accuracy. If the harness stores only final answers, it cannot tell which internal behavior changed when a new model or prompt ships.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Evaluate research as a data pipeline with durable artifacts. The core records are task definitions, run traces, source ledgers, claim ledgers, contradiction edges, tool outputs, scorer decisions, and cost records. The final answer is one artifact in that pipeline.',
        'A claim ledger is the central data structure. Each material claim gets an id, source span, freshness label, authority label, confidence, and sometimes a contradiction edge. Scoring then asks whether the final answer used that ledger responsibly.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A task record stores the exact user request, expected output shape, allowed tools, source constraints, uploaded files, hidden evaluation notes, risk tags, budget, and time sensitivity. This keeps repeated runs comparable. If one run can browse and another cannot, their scores should not be compared as the same task.',
        'A run record stores the plan, searches, pages opened, file spans read, commands run, intermediate notes, extracted claims, citations, contradictions, final answer, scorer outputs, latency, and cost. The harness should preserve enough detail for a reviewer to reconstruct why an important claim appeared. Missing trace data becomes an evaluation failure in itself.',
        'Scoring combines exact checks, span-support checks, rubric judging, trace analysis, and human audit. These scores should remain separate until the gate because factuality, citation precision, source authority, freshness, contradiction handling, file use, workflow reliability, latency, and cost are different product risks.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is traceability. If every material claim points to inspected evidence and every scorer decision points to a recorded artifact, then a reviewer can audit the result without trusting the agent\'s final prose. Unsupported claims, stale sources, and ignored files become detectable states.',
        'The harness also works as a regression system. When an agent fails because it missed page 47 of a PDF or trusted an old benchmark, that case becomes a fixture. Future agents must survive the same source trap before they pass the release gate.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Logging and scoring add storage, latency, implementation work, and reviewer time. A run with 50 opened pages, 200 extracted claims, 30 cited spans, and 12 scorer checks can store far more metadata than final answer text. That overhead is the price of knowing why the answer passed.',
        'Cost should be measured as behavior. If a new agent reduces average task cost from 4 dollars to 2 dollars but doubles unsupported material claims from 3 percent to 6 percent, it is not a clear improvement for a research product. The harness must keep quality and cost dimensions separate until product owners decide the tradeoff.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This harness pattern fits market research, technical due diligence, legal and policy synthesis, scientific literature review, benchmark audits, incident retrospectives, and competitive intelligence. These tasks are evaluated by defended claims, not by one canonical answer. The access pattern combines web sources, local files, tools, and long synthesis.',
        'It also fits internal AI product development. Teams can compare model versions, prompt changes, browser tools, file parsers, and retrieval systems on the same preserved tasks. The value is not a leaderboard alone; it is knowing which failure class changed.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The harness fails when it measures easy proxies. Source count is not source quality, long traces are not deep research, and citation tables are not support unless the cited spans actually prove the claims. A benchmark can reward busy work if the rubric is vague.',
        'It also fails when teams overfit the test set. Repeated prompt tuning on a sealed holdout turns the holdout into training data. Source snapshots can drift, pages can disappear, and hidden notes can leak, so versioning and access control are part of evaluation quality.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a benchmark has 100 research tasks. Each task allows browsing and local-file reading, has a 30-minute budget, and requires claim-level citations. The harness logs actions, creates source records, extracts claim cards, and scores support, freshness, contradiction handling, file use, and final usefulness.',
        'Agent A costs 3.20 dollars per task, averages 18 sources, and passes 72 of 100 tasks. Agent B costs 2.10 dollars per task, averages 9 sources, and passes 68 tasks, but fails 20 file-heavy tasks because it stops reading after the first matching span. The pass rate alone hides the file-depth regression.',
        'The harness turns that failure into a fixture. The next release must read the buried span, cite it correctly, and preserve the contradiction that made the first answer wrong. The score improves only when the trace and final answer both improve.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study WebGPT at https://arxiv.org/abs/2112.09332, GAIA at https://arxiv.org/abs/2311.12983, STORM at https://arxiv.org/abs/2402.14207, OpenTelemetry tracing concepts at https://opentelemetry.io/docs/concepts/signals/traces/, and human evaluation guidance from model-evaluation literature. Then study claim graphs, retrieval evaluation, provenance DAGs, workflow engines, prompt-injection threat models, document parsing, and regression test stores.',
      ],
    },
  ],
};
