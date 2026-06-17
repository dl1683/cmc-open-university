// Nav2 behavior-tree recovery: tick navigation goals through planners,
// controllers, conditions, recovery subtrees, blackboard state, and retries.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'nav2-behavior-tree-recovery-case-study',
  title: 'Nav2 Behavior Tree Recovery Case Study',
  category: 'Systems',
  summary: 'A robot-navigation control-plane case study: behavior-tree ticks, blackboard keys, planner/controller actions, decorators, recovery branches, retry budgets, and failure evidence.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['tree ticks', 'recovery loop'], defaultValue: 'tree ticks' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function btGraph(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'root', x: 0.8, y: 3.5, note: 'tick' },
      { id: 'rate', label: 'rate', x: 2.1, y: 1.4, note: 'decor' },
      { id: 'plan', label: 'plan', x: 3.7, y: 1.4, note: 'path' },
      { id: 'follow', label: 'follow', x: 5.4, y: 1.4, note: 'ctrl' },
      { id: 'blackboard', label: 'board', x: 4.6, y: 3.5, note: 'keys' },
      { id: 'fallback', label: 'fallback', x: 2.1, y: 5.7, note: 'recover' },
      { id: 'clear', label: 'clear', x: 3.8, y: 5.7, note: 'costmap' },
      { id: 'spin', label: 'spin', x: 5.5, y: 5.7, note: 'unstuck' },
      { id: 'wait', label: 'wait', x: 7.0, y: 5.7, note: 'settle' },
      { id: 'result', label: 'result', x: 8.7, y: 3.5, note: 'status' },
    ],
    edges: [
      { id: 'e-root-rate', from: 'root', to: 'rate' },
      { id: 'e-rate-plan', from: 'rate', to: 'plan' },
      { id: 'e-plan-follow', from: 'plan', to: 'follow' },
      { id: 'e-plan-board', from: 'plan', to: 'blackboard' },
      { id: 'e-board-follow', from: 'blackboard', to: 'follow' },
      { id: 'e-root-fallback', from: 'root', to: 'fallback' },
      { id: 'e-fallback-clear', from: 'fallback', to: 'clear' },
      { id: 'e-clear-spin', from: 'clear', to: 'spin' },
      { id: 'e-spin-wait', from: 'spin', to: 'wait' },
      { id: 'e-follow-result', from: 'follow', to: 'result' },
      { id: 'e-wait-result', from: 'wait', to: 'result' },
    ],
  }, { title });
}

function retryPlot() {
  return plotState({
    axes: {
      x: { label: 'bt tick', min: 0, max: 12 },
      y: { label: 'recovery budget', min: 0, max: 4 },
    },
    series: [
      { id: 'budget', label: 'budget', points: [{ x: 0, y: 3 }, { x: 2, y: 3 }, { x: 4, y: 2 }, { x: 6, y: 2 }, { x: 8, y: 1 }, { x: 10, y: 0 }] },
      { id: 'progress', label: 'progress', points: [{ x: 0, y: 0.3 }, { x: 2, y: 0.7 }, { x: 4, y: 1.1 }, { x: 6, y: 1.9 }, { x: 8, y: 2.7 }, { x: 10, y: 3.4 }] },
    ],
    markers: [
      { id: 'fail', x: 10, y: 0, label: 'fail' },
    ],
  });
}

