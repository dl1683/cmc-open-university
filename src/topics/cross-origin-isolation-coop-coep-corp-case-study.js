// Cross-origin isolation: COOP separates browsing context groups, COEP requires
// explicit resource opt-in, and CORP/CORS make subresource embedding auditable.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'cross-origin-isolation-coop-coep-corp-case-study',
  title: 'Cross-Origin Isolation: COOP, COEP & CORP',
  category: 'Security',
  summary: 'How COOP, COEP, CORS, CORP, credentialless loading, opener isolation, subresource audits, workers, and SharedArrayBuffer gating fit together.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['header triad', 'resource audit'], defaultValue: 'header triad' },
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

function isolationGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'doc', label: 'doc', x: 0.5, y: 4.1, note: notes.doc ?? 'app page' },
      { id: 'coop', label: 'COOP', x: 2.2, y: 5.6, note: notes.coop ?? 'opener' },
      { id: 'coep', label: 'COEP', x: 2.2, y: 2.7, note: notes.coep ?? 'embedder' },
      { id: 'bcg', label: 'BCG', x: 4.5, y: 5.6, note: notes.bcg ?? 'isolated' },
      { id: 'subres', label: 'assets', x: 4.5, y: 2.7, note: notes.subres ?? 'scripts/img' },
      { id: 'corp', label: 'CORP', x: 6.4, y: 2.0, note: notes.corp ?? 'same-site' },
      { id: 'cors', label: 'CORS', x: 6.4, y: 3.4, note: notes.cors ?? 'explicit' },
      { id: 'worker', label: 'worker', x: 8.0, y: 4.1, note: notes.worker ?? 'module' },
      { id: 'sab', label: 'SAB', x: 9.4, y: 4.1, note: notes.sab ?? 'allowed?' },
    ],
    edges: [
      { id: 'e-doc-coop', from: 'doc', to: 'coop', weight: '' },
      { id: 'e-doc-coep', from: 'doc', to: 'coep', weight: '' },
      { id: 'e-coop-bcg', from: 'coop', to: 'bcg', weight: '' },
      { id: 'e-coep-subres', from: 'coep', to: 'subres', weight: '' },
      { id: 'e-subres-corp', from: 'subres', to: 'corp', weight: '' },
      { id: 'e-subres-cors', from: 'subres', to: 'cors', weight: '' },
      { id: 'e-bcg-worker', from: 'bcg', to: 'worker', weight: '' },
      { id: 'e-cors-worker', from: 'cors', to: 'worker', weight: '' },
      { id: 'e-worker-sab', from: 'worker', to: 'sab', weight: '' },
    ],
  }, { title });
}

function* headerTriad() {
  yield {
    state: isolationGraph('Cross-origin isolation is a document state, not one header', { sab: 'locked' }),
    highlight: { active: ['doc', 'coop', 'coep', 'e-doc-coop', 'e-doc-coep'], compare: ['sab'] },
    explanation: 'A page becomes cross-origin isolated only when the opener relationship and embedded resources satisfy the isolation rules. COOP and COEP work together.',
    invariant: 'SharedArrayBuffer availability depends on the resulting crossOriginIsolated state.',
  };

  yield {
    state: isolationGraph('COOP moves the page into the right browsing context group', { coop: 'same-origin', bcg: 'new group' }),
    highlight: { active: ['doc', 'coop', 'bcg', 'e-doc-coop', 'e-coop-bcg'], removed: ['sab'] },
    explanation: 'Cross-Origin-Opener-Policy controls whether the document shares a browsing context group with cross-origin opener or opened pages. That limits powerful opener relationships.',
  };

  yield {
    state: isolationGraph('COEP requires cross-origin resources to opt in', { coep: 'require', subres: 'checked' }),
    highlight: { active: ['doc', 'coep', 'subres', 'e-doc-coep', 'e-coep-subres'], compare: ['corp', 'cors'] },
    explanation: 'Cross-Origin-Embedder-Policy changes the loading contract. Cross-origin no-cors resources need an explicit grant, usually through CORP, CORS, or a credentialless mode.',
  };

  yield {
    state: labelMatrix(
      'Header roles',
      [
        { id: 'coop', label: 'COOP' },
        { id: 'coep', label: 'COEP' },
        { id: 'corp', label: 'CORP' },
        { id: 'cors', label: 'CORS' },
      ],
      [
        { id: 'controls', label: 'controls' },
        { id: 'mistake' },
      ],
      [
        ['opener', 'asset gate'],
        ['embed rules', 'opener'],
        ['resource says', 'page state'],
        ['read grant', 'all embeds'],
      ],
    ),
    highlight: { active: ['coop:controls', 'coep:controls', 'corp:controls', 'cors:controls'], compare: ['corp:mistake'] },
    explanation: 'COOP, COEP, CORP, and CORS are easy to mix up because they all sit near cross-origin policy. The data structure to remember is a two-sided contract: the page opts into isolation, and each resource opts into being embedded or fetched.',
  };

  yield {
    state: isolationGraph('When the audit passes, workers can share memory safely', { worker: 'isolated', sab: 'enabled' }),
    highlight: { active: ['bcg', 'worker', 'sab', 'e-bcg-worker', 'e-worker-sab'], found: ['coop', 'coep', 'corp', 'cors'] },
    explanation: 'After the opener boundary and resource boundary both pass, APIs such as SharedArrayBuffer can be enabled for worker pipelines that need shared memory and Atomics.',
  };
}

