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
  yield {
    state: labelMatrix(
      'Portability perturbation matrix',
      [
        { id: 'harness', label: 'harness' },
        { id: 'tools', label: 'tools' },
        { id: 'edit', label: 'edit' },
        { id: 'shell', label: 'shell' },
        { id: 'lang', label: 'lang' },
        { id: 'budget', label: 'budget' },
      ],
      [
        { id: 'shift', label: 'shift' },
        { id: 'symptom', label: 'symptom' },
        { id: 'gate', label: 'gate' },
      ],
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
    explanation: 'A portability audit changes the agent environment while keeping the task family stable. If performance collapses after only the interface moves, the model may have learned harness rituals rather than transferable operations.',
    invariant: 'Evaluate the model plus interface, then perturb the interface.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'audit condition', min: 0, max: 5 }, y: { label: 'resolved tasks, illustrative percent', min: 0, max: 75 } },
      series: [
        { id: 'pass-rate', label: 'pass rate', points: [
          { x: 0, y: 66 }, { x: 1, y: 50 }, { x: 2, y: 54 }, { x: 3, y: 43 }, { x: 4, y: 58 },
        ] },
      ],
      markers: [
        { id: 'base', x: 0, y: 66, label: 'native' },
        { id: 'harness', x: 1, y: 50, label: 'new harness' },
        { id: 'tools', x: 2, y: 54, label: 'fewer tools' },
        { id: 'scaffold', x: 3, y: 43, label: 'new scaffold' },
        { id: 'budget', x: 4, y: 58, label: 'lower budget' },
      ],
    }),
    highlight: { active: ['pass-rate'], found: ['harness', 'tools', 'scaffold'], compare: ['base'] },
    explanation: 'The exact numbers are task-specific, but the shape is the lesson: a strong native score can hide sharp drops under harness, tool, scaffold, or budget shifts.',
  };

  yield {
    state: labelMatrix(
      'Failure classification',
      [
        { id: 'plan', label: 'planning' },
        { id: 'bind', label: 'binding' },
        { id: 'sem', label: 'semantics' },
        { id: 'oracle', label: 'oracle' },
        { id: 'budget', label: 'budget' },
      ],
      [
        { id: 'trace sign', label: 'trace sign' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['wrong file', 'better search'],
        ['right intent bad tool', 'op graph'],
        ['wrong behavior', 'more traces'],
        ['tests mislead', 'oracle audit'],
        ['runs out', 'budget policy'],
      ],
    ),
    highlight: { active: ['bind:trace sign', 'bind:fix'], compare: ['plan:fix', 'oracle:fix'] },
    explanation: 'Trace diffs tell you what failed. A binding failure means the agent had the right intent but used the local tool wrong. That needs an operation graph or adapter fix, not more examples of the same high-level plan.',
  };
}

