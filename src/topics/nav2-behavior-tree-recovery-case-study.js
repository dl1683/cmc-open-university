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
  sections: [
    { heading: 'How to read the animation', paragraphs: ['Read the tree as a control policy, not as a picture of intent. A behavior tree is a rooted tree where each tick asks a node to return Running, Success, or Failure.', 'The active branch is the work being ticked now. The blackboard is shared state for goal, path, error code, retry count, and timestamps, so a recovery action is safe only when it reads current evidence.', {type:'callout', text:'A behavior tree makes robot recovery inspectable by giving every planner, controller, condition, and recovery action a tick status, blackboard contract, and retry budget.'}, {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/2/27/BT_search_and_grasp.svg', alt:'Behavior tree diagram for a robot search and grasp task.', caption:'A behavior tree models robot tasks as control-flow nodes and action leaves with explicit success, failure, or running status. Source: Wikimedia Commons, Aliekor, CC BY-SA 3.0'}] },
    { heading: 'Why this exists', paragraphs: ['A robot navigation stack has planners, controllers, costmaps, localization, and recovery actions. Each component can be reasonable alone while the robot still behaves badly after a blocked aisle or stale map.', 'Nav2 uses behavior trees so recovery is explicit control flow. The tree says which failure leads to clearing a costmap, backing up, waiting, replanning, or giving up.'] },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is a finite state machine with states such as plan, follow, recover, and done. It works for a small demo because every transition can be drawn and reviewed.', 'A second approach is to let each action handle its own failure internally. That keeps the tree small, but it hides why the robot retried, which state changed, and when the system should stop.'] },
    { heading: 'The wall', paragraphs: ['The wall is combinatorial failure. A planner failure, controller timeout, stale transform, obstacle mark, localization issue, and exhausted retry budget need different responses even though the user only sees navigation failed.', 'A flat state machine tends to grow crossings between every state and every recovery. Hidden local retries are worse because the operator cannot explain whether the robot is recovering or looping.'] },
    { heading: 'The core insight', paragraphs: ['A behavior tree composes recovery from small nodes with a common status contract. Parent nodes decide order and fallback, while child nodes expose only Running, Success, Failure, and blackboard effects.', 'That contract makes recovery auditable. The tree can show that FollowPath failed, ClearCostmap ran once, Spin updated perception, and Replan got a new path before control resumed.'] },
    { heading: 'How it works', paragraphs: ['The root ticks its children at a regular cadence. Sequence nodes require each child to succeed, fallback nodes try alternatives after failure, decorators add constraints such as retry limit or timeout, and action nodes call Nav2 servers.', 'The blackboard carries the goal, path, planner id, controller id, recovery count, and result codes. A recovery branch should update or validate one of those facts before returning to planning or control.'] },
    { heading: 'Why it works', paragraphs: ['The correctness argument is status preservation. If every node truthfully returns Running, Success, or Failure and writes only its declared blackboard keys, the parent can make the same decision each tick from inspectable state.', 'Bounded recovery makes the policy safe to stop. A retry decorator with limit 2 can prove that the robot will not clear the same costmap forever after a persistent obstacle blocks the route.'] },
    { heading: 'Cost and complexity', paragraphs: ['The runtime tick cost is usually small compared with planning and control, but policy cost grows with nodes and blackboard contracts. A tree with 40 nodes and 10 shared keys creates hundreds of possible read-write interactions to test.', 'The operational cost is trace quality. Without tick logs, action result codes, and blackboard snapshots, recovery behavior becomes harder to debug than the planner it was meant to coordinate.'] },
    { heading: 'Real-world uses', paragraphs: ['Behavior-tree recovery fits warehouse robots, service robots, and delivery platforms where known failures need bounded responses. It is useful when the system has several recovery actions and each action has a narrow cause.', 'It also fits simulation and curriculum work because learners can replay a failed tick trace. They can see the exact node that failed instead of treating autonomy as a single opaque block.'] },
    { heading: 'Where it fails', paragraphs: ['A behavior tree fails when it becomes a hope loop. If every failure runs every recovery action until luck changes, the tree is no longer a policy.', 'It also fails when blackboard keys are stale or too generic. A node that writes error = failed removes the diagnosis that the next branch needed to choose a safe recovery.'] },
    { heading: 'Worked example', paragraphs: ['A warehouse robot has retry limit 2 and a 10 Hz tick rate. FollowPath fails at tick 1, the tree clears the local costmap in 0.4 seconds, spins for 1.0 second to refresh lidar, and replans in 0.2 seconds.', 'If the second FollowPath attempt succeeds, the recovery branch cost about 1.6 seconds and one retry budget unit. If it fails twice more with the same blocked-aisle code, the tree returns Failure instead of sending the robot into an unbounded retry cycle.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources are the Nav2 BT Navigator documentation, Nav2 behavior tree plugin documentation, and BehaviorTree.CPP documentation. Read the action-node and recovery-node docs beside actual tick traces.', 'Study finite state machines, A* search, costmap inflation, occupancy grids, recovery policies, and model predictive control next. The key skill is mapping a failure code to the smallest recovery action that can actually change the state.'] },
  ],
};