function* resourceAudit() {
  yield {
    state: isolationGraph('Start with an inventory of everything the page embeds', { subres: 'inventory', sab: 'blocked' }),
    highlight: { active: ['doc', 'coep', 'subres', 'e-doc-coep', 'e-coep-subres'], compare: ['sab'] },
    explanation: 'The migration problem is a dependency graph. Every script, worker, image, font, WASM module, iframe, and analytics tag needs a path through CORS, CORP, same-origin hosting, or credentialless loading.',
    invariant: 'Isolation rollouts fail at the weakest embedded-resource edge.',
  };

  yield {
    state: labelMatrix(
      'Resource audit',
      [
        { id: 'app', label: 'app JS' },
        { id: 'wasm', label: 'WASM' },
        { id: 'cdn', label: 'CDN img' },
        { id: 'tag', label: 'tag' },
        { id: 'frame', label: 'iframe' },
      ],
      [
        { id: 'path' },
        { id: 'risk' },
      ],
      [
        ['same-origin', 'low'],
        ['CORS', 'headers'],
        ['CORP', 'no creds'],
        ['vendor', 'breakage'],
        ['isolate?', 'policy'],
      ],
    ),
    highlight: { active: ['app:path', 'wasm:path', 'cdn:path'], compare: ['tag:risk', 'frame:risk'] },
    explanation: 'Treat third-party tags and iframes as explicit dependencies. Some can move behind server-side proxies, some need vendor headers, and some are incompatible with strict isolation.',
  };

  yield {
    state: isolationGraph('A failing third-party script blocks the isolated state', { subres: 'vendor JS', corp: 'missing', cors: 'missing', sab: 'blocked' }),
    highlight: { active: ['subres', 'corp', 'cors', 'e-subres-corp', 'e-subres-cors'], removed: ['sab'] },
    explanation: 'COEP is intentionally strict. If a required cross-origin resource cannot prove it is safe to embed in the isolated page, the page should fail closed instead of silently enabling shared memory.',
  };

  yield {
    state: isolationGraph('Credentialless can load some no-cors resources without cookies', { coep: 'credentialless', subres: 'no-cors', corp: 'optional', cors: 'none', sab: 'maybe' }),
    highlight: { active: ['coep', 'subres', 'corp', 'cors'], compare: ['worker', 'sab'] },
    explanation: 'COEP credentialless is a compatibility path for some no-cors subresources. It trades away credentials on those requests, which can be safer than letting ambient cookies leak into every cross-origin asset load.',
  };

  yield {
    state: isolationGraph('The complete case study is a browser-based IDE with WASM workers', { doc: 'IDE', subres: 'WASM/CDN', worker: 'compiler', sab: 'enabled' }),
    highlight: { active: ['doc', 'coop', 'coep', 'bcg', 'subres', 'worker', 'sab'], found: ['corp', 'cors'] },
    explanation: 'A browser IDE wants a WASM compiler and a SharedArrayBuffer-backed worker pool. The team adds COOP and COEP, inventories CDN assets, moves incompatible tags out of the compiler page, and gates rollout on crossOriginIsolated.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'header triad') yield* headerTriad();
  else if (view === 'resource audit') yield* resourceAudit();
  else throw new InputError('Pick a cross-origin isolation view.');
}


export const article = { sections: [
  { heading: 'How to read the animation', paragraphs: [
    'The header-triad view shows how a document reaches crossOriginIsolated. Active nodes are the current header or resource check; found nodes are satisfied contracts; removed nodes are capabilities withheld because the contract failed.',
    'The resource-audit view is a dependency graph. Every script, worker, WASM module, image, font, iframe, and tag needs a same-origin path, CORS path, CORP header, or credentialless-compatible load.',
  ] },
  { heading: 'Why this exists', paragraphs: [
    'Spectre-class attacks made high-resolution timers and shared memory dangerous when a process also contains opaque cross-origin data. Browsers therefore gate SharedArrayBuffer and related capabilities behind stronger isolation.',
    'Cross-origin isolation is the browser state that says the opener boundary and embedded-resource boundary are explicit. A page opts in, and every cross-origin resource must consent to being used in that page.',
    {type:'callout', text:'Cross-origin isolation is a conjunctive contract: the document opts into isolation and every cross-origin resource must explicitly opt into being embedded.'},
  ] },
  { heading: 'The obvious approach', paragraphs: [
    'The obvious approach is to add Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp to the page. That works for a small first-party route where all resources are same-origin or already CORS/CORP-compatible.',
    'It breaks on uncontrolled dependencies. One third-party analytics script, CDN image without CORP, payment popup relying on window.opener, or ad iframe can block the isolated state for the whole document.',
  ] },
  { heading: 'The wall', paragraphs: [
    'The wall is conjunctive failure. crossOriginIsolated is true only when COOP passes and every COEP-governed resource edge passes; there is no mostly isolated state for SharedArrayBuffer.',
    'The migration wall is inventory. A page can look visually fine and still fail the runtime boolean because one opaque subresource loaded through a path that did not opt into isolation.',
  ] },
  { heading: 'The core insight', paragraphs: [
    'Cross-origin isolation is a two-sided contract. COOP controls opener relationships and browsing context groups, while COEP requires embedded cross-origin resources to provide explicit permission through CORS, CORP, or a credentialless path.',
    'CORS and CORP answer different questions. CORS allows a cross-origin read path; CORP tells the browser which origins may consume a no-cors response as an embedded resource.',
  ] },
  { heading: 'How it works', paragraphs: [
    'COOP: same-origin moves the document away from cross-origin opener relationships, usually nulling window.opener across the boundary. COEP: require-corp makes the browser check each cross-origin subresource before loading it into the page.',
    'For a cors request, normal CORS validation must pass. For a no-cors request, the response needs a Cross-Origin-Resource-Policy value that permits consumption, unless the page uses a credentialless mode that strips credentials for compatible no-cors resources.',
  ] },
  { heading: 'Why it works', paragraphs: [
    'The security argument is that an isolated page should not share powerful timing and memory tools with opaque cross-origin data. COOP removes cross-origin opener access, and COEP blocks cross-origin resources that did not opt in.',
    'Once the browser can establish that boundary, it can safely expose SharedArrayBuffer to the page and workers. The proof is mechanical: headers and resource modes pass, not vendor reputation.',
  ] },
  { heading: 'Cost and complexity', paragraphs: [
    'The runtime cost is small, but the dependency cost can be large. A route with 4 first-party assets may isolate in an hour; a route with 30 vendor tags, 5 ad iframes, and an OAuth popup may need architecture changes.',
    'The maintenance cost is regression control. Every new vendor script, CDN asset, worker, iframe, font, and popup needs an isolation-compatible path or the page can lose crossOriginIsolated after a deploy.',
  ] },
  { heading: 'Real-world uses', paragraphs: [
    'It fits browser IDEs, WASM compilers, media encoders, CAD tools, scientific notebooks, game engines, and ML demos that need SharedArrayBuffer or precise timing. The common access pattern is worker-heavy computation with shared memory.',
    'It also cleans architecture. Moving ads, analytics, and opaque widgets off the high-performance route creates a smaller dependency graph for pages that need powerful browser features.',
  ] },
  { heading: 'Where it fails', paragraphs: [
    'It fails on pages that depend on opaque third-party resources the team cannot control. Ad networks, legacy analytics tags, partner widgets, personalized CDN assets, and opener-based payment flows are common blockers.',
    'It also fails when code assumes isolation instead of checking it. Production code should branch on globalThis.crossOriginIsolated and provide a fallback path when the browser withholds SharedArrayBuffer.',
  ] },
  { heading: 'Worked example', paragraphs: [
    'A browser IDE compiles a project in 18 seconds with copied ArrayBuffers. A SharedArrayBuffer worker pool cuts compile time to 7 seconds, so the /editor route adds COOP and COEP and inventories app.js, compiler.wasm, fonts, CDN images, analytics, and payment popup.',
    'The audit finds 7 resource edges: 4 pass, CDN images need CORP, analytics has no compatible header, and payment uses opener. The team adds CORP to images, removes analytics from /editor, redesigns payment handoff through postMessage, and enables SAB only when crossOriginIsolated is true.',
  ] },
  { heading: 'Sources and study next', paragraphs: [
    'Primary sources: MDN COOP, COEP, CORP, SharedArrayBuffer, and crossOriginIsolated docs; web.dev guidance on making a site cross-origin isolated; WHATWG Fetch; and HTML policy algorithms. Study browsing context groups, no-cors requests, and worker memory next.',
    'Then compare CORS Preflight Cache, CSP Nonce Hash Policy, Subresource Integrity, Fetch Metadata, Permissions Policy, and Service Workers. Each tool controls a different browser boundary.',
  ] },
] };
