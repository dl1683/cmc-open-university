// Kubernetes node-pressure eviction: the kubelet watches local resource signals,
// reclaims node resources, then evicts Pods when starvation risk crosses policy.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-node-pressure-eviction-signal-case-study',
  title: 'Kubernetes Node Pressure Eviction Signal Case Study',
  category: 'Systems',
  summary: 'How kubelet monitors memory, disk, imagefs, containerfs, inodes, soft and hard thresholds, local reclaim, QoS, priority, and replacement after eviction.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['signal ladder', 'eviction choice'], defaultValue: 'signal ladder' },
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

function evictionGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'kubelet', label: 'kubelet', x: 0.7, y: 3.8, note: notes.kubelet ?? 'monitor' },
      { id: 'mem', label: 'mem', x: 2.4, y: 2.0, note: notes.mem ?? 'avail' },
      { id: 'disk', label: 'disk', x: 2.4, y: 3.8, note: notes.disk ?? 'space' },
      { id: 'inode', label: 'inode', x: 2.4, y: 5.6, note: notes.inode ?? 'files' },
      { id: 'reclaim', label: 'reclaim', x: 4.5, y: 3.0, note: notes.reclaim ?? 'images' },
      { id: 'rank', label: 'rank', x: 4.5, y: 4.9, note: notes.rank ?? 'victims' },
      { id: 'podA', label: 'pod A', x: 6.6, y: 2.2, note: notes.podA ?? 'Burst' },
      { id: 'podB', label: 'pod B', x: 6.6, y: 4.0, note: notes.podB ?? 'Best' },
      { id: 'ctrl', label: 'ctrl', x: 8.5, y: 3.1, note: notes.ctrl ?? 'replace' },
      { id: 'sched', label: 'sched', x: 8.5, y: 5.1, note: notes.sched ?? 'resched' },
    ],
    edges: [
      { id: 'e-k-mem', from: 'kubelet', to: 'mem' },
      { id: 'e-k-disk', from: 'kubelet', to: 'disk' },
      { id: 'e-k-inode', from: 'kubelet', to: 'inode' },
      { id: 'e-mem-reclaim', from: 'mem', to: 'reclaim' },
      { id: 'e-disk-reclaim', from: 'disk', to: 'reclaim' },
      { id: 'e-reclaim-rank', from: 'reclaim', to: 'rank' },
      { id: 'e-rank-podA', from: 'rank', to: 'podA' },
      { id: 'e-rank-podB', from: 'rank', to: 'podB' },
      { id: 'e-podB-ctrl', from: 'podB', to: 'ctrl' },
      { id: 'e-ctrl-sched', from: 'ctrl', to: 'sched' },
    ],
  }, { title });
}

