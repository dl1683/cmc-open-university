// Case study: Meta's Code World Model. The reusable idea is execution
// grounding: train on state transitions, not only static code text.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'code-world-models-case-study',
  title: 'Code World Models Case Study',
  category: 'Papers',
  summary: 'Meta CWM as a systems lesson: execution traces improve code reasoning, but portability and verification become the real moat.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['execution grounding', 'portability and verifier factory'], defaultValue: 'execution grounding' },
  ],
  run,
};

function* grounding() {
  yield {
    state: matrixState({
      title: 'Three kinds of code training signal',
      rows: [
        { id: 'text', label: 'static code text' },
        { id: 'trace', label: 'execution traces' },
        { id: 'agent', label: 'agent trajectories' },
      ],
      columns: [
        { id: 'sees', label: 'model sees' },
        { id: 'learns', label: 'model can learn' },
        { id: 'misses', label: 'still weak at' },
      ],
      values: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      format: (v) => [
        '',
        'files and diffs', 'syntax and style', 'what state changes',
        'line by line states', 'operational semantics', 'long-horizon planning',
        'read, edit, run loops', 'tool policy', 'new environments',
      ][v],
    }),
    highlight: { active: ['trace:learns'] },
    explanation: 'Normal code LLMs mostly see code as text. Code World Model changes the data: Python execution traces expose what every line does to program state. That teaches execution semantics directly, closer to Finite State Machines than autocomplete.',
  };

  yield {
    state: matrixState({
      title: 'A toy trace: code becomes state transitions',
      rows: [
        { id: 'l1', label: 'x = []' },
        { id: 'l2', label: 'x.append(1)' },
        { id: 'l3', label: 'x.append(x[-1] + 2)' },
        { id: 'l4', label: 'return x' },
      ],
      columns: [
        { id: 'before', label: 'before' },
        { id: 'action', label: 'action' },
        { id: 'after', label: 'after' },
      ],
      values: [
        [1, 2, 3],
        [3, 4, 5],
        [5, 6, 7],
        [7, 8, 9],
      ],
      format: (v) => [
        '',
        '{}', 'bind x', '{x: []}',
        '{x: []}', 'mutate list', '{x: [1]}',
        '{x: [1]}', 'read then append', '{x: [1, 3]}',
        '{x: [1, 3]}', 'emit value', '[1, 3]',
      ][v],
    }),
    highlight: { active: ['l2:after', 'l3:after'], found: ['l4:after'] },
    explanation: 'The trace is not just a comment. It is supervised state transition data: before, action, after. For code, this matters because many bugs hide in mutation, aliasing, loop state, and exceptions. Static tokens show the sentence; traces show the machine running it.',
    invariant: 'Execution grounding teaches state changes, not merely next-token plausibility.',
  };

  yield {
    state: matrixState({
      title: 'Reported CWM benchmark shape',
      rows: [
        { id: 'swe', label: 'SWE-bench Verified' },
        { id: 'live', label: 'LiveCodeBench' },
        { id: 'math', label: 'Math-500' },
        { id: 'aime', label: 'AIME 2024' },
      ],
      columns: [
        { id: 'score', label: 'reported score' },
        { id: 'ingredient', label: 'important ingredient' },
        { id: 'lesson', label: 'lesson' },
      ],
      values: [
        [66, 1, 2],
        [69, 3, 4],
        [97, 5, 6],
        [76, 5, 7],
      ],
      format: (v) => {
        if (v >= 50) return `${v}%`;
        return [
          '',
          'test-time scaling', 'agent loop helps',
          'code training', 'execution skill transfers some',
          'reasoning RL', 'math still needs reasoning',
          'not just traces',
        ][v];
      },
    }),
    highlight: { active: ['swe:score', 'live:score'] },
    explanation: 'The headline numbers are strong, but the educational point is the mechanism: traces help most when the benchmark rewards execution prediction. For real software engineering, the model still needs search, tool use, tests, and retries. Execution grounding improves the loop; it does not replace the loop.',
  };
}