function* treeTicks() {
  yield {
    state: btGraph('A navigation BT ticks action and recovery branches'),
    highlight: { active: ['root', 'rate', 'plan', 'follow', 'blackboard', 'e-root-rate', 'e-rate-plan', 'e-plan-follow', 'e-plan-board', 'e-board-follow'], compare: ['fallback'] },
    explanation: 'The tree shows navigation as repeated decisions, not one long script. Each tick moves status through planner and controller nodes, while the blackboard keeps the path, goal, and action status available to the next node.',
    invariant: 'BT status is state: SUCCESS, FAILURE, and RUNNING drive the next tick.',
  };

  yield {
    state: labelMatrix(
      'Tick status table',
      [
        { id: 'cond', label: 'cond' },
        { id: 'plan', label: 'plan' },
        { id: 'follow', label: 'follow' },
        { id: 'recover', label: 'recover' },
      ],
      [
        { id: 'reads', label: 'reads' },
        { id: 'writes', label: 'writes' },
        { id: 'status', label: 'status' },
      ],
      [
        ['goal', 'ok?', 'success'],
        ['map+goal', 'path', 'success'],
        ['path', 'cmd_vel', 'running'],
        ['error', 'clear', 'idle'],
      ],
    ),
    highlight: { active: ['plan:writes', 'follow:status'], found: ['cond:status'], compare: ['recover:status'] },
    explanation: 'The table is the tree contract. A node reads named keys, writes named keys, and returns status; recovery only works when those keys make the failed planner or controller state visible.',
  };

  yield {
    state: btGraph('Decorators control when expensive nodes run'),
    highlight: { active: ['rate', 'plan', 'e-rate-plan'], found: ['follow'], compare: ['clear', 'spin'] },
    explanation: 'Decorators are cheap guards around expensive work. A rate or distance condition preserves the control-flow invariant while preventing replanning from stealing every tick.',
  };

  yield {
    state: labelMatrix(
      'BT data structures',
      [
        { id: 'xml', label: 'xml tree' },
        { id: 'board', label: 'blackboard' },
        { id: 'action', label: 'actions' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['nodes', 'bad shape'],
        ['keys', 'stale key'],
        ['goals', 'timeout'],
        ['ticks', 'no replay'],
      ],
    ),
    highlight: { active: ['xml:stores', 'board:stores', 'trace:stores'], compare: ['board:risk'] },
    explanation: 'This matrix names the evidence a real robot needs after a bad run. Node status, blackboard snapshots, action ids, and timestamps turn "navigation failed" into a replayable control trace.',
  };
}

function* recoveryLoop() {
  yield {
    state: btGraph('Recovery branches are explicit fallback logic'),
    highlight: { active: ['fallback', 'clear', 'spin', 'wait', 'e-root-fallback', 'e-fallback-clear', 'e-clear-spin', 'e-spin-wait'], compare: ['plan', 'follow'] },
    explanation: 'The highlighted branch is the fallback path, not a side effect. When planning or control fails, the tree moves into bounded recovery actions such as clearing costmaps, spinning to observe, waiting, backing up, replanning, or failing safely.',
  };

  yield {
    state: labelMatrix(
      'Recovery ladder',
      [
        { id: 'clear', label: 'clear' },
        { id: 'spin', label: 'spin' },
        { id: 'backup', label: 'backup' },
        { id: 'fail', label: 'fail' },
      ],
      [
        { id: 'trigger', label: 'trigger' },
        { id: 'goal', label: 'goal' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['stale obs', 'fresh map', 'rate'],
        ['blocked view', 'scan', 'space'],
        ['too close', 'unstuck', 'free'],
        ['budget 0', 'safe stop', 'report'],
      ],
    ),
    highlight: { active: ['clear:goal', 'spin:goal', 'backup:guard'], found: ['fail:guard'] },
    explanation: 'Each recovery row has a trigger, a goal, and a guard. That shape keeps recovery narrow: clear only stale map evidence, spin only when there is space, back up only when collision checks allow it.',
  };

  yield {
    state: retryPlot(),
    highlight: { active: ['budget', 'progress', 'fail'] },
    explanation: 'The plot compares retry budget with real progress. A healthy recovery spends budget while progress rises; if budget reaches zero without progress, the invariant changes from "keep trying" to "stop and report evidence."',
  };

  yield {
    state: labelMatrix(
      'Failure evidence',
      [
        { id: 'node', label: 'node' },
        { id: 'err', label: 'error' },
        { id: 'map', label: 'map' },
        { id: 'tf', label: 'TF' },
      ],
      [
        { id: 'record', label: 'record' },
        { id: 'debug', label: 'debug' },
      ],
      [
        ['BT path', 'where'],
        ['code', 'why'],
        ['version', 'world'],
        ['frames', 'timing'],
      ],
    ),
    highlight: { found: ['node:debug', 'err:debug', 'map:debug', 'tf:debug'] },
    explanation: 'The final table is the incident report. It separates the failing BT node, action-server error, costmap version, and TF timing so the next fix targets the real boundary that failed.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'tree ticks') yield* treeTicks();
  else if (view === 'recovery loop') yield* recoveryLoop();
  else throw new InputError('Pick a Nav2 behavior-tree view.');
}

export const article = {
  references: [
    { title: 'Nav2 Behavior Trees', url: 'https://docs.nav2.org/behavior_trees/index.html' },
    { title: 'Nav2 Behavior-Tree Navigator', url: 'https://docs.nav2.org/configuration/packages/configuring-bt-navigator.html' },
    { title: 'Nav2 Detailed Behavior Tree Walkthrough', url: 'https://docs.nav2.org/behavior_trees/overview/detailed_behavior_tree_walkthrough.html' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['Nav2 uses behavior trees to orchestrate navigation tasks. A tree ticks planner, controller, condition, decorator, and recovery nodes until the task succeeds, fails, or keeps running.', 'The data-structure view is a control tree plus blackboard. The tree defines control flow. The blackboard stores goal, path, planner id, controller id, error codes, retry counts, timeout state, and action state.'] },
    { heading: 'Why this exists', paragraphs: ['A mobile robot cannot treat navigation as one function call. Planning can fail, control can fail, the costmap can be stale, localization can drift, and a temporary obstacle can block the path. The system needs explicit recovery behavior that is narrow enough to be safe and structured enough to debug.', 'Behavior trees exist here because recovery is conditional control flow. The robot should not clear every map, spin forever, or replan blindly. It should tick a known sequence of checks and recovery actions, each with a status and a budget.'] },
    { heading: 'The obvious approach and the wall', paragraphs: ['The obvious approach is a large state machine or a script: plan path, follow path, and if something fails, run a recovery script. That works for a demonstration but becomes brittle when failures overlap or when one recovery action changes the conditions for another.', 'The wall is observability and safety. If the robot only reports "navigation failed," operators cannot tell whether the planner, controller, transform tree, costmap, obstacle layer, or recovery branch caused the failure. A recovery loop without explicit budgets can also turn a blocked aisle into endless motion.'] },
    { heading: 'The core insight', paragraphs: ['Model navigation as a ticked control tree with explicit node contracts. A sequence node requires children to succeed in order. A fallback node tries alternatives when a child fails. Decorators add retry, timeout, rate, or condition behavior. Action nodes call planners, controllers, or recovery behaviors. The blackboard carries shared state.', 'The key invariant is that every tick returns Running, Success, or Failure and every node has a narrow responsibility. That makes the recovery policy inspectable: what failed, which branch ran, what state changed, and whether another retry is still allowed.'] },
    { heading: 'What the animation teaches', paragraphs: ['The highlighted tree edges show control authority. The active branch is the work being ticked now; compared or idle nodes are available alternatives, not hidden background logic.', 'In the matrix views, rows are node contracts. A recovery system is correct when each node can explain what it read, what it wrote, which status it returned, and why the retry budget still allows another attempt.', 'The animation is not just showing a robot trying again. It is showing the evidence chain that makes a retry safe: failure reason, recovery action, updated blackboard state, and a bounded return to planning or control.'] },
    { heading: 'How it works', paragraphs: ['A root node ticks its children. Planner nodes compute paths, controller nodes follow paths, decorators limit when children run, and fallback branches run recovery behavior when a child fails.', 'The BT Navigator implements navigation task interfaces with behavior trees and gives users a way to specify complex robot behaviors, including recovery: https://docs.nav2.org/configuration/packages/configuring-bt-navigator.html.', 'Common recovery actions include clearing costmaps, spinning to refresh local perception, waiting, backing up, or replanning. Each action should be tied to a specific failure mode rather than used as a generic ritual after every failure.'] },
    { heading: 'Worked example', paragraphs: ['A warehouse robot plans a path but the local controller fails because a pallet blocks the aisle. The tree records the FollowPath failure, enters the recovery branch, clears stale obstacle cells, spins to refresh perception, waits for a costmap update, then replans. If retry budget is exhausted, the tree fails the task and reports evidence.', 'A different failure should take a different branch. If the planner cannot find a global path because the goal is outside the map, clearing the local costmap is noise. If localization confidence is poor, replanning may produce a precise-looking path from bad state. Recovery has to match the diagnosis.'] },
    { heading: 'Why it works', paragraphs: ['Behavior trees work because they make control flow compositional. The parent does not need to know every implementation detail of a child. It only needs the child status and blackboard contract. That lets teams replace a planner, controller, or recovery node without rewriting the whole navigation policy.', 'They also work because repeated ticking keeps long-running actions explicit. A controller can return Running while the robot is moving, Success when the goal is reached, or Failure when progress stops. The tree can then choose recovery rather than hiding failure inside the controller.'] },
    { heading: 'Cost and behavior', paragraphs: ['The cost is policy complexity. Every node, decorator, retry count, timeout, and blackboard key becomes part of the robot behavior. A poorly designed tree can oscillate between recovery branches, starve replanning, or mask a real hardware problem with repeated retries.', 'Tick traces, action result codes, and blackboard snapshots are therefore not optional debugging extras. They are the only way to explain why the robot moved, waited, cleared a map, backed up, or gave up.'] },
    { heading: 'Design review', paragraphs: ['Review a navigation tree by asking what each failure code means, which recovery action is allowed to respond, how often that recovery can repeat, and what evidence proves recovery helped. If the answer is "try everything," the tree is not a policy; it is a hope loop.', 'Also review blackboard ownership. Planner, controller, recovery, and condition nodes should not overwrite shared keys casually. A stale path, stale costmap timestamp, or generic error code can send the tree down the wrong branch while every individual node appears to work.'] },
    { heading: 'Data structures', paragraphs: ['The durable records are behavior-tree XML or model tree, node ids, child order, blackboard keys, action goal ids, node status, retry counts, timeout state, costmap version, TF timestamp, and tick trace.', 'A tick trace makes navigation debuggable. Without it, an operator may see only "navigation failed" instead of the exact planner, controller, or recovery node that caused the failure.'] },
    { heading: 'What students should learn', paragraphs: ['The lesson is not that behavior trees are always better than finite state machines. The lesson is that autonomy needs explicit control contracts. A planner, controller, costmap, and recovery action can each be reasonable alone and still produce unsafe behavior if the orchestration policy is vague.', 'A good curriculum should have learners inspect a failed tick trace, identify the failing node, choose a recovery branch, and explain when the robot must stop instead of trying again. That is closer to real robotics engineering than watching a path line turn green.'] },
    { heading: 'Where it wins', paragraphs: ['Behavior-tree recovery wins when a robot has several known failure modes and several bounded recovery actions. It is a good fit for warehouse aisles, service robots, and autonomous platforms where planning, control, perception, and safety checks must be coordinated.', 'It is also useful for curriculum design because it shows how autonomy is built from explicit contracts rather than vague intelligence. Students can inspect each node, status, blackboard key, and recovery budget.'] },
    { heading: 'Where it fails', paragraphs: ['Common mistakes are stale blackboard keys, recovery loops with no budget, clearing costmaps too aggressively, decorators that starve replanning, and hiding action-server errors behind generic failure labels.', 'Behavior trees are explicit control flow, not magic autonomy. They need narrow recovery actions, timeout limits, collision checks, and readable failure reports.', 'They also fail when used as a substitute for perception or planning quality. A tree can decide when to replan or recover; it cannot make a broken costmap, bad localization, or unsafe controller correct by orchestration alone.'] },
    { heading: 'Study next', paragraphs: ['Study Nav2 Costmap Inflation Layer, DWB Velocity Lattice Trajectory Critic, RRT* Motion Planning Tree, Finite State Machine, A* Search, and Occupancy Grid Log-Odds Mapping next.'] },
  ],
};
