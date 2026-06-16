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

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Cross-origin isolation is a browser security state created by a compatible opener policy and embedder policy. It matters because powerful APIs such as SharedArrayBuffer require stronger process and resource boundaries after Spectre-style side-channel risks.',
        'MDN documents that Cross-Origin-Opener-Policy helps control browsing context group sharing and that some features depend on cross-origin isolation: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy. MDN Cross-Origin-Embedder-Policy explains that COEP controls loading and embedding cross-origin resources requested in no-cors mode: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy.',
      ],
    },
    {
      heading: 'Core mental model',
      paragraphs: [
        'Think of the page as two linked graphs. The opener graph decides which windows can share a browsing context group. The resource graph decides which subresources are allowed into the isolated document. COOP acts on the first graph. COEP acts on the second graph. CORP and CORS are ways for resources to satisfy the second graph.',
        'CORP is a resource-side response header. CORS is a request and response protocol that can grant cross-origin reads. COEP require-corp demands an explicit signal for cross-origin no-cors resources; COEP credentialless omits credentials for some no-cors requests instead.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A browser-based IDE runs a WASM compiler in workers and uses SharedArrayBuffer to avoid copying large build artifacts. The app page sends Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp. First-party scripts and workers are same-origin. CDN fonts and images receive CORP. WASM receives CORS headers. A marketing tag that cannot opt in is removed from the compiler surface.',
        'The application checks window.crossOriginIsolated before enabling the shared-memory pipeline. If isolation fails, it falls back to transferable ArrayBuffers and shows slower compile progress rather than failing the editor.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not say CORP enables SharedArrayBuffer by itself. COOP plus COEP create the isolated document state; CORP helps individual resources pass the embedder policy. Do not assume every third-party tag can survive this migration.',
        'Do not confuse CORS and CORP. CORS controls explicit cross-origin access for fetches that participate in the CORS protocol. CORP lets a resource declare who may embed it in no-cors contexts.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Cross-Origin-Opener-Policy at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy, MDN Cross-Origin-Embedder-Policy at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy, MDN Cross-Origin-Resource-Policy at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Resource-Policy, WHATWG Fetch at https://fetch.spec.whatwg.org/, and HTML cross-origin embedder policy text at https://html.spec.whatwg.org/dev/browsers.html.',
        'Study SharedArrayBuffer & Atomics Wait/Notify, CORS Preflight Cache, Subresource Integrity Hash Manifest, CSP Nonce & Hash Policy, Trusted Types DOM XSS Sink Guard, and Fetch Metadata Request Gate next.',
      ],
    },
  ],
};
