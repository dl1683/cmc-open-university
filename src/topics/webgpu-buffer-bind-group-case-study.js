// WebGPU: host arrays become GPUBuffer resources, bind groups connect those
// buffers to shader slots, and command buffers move work onto the GPU queue.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'webgpu-buffer-bind-group-case-study',
  title: 'WebGPU Buffer & Bind Group Case Study',
  category: 'Systems',
  summary: 'How WebGPU moves typed-array data into GPUBuffer objects, binds resources to shader slots, records commands, and submits work to a GPU queue.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['resource binding', 'compute pass'], defaultValue: 'resource binding' },
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

function resourceGraph(title) {
  return graphState({
    nodes: [
      { id: 'js', label: 'JS', x: 0.7, y: 3.6, note: 'host' },
      { id: 'array', label: 'Array', x: 2.4, y: 1.7, note: 'CPU bytes' },
      { id: 'device', label: 'device', x: 2.4, y: 5.7, note: 'logical' },
      { id: 'buffer', label: 'Buffer', x: 4.4, y: 3.7, note: 'flags' },
      { id: 'layout', label: 'Layout', x: 6.4, y: 1.4, note: 'slots' },
      { id: 'bind', label: 'Bind', x: 6.4, y: 5.8, note: 'resources' },
      { id: 'pipe', label: 'Pipe', x: 8.4, y: 2.3, note: 'shader' },
      { id: 'queue', label: 'Queue', x: 9.3, y: 5.0, note: 'submit' },
    ],
    edges: [
      { id: 'e-js-array', from: 'js', to: 'array' },
      { id: 'e-js-device', from: 'js', to: 'device' },
      { id: 'e-array-buffer', from: 'array', to: 'buffer', weight: 'write/copy' },
      { id: 'e-device-buffer', from: 'device', to: 'buffer', weight: 'create' },
      { id: 'e-buffer-bind', from: 'buffer', to: 'bind' },
      { id: 'e-layout-bind', from: 'layout', to: 'bind' },
      { id: 'e-layout-pipe', from: 'layout', to: 'pipe' },
      { id: 'e-bind-pipe', from: 'bind', to: 'pipe' },
      { id: 'e-pipe-queue', from: 'pipe', to: 'queue' },
    ],
  }, { title });
}

function computeGraph(title) {
  return graphState({
    nodes: [
      { id: 'inA', label: 'input A', x: 0.7, y: 2.1, note: 'storage' },
      { id: 'inB', label: 'input B', x: 0.7, y: 5.2, note: 'storage' },
      { id: 'bind', label: 'bind group', x: 2.8, y: 3.6, note: 'slots 0..2' },
      { id: 'shader', label: 'WGSL', x: 4.8, y: 3.6, note: 'kernel' },
      { id: 'dispatch', label: 'dispatch', x: 6.7, y: 3.6, note: 'workgroups' },
      { id: 'out', label: 'output', x: 8.5, y: 2.1, note: 'storage' },
      { id: 'readback', label: 'readback', x: 8.5, y: 5.2, note: 'MAP_READ' },
    ],
    edges: [
      { id: 'e-a-bind', from: 'inA', to: 'bind' },
      { id: 'e-b-bind', from: 'inB', to: 'bind' },
      { id: 'e-bind-shader', from: 'bind', to: 'shader' },
      { id: 'e-shader-dispatch', from: 'shader', to: 'dispatch' },
      { id: 'e-dispatch-out', from: 'dispatch', to: 'out' },
      { id: 'e-out-readback', from: 'out', to: 'readback' },
    ],
  }, { title });
}

function* resourceBinding() {
  yield {
    state: resourceGraph('WebGPU starts with a logical device and explicit buffers'),
    highlight: { active: ['js', 'device', 'buffer', 'e-js-device', 'e-device-buffer'], compare: ['array'] },
    explanation: 'A WebGPU app asks the browser for a GPUAdapter and GPUDevice, then creates GPUBuffer objects with explicit usage flags. The buffer is not a JavaScript array; it is a GPU resource with declared allowed uses.',
  };

  yield {
    state: resourceGraph('Typed arrays upload bytes into GPUBuffer storage'),
    highlight: { active: ['array', 'buffer', 'e-array-buffer'], found: ['js'], compare: ['device'] },
    explanation: 'Host data usually starts as a TypedArray. The app writes it into a GPUBuffer with queue.writeBuffer, mapped ranges, or copy commands. This is the same boundary lesson as WebAssembly linear memory: bytes cross explicitly, and layout is the contract.',
    invariant: 'The shader sees bytes with a declared layout; JavaScript object shape is not visible on the GPU.',
  };

  yield {
    state: resourceGraph('Bind group layout names the shader resource contract'),
    highlight: { active: ['layout', 'bind', 'buffer', 'pipe', 'e-layout-bind', 'e-buffer-bind', 'e-layout-pipe'], compare: ['queue'] },
    explanation: 'A bind group layout says which resource slots exist, which shader stages can see them, and whether a buffer is uniform, read-only storage, writable storage, or another resource type. A bind group fills those slots with concrete resources.',
  };

  yield {
    state: labelMatrix(
      'GPUBuffer usage flags',
      [
        { id: 'mapread', label: 'MAP_READ' },
        { id: 'mapwrite', label: 'MAP_WRITE' },
        { id: 'copy', label: 'COPY_SRC/DST' },
        { id: 'vertex', label: 'VERTEX/INDEX' },
        { id: 'uniform', label: 'UNIFORM' },
        { id: 'storage', label: 'STORAGE' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'common pitfall', label: 'common pitfall' },
      ],
      [
        ['read back to CPU', 'must copy from compute output first'],
        ['CPU writes mapped range', 'not a free live JS view'],
        ['staging and transfers', 'missing flag blocks copy'],
        ['draw input streams', 'wrong stride breaks vertices'],
        ['small constants', 'alignment and size limits'],
        ['large shader data', 'race and bounds discipline'],
      ],
    ),
    highlight: { active: ['copy:purpose', 'uniform:purpose', 'storage:purpose'], compare: ['mapread:common pitfall'] },
    explanation: 'Usage flags are a validation data structure. They let the browser reject impossible or unsafe resource transitions before commands reach the driver.',
  };
}

