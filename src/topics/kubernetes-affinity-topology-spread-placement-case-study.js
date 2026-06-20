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
      heading: 'Why this exists',
      paragraphs: [
        'A Kubernetes scheduler cannot treat every node as interchangeable. CPU and memory fit are necessary, but they do not capture failure domains, hardware needs, storage locality, latency, compliance boundaries, or the risk of putting every replica on the same host. A Pod can fit perfectly on a node and still be a bad placement.',
        'Affinity, anti-affinity, and topology spread constraints give the scheduler structured placement rules. Node affinity talks about node labels. Pod affinity and anti-affinity talk about existing Pods in topology domains. Topology spread constraints count matching Pods across domains such as hostname, zone, or region and try to keep skew bounded. The case study is useful because it turns vague placement goals into filter and score data structures.',
        {type:'callout', text:'Kubernetes placement is a two-phase ledger: hard rules define the feasible nodes and soft rules rank the survivors by resilience, locality, and policy.'},
      ],
    },
    {
      heading: 'The naive baseline',
      paragraphs: [
        'The baseline scheduler is a bin packer. For each pending Pod, filter nodes that lack enough CPU, memory, ports, or required resources. Score the survivors for utilization or balance. Bind the Pod to the best node. This is a reasonable starting point because resource feasibility is real and easy to measure.',
        'The baseline fails because production risk is correlated. Six replicas can all fit in one zone, but a zone outage then removes the whole service. Two database replicas can fit on one node, but a node reboot then loses quorum. A GPU job can fit by memory on a CPU-only node if hardware labels are not part of the filter. A cache-heavy service can land far from the cache it was designed to use. Placement needs semantic rules, not only capacity arithmetic.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that some placement rules are correctness constraints and some are preferences. "This Pod must run on Linux nodes" is not the same as "prefer a node in the same zone as the cache." If the scheduler treats both as hard rules, rollouts get stuck. If it treats both as soft rules, Pods can land somewhere invalid.',
        'The second wall is that placement depends on other Pods. Anti-affinity asks where matching Pods already run. Topology spread asks how many matching Pods are in each domain. Those answers change as Pods start, stop, crash, and roll through deployments. The scheduler needs a current ledger of existing placements, not just a static list of node capacities.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Kubernetes placement is two ledgers at once: a feasible set and a score vector. Required rules remove candidate nodes. Preferred rules keep nodes in the candidate set but change their ranking. Topology spread constraints add a count ledger over topology domains and ask whether placing the pending Pod on a candidate node would preserve an acceptable skew.',
        'This separation is the key idea. Hard affinity and hard anti-affinity express invariants that must not be violated at bind time. Soft affinity, soft anti-affinity, and ScheduleAnyway spread constraints express pressure. They can steer placement without making the Pod unschedulable during a partial outage or a small cluster expansion.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'Node affinity evaluates labels on candidate nodes. A required node affinity term filters out nodes that do not match. A preferred node affinity term contributes a weighted score. This is the cheapest form because it mostly reads node metadata. It is commonly used for operating system, architecture, GPU type, node pool, zone, compliance class, or custom hardware labels.',
        'Pod affinity and anti-affinity evaluate labels on already-running Pods and group the result by a topologyKey such as `kubernetes.io/hostname` or `topology.kubernetes.io/zone`. Pod affinity attracts the pending Pod toward domains containing matching Pods. Pod anti-affinity repels it from those domains. Required forms filter nodes; preferred forms score nodes. The `IgnoredDuringExecution` part of common rule names matters: if labels later change, Kubernetes does not automatically evict the already-running Pod just because the original scheduling rule would no longer match.',
        'Topology spread constraints start with a labelSelector, a topologyKey, a maxSkew, and a whenUnsatisfiable policy. The scheduler counts matching Pods in eligible domains, simulates placing the pending Pod on a candidate node, computes the resulting skew between domains, and either filters or scores the node. DoNotSchedule makes excessive skew a hard failure. ScheduleAnyway keeps the node feasible but scores better placements higher.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine a web Deployment with label `app=web` and three zones. The current counts are zone A: 3, zone B: 2, zone C: 1. A topology spread constraint uses topologyKey `topology.kubernetes.io/zone`, labelSelector `app=web`, maxSkew 1, and ScheduleAnyway. The next Pod should strongly prefer zone C because that placement moves the counts toward balance. Zone A may still be feasible, but it receives a worse score because it increases skew.',
        'Now make the same rule DoNotSchedule. If placing a Pod in zone A would make skew exceed maxSkew, nodes in zone A are filtered out for that Pod. This may be exactly what a critical service wants under normal capacity. During a zone outage, however, the same hard rule may prevent replacement Pods from running anywhere. The rule strength has to match the failure model and the cluster size.',
        'For a database, the team might use hard pod anti-affinity by hostname so two replicas never land on one node. It may use preferred anti-affinity by zone if the cluster sometimes has fewer available zones than replicas. It may also use node affinity for storage-optimized nodes. The scheduler combines these as filters and scores rather than as one monolithic rule.',
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        'The affinity-filter view shows a pending Pod flowing through selector rules into a hard filter and a soft score. The important distinction is feasibility versus ranking. A required rule removes a node before scoring. A preferred rule leaves the node alive and changes how attractive it is. Anti-affinity in the graph is a protection against correlated failure, not just a desire to make a diagram look balanced.',
        'The spread-scoring view shows the count ledger. Zone A, zone B, and zone C have different numbers of matching Pods. The scheduler asks what would happen to those counts if the pending Pod were placed in each domain. The chosen domain is not special by name; it is the domain that best preserves the skew invariant under the current state.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The hard-rule invariant is simple: a Pod should not be bound to a node that fails a required placement rule at scheduling time. That makes required node affinity, required pod affinity, and required pod anti-affinity part of the feasibility phase. If the rule is correct, every surviving node is valid with respect to that rule.',
        'The spread invariant is a count bound. For each topology spread constraint, the scheduler can compute domain counts before and after a candidate placement. If a hard constraint would exceed maxSkew, the candidate is removed. If a soft constraint would improve balance, the candidate gets a better score. This converts a resilience goal into ordinary scheduling data: counts, domains, filters, and scores.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Node affinity is usually cheap because it is label matching against candidate nodes. Inter-pod affinity, anti-affinity, and topology spread are more expensive because they inspect existing Pods and topology domains. Their cost grows with the number of candidate nodes, matching Pods, namespaces, selectors, and topology buckets. Large clusters need careful use of broad hard inter-pod rules.',
        'The hidden cost is label quality. Missing topology labels, inconsistent zone labels, stale node labels, or selectors that count the wrong Pods make the scheduler do precise math over bad data. If some nodes lack the topologyKey, a spread rule can produce surprising results. If the labelSelector accidentally counts old canary Pods or excludes new version Pods, the skew ledger no longer matches the intended workload.',
        'Hard rules reduce scheduling freedom. That is sometimes the point, but it can also block rollouts during outages, upgrades, or cluster scale-downs. Soft rules preserve liveness but may allow a placement that violates the operator\'s mental model. The design choice is not "affinity good" or "affinity bad"; it is whether a rule expresses correctness or preference.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Topology spread wins for stateless replicated services that should survive node or zone loss. It gives the scheduler a direct count-based target instead of hoping replicas naturally scatter. It also works well for large Deployments where exact per-replica hand placement would be fragile and too slow for operators to maintain.',
        'Affinity wins when placement has a real relationship. GPU workloads should land on GPU nodes. Storage clients may need the same zone as their volumes. Cache-heavy services may prefer nodes or zones near the cache tier. Security-sensitive Pods may require a dedicated node pool. Replicas may need anti-affinity by hostname so one node failure does not remove multiple copies.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Hard inter-pod anti-affinity can be too rigid in small or damaged clusters. If there are fewer eligible topology domains than required replicas, the last replicas may remain pending forever. Hard zone spreading can also fight autoscaling if the autoscaler cannot create capacity in the required domain quickly enough.',
        'Topology spread fails when the topology model is wrong. A balanced count across zones does not help if all zones depend on one shared storage system or one overloaded network device. A balanced count across the wrong labelSelector is not reliability; it is clean-looking bad data. Placement rules protect only the failure domains they actually encode.',
        'It can also fail after scheduling. Many rules are checked when the Pod is placed, not continuously enforced by eviction. If labels drift, topology changes, or other Pods are deleted, already-running Pods may no longer match the placement shape an operator expects. Scheduling constraints are not a complete runtime policy engine.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Common failures include Pods stuck Pending because required affinity has no matching nodes, hard anti-affinity blocking a rollout, topology spread counting the wrong Pods, nodes missing the topologyKey, taints interacting with spread counts in unexpected ways, and preferred rules being ignored because stronger scoring plugins or resource pressure dominate the final score.',
        'Debugging should follow the scheduler pipeline. First ask whether a node was filtered and by which rule. Then ask how surviving nodes were scored. Then inspect the labels on nodes and Pods that feed the selectors. Finally check whether the topology domains in the rule match the real failure domains the service cares about.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Kubernetes assigning Pods to nodes at https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/ and Kubernetes topology spread constraints at https://kubernetes.io/docs/concepts/scheduling-eviction/topology-spread-constraints/.',
        'Study Kubernetes Scheduler PriorityQueue & Preemption for the scheduling loop, Kubernetes Taints and Tolerations Node Pool for repulsion, Kubernetes PV/PVC Storage Binding for topology-aware storage, Sparse Set and Filtered Vector Search Bitset for feasible-set filtering, Bin Packing First Fit Decreasing for the resource baseline, and Graph BFS for reasoning about topology domains.',
      ],
    },
  ],
};
