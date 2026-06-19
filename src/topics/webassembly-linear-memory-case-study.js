// WebAssembly linear memory: one growable byte array shared between Wasm and
// JavaScript, with pages, typed-array views, explicit pointers, and sandboxed bounds.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'webassembly-linear-memory-case-study',
  title: 'WebAssembly Linear Memory Case Study',
  category: 'Systems',
  summary: 'How Wasm represents memory as pages of raw bytes, exposes an ArrayBuffer to JavaScript, grows memory, and keeps native-style code sandboxed.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['linear memory', 'growth and interop'], defaultValue: 'linear memory' },
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

function memoryGraph(title) {
  return graphState({
    nodes: [
      { id: 'js', label: 'JS', x: 0.8, y: 3.7, note: 'host' },
      { id: 'memory', label: 'Memory', x: 2.7, y: 3.7, note: 'ArrayBuffer' },
      { id: 'u8', label: 'Uint8', x: 4.8, y: 1.8, note: 'bytes' },
      { id: 'u32', label: 'Uint32', x: 4.8, y: 3.7, note: 'words' },
      { id: 'f64', label: 'Float64', x: 4.8, y: 5.6, note: 'numbers' },
      { id: 'wasm', label: 'Wasm', x: 7.0, y: 3.7, note: 'instance' },
      { id: 'load', label: 'load/store', x: 9.0, y: 2.3, note: 'offset' },
      { id: 'bounds', label: 'bounds', x: 9.0, y: 5.1, note: 'trap' },
    ],
    edges: [
      { id: 'e-js-memory', from: 'js', to: 'memory' },
      { id: 'e-memory-u8', from: 'memory', to: 'u8' },
      { id: 'e-memory-u32', from: 'memory', to: 'u32' },
      { id: 'e-memory-f64', from: 'memory', to: 'f64' },
      { id: 'e-memory-wasm', from: 'memory', to: 'wasm' },
      { id: 'e-wasm-load', from: 'wasm', to: 'load' },
      { id: 'e-load-bounds', from: 'load', to: 'bounds' },
    ],
  }, { title });
}

function interopGraph(title) {
  return graphState({
    nodes: [
      { id: 'malloc', label: 'malloc', x: 0.8, y: 3.7, note: 'reserve' },
      { id: 'ptr', label: 'ptr', x: 2.5, y: 3.7, note: 'number' },
      { id: 'view', label: 'view', x: 4.2, y: 2.0, note: 'typed array' },
      { id: 'call', label: 'call', x: 4.2, y: 5.3, note: 'export' },
      { id: 'grow', label: 'grow', x: 6.1, y: 3.7, note: '+pages' },
      { id: 'old', label: 'old view', x: 7.9, y: 2.0, note: 'stale' },
      { id: 'new', label: 'new view', x: 7.9, y: 5.3, note: 'refresh' },
      { id: 'free', label: 'free', x: 9.3, y: 3.7, note: 'manual' },
    ],
    edges: [
      { id: 'e-malloc-ptr', from: 'malloc', to: 'ptr' },
      { id: 'e-ptr-view', from: 'ptr', to: 'view' },
      { id: 'e-ptr-call', from: 'ptr', to: 'call' },
      { id: 'e-call-grow', from: 'call', to: 'grow' },
      { id: 'e-grow-old', from: 'grow', to: 'old' },
      { id: 'e-grow-new', from: 'grow', to: 'new' },
      { id: 'e-new-free', from: 'new', to: 'free' },
    ],
  }, { title });
}

