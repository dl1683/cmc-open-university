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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Cross-Origin Isolation: COOP, COEP & CORP. How COOP, COEP, CORS, CORP, credentialless loading, opener isolation, subresource audits, workers, and SharedArrayBuffer gating fit together..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'What Cross-Origin Isolation Is',
      paragraphs: [
        'Cross-origin isolation is a browser-enforced document state. A page reaches that state only when its opener relationships and embedded resources satisfy stricter cross-origin rules. The result is exposed through `window.crossOriginIsolated` and similar worker properties.',
        'The practical reason is powerful execution features. SharedArrayBuffer, Atomics-heavy worker pipelines, high-resolution timing, and some WASM workloads can expose side-channel risk if a page is mixed freely with unrelated cross-origin documents and opaque resources. Isolation makes the page prove that its boundaries are explicit before those capabilities are enabled.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'The tempting fix is to add one header to the HTML response or to adjust only the worker that wants SharedArrayBuffer. That fails because isolation is not a property of one script. It is the state of the whole document, its browsing context group, and every resource edge the document depends on.',
        'A single analytics tag, CDN image, WASM file, font, iframe, worker script, payment popup, or legacy vendor response can keep the page out of the isolated state. The migration is therefore a dependency audit, not a header toggle.',
        'Content Security Policy does not replace this. CSP can restrict where scripts, images, frames, and other resources may load from. Cross-origin isolation asks a different question: has the page separated opener relationships, and have embedded cross-origin resources opted into being used by an isolated document?',
      ],
    },
    {
      heading: 'The Header Roles',
      paragraphs: [
        '`Cross-Origin-Opener-Policy` controls browsing context group relationships. With the strict isolation path, `COOP: same-origin` prevents a cross-origin opener or opened page from sharing the same group. This limits direct opener references and helps separate documents that should not script each other.',
        '`Cross-Origin-Embedder-Policy` controls the embedding contract for resources used by the document. With `COEP: require-corp`, cross-origin resources must be explicitly loadable by the page through CORS or must declare an appropriate `Cross-Origin-Resource-Policy`. With `COEP: credentialless`, some no-cors requests can load without credentials, which changes compatibility and privacy tradeoffs.',
        '`Cross-Origin-Resource-Policy` is a resource-side statement. It says whether a resource is willing to be loaded by same-origin, same-site, or cross-origin documents. CORS is broader and lets a resource grant cross-origin reads through response headers. CORP does not create the isolated page by itself; it helps individual resource edges pass COEP.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A page that wants the strict path usually sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` or `credentialless`. The browser then evaluates the document in two directions: which top-level windows it can share state with, and which resources it is allowed to embed.',
        'The opener check decides whether the document remains connected to cross-origin windows through `window.opener` and the browsing context group. The embedder check walks the resource graph. Same-origin resources generally pass. Cross-origin resources need a CORS grant, a CORP grant, same-origin hosting through a proxy or asset move, or a credentialless-compatible path.',
        'Only after the combined state passes should the application enable SharedArrayBuffer code. Production code should check `crossOriginIsolated`, provide an ArrayBuffer or single-thread fallback, and treat a false value as a configuration failure worth logging.',
      ],
    },
    {
      heading: 'Worked Migration',
      paragraphs: [
        'Consider a browser IDE that runs a WASM compiler in workers. The compiler wants SharedArrayBuffer so multiple workers can coordinate through shared memory instead of copying large buffers between threads.',
        'The team first isolates the compiler route, not the entire marketing site. The app shell, worker scripts, WASM binary, source maps, fonts, and editor assets are inventoried. First-party assets move to the same origin or receive compatible headers. CDN assets get CORS or CORP. Marketing tags and opaque third-party iframes move off the compiler page because they cannot satisfy the stricter contract.',
        'The rollout gate is simple: if `crossOriginIsolated` is true, enable the shared-memory worker pool; if false, use a slower fallback and report which resource failed the audit. The page does not guess. It lets the browser state be the final authority.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is fail closed. A page does not become isolated because most resources are configured correctly. Every required edge has to satisfy the contract, and the browser withholds powerful APIs if the contract is incomplete or blocked by policy.',
        'This works because it joins two checks that are often confused. COOP reduces risky opener relationships at the browsing context level. COEP forces embedded cross-origin resources to be explicit instead of opaque ambient dependencies. Together they give the browser evidence that the document can safely receive APIs that were restricted after Spectre-class attacks.',
        'The policy is intentionally mechanical. It is not trying to determine whether a vendor is trustworthy in a human sense. It is checking whether the page and each resource declared the cross-origin relationship that the isolated document requires.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The main cost is operational. Every embedded resource becomes part of a policy ledger: who owns it, which origin serves it, whether it needs credentials, whether it can send CORS, whether it can send CORP, and whether it is allowed on the isolated surface.',
        '`require-corp` is strict and predictable, but it can break resources whose owners cannot or will not set headers. `credentialless` can improve compatibility for some no-cors resources, but those requests omit credentials, so any resource depending on cookies, HTTP authentication, or personalized responses may change behavior.',
        'Popup flows need special care. OAuth, payment, support chat, and document-preview integrations may rely on opener relationships. Some flows need a separate non-isolated route, explicit `rel=noopener`, postMessage redesign, or a popup strategy that does not undermine the isolated surface.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Cross-origin isolation is worth the migration on pages where shared memory or stronger isolation changes the product: browser IDEs, local compilers, media encoders, scientific notebooks, simulation tools, CAD-like web apps, ML inference demos, and worker-heavy WASM pipelines.',
        'It is also useful as an architecture forcing function. Sensitive tools can become cleaner when ads, broad analytics, opaque widgets, and unrelated iframes are kept out of the execution surface that handles high-performance or security-sensitive work.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the page depends on uncontrolled third parties. Ad stacks, old analytics tags, opaque cross-origin iframes, partner-hosted widgets, and CDN resources without header control can block isolation or force awkward workarounds.',
        'It also fails as a substitute for other browser defenses. Cross-origin isolation does not validate input, prevent XSS, replace CSP, make cookies safe, enforce Fetch Metadata, or guarantee that every same-origin application is mutually safe. It narrows a specific set of opener and embedder risks so powerful APIs can be exposed under stricter conditions.',
        'The worst implementation is partial confidence: a team adds COOP and COEP, assumes SharedArrayBuffer will work, and ships no fallback or resource diagnostics. The right gate is browser-observed state plus an inventory that names the failing edge.',
      ],
    },
    {
      heading: 'Implementation Checklist',
      paragraphs: [
        'Inventory every resource on the target route: scripts, module workers, classic workers, WASM, images, fonts, stylesheets, source maps, iframes, fetches, imports, analytics, and popup flows. Mark each edge as same-origin, CORS-enabled, CORP-enabled, credentialless-compatible, movable, proxyable, or incompatible.',
        'Apply headers on the isolated route, verify `crossOriginIsolated` in the main window and relevant workers, add fallback behavior, and log blocked resource URLs in development and staging. Keep the isolated route small enough that future vendors cannot silently add failing dependencies.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary references: MDN Cross-Origin-Opener-Policy at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy, MDN Cross-Origin-Embedder-Policy at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy, MDN Cross-Origin-Resource-Policy at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Resource-Policy, MDN `crossOriginIsolated` at https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated, WHATWG Fetch at https://fetch.spec.whatwg.org/, and HTML cross-origin embedder policy text at https://html.spec.whatwg.org/dev/browsers.html.',
        'Study SharedArrayBuffer & Atomics Wait/Notify, CORS Preflight Cache, Subresource Integrity Hash Manifest, CSP Nonce & Hash Policy, Trusted Types DOM XSS Sink Guard, Fetch Metadata Request Gate, and Service Worker Navigation Preload next.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'The core insight',
      paragraphs: [
        "The core insight is the smallest idea that changes what can be proven.",
        "Phrase it as an invariant, boundary, or contract that stays true across all transitions.",
        "Everything else in the topic should serve this one sentence.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
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
          'If your predicted final state matches the animation for cross-origin-isolation-coop-coep-corp-case-study, continue to the next topic in the same track.'
  ],
      },
],
};

