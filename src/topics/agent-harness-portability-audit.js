// Agent harness portability audit: perturb the interface and environment to
// distinguish real competence from harness-specific habits.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'agent-harness-portability-audit',
  title: 'Agent Harness Portability Audit',
  category: 'AI & ML',
  summary: 'A test matrix for coding agents: change harnesses, tools, edit formats, shells, languages, and budgets to expose environment overfitting.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['shift matrix', 'audit loop'], defaultValue: 'shift matrix' },
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

function auditGraph(title) {
  return graphState({
    nodes: [
      { id: 'baseline', label: 'baseline', x: 0.8, y: 3.6, note: 'native' },
      { id: 'perturb', label: 'perturb', x: 2.7, y: 2.0, note: 'shift' },
      { id: 'rerun', label: 'rerun', x: 4.5, y: 2.0, note: 'same tasks' },
      { id: 'trace', label: 'trace diff', x: 6.3, y: 3.6, note: 'where?' },
      { id: 'classify', label: 'classify', x: 8.0, y: 2.0, note: 'failure' },
      { id: 'fix', label: 'fix data', x: 8.0, y: 5.2, note: 'train/audit' },
      { id: 'report', label: 'report', x: 9.5, y: 3.6, note: 'slices' },
    ],
    edges: [
      { id: 'e-baseline-perturb', from: 'baseline', to: 'perturb' },
      { id: 'e-perturb-rerun', from: 'perturb', to: 'rerun' },
      { id: 'e-rerun-trace', from: 'rerun', to: 'trace' },
      { id: 'e-trace-classify', from: 'trace', to: 'classify' },
      { id: 'e-classify-fix', from: 'classify', to: 'fix' },
      { id: 'e-fix-perturb', from: 'fix', to: 'perturb', weight: 'repeat' },
      { id: 'e-classify-report', from: 'classify', to: 'report' },
    ],
  }, { title });
}

function* shiftMatrix() {
  const perturbRows = [
    { id: 'harness', label: 'harness' },
    { id: 'tools', label: 'tools' },
    { id: 'edit', label: 'edit' },
    { id: 'shell', label: 'shell' },
    { id: 'lang', label: 'lang' },
    { id: 'budget', label: 'budget' },
  ];
  const perturbCols = [
    { id: 'shift', label: 'shift' },
    { id: 'symptom', label: 'symptom' },
    { id: 'gate', label: 'gate' },
  ];

  yield {
    state: labelMatrix(
      'Portability perturbation matrix',
      perturbRows,
      perturbCols,
      [
        ['runner', 'ritual', 'delta'],
        ['helper', 'panic', 'fallbk'],
        ['diff', 'patch', 'apply'],
        ['pwsh', 'cmd', 'ops'],
        ['Py/JS', 'sem', 'split'],
        ['retry-', 'crutch', 'curve'],
      ],
    ),
    highlight: { active: ['harness:shift', 'tools:shift', 'edit:shift', 'budget:shift'], found: ['harness:gate', 'edit:gate', 'budget:gate'] },
    explanation: `A portability audit changes the agent environment across ${perturbRows.length} dimensions and ${perturbCols.length} columns while keeping the task family stable. If performance collapses after only the interface moves, the model may have learned harness rituals rather than transferable operations.`,
    invariant: `Evaluate the model plus interface across all ${perturbRows.length} perturbation rows, then perturb the interface.`,
  };

  const baselineScore = 66;
  const perturbedScores = [50, 54, 43, 58];
  const lowestScore = Math.min(...perturbedScores);
  const markerLabels = ['native', 'new harness', 'fewer tools', 'new scaffold', 'lower budget'];

  yield {
    state: plotState({
      axes: { x: { label: 'audit condition', min: 0, max: 5 }, y: { label: 'resolved tasks, illustrative percent', min: 0, max: 75 } },
      series: [
        { id: 'pass-rate', label: 'pass rate', points: [
          { x: 0, y: baselineScore }, { x: 1, y: perturbedScores[0] }, { x: 2, y: perturbedScores[1] }, { x: 3, y: perturbedScores[2] }, { x: 4, y: perturbedScores[3] },
        ] },
      ],
      markers: [
        { id: 'base', x: 0, y: baselineScore, label: markerLabels[0] },
        { id: 'harness', x: 1, y: perturbedScores[0], label: markerLabels[1] },
        { id: 'tools', x: 2, y: perturbedScores[1], label: markerLabels[2] },
        { id: 'scaffold', x: 3, y: perturbedScores[2], label: markerLabels[3] },
        { id: 'budget', x: 4, y: perturbedScores[3], label: markerLabels[4] },
      ],
    }),
    highlight: { active: ['pass-rate'], found: ['harness', 'tools', 'scaffold'], compare: ['base'] },
    explanation: `The baseline is ${baselineScore}% but drops to as low as ${lowestScore}% under perturbation across ${markerLabels.length} conditions. The shape is the lesson: a strong "${markerLabels[0]}" score can hide sharp drops under harness, tool, scaffold, or budget shifts.`,
  };

  const failureRows = [
    { id: 'plan', label: 'planning' },
    { id: 'bind', label: 'binding' },
    { id: 'sem', label: 'semantics' },
    { id: 'oracle', label: 'oracle' },
    { id: 'budget', label: 'budget' },
  ];
  const failureData = [
    ['wrong file', 'better search'],
    ['right intent bad tool', 'op graph'],
    ['wrong behavior', 'more traces'],
    ['tests mislead', 'oracle audit'],
    ['runs out', 'budget policy'],
  ];

  yield {
    state: labelMatrix(
      'Failure classification',
      failureRows,
      [
        { id: 'trace sign', label: 'trace sign' },
        { id: 'fix', label: 'fix' },
      ],
      failureData,
    ),
    highlight: { active: ['bind:trace sign', 'bind:fix'], compare: ['plan:fix', 'oracle:fix'] },
    explanation: `Trace diffs classify failures into ${failureRows.length} types. A "${failureRows[1].label}" failure (trace sign: "${failureData[1][0]}") means the agent had the right intent but used the local tool wrong. That needs an ${failureData[1][1]} fix, not more examples of the same high-level plan.`,
  };
}

