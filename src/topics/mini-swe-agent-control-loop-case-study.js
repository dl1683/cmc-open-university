// mini-SWE-agent as an architecture lesson: a small loop can be strong when
// environment, tool grammar, transcript, and verifier contracts are clean.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'mini-swe-agent-control-loop-case-study',
  title: 'mini-SWE-agent Control Loop Case Study',
  category: 'AI & ML',
  summary: 'mini-SWE-agent as a minimal-scaffold lesson: model call, environment step, observation ledger, budget policy, and verifier gate can carry a surprising amount of agent behavior.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['minimal loop', 'scaffold ledger'], defaultValue: 'minimal loop' },
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

function loopGraph(title) {
  return graphState({
    nodes: [
      { id: 'issue', label: 'issue', x: 0.6, y: 3.3, note: 'task' },
      { id: 'prompt', label: 'prompt', x: 2.0, y: 3.3, note: 'state' },
      { id: 'model', label: 'model', x: 3.5, y: 2.0, note: 'next' },
      { id: 'action', label: 'action', x: 5.0, y: 2.0, note: 'tool' },
      { id: 'env', label: 'env', x: 6.5, y: 3.3, note: 'step' },
      { id: 'obs', label: 'obs', x: 5.0, y: 4.8, note: 'stdout' },
      { id: 'budget', label: 'budget', x: 3.5, y: 4.8, note: 'turns' },
      { id: 'final', label: 'final', x: 8.2, y: 2.0, note: 'patch' },
      { id: 'score', label: 'score', x: 8.2, y: 4.8, note: 'test' },
    ],
    edges: [
      { id: 'e-issue-prompt', from: 'issue', to: 'prompt' },
      { id: 'e-prompt-model', from: 'prompt', to: 'model' },
      { id: 'e-model-action', from: 'model', to: 'action' },
      { id: 'e-action-env', from: 'action', to: 'env' },
      { id: 'e-env-obs', from: 'env', to: 'obs' },
      { id: 'e-obs-budget', from: 'obs', to: 'budget' },
      { id: 'e-budget-prompt', from: 'budget', to: 'prompt', weight: 'loop' },
      { id: 'e-env-final', from: 'env', to: 'final' },
      { id: 'e-final-score', from: 'final', to: 'score' },
    ],
  }, { title });
}

function* minimalLoop() {
  yield {
    state: loopGraph('A minimal coding-agent control loop'),
    highlight: { active: ['issue', 'prompt', 'model', 'action', 'env', 'obs', 'budget', 'e-issue-prompt', 'e-prompt-model', 'e-model-action', 'e-action-env', 'e-env-obs', 'e-obs-budget', 'e-budget-prompt'], found: ['final', 'score'] },
    explanation: 'mini-SWE-agent is a useful architecture lesson because the control loop is small: build a prompt from state, ask the model for an action, execute in an environment, append observation, enforce budget, and repeat.',
    invariant: 'Small scaffold does not mean absent scaffold.',
  };

  yield {
    state: labelMatrix(
      'Loop state fields',
      [
        { id: 'msg', label: 'msg' },
        { id: 'tool', label: 'tool' },
        { id: 'cwd', label: 'cwd' },
        { id: 'diff', label: 'diff' },
        { id: 'cost', label: 'cost' },
        { id: 'stop', label: 'stop' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['history', 'context', 'bloat'],
        ['schema', 'parse', 'drift'],
        ['path', 'state', 'lost'],
        ['patch', 'score', 'bad'],
        ['cost', 'budget', 'loop'],
        ['done?', 'submit', 'early'],
      ],
    ),
    highlight: { active: ['msg:field', 'tool:field', 'diff:field', 'cost:field'], found: ['stop:risk'], compare: ['cwd:risk'] },
    explanation: 'Even a tiny agent has a state vector. If history, tool schema, working directory, current diff, cost, and stop condition are not explicit, debugging becomes guesswork.',
  };

  yield {
    state: loopGraph('Observation is the feedback channel'),
    highlight: { active: ['action', 'env', 'obs', 'budget', 'prompt', 'e-action-env', 'e-env-obs', 'e-obs-budget', 'e-budget-prompt'], compare: ['model'], found: ['score'] },
    explanation: 'The observation text is where the environment teaches the next step: command output, test failure, file contents, patch status, and policy errors. Compressing or dropping it changes the agent.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'scaffold complexity', min: 0, max: 10 }, y: { label: 'agent utility, conceptual', min: 0, max: 100 } },
      series: [
        { id: 'curve', label: 'useful scaffold', points: [{ x: 1, y: 20 }, { x: 2, y: 55 }, { x: 3, y: 68 }, { x: 5, y: 74 }, { x: 8, y: 73 }, { x: 10, y: 69 }] },
      ],
      markers: [
        { id: 'mini', x: 2.5, y: 66, label: 'mini' },
        { id: 'heavy', x: 8, y: 73, label: 'heavy' },
      ],
    }),
    highlight: { active: ['curve', 'mini'], compare: ['heavy'] },
    explanation: 'The lesson is not that every extra component is bad. It is that clear environment contracts, action parsing, and verifier loops can matter more than a large pile of planning machinery.',
  };
}

