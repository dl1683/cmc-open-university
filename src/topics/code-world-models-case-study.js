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
    explanation: 'The matrix compares three training signals. Static code teaches syntax and style, but the highlighted trace row exposes before-and-after state. CWM uses that extra supervision so the model learns what execution changes, not only what token tends to come next.',
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
    explanation: 'The highlighted breakage cells are portability failures. A code agent is a model plus tools, prompts, shell behavior, edit grammar, tests, and feedback. If any part of that path changes, a habit learned in one harness may stop being correct in another.',
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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Code World Models Case Study. Meta CWM as a systems lesson: execution traces improve code reasoning, but portability and verification become the real moat..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this idea exists',
      paragraphs: [
        `Code World Models exist because code is not only text. Source files have syntax, names, style, imports, and comments, but running code also has state: variables change, lists mutate, stack frames open and close, exceptions fire, tests pass or fail, and files on disk are edited. A model trained only on static text can learn many surface regularities while missing the machine that the text controls.`,
        `The CWM idea is to train coding models with execution-grounded data. Instead of asking the model to learn only from code tokens and patches, the training signal includes observations, actions, interpreter traces, and agent trajectories. The educational lesson is broader than one paper: if a domain has state transitions and verifiers, better supervision often comes from recording the process, not only the final artifact.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious way to train a code model is to collect repositories, diffs, issues, solutions, and documentation, then predict the next token or patch. That baseline is useful. It teaches syntax, idioms, library usage, and common repair shapes. It is also incomplete. A static diff may show that a line changed, but not which runtime state made the old line fail.`,
        `Text-only learning struggles with aliasing, mutation, loop invariants, exceptions, concurrency, and hidden test behavior because those facts are not always visible in local text. The model can infer some of them from patterns, but it is learning around the execution process rather than from it directly.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to treat code as a world model problem. A world model predicts how state changes when an action occurs. For code, the world includes variables, heap objects, stack frames, files, tests, commands, and tool outputs. A good coding model should predict not just what code looks like, but what code does next.`,
        `Execution grounding gives the model direct pressure to learn operational semantics. If a list append changes x from [] to [1], the trace makes that transition explicit. If a function throws, the trace shows where control flow stopped. If a test fails after a patch, the trajectory connects an edit to observed evidence. The model learns from state change rather than only from plausible text continuation.`,
      ],
    },
    {
      heading: 'How trace learning works',
      paragraphs: [
        `A trace example can be framed as before, action, after. Before: the environment has certain variables and files. Action: execute a line, call a function, run a command, or apply a patch. After: the state changes, output appears, or an error is raised. These examples teach small local transitions that static code does not expose cleanly.`,
        `For a Python interpreter trace, the model might observe variable bindings before and after each statement. For an agent trajectory, it might observe file reads, shell commands, test failures, edits, and final verification. The two signals complement each other. Interpreter traces teach local execution. Agent trajectories teach tool use and repair workflow.`,
      ],
    },
    {
      heading: 'The verifier factory',
      paragraphs: [
        `The scarce asset is not just the model. It is the factory that creates clean verified trajectories. That factory needs runnable repositories, dependency snapshots, containers, input tasks, candidate actions, test oracles, failure logs, patch validation, duplicate filtering, licensing checks, and refresh as upstream code changes. Bad trajectories teach bad behavior.`,
        `This is why execution-grounded coding is a systems problem. The model is the visible artifact, but the verifier factory determines whether the data is trustworthy. A repair that only appears to work because of a flaky test, missing dependency, or accidental benchmark-environment shortcut can poison training. Provenance is part of the data structure.`,
      ],
    },
    {
      heading: 'Agent trajectories',
      paragraphs: [
        `An agent trajectory is a higher-level execution record. It includes the model reading files, forming a hypothesis, running tests, seeing errors, editing code, and checking whether the result works. This matters because real software engineering is not only line-by-line execution. It is search under uncertainty.`,
        `The agent must decide which file to inspect, which command to run, which failing test matters, how large an edit should be, when to backtrack, and when the evidence is sufficient. Execution grounding improves the model\'s local predictions, but planning still needs search, scoring, budget allocation, and verification. Tree search and process reward models fit naturally around this loop.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The first visual proves the difference between three training signals. Static code text teaches files, diffs, syntax, and style. Execution traces add before-and-after state. Agent trajectories add tool policy and verifier feedback. The highlighted trace row is the point: state transitions expose facts that static tokens only imply.`,
        `The second visual proves that portability is not automatic. A learned behavior can depend on the execution interface, shell, edit grammar, language, timeout, or verifier. The third visual proves the reusable pattern: define the state space, build an executor, build an oracle, collect verified transitions, then train or search over them.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `Execution-grounded data is expensive. It requires runnable environments, instrumentation, storage for traces, replayable task definitions, and verification. Dependencies rot. Containers drift. Tests can be flaky. Hidden oracles may not be available. Recording too much state can be costly or unsafe. Recording too little state can remove the very signal the method needs.`,
        `There is also a modeling tradeoff. Traces make local state changes clearer, but they can bias a model toward the environments that were instrumented. A model trained heavily on Python interpreter traces may still struggle with Rust ownership, Java concurrency, browser APIs, build systems, or distributed services unless those worlds are represented with their own states and oracles.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `The idea wins where execution is crisp and verification is cheap. Debugging, unit-test repair, small migrations, compiler errors, runtime exceptions, type errors, and benchmark-driven optimization all produce concrete feedback. A coding agent can run a command, observe a failure, make a patch, and verify the result.`,
        `The same pattern can transfer outside code when the domain has state plus action plus oracle. Financial simulations have portfolio state and backtests. Robotics simulators have physical state and task success checks. Some legal or compliance workflows have document state and review rules. The more objective the oracle, the stronger the training signal.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The main failure mode is benchmark-environment overfit. The model may learn the rituals of one benchmark instead of the abstract operation. It may learn that a certain command usually appears before success, that a certain patch shape fits a dataset, or that a particular test suite is enough even when real users need more evidence.`,
        `Another failure is trace incompleteness. If the recorded state misses external services, timing, randomness, permissions, file-system state, or hidden tests, the transition is only partly true. A third failure is benchmark optimism. Reported coding-agent scores are full-stack measurements: model, tools, prompts, retries, verifier, timeout, and dataset all matter.`,
      ],
    },
    {
      heading: 'Why it still needs search',
      paragraphs: [
        `Execution grounding does not remove the need for planning. A model may predict what a line does and still choose the wrong file to edit. It may understand a failing assertion and still make a patch that fixes one case while breaking another. Real software work needs candidate generation, comparison, rollback, and proof that the final patch satisfies the task.`,
        `This is where search methods fit. Tree of Thoughts, Monte Carlo Tree Search, process reward models, and verifier-guided sampling all use feedback to allocate effort. CWM-style data improves the model inside that loop. It does not replace the loop.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: CWM: An Open-Weights LLM for Research on Code Generation with World Models at https://arxiv.org/abs/2510.02387 and Meta AI\'s publication page at https://ai.meta.com/research/publications/cwm-an-open-weights-llm-for-research-on-code-generation-with-world-models/. Study Verified Agent Trajectory Store, Execution Trace State Diff Case Study, Dynamic Scratchpad Execution Trace Case Study, Agent Trajectory Dedupe & Provenance Hash, Abstract Agent Operation Graph, Agent Interface Portability Audit, Tree of Thoughts Search Case Study, Monte Carlo Tree Search & UCT Primer, Process Reward Models & Verifier Search, Git Internals, Distributed Tracing, Write-Ahead Log, Evolutionary Search, and AlphaEvolve Case Study.`,
      ],
    },
      {
      heading: 'Why this exists',
      paragraphs: [
        "State the real constraint this topic fixes before introducing the mechanism.",
        "A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.",
        "Without that, every optimization appears decorative.",
      ],
    },

    {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Why it works',
      paragraphs: [
        "Give the proof sketch as a preservation argument: invariant before, move, invariant after.",
        "If there is a nontrivial corner case, name it explicitly.",
        "When correctness is explicit, readers can transfer the method to new inputs.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for code-world-models-case-study, continue to the next topic in the same track.'
  ],
      },
],
};