function* auditLoop() {
  const graph1 = auditGraph('Run the native harness, then perturb it');
  const graphNodeCount = graph1.nodes.length;
  const graphEdgeCount = graph1.edges.length;
  const baselineNode = graph1.nodes.find(n => n.id === 'baseline');
  const reportNode = graph1.nodes.find(n => n.id === 'report');

  yield {
    state: graph1,
    highlight: { active: ['baseline', 'perturb', 'rerun', 'e-baseline-perturb', 'e-perturb-rerun'], compare: ['report'] },
    explanation: `Start with the "${baselineNode.label}" node (note: "${baselineNode.note}"), then rerun the same task family under controlled shifts across ${graphNodeCount} pipeline nodes and ${graphEdgeCount} edges. The audit is comparative; a single pass rate cannot identify harness overfit.`,
  };

  const traceNode = graph1.nodes.find(n => n.id === 'trace');
  const classifyNode = graph1.nodes.find(n => n.id === 'classify');

  yield {
    state: auditGraph('Trace diffs locate the portability break'),
    highlight: { active: ['rerun', 'trace', 'classify', 'e-rerun-trace', 'e-trace-classify'], found: ['fix'] },
    explanation: `Compare traces at the "${traceNode.label}" node (note: "${traceNode.note}"), not only final scores. The diff asks where the behavior diverged: search path, edit binding, shell output parsing, test choice, retry budget, or stop decision, then feeds into "${classifyNode.label}".`,
  };

  const fixNode = graph1.nodes.find(n => n.id === 'fix');

  yield {
    state: auditGraph('Fix the data or interface, then repeat'),
    highlight: { active: ['classify', 'fix', 'perturb', 'e-classify-fix', 'e-fix-perturb'], found: ['report'] },
    explanation: `The audit loop feeds "${fixNode.label}" (note: "${fixNode.note}") back into training data, tool schemas, operation graphs, and eval slices. Portability is not a one-time claim; it is a regression suite ending at the "${reportNode.label}" node.`,
  };

  const reportRows = [
    { id: 'native', label: 'native' },
    { id: 'aci', label: 'new ACI' },
    { id: 'tools', label: 'less tools' },
    { id: 'lang', label: 'new lang' },
    { id: 'budget', label: 'budget' },
  ];
  const reportData = [
    ['high', 'native strength'],
    ['medium', 'interface sensitive'],
    ['medium', 'tool dependent'],
    ['low', 'semantic gap'],
    ['curve', 'cost aware'],
  ];

  yield {
    state: labelMatrix(
      'Report slices',
      reportRows,
      [
        { id: 'score', label: 'score' },
        { id: 'claim', label: 'claim allowed' },
      ],
      reportData,
    ),
    highlight: { active: ['native:claim', 'aci:claim', 'tools:claim', 'lang:claim', 'budget:claim'] },
    explanation: `A serious report names all ${reportRows.length} slices. "${reportData[0][1]}", "${reportData[1][1]}", "${reportData[2][1]}", "${reportData[3][1]}", and "${reportData[4][1]}" are different claims, each with its own score level.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  const views = ['shift matrix', 'audit loop'];
  if (view === views[0]) yield* shiftMatrix();
  else if (view === views[1]) yield* auditLoop();
  else throw new InputError(`Pick an agent portability view from ${views.length} options: ${views.join(', ')}.`);
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. The shift-matrix view shows a grid where each row is one perturbation axis (harness, tools, edit format, shell, language, budget) and each column tracks the controlled change, the observable symptom, and the gate claim. Highlighted cells are the axes under test; cells marked "found" are axes where the agent survived the shift. The bar chart that follows plots pass rates across audit conditions so you can see the drop shape.',
        'The audit-loop view shows the full methodology as a directed graph: baseline, perturb, rerun, trace diff, classify, fix, and repeat. Edges marked "repeat" indicate the feedback loop where classified failures drive data or interface fixes before the next perturbation round. The final report-slices matrix shows that each audit condition produces a separate claim, not a blended average.',
        {type: 'image', src: './assets/gifs/agent-harness-portability-audit.gif', alt: 'Animated walkthrough of the agent harness portability audit visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A coding agent is not just a language model. It is a model plus an evaluation harness: a shell, a file-edit API, a set of tool schemas, a retry policy, a test oracle, and a language distribution. When a leaderboard reports that an agent solves 66% of tasks, that number describes the entire coupled system. If 16 of those percentage points come from a generous retry budget and a file-search helper that pins the model to the right directory, the model\'s portable competence is closer to 50%.',
        'The portability audit exists to decompose that coupled score. It holds the task family constant and changes one interface axis at a time -- the harness runner, the available tools, the edit grammar, the shell, the target language, or the turn budget. Each shift isolates one dependency. A sharp drop under a single-axis change is direct evidence that the agent learned an interface ritual rather than a transferable coding operation.',
        'This matters because production environments almost never match benchmark environments. A team that deploys an agent tuned for SWE-bench\'s Docker runner into a Windows CI pipeline, a monorepo with no file-search helper, or a language the benchmark never tested is shipping an untested system. The portability audit is the test that catches this before users do.',
        {type: 'callout', text: 'A portability audit treats the harness as part of the system under test, then changes one interface axis at a time to expose environment overfit.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious evaluation is a single clean run in the agent\'s native harness. The team picks a benchmark (SWE-bench, HumanEval, a private issue set), runs the agent with its production scaffold, and reports the pass rate. This is not a bad starting point. It measures the system the team actually built, establishes a regression baseline, and catches many straightforward bugs.',
        'The problem is that a single-environment pass rate conflates model ability with interface fit. The agent may score 66% because its file-search tool always returns the right file, its structured-patch editor never produces a malformed diff, its bash shell matches every command it trained on, and its 25-turn retry budget gives it time to stumble into the right answer. Each of those affordances is invisible in the final score.',
        'Teams often discover this the hard way. An agent that solves Python issues reliably fails on JavaScript repos because it never learned to read package.json. An agent that produces clean patches in a structured editor produces garbage when switched to whole-file replacement. The native score predicted none of these failures because it never tested the interface boundary.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that a single-environment score cannot distinguish three fundamentally different agents: one that understands code and happens to use the local tools, one that has memorized the local tool patterns and would fail with any other interface, and one that gets lucky under a generous retry budget. All three can produce the same pass rate in the native harness.',
        'This is not a theoretical concern. The SWE-agent paper (Yang et al., 2024) showed that changing the agent-computer interface (ACI) -- the edit commands, search tools, and navigation helpers available to the model -- moved SWE-bench scores by double-digit percentages with the same underlying model. The interface was doing real work, and the native score was taking credit for it.',
        'Without a way to decompose the score into model contribution and interface contribution, every claim about agent capability is overfit to the test environment. The wall is that you cannot see this overfit from inside the native run.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is controlled perturbation with matched tasks. Instead of testing the model alone (impossible -- it always needs some interface) or the system in one configuration (uninformative about portability), the audit holds the task distribution constant and changes exactly one interface axis per comparison. The delta between the native score and the perturbed score isolates the contribution of that specific axis.',
        'This works because of the same logic behind controlled experiments in any field. If you change one variable and the outcome changes, the variable you changed is the best explanation. If you change the edit format from structured patches to whole-file replacement and the pass rate drops from 66% to 43%, the 23-point gap is attributable to edit-format dependence, not to harder tasks or a weaker model.',
        {type: 'image', src: 'https://www.anthropic.com/_next/image?url=https%3A%2F%2Fstorage.googleapis.com%2Fanthropic-website%2F4zrzovbb%2Fwebsite%2F190af9f3e10181e47f55c6e5f6c4b9d12c7b72ca-2401x1000.png&w=3840&q=75', alt: 'Anthropic diagram of an augmented language model with retrieval, tools, and memory.', caption: 'Harness audits should separate model ability from the tools and context wrapped around it. (Source: anthropic.com)'},
        'The second half of the insight is that scores alone are not enough. Two runs can both fail, but fail for different reasons. The audit pairs every score comparison with a trace diff -- a side-by-side comparison of the tool calls, file reads, edits, shell commands, and decisions the agent made in the native run versus the perturbed run. The trace diff localizes the failure to a specific layer: planning, tool binding, semantic understanding, oracle mismatch, or budget exhaustion.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Step one: run the native configuration and capture the full trace, not just pass/fail. The trace includes the system prompt, tool schemas, every tool call and its response, every file read and edit, every shell command and its output, the retry count, the test results, and the final patch. This baseline trace is the reference for all later comparisons. Without it, a later score drop is just a number without a cause.',
        'Step two: define the perturbation matrix. The six standard axes are harness (swap the evaluation runner), tools (remove or replace helpers like file search or linting), edit format (switch between structured patches, whole-file replacement, and line-range edits), shell (bash to PowerShell or cmd), language (shift the task distribution from Python-heavy to JavaScript-heavy or mixed), and budget (reduce the turn limit or token limit). Each axis gets one controlled experiment against the same matched task set.',
        {type: 'image', src: 'https://sambanova.ai/hs-fs/hubfs/mini-swe-agent%20framework.jpg?height=900&name=mini-swe-agent+framework.jpg&width=1600', alt: 'Mini SWE-agent framework showing agent, model, environment, and validation loop.', caption: 'A coding-agent scaffold makes the harness boundary concrete: task, model, tools, environment, and validation. (Source: sambanova.ai)'},
        'Step three: for every perturbation that causes a score drop, run the trace diff. Compare the native trace and the perturbed trace side by side for each failed task. Classify the divergence point into one of five failure types. A planning failure means the agent searched the wrong directory or file. A binding failure means the agent had the right intent but could not express it through the available tool -- for example, it tried to use a structured patch command that no longer exists. A semantic failure means the agent misunderstood what the code does. An oracle failure means the agent optimized for a test that does not match the real specification. A budget failure means the agent was on the right track but ran out of turns or tokens before finishing.',
        'Step four: feed the classified failures back into the system. Planning failures need better environment-discovery data. Binding failures need tool adapters or operation-graph abstractions. Semantic failures need richer code-understanding training. Oracle failures need better test validation. Budget failures need policy changes for evidence gathering before editing. Then repeat the audit to confirm the fix worked without regressing other axes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on controlled comparison, the same principle that makes A/B testing valid. If the task set, the repository state, and the scoring rule are held constant, and only the edit API changes, then a systematic score change is attributable to edit-API dependence. The audit does not prove causation as strongly as a randomized trial (there may be interactions between axes), but it is far stronger than a single benchmark run because it names what changed and provides trace-level evidence for why the score moved.',
        'Trace diffs make the argument mechanically inspectable. Consider two runs of the same task. In the native run, the agent calls file_search("auth"), reads auth/middleware.py, and patches line 42. In the perturbed run (file-search helper removed), the agent calls grep("auth"), gets no results because the helper\'s fuzzy matching is gone, then edits the wrong file. The trace diff pinpoints the failure: the agent depended on fuzzy file search, not on understanding the repository layout. That diagnosis is actionable. Adding a broader search fallback or training on repository-structure exploration fixes the root cause.',
        'The classification taxonomy (planning, binding, semantic, oracle, budget) works because these five failure types require different fixes and live in different layers of the system. Conflating them -- which is what a single pass rate does -- leads teams to apply the wrong remedy. A binding failure does not need more training data; it needs a better tool abstraction. A budget failure does not need a smarter model; it needs a more efficient evidence-gathering policy.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The dominant cost is compute multiplication. A six-axis audit with one perturbation per axis requires seven full evaluation runs (one baseline plus six perturbed). If the native benchmark has 300 tasks and each task costs roughly $0.50 in API calls, the baseline run costs $150. The full audit costs $1,050. Adding a second perturbation level per axis (for example, mild and severe tool removal) doubles the perturbation runs to $1,950 total.',
        'Human review is the second cost. Not every failure is clearly classifiable from traces alone. Ambiguous cases -- where the agent fails for a mix of planning and binding reasons -- need human judgment. In practice, roughly 20-30% of failures in a portability audit require manual trace review. For a 300-task audit where the perturbed runs fail on 40% more tasks (about 120 new failures across all axes), that means 24 to 36 tasks need human analysis.',
        'The ongoing cost is maintenance. Every time the agent\'s scaffold changes, the perturbation matrix may need updating. A new tool added to the native harness means a new perturbation (what happens without it). A new target language means a new language-shift slice. Teams that treat the audit as a one-time gate rather than a regression suite lose its value within a few release cycles.',
        'The payoff is sharper risk control. Instead of discovering in production that the agent cannot handle PowerShell, the team knows before deployment. Instead of publishing a benchmark claim that silently depends on a generous retry budget, the team publishes separate scores per condition. The audit cost is small relative to the cost of deploying an agent that fails in a predictable, testable way.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Pre-deployment validation is the primary use. Before shipping a coding agent into a new customer environment -- different OS, different shell, different language mix, different CI system -- the portability audit predicts which axes will cause failures. A team deploying from a Linux/bash/Python benchmark environment into a Windows/PowerShell/C# production environment can run three targeted perturbations and know the risk before any customer sees a failure.',
        'Benchmark integrity is the second use. When publishing agent scores on SWE-bench or similar benchmarks, the portability audit separates the score into native strength, interface sensitivity, tool dependence, language transfer, and budget sensitivity. This prevents overclaiming. A team that scores 66% natively but 43% without its custom file-search helper can honestly report both numbers and let readers decide what matters for their use case.',
        'Scaffold comparison is the third use. When choosing between two agent frameworks, running both through the same perturbation matrix reveals which scaffold is more portable versus which is more tuned to its native environment. A scaffold that scores 60% natively and 55% under perturbation is often more valuable than one that scores 70% natively and 40% under perturbation.',
        'Platform teams use the audit to separate model weakness from interface debt. If every model fails under the same edit grammar, the grammar is the bug, not the models. If one model fails only when a helper is removed, that helper is a product requirement, not a nice-to-have.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The most common failure is confounding. If the audit changes the shell, the language, and the tool set simultaneously, the trace diff cannot attribute the score drop to any single axis. Multi-axis changes turn the audit into a new uncontrolled benchmark. Discipline requires one axis per comparison, which is why the method is expensive.',
        'Audit overfitting is a subtler failure. Teams that tune prompts, training data, and tool schemas against the portability suite eventually make it another native environment. The perturbation matrix must rotate: new tasks, new axis combinations, new severity levels. A frozen audit suite has a shelf life of roughly two to three release cycles before the agent has effectively trained on it.',
        'Oracle trust is the third failure mode. The audit inherits whatever test oracle the benchmark uses. SWE-bench tasks use repository test suites, but those tests can be too narrow (passing a wrong patch that happens to satisfy the test), too broad (failing a correct patch on an unrelated test), or contaminated (the model has seen the test in training). OpenAI\'s 2026 announcement that they no longer evaluate on SWE-bench Verified illustrates this risk: the oracle itself became unreliable for frontier claims. Any portability audit should include oracle review when results will drive a public claim or deployment decision.',
        {type: 'image', src: 'https://langsmith.langchain.ac.cn/assets/images/swebench_evaluation-4086f0af70875bc21fa5e2b9ce7044e0.png', alt: 'SWE-bench evaluation flow from candidate patch to test validation.', caption: 'Public software-agent scores depend on the evaluation runner, patch path, and validation oracle. (Source: langsmith.langchain.ac.cn)'},
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A team ships a coding agent that scores 66% on a 300-task SWE-style benchmark in its native harness: bash shell, structured-patch editor, file-search helper, Python-heavy task distribution, 25-turn budget. The team wants to deploy into customer environments that include Windows, JavaScript repos, and a 10-turn cost limit. The portability audit runs five perturbations against a matched 200-task subset.',
        'Perturbation 1 -- harness swap: replace the native evaluation runner with a minimal Docker container that only provides a shell and a text editor. Score drops from 66% to 50%. Trace diffs show the agent trying to call file_search, a tool that no longer exists, on 38 of the 100 newly failed tasks (132 passed natively, 100 passed in perturbation). The failure type is binding: the agent had the right intent but could not express it without the helper.',
        'Perturbation 2 -- tool removal: keep the native runner but remove the file-search and lint helpers. Score drops to 54%. Trace diffs overlap heavily with perturbation 1, confirming that file-search dependence is the dominant issue. 28 of 36 new failures show the agent grep-ing for filenames it used to get from the helper.',
        'Perturbation 3 -- edit format: switch from structured patches (diff hunks with line numbers) to whole-file replacement. Score drops to 43%. This is the largest drop. Trace diffs reveal that the agent frequently produces whole-file outputs with subtle off-by-one errors in surrounding context, or truncates long files. The failure type is binding: the agent learned the patch grammar, not the edit operation.',
        'Perturbation 4 -- language shift: replace 60% of the Python tasks with matched JavaScript tasks (same complexity, same issue types). Score drops to 52%. Trace diffs show the agent failing to recognize package.json scripts, using Python import conventions in JS files, and missing async/await patterns. The failure type is semantic: the agent\'s code understanding is language-specific.',
        'Perturbation 5 -- budget reduction: cut the turn limit from 25 to 10. Score drops to 58%. Trace diffs show the agent succeeding on the same tasks it solves quickly in the native run but failing on tasks where it previously needed 12-20 turns of retry. The failure type is budget: the agent\'s evidence-gathering strategy is too expensive for tight limits.',
        'The report names five separate claims: native strength 66%, harness-portable 50%, tool-independent 54%, edit-portable 43%, language-portable 52%, budget-resilient 58%. The team now knows that edit-format dependence is their biggest deployment risk, file-search dependence is second, and language transfer is third. The fix priorities are: build a format-agnostic edit abstraction, add search fallback training, and expand the JavaScript training distribution.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Abstract Agent Operation Graph next for a portable vocabulary that survives interface changes. Study Verified Agent Trajectory Store for trace-capture infrastructure. Study Execution Trace State Diff Case Study for worked examples of trace-diff analysis. Study LLM Evaluation Harnesses: Golden Sets and Judges for oracle design and validation. Study Data Leakage & Contamination before trusting any public benchmark delta.',
        'Primary sources: the SWE-agent paper (Yang et al., 2024) demonstrated that agent-computer interface design moves coding-agent scores by double-digit percentages, establishing the empirical basis for interface-axis perturbation (https://arxiv.org/abs/2405.15793). SWE-bench provides the task format and Docker evaluation runner used by most coding-agent benchmarks (https://github.com/swe-bench/SWE-bench). SWE-bench Verified describes the 500-instance human-filtered subset that improved oracle quality (https://www.swebench.com/verified.html). OpenAI\'s 2026 audit explains why even Verified is insufficient for frontier claims, motivating oracle review as part of any portability audit (https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/). Meta\'s CWM work provides background on training code models with interpreter and agentic environment trajectories (https://ai.meta.com/research/publications/cwm-an-open-weights-llm-for-research-on-code-generation-with-world-models/).',
      ],
    },
  ],
};
