// Kubernetes affinity and topology spread: selectors, topology domains, hard
// filters, and soft scores shape where Pods land.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-affinity-topology-spread-placement-case-study',
  title: 'Kubernetes Affinity and Topology Spread Placement Case Study',
  category: 'Systems',
  summary: 'How node affinity, pod affinity, pod anti-affinity, topologyKey, maxSkew, whenUnsatisfiable, and scheduler scoring shape resilient placement.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['affinity filters', 'spread scoring'], defaultValue: 'affinity filters' },
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

function placementGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'pod', label: 'Pod', x: 0.7, y: 3.8, note: notes.pod ?? 'pending' },
      { id: 'rules', label: 'rules', x: 2.3, y: 3.8, note: notes.rules ?? 'selectors' },
      { id: 'zoneA', label: 'zone A', x: 4.2, y: 2.1, note: notes.zoneA ?? '2 pods' },
      { id: 'zoneB', label: 'zone B', x: 4.2, y: 3.8, note: notes.zoneB ?? '1 pod' },
      { id: 'zoneC', label: 'zone C', x: 4.2, y: 5.5, note: notes.zoneC ?? '0 pods' },
      { id: 'filter', label: 'filter', x: 6.3, y: 2.8, note: notes.filter ?? 'hard' },
      { id: 'score', label: 'score', x: 6.3, y: 4.8, note: notes.score ?? 'soft' },
      { id: 'bind', label: 'bind', x: 8.5, y: 3.8, note: notes.bind ?? 'zone C' },
    ],
    edges: [
      { id: 'e-pod-rules', from: 'pod', to: 'rules' },
      { id: 'e-rules-zoneA', from: 'rules', to: 'zoneA' },
      { id: 'e-rules-zoneB', from: 'rules', to: 'zoneB' },
      { id: 'e-rules-zoneC', from: 'rules', to: 'zoneC' },
      { id: 'e-zoneA-filter', from: 'zoneA', to: 'filter' },
      { id: 'e-zoneB-filter', from: 'zoneB', to: 'filter' },
      { id: 'e-zoneC-score', from: 'zoneC', to: 'score' },
      { id: 'e-filter-bind', from: 'filter', to: 'bind' },
      { id: 'e-score-bind', from: 'score', to: 'bind' },
    ],
  }, { title });
}

