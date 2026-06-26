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
    explanation: 'Zone C is not chosen because it is special. It is chosen because placing the next replica there minimizes skew and preserves the failure-domain balance invariant.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as the scheduler reducing a pending Pod to a placement decision. A Pod is a request to run one container group, a node is a machine that can run Pods, and a topology domain is a failure bucket such as a hostname or zone. Active nodes are rules or domains being evaluated, compare nodes are alternatives that remain possible, and found nodes are the chosen or rejected result.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'The Kubernetes scheduler must choose a node for each pending Pod, but capacity is not the only constraint. A service can fit on a node and still be unsafe if every replica lands in one zone, invalid if it requires a GPU node, or slow if it is far from a storage system. Affinity, anti-affinity, and topology spread constraints let operators express placement rules as labels, selectors, domain counts, filters, and scores.',
        {type:'callout', text:'Kubernetes placement is a two-phase ledger: hard rules define the feasible nodes and soft rules rank the survivors by resilience, locality, and policy.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first scheduler design is resource bin packing: discard nodes without enough CPU, memory, ports, or devices, then pick the least loaded survivor. That is reasonable because resource feasibility is easy to measure and it prevents the most obvious failure, a Pod landing where it cannot start. It works for a small cluster where all nodes are interchangeable and failure domains do not matter.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that some placement statements are correctness rules and others are preferences. Required node affinity saying linux only is a hard validity rule, while preferring the cache zone is a ranking hint. If both are hard, rollouts can get stuck during outages; if both are soft, Pods can land somewhere invalid.',
        'The second wall is that placement depends on other Pods. Pod anti-affinity asks where matching Pods already run, and topology spread asks how many matching Pods exist in each domain. Those answers change during scale-up, failure, and rollout, so the scheduler needs a live placement ledger rather than a static node table.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to split placement into a feasible set and a ranking vector. Required rules remove nodes before scoring, preferred rules keep nodes alive but change their score, and topology spread constraints add a count table over failure domains. A rule is safe only when its strength matches its meaning: correctness belongs in filtering, preference belongs in scoring.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Node affinity evaluates labels on candidate nodes, so a required term can demand `kubernetes.io/os=linux` or a GPU label before scoring begins. Pod affinity and anti-affinity evaluate labels on existing Pods inside a topology key such as `kubernetes.io/hostname` or `topology.kubernetes.io/zone`. Topology spread uses a label selector, topology key, maxSkew, and `whenUnsatisfiable` policy to simulate each candidate placement and compute the resulting domain skew.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an invariant over the candidate set. After the filter phase, every surviving node satisfies every required placement rule checked at scheduling time; after the score phase, the highest-ranked survivor is the best node under the configured preferences. For a hard topology spread constraint, a candidate is safe only if the simulated placement keeps skew within `maxSkew`; for a soft one, the score records how close it gets.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Node affinity is cheap because it mostly reads labels from each candidate node. Inter-pod affinity, anti-affinity, and topology spread cost more because the scheduler must inspect existing Pods, selectors, namespaces, and topology buckets. If candidates double from 500 to 1,000 and each rule scans broad Pod state, scheduling latency can grow with both node count and matching Pod count rather than with node count alone.',
        'The hidden cost is bad metadata. Missing zone labels, stale node labels, or selectors that count canary Pods by accident make the scheduler compute precise answers over the wrong set. Hard rules also spend availability: they can keep Pods pending during partial outages when a soft score would have allowed degraded but useful placement.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Topology spread fits stateless replicated services that should survive node or zone loss. Hard pod anti-affinity by hostname fits quorum systems that must not place two voting replicas on the same machine. Node affinity fits hardware, compliance, storage, or operating-system requirements where the wrong node is not merely slower but invalid.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when operators encode wishes as hard laws. A three-zone hard spread rule can block recovery when one zone is down and only two zones have capacity. It also fails when the topology model is false: balancing across zones does not protect a service if all zones depend on the same overloaded storage system.',
        'The rules are scheduling-time checks, not a complete runtime policy engine. The common `IgnoredDuringExecution` forms do not evict a running Pod just because labels later drift. If the world changes after placement, another controller or operator process must decide whether to repair it.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A web Deployment has replicas labeled `app=web` across three zones with counts A=3, B=2, C=1. A topology spread constraint uses `topology.kubernetes.io/zone`, selector `app=web`, and `maxSkew: 1`. Placing the next Pod in C changes counts to 3,2,2 with skew 1, while placing it in A changes counts to 4,2,1 with skew 3, so a hard rule filters A and a soft rule scores C higher.',
        'Add a hard hostname anti-affinity rule for a database with three replicas on nodes n1, n2, and n3. If n3 is drained and only n1 and n2 remain eligible, the replacement stays Pending because either placement would put two replicas on one host. That is correct for quorum safety if same-host failure is unacceptable, and wrong if temporary degraded service is better than no replacement.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Use the official Kubernetes pages on assigning Pods to nodes and topology spread constraints as the primary sources. They define node affinity, pod affinity, anti-affinity, topology keys, `maxSkew`, `DoNotSchedule`, `ScheduleAnyway`, and node inclusion policy behavior.',
        'Study scheduler filtering and scoring next, then taints and tolerations, persistent-volume topology binding, and PodDisruptionBudget behavior. Those topics show how placement rules combine with repulsion, storage locality, and voluntary disruption limits.',
      ],
    },
  ],
};