function* scaffoldLedger() {
  yield {
    state: loopGraph('Minimal scaffold still needs a ledger'),
    highlight: { active: ['prompt', 'model', 'action', 'env', 'obs', 'final', 'score', 'e-model-action', 'e-action-env', 'e-env-obs', 'e-env-final', 'e-final-score'], found: ['budget'] },
    explanation: 'A compact implementation can still write a rich trace: messages, actions, environment outputs, costs, final patch, and verifier result. Simplicity should not mean no evidence.',
  };

  yield {
    state: labelMatrix(
      'Scaffold responsibilities',
      [
        { id: 'parse', label: 'parse' },
        { id: 'exec', label: 'exec' },
        { id: 'obs', label: 'obs' },
        { id: 'limit', label: 'limit' },
        { id: 'score', label: 'score' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'must', label: 'must' },
      ],
      [
        ['read action', 'reject bad'],
        ['run tool', 'sandbox'],
        ['return out', 'normalize'],
        ['cap spend', 'stop'],
        ['run tests', 'prove'],
      ],
    ),
    highlight: { active: ['parse:must', 'exec:must', 'obs:must', 'limit:must', 'score:must'] },
    explanation: 'The scaffold owns the boundary conditions: parse actions, execute tools safely, normalize observations, cap budgets, and prove final patches. The model should not be trusted to self-police those contracts.',
  };

  yield {
    state: labelMatrix(
      'Complete case: tiny loop on SWE task',
      [
        { id: 'a', label: 'read' },
        { id: 'b', label: 'edit' },
        { id: 'c', label: 'test' },
        { id: 'd', label: 'retry' },
        { id: 'e', label: 'final' },
      ],
      [
        { id: 'obs', label: 'obs' },
        { id: 'state', label: 'state' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['files', 'hyp', 'trace'],
        ['diff', 'patch', 'hash'],
        ['fail', 'bug', 'log'],
        ['fix', 'loop', 'cost'],
        ['pass', 'done', 'score'],
      ],
    ),
    highlight: { active: ['a:proof', 'b:proof', 'c:proof', 'd:proof', 'e:proof'], found: ['e:obs', 'e:state'] },
    explanation: 'A small scaffold reads files, applies a patch, runs tests, observes failure, retries once, and submits the passing diff. The control loop is short, but the evidence chain is complete.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'turn', min: 0, max: 8 }, y: { label: 'remaining budget, illustrative percent', min: 0, max: 100 } },
      series: [
        { id: 'budget', label: 'budget', points: [{ x: 0, y: 100 }, { x: 1, y: 89 }, { x: 2, y: 75 }, { x: 3, y: 58 }, { x: 4, y: 44 }, { x: 5, y: 25 }, { x: 6, y: 12 }] },
      ],
      markers: [
        { id: 'test', x: 4, y: 44, label: 'test' },
        { id: 'stop', x: 6, y: 12, label: 'stop' },
      ],
    }),
    highlight: { active: ['budget', 'test', 'stop'] },
    explanation: 'Budget is part of the agent state. A minimal loop should know when test evidence is strong enough and when another retry is too expensive.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'minimal loop') yield* minimalLoop();
  else if (view === 'scaffold ledger') yield* scaffoldLedger();
  else throw new InputError('Pick a mini-SWE-agent view.');
}