function* signalLadder() {
  yield {
    state: evictionGraph('The kubelet watches local pressure signals'),
    highlight: { active: ['kubelet', 'mem', 'disk', 'inode', 'e-k-mem', 'e-k-disk', 'e-k-inode'], compare: ['rank'] },
    explanation: 'Node-pressure eviction is local. The kubelet monitors node resources such as memory, disk space, and inodes and acts before the node starves.',
    invariant: 'Eviction is a kubelet survival mechanism, not a voluntary disruption budget flow.',
  };

  yield {
    state: labelMatrix(
      'Signals',
      [
        { id: 'mem', label: 'mem' },
        { id: 'nodefs', label: 'nodefs' },
        { id: 'imagefs', label: 'imgfs' },
        { id: 'inode', label: 'inode' },
      ],
      [
        { id: 'watch', label: 'watch' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['avail', 'OOM'],
        ['bytes', 'write'],
        ['bytes', 'pull'],
        ['free', 'create'],
      ],
    ),
    highlight: { active: ['mem:watch', 'nodefs:watch', 'inode:watch'], found: ['imagefs:risk'] },
    explanation: 'The signals are resource-specific. A node can be fine on memory while failing image pulls because imagefs is full, or fail file creation because inodes are exhausted.',
  };

  yield {
    state: evictionGraph('Kubelet tries node-level reclaim before evicting Pods', { reclaim: 'GC images', rank: 'if still bad' }),
    highlight: { active: ['reclaim', 'rank', 'e-reclaim-rank'], found: ['disk'] },
    explanation: 'Before evicting end-user Pods, kubelet tries reclaim such as deleting unused images when disk pressure is the issue. If pressure remains, it ranks Pods for eviction.',
  };

  yield {
    state: labelMatrix(
      'Threshold policy',
      [
        { id: 'soft', label: 'soft' },
        { id: 'hard', label: 'hard' },
        { id: 'grace', label: 'grace' },
        { id: 'poll', label: 'poll' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['warn', 'delay'],
        ['stop', '0s'],
        ['bound', 'late'],
        ['sample', 'miss'],
      ],
    ),
    highlight: { active: ['soft:job', 'hard:job', 'grace:job'], compare: ['poll:risk'] },
    explanation: 'Soft thresholds allow a grace period. Hard thresholds act immediately. The exact policy changes how much time a Pod has after the node crosses danger levels.',
  };
}

function* evictionChoice() {
  yield {
    state: evictionGraph('When reclaim fails, kubelet ranks victim Pods', { rank: 'choose', podA: 'keep?', podB: 'evict' }),
    highlight: { active: ['rank', 'podB', 'e-rank-podB'], compare: ['podA'] },
    explanation: 'The kubelet is choosing the cheapest Pod loss that relieves the breached local resource. Requests, QoS, priority, and actual usage decide which eviction best preserves node survival.',
  };

  yield {
    state: labelMatrix(
      'Victim ledger',
      [
        { id: 'qos', label: 'QoS' },
        { id: 'req', label: 'req' },
        { id: 'use', label: 'use' },
        { id: 'prio', label: 'prio' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['protect', 'Best'],
        ['right', 'zero'],
        ['low', 'spike'],
        ['high', 'abuse'],
      ],
    ),
    highlight: { active: ['qos:helps', 'req:helps', 'prio:helps'], compare: ['use:risk'] },
    explanation: 'Good requests are eviction hygiene. A workload with no requests is easier to classify as expendable under pressure, and bursty usage can make it the cheapest way to save the node.',
  };

  yield {
    state: evictionGraph('Evicted Pods become Failed and controllers replace them', { podB: 'Failed', ctrl: 'new pod', sched: 'elsewhere' }),
    highlight: { active: ['podB', 'ctrl', 'sched', 'e-podB-ctrl', 'e-ctrl-sched'], found: ['rank'] },
    explanation: 'During node-pressure eviction, selected Pods are failed and terminated. If a Deployment or StatefulSet owns them, the control plane creates replacements that re-enter scheduling.',
  };

  yield {
    state: labelMatrix(
      'Complete case: imagefs full',
      [
        { id: 'sig', label: 'sig' },
        { id: 'gc', label: 'GC' },
        { id: 'evict', label: 'evict' },
        { id: 'fix', label: 'fix' },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['imgfs', 'watch'],
        ['images', 'first'],
        ['batch', 'last'],
        ['quota', 'root'],
      ],
    ),
    highlight: { active: ['sig:event', 'gc:lesson', 'evict:event'], found: ['fix:lesson'] },
    explanation: 'If imagefs fills, kubelet first removes unused images. If pressure stays above threshold, it evicts lower-value Pods. The durable fix is right-sized disk, image cleanup, requests, and workload admission controls.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'signal ladder') yield* signalLadder();
  else if (view === 'eviction choice') yield* evictionChoice();
  else throw new InputError('Pick a Kubernetes node-pressure eviction view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Kubernetes scheduling is an admission decision, not a permanent guarantee that the node will stay healthy. The scheduler places Pods using requests, node capacity, taints, affinity, and other cluster-level constraints. After placement, the kubelet lives with actual memory use, actual writable layers, actual logs, actual local volumes, actual image storage, and actual inode creation on one machine.',
        'Node-pressure eviction exists because local resources fail locally. A cluster may have spare capacity somewhere else while one node is unable to allocate memory, pull an image, write a log, create a file, or keep node daemons alive. If the kubelet waits until the operating system kills a random process or disk writes fail, the failure is late, blunt, and harder for the control plane to explain.',
        'The official Kubernetes node-pressure eviction documentation describes a local kubelet loop that monitors signals, compares them with thresholds, attempts node-level reclaim, and evicts Pods if reclaim cannot restore safety: https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/. The disruptions documentation treats these as involuntary disruptions; PodDisruptionBudgets can mitigate voluntary maintenance, but they do not prevent unavoidable node failures: https://kubernetes.io/docs/concepts/workloads/pods/disruptions/.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A reasonable first design is to trust the scheduler and the operating system. The scheduler can avoid placing too many requested CPUs and too much requested memory on one node. The operating system already has an OOM killer, filesystem accounting, page reclaim, and process-level failure behavior. For small clusters with well-behaved workloads, this can appear to work.',
        'Operators also try overprovisioning: larger disks, more memory, lower bin-packing density, and broad safety margins. That reduces incidents, but it does not define which workload should lose capacity first when a node still gets into trouble. It also does not explain why a Pod was killed or how much resource must be reclaimed before the node is safe again.',
        'Manual cleanup is another tempting answer. Delete old images, restart noisy Pods, drain the node, and move traffic away. Manual cleanup is useful during an incident, but the kubelet needs an automatic loop because pressure can arrive faster than an operator can diagnose it.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the gap between requested resources and real local pressure. A Pod can request little memory and then burst. A container can write more logs than expected. Repeated deploys can leave image storage near a threshold. Many small files can exhaust inodes while byte capacity still looks fine. The scheduler cannot fix these after the Pod is already running.',
        'Operating-system failure is also the wrong abstraction. An OOM kill chooses a process, not a Kubernetes workload intent. A disk-full error hits whichever write arrives next, not necessarily the workload creating the most pressure. Node daemons such as kubelet, container runtime, logging, and network agents also need reserved resources; if they fail, the node stops being manageable.',
        'The kubelet needs a policy that turns raw measurements into Kubernetes decisions. It must know which signal is breached, whether a grace period applies, what can be reclaimed without evicting a Pod, which Pod loss is most defensible, and how to report the result so controllers can replace failed work.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Node-pressure eviction is a signal ladder. The kubelet observes resource signals such as memory availability, filesystem bytes, filesystem inodes, and process IDs. It compares those signals with soft or hard thresholds. If a threshold is crossed, it tries local reclaim when reclaim can help. If pressure remains, it ranks Pods and evicts enough work to protect node stability.',
        'The invariant is simple: preserve the node before preserving any single non-critical Pod. That does not mean evictions are harmless. It means the kubelet treats some Pod loss as less damaging than letting memory pressure, disk pressure, inode starvation, or PID starvation take down the node and its daemons.',
        'The key design move is that eviction follows the breached resource. Memory pressure should remove memory pressure. Disk pressure should reclaim the relevant filesystem. Inode pressure should prefer decisions that restore inode headroom. A generic "kill a Pod" rule would be easy to implement but weak; the useful policy is resource-specific.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The kubelet samples eviction signals at its monitoring interval. Memory pressure uses a calculation of memory available to the node and cgroup hierarchy rather than a naive host-level free-memory number. Filesystem signals are separated by layout: nodefs for the main node filesystem, imagefs for image layers when separated, and containerfs for writable container layers in runtimes and Kubernetes versions that support the split. Inodes have their own signals because a filesystem can have bytes free but no file entries left.',
        'Each signal is compared with configured thresholds. A hard threshold means the kubelet acts immediately when the measured value crosses the line. A soft threshold means the signal must stay bad for a grace period before eviction. This distinction matters because short spikes and sustained starvation should not be treated the same way.',
        'Before evicting end-user Pods, the kubelet tries node-level reclaim. For disk pressure, that may mean garbage collecting dead Pods and containers or deleting unused images, depending on which filesystem is pressured. This is the cheapest path because it can restore headroom without terminating live application work.',
        'If reclaim does not bring the signal below the threshold, the kubelet chooses victim Pods. Kubernetes documentation describes the ordering in terms of whether usage exceeds requests, Pod priority, and usage relative to requests. QoS class is often a useful summary because it is derived from requests and limits, but the documentation is explicit that QoS class itself is not the direct sorting key for all resources. For inodes and PIDs, there are no requests, so relative priority dominates.',
        'An evicted Pod is terminated and reported as Failed. A controller such as a Deployment, ReplicaSet, StatefulSet, Job, or DaemonSet may create replacement work. That replacement returns to normal scheduling; it is not guaranteed to land on the same node, and it still has to pull images, start containers, and pass readiness before capacity returns.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is not a mathematical proof of optimal placement. It is a survival invariant. At every stage, the kubelet must either recover the resource directly or remove work according to a ranking that is tied to the resource under pressure. If it cannot do either, the node remains at risk and may fall back to lower-level operating-system failure.',
        'Requests make the ranking more defensible. A Pod that uses much more than it requested has consumed unreserved headroom. Under pressure, evicting that Pod preserves the expectation that workloads closer to their requests should be safer. Priority adds a second ordering signal: critical workloads should survive before low-priority batch work when both contribute to pressure.',
        'The reclaim-before-evict rule is what keeps the policy from being needlessly destructive. If deleting unused images restores imagefs headroom, no live Pod needs to die. If dead container logs or writable layers can be garbage collected, eviction can be avoided. Eviction is the last local mechanism before arbitrary resource failure, not the first cleanup tool.',
        'The control-plane handoff also matters. Marking the Pod Failed gives higher-level controllers a clear event to react to. A silent process kill would leave more ambiguity. Kubernetes cannot promise that the replacement is instant, but it can keep the workload controller model intact after the local node decision.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a node with a separate imagefs. A deployment wave has pulled many large images. Some old images are unused, but several running Pods still reference large image layers. The kubelet samples imagefs.available and sees it below the hard threshold. The node can still serve existing traffic, but new image pulls are at risk and the node is close to disk starvation.',
        'The kubelet first deletes unused images. If the signal returns above threshold, the incident ends without Pod eviction. If the signal stays bad, the kubelet must rank Pods whose removal can reduce the pressure. The exact ranking depends on the filesystem layout. With imagefs and containerfs split, image storage and writable layer pressure are treated differently because they reclaim different bytes.',
        'Suppose a low-priority batch Pod has a large writable layer and weak requests, while a high-priority service Pod is close to its request. Under the documented ranking, the batch Pod is a better victim. The kubelet terminates it, records an eviction event, marks the Pod Failed, and the owning Job can retry later. The service keeps running, and the node has a chance to recover before image pulls or daemons fail.',
        'The root cause is still not solved by the eviction itself. The durable fix may be image garbage collection settings, disk sizing, ephemeral-storage requests and limits, namespace quotas, log rotation, admission controls for large images, or moving batch work to nodes with different risk tolerance.',
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The signal-ladder view shows the kubelet as a local controller. The useful thing to notice is the order of responsibility: observe memory, disk, and inode signals; compare those signals with policy; try reclaim; then rank victims only if the signal still threatens the node.',
        'The eviction-choice view shows that victim selection is not a moral judgment about an application. It is a constrained local decision. A Pod becomes a good victim when removing it is likely to relieve the breached resource while preserving higher-priority or better-reserved work.',
        'The replacement nodes in the diagram are deliberately separated from eviction. Kubelet evicts locally; workload controllers and the scheduler handle replacement globally. Confusing those two loops leads to bad debugging. The kubelet can create the failure signal, but it cannot promise that cluster capacity, image pulls, readiness, and placement will all succeed immediately afterward.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The steady-state monitoring cost is small: each kubelet samples local signals and updates node conditions. The incident cost is much larger. Eviction can terminate useful work, lose warm caches, drop in-flight requests, trigger retries, start image pulls, and create a burst of scheduling and controller activity.',
        'Soft thresholds trade responsiveness for stability. They avoid killing Pods for short-lived spikes, but they can wait too long if pressure rises quickly. Hard thresholds trade stability for survival. They can protect the node quickly, but they can also shorten application grace and surprise operators who expected a gentler failure path.',
        'Minimum reclaim settings change how aggressively the kubelet tries to move away from the threshold. Without enough reclaim margin, the node can oscillate: reclaim a little, cross the threshold again, evict another Pod, and repeat. With too much margin, the kubelet may remove more work than needed during a brief incident.',
        'The ranking quality depends on honest resource modeling. If many Pods omit realistic requests, the kubelet has less information. If everything is high priority, priority no longer separates critical work from expendable work. If system-reserved and kube-reserved are too small, node daemons can create pressure that application Pods then pay for.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Node-pressure eviction is the right tool when local scarcity is real and immediate. Memory pressure, imagefs exhaustion, nodefs exhaustion, containerfs exhaustion, inode starvation, and PID starvation are not abstract cluster states. They are local conditions that can break the node before a central scheduler loop can repair anything.',
        'It is especially useful in mixed clusters that run services, batch jobs, controllers, and DaemonSets together. Priority and requests let operators express which work should survive first. Batch work can be retried; critical node services and user-facing replicas often deserve stronger protection.',
        'It also creates a useful incident ledger. A good event trail can show the signal, threshold, reclaim attempt, selected Pod, and replacement path. That turns "the node killed my Pod" into a more precise question: which resource crossed policy, why was reclaim insufficient, and why did this Pod rank as the best victim?',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Eviction is not capacity planning. If image storage is always near full, if logs are unbounded, if ephemeral-storage requests are absent, or if nodes are undersized, kubelet will keep choosing victims. The incident may look automatic, but the system is still spending application availability to cover a design gap.',
        'Eviction is not a voluntary disruption workflow. A PodDisruptionBudget can protect against many API-initiated evictions, but it cannot veto unavoidable local node pressure. That surprises teams that treat PDBs as a universal availability shield.',
        'Eviction can also fail to act before the operating system does. Kubernetes documents that rapid memory growth can outrun the kubelet polling loop, causing the OOM killer to respond first. In that case, a container may be killed and restarted according to restartPolicy instead of the whole Pod being evicted through the kubelet policy path.',
        'The hardest failure mode is misleading safety. A high-priority Pod can still be evicted if the node must preserve itself and no better victim remains. A Guaranteed Pod is strongly protected against another Pod consuming memory, but it is not protected from every possible node-level pressure source, daemon misreservation, PID starvation, or hardware failure.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Kubernetes Priority and Preemption for scheduler-side scarcity, PodDisruptionBudget for voluntary eviction, ResourceQuota and LimitRange for namespace admission controls, kube-reserved and system-reserved for node-daemon headroom, and Linux memory reclaim for the lower-level mechanism underneath memory pressure.',
        'For the broader pattern, compare node-pressure eviction with load shedding, circuit breakers, backpressure, and admission control. All of them choose controlled loss before uncontrolled failure. The difference is the resource boundary: Kubernetes node-pressure eviction protects one worker node, while the others usually protect a service, queue, or request path.',
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
          'If your predicted final state matches the animation for kubernetes-node-pressure-eviction-signal-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
