// Hierarchical heavy hitters: report heavy aggregates over a prefix hierarchy.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'hierarchical-heavy-hitters-prefix-sketch',
  title: 'Hierarchical Heavy Hitters: Prefix Sketch',
  category: 'Data Structures',
  summary: 'Find dominant IP prefixes or category rollups by combining stream summaries with a hierarchy and subtracting already-reported descendants.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['prefix hierarchy', 'ddos case study'], defaultValue: 'prefix hierarchy' },
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

function prefixTree(title) {
  return graphState({
    nodes: [
      { id: 'root', label: '0/0', x: 5.0, y: 6.8, note: 'all' },
      { id: 'n10', label: '10/8', x: 3.0, y: 5.4, note: '42%' },
      { id: 'n192', label: '192/8', x: 7.0, y: 5.4, note: '18%' },
      { id: 'n104', label: '10.4/16', x: 2.0, y: 3.9, note: '30%' },
      { id: 'n109', label: '10.9/16', x: 4.3, y: 3.9, note: '12%' },
      { id: 'n1047', label: '10.4.7', x: 1.1, y: 2.3, note: '/24 24%' },
      { id: 'host', label: 'host', x: 0.7, y: 0.9, note: '17%' },
      { id: 'spread', label: '10.4.8', x: 3.1, y: 2.3, note: '/24 6%' },
      { id: 'n1922', label: '192.2', x: 7.0, y: 3.9, note: '/16 8%' },
    ],
    edges: [
      { id: 'e-root-10', from: 'root', to: 'n10', weight: '' },
      { id: 'e-root-192', from: 'root', to: 'n192', weight: '' },
      { id: 'e-10-104', from: 'n10', to: 'n104', weight: '' },
      { id: 'e-10-109', from: 'n10', to: 'n109', weight: '' },
      { id: 'e-104-1047', from: 'n104', to: 'n1047', weight: '' },
      { id: 'e-104-spread', from: 'n104', to: 'spread', weight: '' },
      { id: 'e-1047-host', from: 'n1047', to: 'host', weight: '' },
      { id: 'e-192-1922', from: 'n192', to: 'n1922', weight: '' },
    ],
  }, { title });
}

function updateGraph(title) {
  return graphState({
    nodes: [
      { id: 'packet', label: 'packet', x: 0.6, y: 3.5, note: 'src IP' },
      { id: 'prefixes', label: 'prefixes', x: 2.5, y: 3.5, note: '/8 /16 /24' },
      { id: 'sketches', label: 'sketches', x: 4.7, y: 3.5, note: 'per level' },
      { id: 'subtract', label: 'subtract', x: 6.9, y: 3.5, note: 'children' },
      { id: 'report', label: 'report', x: 8.9, y: 3.5, note: 'HHH' },
    ],
    edges: [
      { id: 'e-packet-prefixes', from: 'packet', to: 'prefixes', weight: '' },
      { id: 'e-prefixes-sketches', from: 'prefixes', to: 'sketches', weight: '' },
      { id: 'e-sketches-subtract', from: 'sketches', to: 'subtract', weight: '' },
      { id: 'e-subtract-report', from: 'subtract', to: 'report', weight: '' },
    ],
  }, { title });
}