function* affinityFilters() {
  yield {
    state: placementGraph('Affinity rules constrain the feasible node set'),
    highlight: { active: ['pod', 'rules', 'filter', 'e-pod-rules'], compare: ['score'] },
    explanation: 'Affinity and anti-affinity are selector rules evaluated against node labels or existing Pod labels. Required rules filter nodes. Preferred rules score nodes.',
    invariant: 'Hard affinity changes feasibility; soft affinity changes ranking.',
  };

  yield {
    state: labelMatrix(
      'Affinity forms',
      [
        { id: 'node', label: 'node' },
        { id: 'pod', label: 'pod' },
        { id: 'anti', label: 'anti' },
        { id: 'soft', label: 'soft' },
      ],
      [
        { id: 'reads', label: 'reads' },
        { id: 'job', label: 'job' },
      ],
      [
        ['labels', 'place'],
        ['pods', 'co-loc'],
        ['pods', 'apart'],
        ['weight', 'rank'],
      ],
    ),
    highlight: { active: ['node:job', 'pod:job', 'anti:job'], found: ['soft:job'] },
    explanation: 'Node affinity reads node labels. Pod affinity and anti-affinity read existing Pods within a topology domain. Preferred terms add weighted scores instead of blocking the node outright.',
  };

  yield {
    state: placementGraph('Anti-affinity can protect replicas from same-node failure', { rules: 'anti app=x', zoneA: 'has x', zoneB: 'empty', bind: 'zone B' }),
    highlight: { active: ['rules', 'zoneA', 'zoneB', 'filter', 'bind', 'e-zoneB-filter'], compare: ['zoneC'] },
    explanation: 'Anti-affinity is a replica placement guard. It can prevent replicas from sharing a hostname, rack, or zone, but hard anti-affinity is expensive and needs consistent topology labels.',
  };

  yield {
    state: labelMatrix(
      'Large-cluster cost',
      [
        { id: 'hard', label: 'hard' },
        { id: 'soft', label: 'soft' },
        { id: 'label', label: 'label' },
        { id: 'cache', label: 'cache' },
      ],
      [
        { id: 'gain', label: 'gain' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['safe', 'slow'],
        ['nudge', 'drift'],
        ['domain', 'miss'],
        ['fast', 'stale'],
      ],
    ),
    highlight: { active: ['hard:risk', 'label:risk'], compare: ['soft:gain'] },
    explanation: 'Inter-pod affinity and anti-affinity require looking at existing Pods across topology domains. The Kubernetes docs warn that this processing can slow scheduling in large clusters.',
  };
}

function* spreadScoring() {
  yield {
    state: placementGraph('Topology spread balances counts across domains'),
    highlight: { active: ['zoneA', 'zoneB', 'zoneC', 'score', 'bind', 'e-zoneC-score'], compare: ['filter'] },
    explanation: 'Topology spread constraints count matching Pods per topology domain and try to keep skew under maxSkew. The target is balanced failure-domain occupancy, not just any feasible node.',
  };

  yield {
    state: labelMatrix(
      'Spread fields',
      [
        { id: 'topo', label: 'topo' },
        { id: 'skew', label: 'skew' },
        { id: 'unsat', label: 'unsat' },
        { id: 'sel', label: 'sel' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['domain', 'bad key'],
        ['limit', 'tight'],
        ['block/rank', 'stuck'],
        ['count', 'wrong set'],
      ],
    ),
    highlight: { active: ['topo:role', 'skew:role', 'unsat:role'], found: ['sel:risk'] },
    explanation: 'The field set is compact: topologyKey defines the buckets, labelSelector defines the counted Pods, maxSkew defines tolerance, and whenUnsatisfiable chooses hard blocking or soft scoring.',
  };

  yield {
    state: placementGraph('Node inclusion policies decide which domains count', { rules: 'spread', zoneA: 'taint?', zoneB: 'aff ok', zoneC: 'best' }),
    highlight: { active: ['rules', 'zoneA', 'zoneB', 'zoneC', 'score'], found: ['bind'] },
    explanation: 'Topology spread interacts with taints and node affinity. Node inclusion policies decide whether tainted or affinity-excluded nodes are counted in the skew calculation.',
  };

  yield {
    state: labelMatrix(
      'Complete case: web replicas',
      [
        { id: 'a', label: 'zone A' },
        { id: 'b', label: 'zone B' },
        { id: 'c', label: 'zone C' },
        { id: 'next', label: 'next' },
      ],
      [
        { id: 'count', label: 'cnt' },
        { id: 'move', label: 'move' },
      ],
      [
        ['3', 'avoid'],
        ['2', 'maybe'],
        ['1', 'pick'],
        ['C', 'skew ok'],
      ],
    ),
    highlight: { active: ['c:move', 'next:move'], compare: ['a:move'] },
    explanation: 'If three replicas already run in zone A, two in zone B, and one in zone C, the next replica should usually prefer zone C. That is the topology-spread ledger made visible.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'affinity filters') yield* affinityFilters();
  else if (view === 'spread scoring') yield* spreadScoring();
  else throw new InputError('Pick a Kubernetes affinity/topology view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Kubernetes placement is more than CPU and memory bin packing. Affinity rules attract or repel Pods based on node labels and already-running Pods. Topology spread constraints count matching Pods across domains such as hostname, zone, or region and try to keep skew bounded.',
        'The official assigning Pods to nodes page explains node affinity, inter-pod affinity, anti-affinity, required versus preferred rules, and warns that inter-pod affinity can slow scheduling in large clusters: https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/. The topology spread constraints page describes topologyKey, maxSkew, whenUnsatisfiable, nodeAffinityPolicy, nodeTaintsPolicy, and the logical AND behavior across multiple constraints: https://kubernetes.io/docs/concepts/scheduling-eviction/topology-spread-constraints/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The scheduler is building a feasible set and a score vector. Required node affinity and required pod affinity or anti-affinity remove nodes. Preferred terms add weighted scores. Topology spread creates bucket counts by topology domain, then compares the candidate placement against maxSkew. The resulting data structure is a per-node ledger of filter reasons and score components.',
        'Topology labels are part of correctness. If some nodes are missing the topologyKey, a hard anti-affinity or spread rule can produce surprising placements. If the selector counts the wrong Pods, the skew calculation looks precise while measuring the wrong set.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A web service wants replicas across zones. It uses topology.kubernetes.io/zone as topologyKey, labelSelector app=web, maxSkew=1, and ScheduleAnyway for soft spreading during partial outages. It also uses hard node affinity for Linux nodes and soft anti-affinity against replicas on the same hostname. The scheduler filters out impossible nodes, scores the rest, and chooses the domain that improves skew without violating other constraints.',
        'For a stateful database, the team might use hard anti-affinity by hostname to prevent two replicas on the same node, but avoid hard zone anti-affinity in a small cluster where it can deadlock rollouts. The rule strength should match the actual failure model and cluster size.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Kubernetes Scheduler PriorityQueue & Preemption for the plugin loop, Kubernetes Taints and Tolerations Node Pool for repulsion, Kubernetes PV/PVC Storage Binding for topology-aware storage, Sparse Set and Filtered Vector Search Bitset for feasible-set filtering, and Graph BFS for reasoning about topology domains.',
      ],
    },
  ],
};
