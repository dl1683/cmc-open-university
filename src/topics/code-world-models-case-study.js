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
        'Read each frame as a comparison between static code text, execution traces, and agent trajectories. Static code shows files and tokens. An execution trace shows before state, action, after state, and verifier result. An agent trajectory extends that idea to files, commands, tests, and edits.',
        'The active cell is the signal being explained, and the found cell is the reusable asset that survives one benchmark run. The safe inference is that an action is useful supervision only when the environment state and success check are well defined. A final patch without the failing run and passing run is weaker evidence.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Code models start from text: repositories, comments, docs, diffs, issues, and patches. That teaches syntax and common repairs, but software is a running state machine. Variables change, objects alias, stack frames appear, exceptions redirect control flow, tests observe behavior, and shell commands mutate files.',
        'Code world models exist to train on those state changes directly. A world model predicts how an environment changes after an action. For code, the environment can include local variables, files, terminal output, test results, containers, dependencies, and tool responses.',
        {type:'callout', text:'Code world models matter because execution traces teach causal state transitions that static code text only implies.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is large-scale static code training. Collect repositories, accepted contest solutions, package docs, issue-to-patch pairs, and pull requests, then train the model to predict code and text. This produces useful autocomplete, explanations, boilerplate, and many simple fixes.',
        'That baseline is strong because static corpora contain real API usage, naming patterns, imports, project layout, and repair idioms. A diff often encodes a solved problem. For many tasks, the final patch is enough signal to teach a useful pattern.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is hidden state. A patch can show that "append(x[-1] + 2)" was added, but it does not show the list before the append, the value read from x[-1], the list after mutation, or which branch was skipped. The model can infer those facts, but static text does not supervise the transition itself.',
        'This matters because many bugs live in operational details. Aliasing changes one object through two names, a loop invariant can fail after the third iteration, and a shell command can change the working tree before the next command. A patch may pass visible tests and fail hidden tests, so text alone leaves the important runtime facts implicit.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make the causal triple explicit: before state, action, after state. A verifier checks whether the after state is acceptable. Without before state, the model cannot know why the action was legal; without after state, it cannot learn the effect; without verification, it cannot distinguish a plausible repair from a working one.',
        'For a Python trace, the action may be one statement and the state may be local variables. For an agent trace, the action may be reading a file, applying an edit, or running a test, while the state is the repository plus tools. The same structure applies at different scales.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A trace generator runs code under instrumentation and records selected state around each step. It may record locals, return values, exceptions, branch outcomes, stdout, stderr, and test results. The model trains on sequences that connect source context to observed consequences.',
        'An agent-data generator runs tasks in a container or sandbox. The trace records observations, file reads, edits, commands, failures, retries, and verifier results. The model sees not only the final diff but the evidence loop that produced it: inspect, hypothesize, edit, run, and check.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Execution traces work because they put the missing invariant into the data. For each recorded step, the after state must be the result of applying the action to the before state under the executor. Repeating that pressure teaches mutation, control flow, return values, and error paths more directly than static code alone.',
        'The correctness claim is modest. The model does not become a perfect interpreter. It receives training signal aligned with the actual coding-agent job: predict consequences, choose useful actions, and use verifier feedback. A patch that passes because the oracle is weak is still weak training data.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Execution-grounded data is expensive because every example needs an environment, not just a document. Container builds fail, dependencies rot, tests are flaky, instrumentation adds overhead, and traces can become huge. Doubling text tokens mostly doubles text processing, but doubling executable tasks can more than double setup, run, capture, and validation work.',
        'Suppose one repository image takes 6 minutes to build and each traced task takes 30 seconds to run. One hundred tasks cost about 56 minutes of wall-clock worker time before filtering, storage, and training. If 20 percent fail for environment reasons, the data pipeline must either repair those environments or avoid turning setup failures into model lessons.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The pattern wins where the environment gives crisp feedback. Unit-test repair, compiler-error fixing, type-error correction, runtime exception debugging, migration scripts, contest programming, and data-pipeline validation all have actions whose effects can be observed. The verifier is what turns activity into supervision.',
        'The idea can transfer outside code only when the state-action-oracle triangle survives. A simulator can expose portfolio state and trades, or robot pose and collisions. A legal workflow can expose document state and rule checks, but the oracle is weaker because judgment is not the same as a deterministic test.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the trace omits important state. Local Python variables do not capture network calls, hidden services, filesystem races, time, randomness, permissions, GPU nondeterminism, or hidden tests. A trajectory can be locally true and globally misleading.',
        'It also fails through harness overfitting. A model may learn one shell, edit command, timeout, repository layout, or patch grammar. Move it to another agent interface and the learned sequence may no longer be legal. Portability is a system property, not a benchmark score.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose makeSeries should return [1, 3] but currently returns [1, 2]. Static training may show only the final diff from "append(2)" to "append(x[-1] + 2)." A trace-grounded record first runs the failing test, records output [1, 2], applies the edit, then records passing output [1, 3].',
        'The useful numbers are small but concrete. The before state is x = [1], the bad action is append(2), the observed after state is [1, 2], and the expected after state is [1, 3]. The repaired action reads x[-1] = 1 and writes 1 + 2 = 3. The verifier passes because the output now matches the expected list.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: "CWM: An Open-Weights LLM for Research on Code Generation with World Models" (arXiv:2510.02387). Read it for the distinction between static code data, Python execution traces, agent trajectories, supervised fine-tuning, and reinforcement learning. Treat benchmark numbers as model-plus-harness results, not proof that every coding environment transfers.',
        'Study execution trace state diffs, dynamic scratchpads, verified agent trajectory stores, trajectory deduplication, process reward models, tree search, and agent interface portability next. The recurring question is whether the trace preserves enough state to make the action and verifier meaningful.',
      ],
    },
  ],
};