export const article = {
  sections: [
    {
      heading: 'What this case study is really about',
      paragraphs: [
        'mini-SWE-agent is valuable because it strips a coding agent down to the loop that actually changes the world: build context, ask the model for an action, execute that action, record the observation, update the budget, and repeat until a verifier or stop condition ends the run.',
        'That makes it a good teaching object. Many agent systems bury the same loop under planners, memories, reflection prompts, dashboards, and routing layers. Those extras may help, but this case study asks a sharper question: which contracts must exist before any of those extras matter?',
        'The answer is not "just call the model." A small agent still needs a tool grammar, an environment boundary, a transcript, a current-diff record, a cost counter, a stop rule, and a verifier. Without those pieces, the agent cannot be debugged, compared, or trusted.',
      ],
    },
    {
      heading: 'The obvious approaches and why both fail',
      paragraphs: [
        'One naive approach is to build a large agent scaffold immediately: planner, critic, retriever, memory store, summarizer, task router, patch repair loop, and custom dashboard. The system may improve, but you no longer know which part caused the improvement. The architecture becomes a fog machine.',
        'The opposite naive approach is a single model call that writes a patch from the issue text. That is too weak for real software work because code repair is not static completion. The agent needs to inspect files, run commands, observe failures, and revise its hypothesis.',
        'The practical wall is boundary discipline. If the tool output is inconsistent, if malformed actions are accepted, if the working directory is implicit, if failed commands are summarized away, or if the final verifier is vague, the model may appear irrational when the scaffold is the part losing state.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A minimal loop can be strong when the contracts are explicit. The model proposes the next action, but the scaffold owns the boundary conditions: parsing, rejection of invalid actions, safe execution, observation capture, budget accounting, and final proof.',
        'The transcript is the central data structure. It is not just chat history. It should record messages, tool calls, working directory, command output, file reads, patch state, errors, cost, stop reason, and verifier result. That trace is what lets a human or benchmark replay the run and diagnose what happened.',
        'This is why "minimal" is not the same as "underspecified." A small loop with a clean transcript is often more educational than a large agent with hidden state.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the minimal-loop view, follow the cycle from issue to prompt to model to action to environment to observation and back into the prompt. The important move is not the arrow into the model. It is the arrow back from the environment. That feedback is what turns a language model into an agent that can repair a mistaken hypothesis.',
        'In the scaffold-ledger view, read each table row as a contract the scaffold must keep even when the model is confused. The parser rejects malformed actions. The executor controls the environment. The observation normalizer returns usable evidence. The limiter prevents runaway spend. The scorer proves whether the final patch actually works.',
        'The animation is showing where responsibility belongs. The model chooses; the scaffold checks, records, and constrains.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A run begins with a task and an environment. The scaffold builds a prompt from instructions, current state, and the transcript. The model emits one action in a known grammar. The scaffold parses that action, executes it in the environment, captures stdout, stderr, exit status, file changes, and policy errors, then appends the observation to the transcript.',
        'On the next turn, the model sees the new evidence. If a test fails, the failure becomes part of the next hypothesis. If a file read disproves the guessed API shape, the model can adjust. If the patch is complete, the model submits and the verifier runs.',
        'The stop condition matters. A good loop can stop because tests pass, because a maximum turn or cost budget was reached, because the model submitted a final answer, or because the environment produced an unrecoverable error. Each stop reason means something different when evaluating the agent.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because software tasks expose evidence. The repository can be searched. Files can be read. Tests can be run. Diffs can be inspected. A minimal loop lets the model use those evidence channels without requiring a complex planning system.',
        'It also works as a baseline. If a larger agent beats the small loop, the comparison becomes meaningful only when the loop is clean. Then you can ask what the added component contributed: better retrieval, better edit grammar, better search over patches, better memory, better verifier feedback, or better budget allocation.',
        'The hidden lesson is measurement. A minimal agent with a faithful trace is easier to benchmark than a sprawling one. You can count turns, tool calls, token cost, failure mode, final patch size, and verifier result.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine a bug report says a parser crashes on empty input. A weak one-shot system guesses the fix from the issue title. A looped agent searches for the parser, reads the input path, runs the failing test, sees the stack trace, edits the guard condition, reruns the focused test, then submits the diff.',
        'The transcript is the proof object. It shows which files were read, which command failed, which patch was applied, and which verifier passed afterward. If the run fails, the trace can show whether the model misunderstood the code, the tool grammar hid the failure, the test command was wrong, or the budget cut the repair short.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost of a minimal loop is that every boundary has to be good. Bad observation compression can remove the one error line the next turn needs. A loose edit grammar can create patches that do not apply. Missing verifier proof can make a wrong final answer look successful. Unclear stop rules can waste money or stop one turn before the fix.',
        'Budget is not an accounting afterthought. It changes behavior. A loop that can afford one read, one patch, and one test behaves differently from a loop that can explore three hypotheses. Serious comparisons should name the model, environment, tools, max turns, cost cap, verifier, and benchmark split.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The minimal loop wins as a baseline, teaching tool, and debugging benchmark runner. It is the right first system when you want to understand whether a benchmark is being solved by model ability, environment access, test feedback, tool grammar, or scaffolding.',
        'It also helps portability work. If the same loop succeeds in one environment and fails in another, the smaller surface makes it easier to find the changed contract: shell behavior, file visibility, patch application, timeout policy, or test command.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the task requires long-horizon planning, wide repository search, persistent project memory, multiple independent hypotheses, human approval, or coordination across several services. A short loop can only represent so much state before the transcript becomes too large or too noisy.',
        'It also fails as a benchmark claim if the surrounding system is not named. Small source code can hide a large external surface: curated prompts, powerful shell access, privileged tests, benchmark-specific hints, replayed demonstrations, or manual cleanup. The article-worthy lesson is to audit the whole control plane, not just the loop body.',
      ],
    },
    {
      heading: 'What to build after the minimal loop',
      paragraphs: [
        'Add architecture only when the trace shows the need. If the loop keeps reading the wrong files, add retrieval or repository maps. If it repeats failed edits, add patch history and rejection memory. If it cannot choose among hypotheses, add search or a critic. If it submits unverified work, strengthen the verifier gate.',
        'This keeps the system honest. Each added component should answer a failure found in the minimal loop, not decorate the agent with a fashionable pattern.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: mini-SWE-agent at https://github.com/SWE-agent/mini-swe-agent, SWE-agent docs at https://swe-agent.com/latest/, SWE-agent paper at https://arxiv.org/abs/2405.15793, SWE-bench official site at https://www.swebench.com/, and CWM at https://arxiv.org/abs/2510.02387.',
        'Study Agentic AI Patterns: Planning, Tools, Memory, Abstract Agent Operation Graph, Coding Agent Edit Grammar Adapter Case Study, the agent-portability audit module, Terminal-Bench Long-Horizon Agent Case Study, and Process Reward Models & Verifier Search next.',
      ],
    },
  ],
};