function* prefixHierarchy() {
  const prefixLevels = ['/8', '/16', '/24', 'host'];
  const treeNodes = 9;
  const threshold = 15; // percent

  yield {
    state: prefixTree('Heavy traffic can hide at many prefix levels'),
    highlight: { active: ['n10', 'n104', 'n1047'], found: ['host'] },
    explanation: `A flat heavy-hitter summary finds individual keys. Network operators often need aggregates across ${prefixLevels.length} levels (${prefixLevels.join(', ')}). Hierarchical heavy hitters search a ${treeNodes}-node tree of prefixes and report the levels that remain heavy after accounting for heavy descendants.`,
    invariant: `A prefix can be heavy because one child is heavy, or because many children collectively exceed the ${threshold}% threshold.`,
  };

  yield {
    state: updateGraph('Each packet updates the prefixes on its path'),
    highlight: { active: ['packet', 'prefixes', 'sketches', 'e-packet-prefixes', 'e-prefixes-sketches'], found: ['report'] },
    explanation: `For source IP 10.4.7.9, the stream contributes to all ${prefixLevels.length} levels: 10${prefixLevels[0]}, 10.4${prefixLevels[1]}, 10.4.7${prefixLevels[2]}, and the ${prefixLevels[3]} leaf. Implementations can keep exact counters or sketches at each level, depending on traffic volume and memory.`,
  };

  yield {
    state: labelMatrix(
      'Residual rule: subtract reported descendants',
      [
        { id: 'root', label: '0/0' },
        { id: 'n10', label: '10/8' },
        { id: 'n104', label: '10.4/16' },
        { id: 'n1047', label: '10.4.7/24' },
        { id: 'host', label: '10.4.7.9' },
      ],
      [
        { id: 'raw', label: 'raw' },
        { id: 'child', label: 'child HHH' },
        { id: 'resid', label: 'resid' },
        { id: 'report', label: 'report?' },
      ],
      [
        ['100%', '42%', '58%', 'no'],
        ['42%', '30%', '12%', 'maybe'],
        ['30%', '24%', '6%', 'no'],
        ['24%', '17%', '7%', 'maybe'],
        ['17%', '0%', '17%', 'yes'],
      ],
    ),
    highlight: { active: ['n1047:raw', 'n1047:child', 'n1047:resid'], found: ['host:report'] },
    explanation: `The residual count prevents double-reporting across ${prefixLevels.length} levels. If the host (17%) is already reported as heavy above ${threshold}%, its traffic is subtracted from ancestors when deciding whether the ancestor is independently heavy. The reported set becomes a concise explanation of where the mass really sits.`,
  };

  yield {
    state: labelMatrix(
      'Hierarchy choices',
      [
        { id: 'ip', label: 'IP prefixes' },
        { id: 'url', label: 'URL paths' },
        { id: 'geo', label: 'geo tree' },
        { id: 'org', label: 'org chart' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'action', label: 'action' },
      ],
      [
        ['who sends bytes?', 'rate limit'],
        ['which path hot?', 'cache/index'],
        ['where spike?', 'route traffic'],
        ['which team?', 'page owner'],
      ],
    ),
    highlight: { found: ['ip:action', 'url:action'], compare: ['org:question'] },
    explanation: `The structure is not limited to IP addresses. Any tree-shaped rollup across ${prefixLevels.length} or more levels can use the same idea: track candidate mass, subtract heavy descendants above the ${threshold}% threshold, and report the smallest useful explanation.`,
  };
}

