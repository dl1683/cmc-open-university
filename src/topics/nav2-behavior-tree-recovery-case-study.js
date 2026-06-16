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
    explanation: 'A Nav2 behavior tree turns navigation into a ticked control graph. Planner and controller action nodes exchange path, goal, and status through the blackboard.',
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
    explanation: 'The blackboard is the shared memory of the tree. It is where the path, goal, controller id, planner id, error codes, and recovery state become explicit data.',
  };

  yield {
    state: btGraph('Decorators control when expensive nodes run'),
    highlight: { active: ['rate', 'plan', 'e-rate-plan'], found: ['follow'], compare: ['clear', 'spin'] },
    explanation: 'A distance or rate controller can keep replanning from running every tick. Decorators are small policy nodes that decide when their child is allowed to execute.',
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
    explanation: 'A production BT needs a tick trace. Without node status, blackboard snapshots, action ids, and timestamps, recovery failures are difficult to reproduce.',
  };
}

function* recoveryLoop() {
  yield {
    state: btGraph('Recovery branches are explicit fallback logic'),
    highlight: { active: ['fallback', 'clear', 'spin', 'wait', 'e-root-fallback', 'e-fallback-clear', 'e-clear-spin', 'e-spin-wait'], compare: ['plan', 'follow'] },
    explanation: 'A recovery subtree encodes what the robot should try after planning or control fails: clear costmaps, spin to observe, wait, back up, replan, or fail the task.',
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
    explanation: 'Recovery actions should be narrow and bounded. The tree needs retry counts, timeout limits, collision checks, and an explicit final failure state.',
  };

  yield {
    state: retryPlot(),
    highlight: { active: ['budget', 'progress', 'fail'] },
    explanation: 'Retry budgets prevent infinite recovery loops. Progress should rise as the robot clears obstacles or replans; if it does not, the task should fail safely with useful evidence.',
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
    explanation: 'A useful failure report says which node failed, which action server returned the error, which costmap was active, and whether transform timing made the state stale.',
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
    { heading: 'What it is', paragraphs: ['Nav2 uses behavior trees to orchestrate navigation tasks. A tree ticks planner, controller, condition, decorator, and recovery nodes until the task succeeds, fails, or keeps running.', 'The data-structure view is a control tree plus blackboard. The tree defines control flow. The blackboard stores goal, path, planner id, controller id, error codes, and action state.'] },
    { heading: 'How it works', paragraphs: ['A root node ticks its children. Planner nodes compute paths, controller nodes follow paths, decorators limit when children run, and fallback branches run recovery behavior when a child fails.', 'The BT Navigator implements navigation task interfaces with behavior trees and gives users a way to specify complex robot behaviors, including recovery: https://docs.nav2.org/configuration/packages/configuring-bt-navigator.html.'] },
    { heading: 'Complete case study', paragraphs: ['A warehouse robot plans a path but the local controller fails because a pallet blocks the aisle. The tree records the FollowPath failure, enters the recovery branch, clears stale obstacle cells, spins to refresh perception, waits for a costmap update, then replans. If retry budget is exhausted, the tree fails the task and reports evidence.', 'This is not just UI logic. The behavior tree is the safety boundary between perception, planning, control, and recovery.'] },
    { heading: 'Data structures', paragraphs: ['The durable records are behavior-tree XML or model tree, node ids, child order, blackboard keys, action goal ids, node status, retry counts, timeout state, costmap version, TF timestamp, and tick trace.', 'A tick trace makes navigation debuggable. Without it, an operator may see only "navigation failed" instead of the exact planner, controller, or recovery node that caused the failure.'] },
    { heading: 'Pitfalls', paragraphs: ['Common mistakes are stale blackboard keys, recovery loops with no budget, clearing costmaps too aggressively, decorators that starve replanning, and hiding action-server errors behind generic failure labels.', 'Behavior trees are explicit control flow, not magic autonomy. They need narrow recovery actions, timeout limits, collision checks, and readable failure reports.'] },
    { heading: 'Study next', paragraphs: ['Study Nav2 Costmap Inflation Layer, DWB Velocity Lattice Trajectory Critic, RRT* Motion Planning Tree, Finite State Machine, A* Search, and Occupancy Grid Log-Odds Mapping next.'] },
  ],
};
