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
        'Read each frame as a comparison between three learning surfaces: static code, execution traces, and agent trajectories. The active cell is the signal being explained. The found cell is the system asset that survives beyond one benchmark result.',
        'In the execution-grounding view, rows are kinds of training data and columns are what the model can observe, learn, and still miss. In the portability view, rows are system boundaries that change when an agent leaves the training harness.',
        {
          type: 'note',
          text: 'The animation is not saying traces are magic. It is showing a contract: an action is only useful supervision when the before state, after state, and verifier are all well defined.',
        },
        'At each frame, ask one question: what state transition became visible that a static code corpus would have forced the model to infer indirectly?',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Most code models start with text. They see files, comments, imports, diffs, issue descriptions, and patches. That teaches syntax and many repair patterns, but software is not only a sequence of tokens. A program is a state machine: variables change, heap objects alias, stack frames appear, exceptions redirect control flow, tests observe behavior, and shell commands mutate files.',
        'Meta CWM is a useful case study because it turns that distinction into a training system. The paper describes a 32B open-weights coding model mid-trained on observation-action trajectories from Python interpreter traces and agentic Docker environments, then post-trained with reasoning and reinforcement learning in verifiable tasks. The reported model is still a transformer language model, but the supervision is closer to "predict the next state" than plain "predict the next token."',
        {
          type: 'quote',
          attribution: 'FAIR CodeGen team, CWM paper, 2025',
          text: 'what code does when executed',
        },
        'That short phrase is the whole educational point. If a learner understands CWM only as another benchmark table, they miss the reusable design pattern: when a domain has state, actions, and an oracle, the best data often records the transition process rather than only the final answer.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is large-scale static code training. Collect repositories, package docs, issues, commits, pull requests, accepted contest solutions, failing tests, and final patches. Train the model to predict code and text. This works well enough to produce useful autocomplete, code explanation, boilerplate generation, and many simple bug fixes.',
        'It is not a foolish baseline. Static corpora contain real style, API usage, naming conventions, common data structures, project layout, and repair idioms. A diff often encodes a solved problem: one version failed, the next version passed. For many tasks, that final patch is enough signal.',
        {
          type: 'bullets',
          items: [
            'Static code teaches what valid code looks like.',
            'Diffs teach common edit shapes.',
            'Issue-to-patch pairs teach coarse task intent.',
            'Documentation teaches names and expected API behavior.',
            'None of those directly records each runtime state change.',
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is hidden state. A static patch can show that "append(x[-1] + 2)" was added, but it does not show the intermediate list before the append, the value read from x[-1], the new list after mutation, or which branch was skipped. The model can guess those facts from patterns, but it is not being supervised on the machine transition itself.',
        'This matters most in code because many bugs live in operational details. Aliasing changes one object through two names. A loop invariant fails only after the third iteration. A try block catches one exception but leaks another. A shell command changes the working tree before the next command runs. A patch passes one visible test and fails a hidden one. Text alone leaves all of that as implied structure.',
        {
          type: 'table',
          headers: ['Training signal', 'What it exposes', 'What remains weak'],
          rows: [
            ['Static repository text', 'Syntax, idioms, imports, naming, local context', 'Runtime state, branch outcomes, mutation effects'],
            ['Issue-to-patch diff', 'Task wording and final repair shape', 'Why the old behavior failed and which evidence proved the fix'],
            ['Python execution trace', 'Line-level before/action/after state', 'Long-horizon planning and non-Python environments'],
            ['Agent trajectory', 'Read, edit, run, fail, retry, verify loop', 'Portability across tools, shells, edit grammars, and oracles'],
          ],
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'CWM treats code as a world-modeling problem. A world model predicts how an environment changes after an action. For code, the environment includes local variables, stack frames, files, terminal output, tests, containers, dependencies, and tool responses. The action can be a Python statement, a shell command, a file edit, or a submitted patch.',
        'The invariant is simple: a useful trace preserves a causal triple. There is a before state, an action chosen under that state, and an after state checked by an executor or oracle. If any side is missing, the supervision becomes weaker. Without before state, the model cannot know what preconditions made the action legal. Without after state, it cannot learn the effect. Without verification, it cannot distinguish a plausible repair from a working one.',
        {
          type: 'diagram',
          alt: 'Execution-grounded training converts code into before-action-after trajectories checked by a verifier.',
          label: 'Execution grounding as a data structure',
          body: '  static corpus\n      |\n      v\n  source context\n      |\n      v\n  before state  --action-->  after state\n      |                         |\n      +--------- verifier -------+\n                  |\n                  v\n        trusted trajectory record\n\nA training example is valuable when the record can be replayed\nor checked well enough to preserve this causal chain.',
          text: '  static corpus\n      |\n      v\n  source context\n      |\n      v\n  before state  --action-->  after state\n      |                         |\n      +--------- verifier -------+\n                  |\n                  v\n        trusted trajectory record\n\nA training example is valuable when the record can be replayed\nor checked well enough to preserve this causal chain.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The paper describes two important mid-training signals. The first is Python execution tracing: actions are Python statements, and observations include local-variable state around those statements. The second is ForagerAgent data: an agent interacts with Dockerized software environments through file views, edits, and shell-like commands. Both turn software work into observation-action sequences.',
        'A minimal trace can be expressed as structured records. The model sees source context plus a sequence of state transitions. It can learn that "append" mutates an existing list, that "return" ends the frame, and that an exception interrupts the normal path. Those are not comments about code; they are executable consequences.',
        {
          type: 'code',
          language: 'javascript',
          body: "const trace = [\n  {\n    before: { x: [] },\n    action: 'x.append(1)',\n    after: { x: [1] },\n    event: 'line'\n  },\n  {\n    before: { x: [1] },\n    action: 'x.append(x[x.length - 1] + 2)',\n    after: { x: [1, 3] },\n    event: 'line'\n  },\n  {\n    before: { x: [1, 3] },\n    action: 'return x',\n    after: { result: [1, 3] },\n    event: 'return'\n  }\n];",
          text: "const trace = [\n  {\n    before: { x: [] },\n    action: 'x.append(1)',\n    after: { x: [1] },\n    event: 'line'\n  },\n  {\n    before: { x: [1] },\n    action: 'x.append(x[x.length - 1] + 2)',\n    after: { x: [1, 3] },\n    event: 'line'\n  },\n  {\n    before: { x: [1, 3] },\n    action: 'return x',\n    after: { result: [1, 3] },\n    event: 'return'\n  }\n];",
        },
        'Agent trajectories add another scale. The state is no longer one stack frame; it is the repository plus tools. The action might be "open this file," "run this test," or "apply this patch." The observation might be a compiler error, failed assertion, lint output, diff, or passing test. That teaches the repair loop: inspect evidence, make a hypothesis, change code, and check the result.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Execution traces work because they put the missing invariant into the data. For each recorded step, the after state must be the result of applying the action to the before state under the executor. The model is trained against that operational rule thousands or millions of times, so it gets direct pressure to represent mutation, control flow, return values, and error paths.',
        'Agent trajectories work for the same reason at a larger boundary. A good trajectory connects a task to a sequence of evidence-producing operations. Running tests is not decoration; it is the oracle that tells the system whether the current patch satisfies the task. File reads are not context stuffing; they decide which state the next edit is conditioned on.',
        'The correctness argument is not that the model becomes a perfect interpreter. It is that the training objective aligns better with the actual job. A coding agent must predict consequences: if I edit this branch condition, which tests change? If I run this command, what evidence will I get? If I choose this patch, what new failure might appear? Trace data supervises those consequence predictions more directly than final text alone.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Execution-grounded data is expensive because every example needs an environment, not just a document. The paper reports building executable repository images, tracing Python programs, collecting agent interactions, filtering data, and training across pre-training, mid-training, supervised fine-tuning, and RL. The cost drivers are container build reliability, dependency rot, instrumentation overhead, trace storage, duplicate filtering, and verifier quality.',
        {
          type: 'table',
          headers: ['Asset', 'Cost driver', 'Failure if neglected'],
          rows: [
            ['Executable repository image', 'Dependencies, system packages, CI assumptions', 'Tasks fail before the model can learn anything useful'],
            ['Trace instrumentation', 'Capturing enough state without huge logs', 'Transitions become incomplete or too expensive to store'],
            ['Oracle or test suite', 'Flakiness, coverage gaps, hidden behavior', 'Bad patches look successful'],
            ['Trajectory dedupe', 'Near-identical command and edit sequences', 'The model memorizes rituals instead of operations'],
            ['Refresh pipeline', 'Repos, dependencies, and benchmarks change', 'Training data becomes stale or benchmark-specific'],
          ],
        },
        'When input size doubles, text-only training mostly doubles tokens. Execution-grounded training can more than double work because setup, execution, trace capture, and validation also scale. One repository can produce many traces, but each trace inherits the fragility of the environment that generated it.',
        {
          type: 'note',
          text: 'The scarce data structure is not "a trace." It is a replayable, licensed, deduplicated, verified trajectory whose state boundary is clear enough to teach the intended operation.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The CWM pattern wins when the environment gives crisp feedback. Unit-test repair, compiler-error fixing, type-error correction, runtime exception debugging, contest programming, data-pipeline validation, migration scripts, and benchmark optimization all have an executor and a reasonably objective success signal.',
        'The same idea transfers outside code only when the state/action/oracle triangle survives. A financial simulator can expose portfolio state, trades, and backtest results. A robotics simulator can expose pose, action, collision, and task completion. A legal workflow can expose document state and rule checks, but the oracle is weaker because legal judgment is not the same as passing a deterministic test.',
        {
          type: 'bullets',
          items: [
            'Use execution grounding when actions have observable effects.',
            'Use it when failures can be replayed.',
            'Use it when the oracle is cheaper than human review.',
            'Use it when static examples hide the state transition that matters.',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The first tax is portability. A model can learn the habits of one harness: a particular shell, edit command, timeout, repository layout, test runner, or patch format. Move it to a new agent interface and the learned sequence may no longer be legal. That is why the animation highlights tool restrictions, edit grammar, and harness changes as system failures rather than minor deployment details.',
        'The second tax is incomplete state. Python local variables do not capture global services, filesystem races, network calls, randomness, permissions, clock time, GPU nondeterminism, or hidden tests. A trajectory that omits those dependencies may be locally true and globally misleading.',
        'The third tax is benchmark optimism. The reported CWM numbers are model-plus-system measurements: prompts, tools, test-time scaling, verifier, dataset, and timeout all matter. A benchmark score can show that an execution-grounded agent loop works under one contract; it does not prove the same behavior will transfer to every software organization.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a task says: "fix makeSeries so it returns [1, 3]." Static code shows only a candidate function. A trace-grounded agent records the failing behavior before it edits anything.',
        {
          type: 'diagram',
          alt: 'A failing function is repaired by preserving each observed state transition through a test oracle.',
          label: 'From failure to verified repair',
          body: '  task: makeSeries() should return [1, 3]\n\n  run test\n    before: source has x.append(2)\n    after:  observed [1, 2]\n    oracle: fail, expected [1, 3]\n\n  edit\n    action: replace 2 with x[-1] + 2\n\n  run test\n    before: patched source\n    after:  observed [1, 3]\n    oracle: pass\n\nThe useful record is the whole chain, not just the final diff.',
          text: '  task: makeSeries() should return [1, 3]\n\n  run test\n    before: source has x.append(2)\n    after:  observed [1, 2]\n    oracle: fail, expected [1, 3]\n\n  edit\n    action: replace 2 with x[-1] + 2\n\n  run test\n    before: patched source\n    after:  observed [1, 3]\n    oracle: pass\n\nThe useful record is the whole chain, not just the final diff.',
        },
        'The lesson is not that this toy bug is hard. The lesson is the shape of the record. The failing run proves the old behavior. The edit names the intervention. The passing run proves the new behavior under the same oracle. A verifier factory tries to create this shape at repository scale.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: "CWM: An Open-Weights LLM for Research on Code Generation with World Models" (arXiv:2510.02387). The paper reports CWM as a dense 32B decoder-only model, trained with context up to 131k tokens, mid-trained on Python execution traces and agentic Docker-environment trajectories, and evaluated on coding and reasoning benchmarks including SWE-bench Verified and LiveCodeBench.',
        'Study next by role. For data provenance, read Verified Agent Trajectory Store and Agent Trajectory Dedupe & Provenance Hash. For the state representation, read Execution Trace State Diff Case Study and Dynamic Scratchpad Execution Trace Case Study. For planning around the model, read Tree of Thoughts Search Case Study, Monte Carlo Tree Search & UCT Primer, and Process Reward Models & Verifier Search. For portability, read Abstract Agent Operation Graph and Agent Interface Portability Audit.',
      ],
    },
  ],
};