function* computePass() {
  yield {
    state: computeGraph('A compute pass binds buffers and dispatches workgroups'),
    highlight: { active: ['inA', 'inB', 'bind', 'shader', 'dispatch', 'e-a-bind', 'e-b-bind', 'e-bind-shader', 'e-shader-dispatch'], compare: ['out'] },
    explanation: 'A compute shader reads storage buffers through a bind group, runs many invocations grouped into workgroups, and writes results into another storage buffer. This is GPU data-parallelism exposed inside the browser.',
  };

  yield {
    state: labelMatrix(
      'Resource type fit',
      [
        { id: 'uniform', label: 'uniform buffer' },
        { id: 'storage', label: 'storage buffer' },
        { id: 'vertex', label: 'vertex buffer' },
        { id: 'index', label: 'index buffer' },
        { id: 'readback', label: 'readback buffer' },
      ],
      [
        { id: 'shader access', label: 'shader access' },
        { id: 'data structure shape', label: 'data structure shape' },
      ],
      [
        ['read constants', 'small config block'],
        ['read/write arrays', 'large flat arrays'],
        ['read per vertex', 'struct stream'],
        ['read indices', 'compact topology'],
        ['CPU map after copy', 'staging result'],
      ],
    ),
    highlight: { active: ['storage:shader access', 'vertex:data structure shape', 'index:data structure shape'], found: ['uniform:data structure shape'] },
    explanation: 'Choosing the buffer type is choosing the access pattern. Uniforms are compact constants, storage buffers are large arrays, vertex and index buffers are draw-specific streams, and readback buffers are CPU-visible staging space.',
  };

  yield {
    state: resourceGraph('Command encoding separates recording from execution'),
    highlight: { active: ['pipe', 'queue', 'e-pipe-queue'], found: ['bind'], compare: ['js'] },
    explanation: 'WebGPU records work into a command encoder, finishes a command buffer, then submits it to the queue. JavaScript is describing future GPU work, not executing each shader invocation directly.',
    invariant: 'The queue timeline and the JavaScript event loop are related but not the same timeline.',
  };

  yield {
    state: computeGraph('Readback copies GPU output into a mappable buffer'),
    highlight: { active: ['out', 'readback', 'e-out-readback'], found: ['dispatch'], compare: ['inA', 'inB'] },
    explanation: 'Compute output usually lives in a storage buffer that is not directly mappable for CPU reads. The usual path is copyBufferToBuffer into a MAP_READ staging buffer, then mapAsync and read the ArrayBuffer after the GPU has completed the copy.',
  };

  yield {
    state: labelMatrix(
      'Complete case study: sparse PageRank in the browser',
      [
        { id: 'rowptr', label: 'rowPtr' },
        { id: 'colidx', label: 'colIdx' },
        { id: 'rank', label: 'rank values' },
        { id: 'next', label: 'next values' },
        { id: 'control', label: 'iteration params' },
      ],
      [
        { id: 'WebGPU resource', label: 'WebGPU resource' },
        { id: 'source topic', label: 'source topic' },
      ],
      [
        ['read-only storage', 'Compressed Sparse Row Graph'],
        ['read-only storage', 'Compressed Sparse Row Graph'],
        ['storage buffer', 'PageRank'],
        ['writable storage', 'PageRank'],
        ['uniform buffer', 'algorithm constants'],
      ],
    ),
    highlight: { active: ['rowptr:WebGPU resource', 'colidx:WebGPU resource', 'rank:WebGPU resource', 'next:WebGPU resource'], found: ['control:WebGPU resource'] },
    explanation: 'The case-study bridge is concrete: a CSR graph becomes flat storage buffers, a PageRank iteration becomes a compute dispatch, and the browser app reads back only summaries or the final rank vector.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'resource binding') yield* resourceBinding();
  else if (view === 'compute pass') yield* computePass();
  else throw new InputError('Pick a WebGPU view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'WebGPU is the modern browser API for sending graphics and compute work to the GPU. The data-structure lesson is not just "use the GPU." It is the explicit resource graph: JavaScript creates GPUBuffer objects, declares usage flags, connects resources to shader slots with bind groups, records commands, and submits command buffers to a GPU queue.',
        'The W3C WebGPU specification is the standards reference: https://www.w3.org/TR/webgpu/. MDN describes the practical flow as requesting a device, creating buffers and pipelines, encoding commands, finishing command buffers, and submitting them to the queue: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API.',
      ],
    },
    {
      heading: 'Data structure model',
      paragraphs: [
        'A GPUBuffer is not a JavaScript array. It is a typed GPU resource with a size and usage flags. Host-side data often starts in a TypedArray, but the shader sees bytes interpreted through WGSL declarations and buffer binding rules. That is why Apache Arrow Columnar Memory, WebAssembly Linear Memory, and Compressed Sparse Row Graph are natural prerequisites: they teach flat memory layout before WebGPU asks the GPU to consume it.',
        'Bind groups are the key indirection structure. A bind group layout defines the slots a shader expects, and a bind group fills those slots with concrete buffers, textures, or samplers. MDN describes GPUBindGroup as a group of resources based on a layout and used by shader stages: https://developer.mozilla.org/en-US/docs/Web/API/GPUBindGroup. The GPUDevice.createBindGroupLayout reference explains the layout as the structure and purpose of related GPU resources: https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createBindGroupLayout.',
      ],
    },
    {
      heading: 'Command and queue model',
      paragraphs: [
        'WebGPU separates resource creation from command recording and command execution. JavaScript records a sequence of GPU commands into a GPUCommandEncoder, creates a pass encoder for render or compute work, sets pipelines and bind groups, dispatches workgroups or draw calls, finishes a command buffer, and submits it to a queue. MDN documents GPUCommandEncoder as collecting commands to issue to the GPU: https://developer.mozilla.org/en-US/docs/Web/API/GPUCommandEncoder.',
        'This timeline separation matters. JavaScript may enqueue work quickly, while the GPU executes later. Reading results back to the CPU is therefore explicit: copy output into a mappable readback buffer, wait with mapAsync or queue completion, then read the ArrayBuffer. A GPU program that ignores this boundary becomes a race between the event loop and the queue timeline.',
      ],
    },
    {
      heading: 'Complete case study: sparse PageRank',
      paragraphs: [
        'A browser PageRank demo can store a CSR graph as three flat buffers: rowPtr, colIdx, and optional edge weights. Rank values live in one storage buffer and next-rank values in another. A uniform buffer stores constants such as damping factor and vertex count. The compute shader dispatches workgroups across vertices, scans rowPtr ranges, reads neighbor ranks, and writes the next vector.',
        'That case study links several topics. Compressed Sparse Row Graph provides rowPtr and colIdx. PageRank provides the iterative algorithm. Web Workers can prepare the graph and avoid blocking the UI. WebAssembly Linear Memory explains the pointer-plus-length boundary, and WebGPU extends the same discipline onto the GPU queue. Texture Atlas & Mipmaps and Depth Buffer Z-Test show the graphics side of the same resource model. Render Graph Framegraph Resource Lifetimes zooms out from one bind group to the whole frame dependency DAG.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first pitfall is missing usage flags. If a buffer must be copied, read, written by a shader, or used as a vertex buffer, those uses need to be declared up front. The second pitfall is layout mismatch: WGSL alignment, array stride, and struct layout must match the bytes JavaScript uploads. The third pitfall is readback: a compute output buffer is often not directly CPU-readable.',
        'WebGPU also does not remove algorithm design. Data transfer can dominate small workloads. Many tiny dispatches waste overhead. Writable storage buffers can create race conditions if multiple invocations write the same location without a plan. The fast path is still a data-structure path: flat arrays, coalesced access, predictable strides, and minimal round trips to JavaScript.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: WebGPU specification at https://www.w3.org/TR/webgpu/, MDN WebGPU API at https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API, GPUBuffer at https://developer.mozilla.org/en-US/docs/Web/API/GPUBuffer, GPUBindGroup at https://developer.mozilla.org/en-US/docs/Web/API/GPUBindGroup, GPUCommandEncoder at https://developer.mozilla.org/en-US/docs/Web/API/GPUCommandEncoder, and WGSL at https://www.w3.org/TR/WGSL/.',
        'Practical companion: WebGPU Fundamentals on storage buffers at https://webgpufundamentals.org/webgpu/lessons/webgpu-storage-buffers.html. Study WebGPU Parallel Prefix Scan & Compaction, WebGPU Swapchain Frame Pacing, OffscreenCanvas Worker Renderer, Texture Atlas & Mipmaps, Depth Buffer Z-Test, Deferred G-Buffer, Render Graph Framegraph Resource Lifetimes, WebAssembly Linear Memory Case Study, Apache Arrow Columnar Memory Case Study, Compressed Sparse Row Graph, PageRank, Browser Rendering, GPU All-Reduce, and Heterogeneous AI Compute Workload Router next.',
      ],
    },
  ],
};