function* linearMemory() {
  yield {
    state: memoryGraph('Wasm memory is one indexed byte array'),
    highlight: { active: ['js', 'memory', 'wasm', 'e-js-memory', 'e-memory-wasm'], found: ['u8', 'u32', 'f64'] },
    explanation: 'WebAssembly linear memory is a contiguous mutable byte array. JavaScript sees it through WebAssembly.Memory.buffer. Wasm code sees it through numeric offsets used by load and store instructions.',
  };

  yield {
    state: labelMatrix(
      'Pages and regions inside one memory',
      [
        { id: 'p0', label: 'page 0' },
        { id: 'p1', label: 'page 1' },
        { id: 'p2', label: 'page 2' },
        { id: 'p3', label: 'page 3' },
      ],
      [
        { id: 'size', label: 'size' },
        { id: 'typical use', label: 'typical use' },
      ],
      [
        ['64 KiB', 'data segment'],
        ['64 KiB', 'stack'],
        ['64 KiB', 'heap'],
        ['64 KiB', 'future grow'],
      ],
    ),
    highlight: { active: ['p0:size', 'p1:size', 'p2:size', 'p3:size'], compare: ['p3:typical use'] },
    explanation: 'Memory grows in WebAssembly pages. One page is 64 KiB. Toolchains divide the byte array into regions such as static data, stack, and heap, but those regions are conventions built on the same byte address space.',
    invariant: 'A pointer is an offset into linear memory, not a JavaScript object reference.',
  };

  yield {
    state: memoryGraph('Typed arrays are overlapping interpretations'),
    highlight: { active: ['memory', 'u8', 'u32', 'f64', 'e-memory-u8', 'e-memory-u32', 'e-memory-f64'], compare: ['wasm'] },
    explanation: 'A Uint8Array, Uint32Array, and Float64Array can all view the same bytes. The data is not copied when a view is created; only the interpretation changes. That is why byte offsets, alignment, and encoding matter.',
  };

  yield {
    state: labelMatrix(
      'Load/store safety boundary',
      [
        { id: 'address', label: 'address' },
        { id: 'bounds', label: 'bounds check' },
        { id: 'trap', label: 'trap' },
        { id: 'sandbox', label: 'sandbox' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['integer offset', 'portable pointer'],
        ['inside memory?', 'host safety'],
        ['fail fast', 'no native memory escape'],
        ['separate store', 'browser/runtime isolation'],
      ],
    ),
    highlight: { found: ['bounds:why', 'trap:why', 'sandbox:why'] },
    explanation: 'Wasm can be low-level without giving a module native pointers. Loads and stores target linear memory and are checked against its bounds. An out-of-bounds access traps instead of reading arbitrary host memory.',
  };
}

function* growthAndInterop() {
  yield {
    state: interopGraph('Interop passes pointers and lengths across the boundary'),
    highlight: { active: ['malloc', 'ptr', 'view', 'call', 'e-malloc-ptr', 'e-ptr-view', 'e-ptr-call'], compare: ['grow'] },
    explanation: 'JavaScript and Wasm usually exchange compound data by passing a pointer and length. JavaScript writes bytes into memory, calls an exported function with the pointer, and reads bytes back through a typed-array view.',
  };

  yield {
    state: labelMatrix(
      'Memory growth edge cases',
      [
        { id: 'grow', label: 'memory.grow' },
        { id: 'old', label: 'old ArrayBuffer' },
        { id: 'new', label: 'new buffer' },
        { id: 'shared', label: 'shared memory' },
      ],
      [
        { id: 'behavior', label: 'behavior' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['adds pages', 'capacity changes'],
        ['detached', 'views go stale'],
        ['fresh length', 'recreate views'],
        ['not detached', 'length caveat'],
      ],
    ),
    highlight: { removed: ['old:behavior'], found: ['new:lesson'], compare: ['shared:behavior'] },
    explanation: 'For non-shared memory, memory.grow detaches references to the old buffer, even grow(0). Code that caches a Uint8Array over memory.buffer must recreate the view after calls that may grow memory.',
    invariant: 'Store pointer and length; recreate the typed-array view when needed.',
  };

  yield {
    state: interopGraph('Manual allocation makes JavaScript a guest in the heap'),
    highlight: { active: ['malloc', 'ptr', 'new', 'free', 'e-malloc-ptr', 'e-new-free'], removed: ['old'] },
    explanation: 'If the Wasm module owns malloc/free, JavaScript must treat returned pointers like foreign heap addresses. A pointer can outlive a temporary JS view, but the allocation still needs an ownership rule and a matching free.',
  };

  yield {
    state: labelMatrix(
      'Interop checklist',
      [
        { id: 'bytes', label: 'bytes' },
        { id: 'strings', label: 'strings' },
        { id: 'structs', label: 'structs' },
        { id: 'growth', label: 'growth' },
        { id: 'threads', label: 'threads' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'failure', label: 'failure if ignored' },
      ],
      [
        ['use Uint8Array', 'wrong element width'],
        ['encode/decode UTF-8', 'garbled text'],
        ['match layout', 'bad offsets'],
        ['refresh views', 'empty stale arrays'],
        ['SharedArrayBuffer rules', 'race or isolation issue'],
      ],
    ),
    highlight: { active: ['bytes:rule', 'strings:rule', 'structs:rule', 'growth:rule', 'threads:rule'] },
    explanation: 'The hard bugs are ordinary memory bugs wearing a browser costume: width mismatch, string encoding, struct layout, stale views, and shared-memory races. The fix is to write explicit boundary contracts.',
  };

  yield {
    state: labelMatrix(
      'What toolchains add',
      [
        { id: 'heap', label: 'HEAP views' },
        { id: 'ccall', label: 'ccall/cwrap' },
        { id: 'malloc', label: 'malloc/free' },
        { id: 'fs', label: 'virtual FS' },
      ],
      [
        { id: 'adds', label: 'adds' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['typed views', 'view refresh'],
        ['function bridge', 'export config'],
        ['C heap API', 'manual lifetime'],
        ['file illusion', 'sync and packaging'],
      ],
    ),
    highlight: { found: ['heap:adds', 'ccall:adds', 'malloc:adds'], compare: ['fs:cost'] },
    explanation: 'Emscripten and similar toolchains hide much of the ceremony, but they do not remove the model. Underneath, data still crosses as bytes, pointers, typed views, and runtime-managed heap conventions.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'linear memory') yield* linearMemory();
  else if (view === 'growth and interop') yield* growthAndInterop();
  else throw new InputError('Pick a WebAssembly memory view.');
}

const legacyArticle = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'WebAssembly needs to run low-level code without handing that code native pointers into the browser or host process. C, C++, Rust, and other compiled languages still need addresses, loads, stores, stacks, heaps, structs, and byte buffers. Linear memory is the compromise: one sandboxed byte array that Wasm can address directly.',
        'The official core specification describes linear memory as a mutable byte array, and MDN describes WebAssembly.Memory as the resizable buffer accessed by a WebAssembly instance: https://www.w3.org/TR/wasm-core-2/ and https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory. This topic is the bridge between arrays, allocators, typed arrays, browser runtimes, and sandboxing.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The easy mistake is to treat a Wasm pointer like a JavaScript object reference. It is not one. A pointer is just an integer offset into the module memory. JavaScript cannot follow it as an object, and Wasm cannot use it to escape into the host heap.',
        'Another mistake is to cache typed-array views forever. For non-shared memory, memory.grow detaches references to the old buffer, even grow(0), so code that keeps a Uint8Array over memory.buffer must recreate the view after any call that may grow memory: https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory/grow.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A memory has an initial size measured in pages. One WebAssembly page is 64 KiB. A module can import memory from JavaScript or create and export memory to JavaScript. JavaScript creates typed-array views such as Uint8Array, Uint32Array, or Float64Array over the same buffer. Those views do not copy data; they reinterpret the same bytes with different element widths.',
        'The invariant is pointer plus length. Compound values cross the boundary by writing bytes into memory, passing an offset and length to an exported function, and reading bytes back through a fresh view. Loads and stores are bounds-checked against linear memory, so an out-of-bounds access traps instead of reading arbitrary host memory.',
        'Toolchains such as Emscripten add calling helpers, string conversion, malloc/free wrappers, and HEAP8/HEAPU8/HEAP32-style views, but the model underneath is still bytes plus offsets: https://emscripten.org/docs/api_reference/preamble.js.html.',
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        'In the linear-memory view, watch one buffer fan out into Uint8, Uint32, and Float64 interpretations. The point is not that there are three copies; the point is that one byte store can be viewed with several element widths, so offsets, alignment, and encoding become part of the contract.',
        'In the growth-and-interop view, malloc returns a numeric pointer, JavaScript creates a view over that range, and growth makes old views unsafe for non-shared memory. The safe rule is to store pointer and length, recreate views after growth, and pair ownership with free when the module owns the heap. If you remember only one thing, remember that the pointer is a number inside Wasm memory, not a host object.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Linear memory wins when native-style code needs predictable byte layout, portable sandboxing, and efficient bulk exchange with JavaScript. It connects Buddy Allocator Free Lists and Slab Allocator Size Classes to browser execution because compiled allocators manage a heap inside this byte array. It also connects Apache Arrow Columnar Memory Case Study because both rely on byte buffers, typed views, and offsets.',
        'It fails when callers forget the boundary contract. JavaScript strings are not raw C strings. Struct layout needs agreed alignment and field widths. Cached views can go stale. Shared memory introduces Atomics and cross-origin isolation requirements. The sandbox prevents host-memory escape, but C code can still corrupt its own heap inside linear memory.',
        'WebAssembly is not only a browser feature. The core format is portable, though browsers expose it through JavaScript APIs. V8 4GB Wasm Memory is a useful example of how runtime and toolchain details affect large memories in practice: https://v8.dev/blog/4gb-wasm-memory.',
      ],
    }
  ],
};

