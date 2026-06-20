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
      heading: 'What it is',
      paragraphs: [
        'A deep research evaluation system tests agents that browse, read files, run tools, compare sources, and write long answers. It is not a style contest for polished reports. Its job is to decide whether the agent actually did the research work: found relevant sources, weighted them correctly, read the right spans, noticed contradictions, used tools when calculation was required, and connected every important claim to evidence that can be inspected later.',
        'The evaluation system treats a research answer as the final object produced by a larger process. That process includes the original task, the allowed tools, the pages and files available at the time, the actions the agent took, the claims it extracted, the contradictions it faced, and the scorer decisions that turned all of that into a pass or fail. For curriculum purposes, this is the key shift: evaluate research as a data pipeline with durable artifacts, not as an isolated paragraph of text.',
        {type:'callout', text:'Deep research quality becomes measurable only when the evidence path is logged as durable task records, claim ledgers, trace events, and regression gates.'},
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is to store a prompt and an answer, then ask a judge model to grade the answer. That can be useful for surface quality, but it collapses most of the real difficulty. A fluent report can cite weak sources, hide stale facts, skip uploaded files, ignore a contrary benchmark, or invent a calculation result. A judge looking only at the final answer often has no way to know which failure happened.',
        'The wall appears as soon as the tasks become long, time-sensitive, or file-heavy. Two agents may both produce plausible reports, but one may have read the primary document and the other may have summarized a blog post about it. One may have noticed that a source is three years old and another may have treated it as current. One may have used Python to verify a numerical claim and another may have guessed. Without process artifacts, the scoring system cannot distinguish good research from confident narrative.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that research quality becomes measurable when the evidence path is represented explicitly. The final answer should be backed by a claim ledger. Each material claim gets an id, a source or file span, a freshness label, an authority label, and sometimes a contradiction edge to a source that says something different. The scorer then evaluates whether the answer used that ledger responsibly.',
        'This changes the release gate. Instead of asking whether the answer sounds expert, the gate asks whether the evidence trail survives inspection. Did the agent cite the source that actually supports the claim? Did it preserve uncertainty where sources disagree? Did it reopen the plan after a contradiction, or did it smooth the conflict into vague balanced prose? Deep research evaluation is therefore a provenance problem, a workflow problem, and only then a writing problem.',
      ],
    },
    {
      heading: 'Task records and run records',
      paragraphs: [
        'A strong evaluation setup begins with a task record. It stores the exact user request, expected output shape, allowed tools, source constraints, uploaded files, time sensitivity, hidden evaluation notes, risk tags, budget, and any seed material the task designer wants available. This matters because research tasks are easy to mutate accidentally. If one run can browse and another cannot, or one run has a PDF and another does not, their scores no longer compare the agents cleanly.',
        'The run record is the second data structure. It should preserve the plan, searches, pages opened, snippets or spans used, file pages read, commands run, intermediate notes, extracted claims, citations, contradictions, final answer, scorer results, and cost. Some products also store screenshots, browser states, or parsed document maps. The important rule is simple: if a future reviewer cannot reconstruct why a claim appeared in the report, the run record has not captured enough evidence.',
      ],
    },
    {
      heading: 'Stressors and adversarial fixtures',
      paragraphs: [
        'Clean research questions are not enough. A real benchmark environment includes stressors that expose the failures research agents actually make. It should include stale pages, vendor pages with selective claims, secondary sources that paraphrase badly, long files with relevant facts buried deep inside, distractor documents with similar vocabulary, conflicting benchmarks, missing data, and tasks that require a small calculation rather than another search.',
        'Every serious failure should become a fixture. If an agent missed the release date buried on page 47 of a PDF, keep that task, file, trace, wrong answer, and scorer rationale. If an agent trusted an old document when a newer one reversed the recommendation, preserve that as a freshness test. Over time, the evaluation suite becomes a library of failure classes, not just a leaderboard. That library is what lets teams detect regressions before customers do.',
      ],
    },
    {
      heading: 'Scoring mechanisms',
      paragraphs: [
        'Research scoring should combine several methods because no single scorer sees the whole system. Exact checks are useful when a task has a known answer. Span checks verify that cited text actually supports the claim. Rubric judges can score synthesis, critique, and usefulness, but they need access to the evidence ledger. Trace analysis can catch loops, shallow file use, missing tool calls, and late-session drift. Human audits calibrate the automatic scorers and reveal failure modes the rubric forgot.',
        'The scores should remain separate until the final gate. Factuality, citation support, source authority, freshness, contradiction handling, file use, synthesis quality, workflow reliability, latency, and cost are different dimensions. Collapsing them too early hides product risk. A faster agent that loses citation support is not an improvement for a research product. A cheaper agent that skips uploaded files is not acceptable when the user explicitly supplied documents.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The system works because it makes invisible research behavior inspectable. Source choice becomes a ledger. Reading becomes spans. Claims become ids. Contradictions become edges. Tool use becomes trace events. Cost becomes a run attribute. Once these objects exist, evaluators can ask precise questions: which unsupported claims survived, which files were ignored, which source type dominated, which tasks caused drift after an hour, and which model version improved synthesis while hurting freshness.',
        'It also works because it creates regression pressure. A one-off judge score encourages teams to optimize a prompt until the answer sounds better. A replayable evaluation suite encourages teams to fix durable failures. When a failed trace becomes a fixture, future agents must survive the same source trap, file-depth trap, or contradiction trap. That gives curriculum builders a stable way to teach both research strategy and data-structure design.',
      ],
    },
    {
      heading: 'Where it is useful and where it fails',
      paragraphs: [
        'This pattern is useful for market research, technical due diligence, legal and policy synthesis, scientific literature review, competitive intelligence, benchmark audits, incident retrospectives, and any assistant that must combine web pages with local files. It is especially valuable when the answer is not a single fact but a defended position assembled from mixed evidence.',
        'It fails when the scoring setup measures the wrong artifact. Source count is not source quality. Long traces are not deep reasoning. A beautiful citation table is useless if the cited spans do not support the claims. It also fails when teams tune repeatedly on the sealed holdout, when source snapshots drift without versioning, or when the task designer writes vague rubrics that reward generic completeness instead of the specific work the task required.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Healthy signals include support coverage per material claim, citation precision, primary-source share, stale-source rate, contradiction detection rate, file-span coverage, tool-required task pass rate, retry count, late-session quality, p95 duration, cost per completed task, and scorer disagreement. For multi-agent systems, add handoff loss, duplicate source work, and lead-agent synthesis quality. These metrics should be sliced by task type, source type, file length, language, and time sensitivity.',
        'The most important operational habit is keeping the event contract stable. The product should serve research tasks, log traces, score artifacts, and replay failures using the same identifiers. If the logger calls a file page one thing and the scorer calls it another, the evidence chain breaks. If the browser snapshot is not versioned, freshness claims become impossible to audit. Evaluation quality depends on boring data hygiene.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Study claim graphs, source ledgers, retrieval evaluation, human evaluation queues, contextual bandit logged-policy evaluation, distributed tracing, workflow engines, prompt-injection threat models, and document parsing. WebGPT is useful for reference-backed browsing. STORM is useful for pre-writing structure and perspective discovery. GAIA is useful for tool-use tasks that humans can understand. Deep research system cards are useful for thinking about browsing, file interpretation, Python analysis, and long-horizon synthesis.',
        'Inside a data-structures curriculum, connect this topic to graphs, matrices, priority queues, inverted indexes, provenance DAGs, append-only logs, finite-state workflows, and regression test stores. A research evaluation system is not one algorithm. It is a coordinated set of records and gates that keeps a long reasoning process honest.',
      ],
    },
  ],
};