function* auditLoop() {
  yield {
    state: auditGraph('Run the native harness, then perturb it'),
    highlight: { active: ['baseline', 'perturb', 'rerun', 'e-baseline-perturb', 'e-perturb-rerun'], compare: ['report'] },
    explanation: 'Start with the native score, then rerun the same task family under controlled shifts. The audit is comparative; a single pass rate cannot identify harness overfit.',
  };

  yield {
    state: auditGraph('Trace diffs locate the portability break'),
    highlight: { active: ['rerun', 'trace', 'classify', 'e-rerun-trace', 'e-trace-classify'], found: ['fix'] },
    explanation: 'Compare traces, not only final scores. The diff asks where the behavior diverged: search path, edit binding, shell output parsing, test choice, retry budget, or stop decision.',
  };

  yield {
    state: auditGraph('Fix the data or interface, then repeat'),
    highlight: { active: ['classify', 'fix', 'perturb', 'e-classify-fix', 'e-fix-perturb'], found: ['report'] },
    explanation: 'The audit loop feeds back into training data, tool schemas, operation graphs, and eval slices. Portability is not a one-time claim; it is a regression suite.',
  };

  yield {
    state: labelMatrix(
      'Report slices',
      [
        { id: 'native', label: 'native' },
        { id: 'aci', label: 'new ACI' },
        { id: 'tools', label: 'less tools' },
        { id: 'lang', label: 'new lang' },
        { id: 'budget', label: 'budget' },
      ],
      [
        { id: 'score', label: 'score' },
        { id: 'claim', label: 'claim allowed' },
      ],
      [
        ['high', 'native strength'],
        ['medium', 'interface sensitive'],
        ['medium', 'tool dependent'],
        ['low', 'semantic gap'],
        ['curve', 'cost aware'],
      ],
    ),
    highlight: { active: ['native:claim', 'aci:claim', 'tools:claim', 'lang:claim', 'budget:claim'] },
    explanation: 'A serious report names the slice. Native strength, interface sensitivity, tool dependence, language transfer, and budget curves are different claims.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'shift matrix') yield* shiftMatrix();
  else if (view === 'audit loop') yield* auditLoop();
  else throw new InputError('Pick an agent portability view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `A coding-agent result is never just a model result. The evaluation environment decides what the agent can see, how it edits files, how commands run, how errors are surfaced, how retries are budgeted, and which tests count as success. A model can look strong because the surrounding interface quietly removes hard parts of software work.`,
        `The portability audit asks a narrower question than a leaderboard: does the behavior survive when the interface changes? It keeps the task family as stable as possible while changing the evaluation environment, tools, edit format, shell, language, scaffold, timeout, or retry budget. A sharp score drop is not just lower performance. It is evidence that the agent depended on the old environment.`,
        {type: 'callout', text: 'A portability audit treats the harness as part of the system under test, then changes one interface axis at a time to expose environment overfit.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious evaluation is one clean run in the native evaluation runner. That run is useful. It measures the system the team actually built, gives a baseline, and catches many ordinary regressions.`,
        `The wall is interpretation. One pass rate cannot tell whether the agent understood the code, benefited from a perfect search helper, relied on a familiar shell, exploited a generous retry policy, or matched a test oracle it had effectively seen before. When the product environment differs from the benchmark environment, that hidden dependency becomes the failure.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Treat the model and evaluation environment as a coupled system, then deliberately perturb the interface. The invariant is matched work under controlled interface shifts. If the task distribution stays comparable and only the edit API changes, the delta says something specific about edit portability. If only the shell changes, the delta says something specific about command portability.`,
        `This is why the audit pairs scores with trace diffs. A score says that the final patch passed or failed. A trace diff says where the run diverged: search, file selection, tool binding, edit application, command parsing, test choice, retry loop, or stop decision.`,
        {type: 'image', src: 'https://www.anthropic.com/_next/image?url=https%3A%2F%2Fstorage.googleapis.com%2Fanthropic-website%2F4zrzovbb%2Fwebsite%2F190af9f3e10181e47f55c6e5f6c4b9d12c7b72ca-2401x1000.png&w=3840&q=75', alt: 'Anthropic diagram of an augmented language model with retrieval, tools, and memory.', caption: 'Harness audits should separate model ability from the tools and context wrapped around it. (Source: anthropic.com)'},
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `In the shift-matrix view, read each row as one way to disturb the agent's environment. The shift column is the controlled change, the symptom column is the behavior to watch, and the gate column is the claim you are allowed to make if the agent still works. A highlighted edit or budget cell matters because it tests whether a convenient local affordance was doing the real work.`,
        `In the audit-loop view, the important movement is baseline, perturb, rerun, trace diff, classify, fix, and repeat. The loop is not ceremony. It prevents a team from calling a native score portable before checking whether the same task family survives a different interface.`,
        `In the report-slices frame, do not average the claims away. Native strength, interface sensitivity, tool dependence, language transfer, and budget sensitivity are different facts. Keeping them separate is the point of the visualization.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `First, run the native configuration and save more than pass/fail. Keep the prompt, tool schemas, tool calls, file reads, edits, shell commands, test results, retry count, and final patch. The trace is the evidence needed to explain a later drop.`,
        `Second, perturb one axis at a time. Replace the ACI, remove a helper, switch from structured patch edits to whole-file edits, change bash to PowerShell, move from Python tasks to JavaScript tasks, reduce the turn budget, or change the test oracle. Matched tasks make the comparison meaningful. Unmatched tasks turn the audit into a new benchmark.`,
        {type: 'image', src: 'https://sambanova.ai/hs-fs/hubfs/mini-swe-agent%20framework.jpg?height=900&name=mini-swe-agent+framework.jpg&width=1600', alt: 'Mini SWE-agent framework showing agent, model, environment, and validation loop.', caption: 'A coding-agent scaffold makes the harness boundary concrete: task, model, tools, environment, and validation. (Source: sambanova.ai)'},
        `Third, classify the divergence. Planning failures pick the wrong area of the repo. Binding failures know the right operation but cannot express it through the local tool. Semantic failures misunderstand program behavior. Oracle failures optimize for tests that do not match the real task. Budget failures need more retries than the product can afford.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness argument is controlled comparison. If the task, repository, and scoring rule are stable, then the changed environment axis is the best explanation for a systematic new failure. The audit is weaker than a randomized clinical trial, but stronger than a single benchmark run because it names what changed.`,
        `Trace diffs make the argument inspectable. If the native run finds the right function and the perturbed run never searches the right directory, the failure is retrieval or planning. If both runs find the right function but one cannot apply the patch, the failure is edit binding. This lets the team fix the right layer instead of adding vague training data.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose a team reports 66 percent on a native SWE-style evaluation runner. The audit reruns a matched subset under four shifts: a different ACI, fewer file-edit helpers, a lower retry budget, and a JavaScript-heavy task slice. The new scores are 50, 54, 58, and 43 percent. The exact numbers are illustrative; the interpretation is not. The agent is strongest in its native setup, somewhat tool-dependent, budget-sensitive, and weak on the shifted language slice.`,
        `The trace diff changes the fix. If the JavaScript slice fails because the agent never recognizes package scripts, add environment-discovery traces and task data. If the lower-budget slice fails after repeated blind test runs, change the policy for gathering evidence before editing. If the different ACI fails during patch application, build a cleaner operation graph or adapter.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The audit is expensive because it multiplies environments. Every perturbation needs task matching, trace capture, scoring, and human review for ambiguous failures. It can also slow product work if every local change must pass every slice.`,
        `The payoff is sharper risk control. A team can decide that Windows shell portability matters for the product, while Rust transfer can wait. It can also keep benchmark claims honest: native score, fixed-interface score, portability score, and cost per solved task are not interchangeable.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Use this audit before deploying an agent into a new developer environment, publishing a benchmark claim, comparing two scaffolds, or training on traces from a simulator. It is especially useful when the system will face private repos, mixed operating systems, missing dependencies, unfamiliar languages, or strict cost limits.`,
        `It also helps platform teams. If one model fails only when a helper is removed, the helper may be a product requirement. If every model fails under the same edit grammar, the grammar is probably the bug. Portability data separates model weakness from interface debt.`,
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        `Do not use this audit as the first evaluation for a barely working agent. If native traces already show random search, broken edits, or no test discipline, fix the basic loop first. Portability does not matter until there is behavior worth porting.`,
        `Do not use it to compare unrelated task sets. Changing the environment and the work at the same time gives a number without a cause. Do not treat it as a replacement for human review either. The audit can show that a patch passes across interfaces; it cannot prove the patch is maintainable or product-correct.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The common failure is confounding. If the audit changes language, repository size, hidden tests, shell, tool schemas, and budget at once, the trace diff cannot explain the drop. Another failure is audit overfitting: teams tune prompts and training data against the portability suite until it becomes another native environment.`,
        `A subtler failure is oracle trust. SWE-bench and SWE-bench Verified are useful because they ground software tasks in real repositories, but current benchmark history also shows the limits of public test-based scoring: task ambiguity, too-narrow tests, too-wide tests, environment drift, and contamination can all mislead pass rates. The audit should include oracle review when a result changes a public claim or a deployment decision.`,
        {type: 'image', src: 'https://langsmith.langchain.ac.cn/assets/images/swebench_evaluation-4086f0af70875bc21fa5e2b9ce7044e0.png', alt: 'SWE-bench evaluation flow from candidate patch to test validation.', caption: 'Public software-agent scores depend on the evaluation runner, patch path, and validation oracle. (Source: langsmith.langchain.ac.cn)'},
      ],
    },
    {
      heading: 'Study next and sources',
      paragraphs: [
        `Study Abstract Agent Operation Graph next for the portable operation vocabulary, then Verified Agent Trajectory Store for trace capture, Execution Trace State Diff Case Study for divergence analysis, and LLM Evaluation Harnesses: Golden Sets and Judges for oracle design. Study Data Leakage & Contamination before trusting public benchmark deltas.`,
        `Current source checks: SWE-agent argues that agent-computer interface design affects coding-agent behavior at https://arxiv.org/abs/2405.15793. SWE-bench describes real GitHub issue tasks and its Docker evaluation runner at https://github.com/swe-bench/SWE-bench. SWE-bench Verified describes the 500-instance human-filtered subset at https://www.swebench.com/verified.html. OpenAI's 2026 audit explains why SWE-bench Verified is no longer enough for frontier coding claims at https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/. Meta's CWM page is useful background on training code models with interpreter and agentic environment trajectories at https://ai.meta.com/research/publications/cwm-an-open-weights-llm-for-research-on-code-generation-with-world-models/.`,
      ],
    },
  ],
};