function* factory() {
  yield {
    state: matrixState({
      title: 'Portability failures are system failures',
      rows: [
        { id: 'harness', label: 'harness changes' },
        { id: 'tools', label: 'tool restrictions' },
        { id: 'edits', label: 'edit grammar' },
        { id: 'lang', label: 'language scope' },
      ],
      columns: [
        { id: 'change', label: 'what changes' },
        { id: 'breaks', label: 'what breaks' },
        { id: 'fix', label: 'better abstraction' },
      ],
      values: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
      ],
      format: (v) => [
        '',
        'agent wrapper', 'cached tool rituals', 'abstract task state',
        'remove edit plugin', 'action habit', 'edit as operation',
        'diff vs whole file', 'format dependence', 'patch intent',
        'Python to other languages', 'semantic locality', 'language-specific traces',
      ][v],
    }),
    highlight: { active: ['harness:breaks', 'tools:breaks', 'edits:breaks'] },
    explanation: 'A code agent is not just a model. It is a model plus tools, prompts, shell behavior, file-editing grammar, tests, and feedback. When those change, learned habits can break. This is the same lesson as Distributed Tracing: the whole request path matters.',
  };

  yield {
    state: matrixState({
      title: 'The verifier factory behind execution-grounded agents',
      rows: [
        { id: 'corpus', label: 'corpus' },
        { id: 'execute', label: 'execution' },
        { id: 'verify', label: 'verification' },
        { id: 'refresh', label: 'refresh' },
      ],
      columns: [
        { id: 'asset', label: 'asset' },
        { id: 'cost', label: 'cost driver' },
        { id: 'moat', label: 'moat' },
      ],
      values: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
      ],
      format: (v) => [
        '',
        'repos and issues', 'coverage and licensing', 'data access',
        'containers', 'dependency rot', 'reproducibility',
        'tests and oracles', 'false positives', 'trust',
        'new commits', 'staleness', 'continuous pipeline',
      ][v],
    }),
    highlight: { found: ['verify:moat', 'refresh:moat'] },
    explanation: 'The model is only the visible artifact. The deeper system is a verifier factory: collect tasks, build runnable environments, generate candidate trajectories, prove the patch works, filter duplicates, and refresh as repositories change. This is Write-Ahead Log discipline for training data: provenance matters.',
    invariant: 'For execution-grounded learning, clean verified trajectories are the scarce input.',
  };

  yield {
    state: matrixState({
      title: 'Where to use the CWM idea',
      rows: [
        { id: 'debug', label: 'debugging' },
        { id: 'coding', label: 'coding agents' },
        { id: 'finance', label: 'financial sims' },
        { id: 'law', label: 'legal workflows' },
      ],
      columns: [
        { id: 'state', label: 'state space' },
        { id: 'oracle', label: 'oracle' },
        { id: 'risk', label: 'main risk' },
      ],
      values: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
      ],
      format: (v) => [
        '',
        'variables and stack', 'tests', 'trace incompleteness',
        'repo and tools', 'CI', 'harness overfit',
        'portfolio state', 'backtest', 'market leakage',
        'claims and obligations', 'review rules', 'ambiguous execution',
      ][v],
    }),
    highlight: { active: ['debug:oracle', 'coding:oracle'] },
    explanation: 'The transferable template is not "train on Python." It is: define the state, build an executor, build an oracle, then train on verified transitions. Domains with crisp execution and good tests get the most immediate value. Ambiguous domains need stronger symbolic or human review layers.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'execution grounding') yield* grounding();
  else if (view === 'portability and verifier factory') yield* factory();
  else throw new InputError('Pick a CWM view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Code World Model, or CWM, is Meta AI research on training a coding model with execution-grounded data. Instead of learning only from static source files and diffs, the model is trained on observation-action trajectories from Python interpreter traces and agentic software-engineering environments. The educational idea is simple: code is a deterministic system, so a model should learn the state transitions, not just the syntax.',
        'This belongs in the Papers category because it teaches a reusable research pattern. It is not only a coding-model result. It is a case study in how AI systems improve when you replace weak text supervision with verified process data.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Execution trace prediction turns each line of code into a before-action-after learning example. A variable is assigned, a list mutates, an exception fires, a stack frame returns. That gives the model direct pressure to understand operational semantics. Agent trajectories add another layer: read files, run tests, inspect failures, edit, and submit. Together, they teach both code execution and tool-using behavior.',
        'The hard part is integration. A simulator that predicts line-by-line execution is useful, but software engineering also requires planning. The agent must decide which files to inspect, what hypothesis to test, which edit to make, and when the tests are sufficient. Tree of Thoughts Search Case Study and Monte Carlo Tree Search & UCT Primer show the missing control-plane shape: generate candidate states, score them, allocate budget, and backtrack. Execution grounding sharpens local reasoning; it does not automatically solve long-horizon search.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The model training cost is only one line item. The deeper cost is the trajectory factory: runnable repositories, Docker images, dependency management, test oracles, failure reproduction, patch verification, deduplication, and refresh. If an example is not verified, it may teach the model a fluent but wrong repair. If the environment is too narrow, the model may learn tool rituals rather than abstract operations.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The immediate use is coding agents: bug fixing, test repair, migration work, code review, and debugging. But the general pattern applies anywhere a domain has executable state transitions and objective verifiers. Financial backtests, compiler optimization, robotics simulators, and some legal or compliance workflows can all be framed as state plus action plus oracle. The more reliable the oracle, the more aggressively you can train or search.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The main misconception is that execution traces equal general reasoning. They do not. They teach a model to simulate one kind of environment. Portability still requires diverse environments, abstract action representations, and evaluation outside the native harness. Abstract Agent Operation Graph and Agent Harness Portability Audit turn that requirement into concrete data structures and eval slices.',
        'Another trap is benchmark optimism. Strong benchmark numbers can hide the system assumptions that made them possible: tool set, timeout, test availability, hidden tests, retry budget, prompt format, and candidate count. Treat coding-agent numbers as full-stack measurements, not pure model measurements.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: CWM: An Open-Weights LLM for Research on Code Generation with World Models, arXiv:2510.02387 at https://arxiv.org/abs/2510.02387, plus Meta AI research page https://ai.meta.com/research/publications/cwm-an-open-weights-llm-for-research-on-code-generation-with-world-models/. Local source: Code World Models Breakdown.txt in the referenced document corpus. Study Verified Agent Trajectory Store, Execution Trace State Diff Case Study, Dynamic Scratchpad Execution Trace Case Study, Agent Trajectory Dedupe & Provenance Hash, Rust Borrow Checker Ownership Trace, JVM Happens-Before Execution Trace, Financial Contract Lifecycle Event Model, Double-Entry Payment Ledger Execution Trace, Abstract Agent Operation Graph, Agent Harness Portability Audit, Tree of Thoughts Search Case Study, Monte Carlo Tree Search & UCT Primer, Process Reward Models & Verifier Search, Execution-as-a-Service Verifier Economy Case Study, Git Internals, Distributed Tracing, Write-Ahead Log, Evolutionary Search, and AlphaEvolve Case Study to see the broader verifier-and-trajectory pattern.',
      ],
    },
  ],
};