function* ddosCaseStudy() {
  const ddosStages = ['routers', 'synopsis', 'HHH', 'NOC', 'ACL'];
  const attackTypes = ['one source', 'many /24', 'one customer', 'global rise'];

  yield {
    state: graphState({
      nodes: [
        { id: 'routers', label: 'routers', x: 0.7, y: 3.5, note: 'packets' },
        { id: 'syn', label: 'synopsis', x: 2.7, y: 3.5, note: 'sketches' },
        { id: 'hh', label: 'HHH', x: 4.8, y: 3.5, note: 'prefixes' },
        { id: 'noc', label: 'NOC', x: 6.8, y: 3.5, note: 'explain' },
        { id: 'acl', label: 'ACL', x: 8.8, y: 3.5, note: 'mitigate' },
      ],
      edges: [
        { id: 'e-routers-syn', from: 'routers', to: 'syn', weight: '' },
        { id: 'e-syn-hh', from: 'syn', to: 'hh', weight: '' },
        { id: 'e-hh-noc', from: 'hh', to: 'noc', weight: '' },
        { id: 'e-noc-acl', from: 'noc', to: 'acl', weight: '' },
      ],
    }, { title: 'Case study: DDoS telemetry needs aggregate explanations' }),
    highlight: { active: ['syn', 'hh', 'noc'], found: ['acl'] },
    explanation: `During an attack, the ${ddosStages.length}-stage pipeline (${ddosStages.join(' → ')}) matters because individual source IPs may be unhelpful: thousands of bots each send a little traffic. Hierarchical heavy hitters identify the aggregate prefix that matters, letting operators rate-limit or route around a block rather than chase every leaf.`,
  };

  yield {
    state: prefixTree('Single elephant vs spread attack'),
    highlight: { active: ['host'], compare: ['n1047', 'spread'], found: ['n104'] },
    explanation: `Among ${attackTypes.length} attack types (${attackTypes.join(', ')}), a single elephant should report the host. A spread attack across many hosts in one prefix should report the prefix. The hierarchy lets the answer move to the right abstraction level as traffic changes.`,
  };

  yield {
    state: labelMatrix(
      'DDoS reporting decisions',
      [
        { id: 'single', label: 'one source' },
        { id: 'subnet', label: 'many /24' },
        { id: 'customer', label: 'one customer' },
        { id: 'global', label: 'global rise' },
      ],
      [
        { id: 'flat', label: 'flat top-k' },
        { id: 'hhh', label: 'HHH' },
        { id: 'ops', label: 'ops action' },
      ],
      [
        ['host', 'host', 'block host'],
        ['many leaves', '/24', 'rate limit /24'],
        ['mixed', '/16', 'call owner'],
        ['no clear key', '0/0', 'shed/load balance'],
      ],
    ),
    highlight: { active: ['subnet:hhh', 'customer:hhh'], found: ['subnet:ops'] },
    explanation: `Flat top-k gives a list. Hierarchical heavy hitters give an explanation across ${attackTypes.length} attack scenarios. That distinction matters when mitigation through the ${ddosStages.length}-stage pipeline happens at prefix, customer, region, or routing-policy boundaries.`,
  };

  yield {
    state: updateGraph('Production pipelines pair summaries with verification'),
    highlight: { active: ['sketches', 'subtract', 'report'], found: ['report'] },
    explanation: `As with Count-Min and Space-Saving, the synopsis at stage ${ddosStages.indexOf('synopsis') + 1} of ${ddosStages.length} should feed verification. Operators can ask for packet samples, exact flow logs, or routing context for the reported prefixes before taking destructive action.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'prefix hierarchy') yield* prefixHierarchy();
  else if (view === 'ddos case study') yield* ddosCaseStudy();
  else throw new InputError('Pick a hierarchical heavy-hitter view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the tree as containment. A host belongs to a /24, the /24 belongs to a /16, and the /16 belongs to a wider prefix. One stream event increments every node on its path.',
        {type: 'image', src: './assets/gifs/hierarchical-heavy-hitters-prefix-sketch.gif', alt: 'Animated walkthrough of the hierarchical heavy hitters prefix sketch visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A flat heavy hitter is one key with a large count. Operators often need the aggregate that explains load: subnet, customer, URL subtree, or region. Hierarchical heavy hitters report the level where mass remains large after more specific causes are removed.',
        {type: 'callout', text: 'Hierarchical heavy hitters explain traffic at the smallest aggregate level that still has unexplained mass.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is flat top-k over leaves such as source IPs or users. It works when one leaf dominates. It fails when many related leaves are small individually but heavy together.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Counting every prefix exactly can be too expensive at line rate. It also reports redundant ancestors: if one host is heavy, its /24 and /16 may look heavy only because they contain that host. The wall is explaining mass once.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use residual mass. A node is reported only if its total count minus already reported heavy descendants still crosses the threshold. Descendant traffic should not make every ancestor look independently important.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg', alt: 'Trie diagram showing shared prefixes across words', caption: 'A prefix trie is the natural shape behind hierarchical heavy hitters. Source: Wikimedia Commons, Trie example.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each event updates counters along its hierarchy path. A packet from 10.4.7.9 updates the host, 10.4.7/24, 10.4/16, 10/8, and root. Reporting proceeds bottom-up so child explanations can be subtracted from parents.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Animated packet switching diagram with packets moving through a network', caption: 'Prefix sketches are often applied to packet or event streams that are too large to store exactly. Source: Wikimedia Commons, Packet Switching.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Updating ancestors makes aggregate mass visible even when no leaf is heavy. Residual subtraction is correct because children partition parent traffic in a tree. Once a child is reported, its mass is already explained and should not be charged to the parent again.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Exact updating costs O(h) per event, where h is hierarchy height. Memory depends on retained candidates per level. Sketches reduce memory but add error, so production systems use slack thresholds, sampling, or exact verification before action.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This fits DDoS monitoring, hot customer prefixes, URL subtree spikes, organization billing, and telemetry ownership. The action usually happens at an aggregate boundary, such as throttling a subnet or paging a service owner.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Partial map of internet connectivity with many colored network links', caption: 'Internet-scale monitoring often needs aggregate explanations across nested address or routing prefixes. Source: Wikimedia Commons, Internet map.'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the hierarchy is stale or wrong. IP ownership, URL routing, and team mappings change. It also struggles with multidimensional questions such as source prefix by destination prefix by port, because those are not a single tree.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Total traffic is 1,000 packets and the threshold is 15 percent, so heavy means at least 150 packets. Host 10.4.7.9 has 170 packets, 10.4.7/24 has 240, and 10.4/16 has 300. Report the host first because 170 >= 150.',
        'After subtracting the host, /24 residual is 240 - 170 = 70 and /16 residual is 300 - 170 = 130. Neither crosses 150, so the output is one host. If ten hosts under /16 each had 30 packets, no host would report and /16 residual would be 300, so the output moves upward.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Cormode, Korn, Muthukrishnan, and Srivastava on hierarchical heavy hitters. Study tries, Patricia tries, longest-prefix match, Space-Saving summaries, Count-Min Sketch, Count Sketch, and Elastic Sketch next.',
      ],
    },
  ],
};
