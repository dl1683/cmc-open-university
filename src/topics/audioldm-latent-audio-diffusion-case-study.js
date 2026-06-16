// AudioLDM moves text-to-audio generation into a latent representation:
// CLAP-style text/audio embeddings condition a latent diffusion model, then a
// decoder renders waveform audio.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'audioldm-latent-audio-diffusion-case-study',
  title: 'AudioLDM Latent Audio Diffusion Case Study',
  category: 'AI & ML',
  summary: 'Text-to-audio generation with latent diffusion: CLAP conditioning, audio latents, denoising, waveform decoding, edit masks, and evaluation ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['latent pipeline', 'audio edits'], defaultValue: 'latent pipeline' },
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

function audioGraph(title) {
  return graphState({
    nodes: [
      { id: 'prompt', label: 'text', x: 0.8, y: 3.2, note: 'prompt' },
      { id: 'clapT', label: 'CLAP-T', x: 2.3, y: 2.3, note: 'text emb' },
      { id: 'clapA', label: 'CLAP-A', x: 2.3, y: 4.4, note: 'audio emb' },
      { id: 'latent', label: 'latent', x: 4.2, y: 3.3, note: 'z' },
      { id: 'noise', label: 'noise', x: 5.9, y: 4.4, note: 'zt' },
      { id: 'denoise', label: 'denoise', x: 7.2, y: 3.3, note: 'LDM' },
      { id: 'mel', label: 'mel', x: 8.6, y: 2.4, note: 'spec' },
      { id: 'wave', label: 'wave', x: 9.5, y: 4.0, note: 'audio' },
    ],
    edges: [
      { id: 'e-prompt-clapt', from: 'prompt', to: 'clapT' },
      { id: 'e-clapt-denoise', from: 'clapT', to: 'denoise' },
      { id: 'e-clapa-latent', from: 'clapA', to: 'latent' },
      { id: 'e-latent-noise', from: 'latent', to: 'noise' },
      { id: 'e-noise-denoise', from: 'noise', to: 'denoise' },
      { id: 'e-denoise-mel', from: 'denoise', to: 'mel' },
      { id: 'e-mel-wave', from: 'mel', to: 'wave' },
    ],
  }, { title });
}

function* latentPipeline() {
  yield {
    state: audioGraph('Text-conditioned latent audio generation'),
    highlight: { active: ['prompt', 'clapT', 'denoise', 'e-prompt-clapt', 'e-clapt-denoise'], found: ['latent', 'noise'] },
    explanation: 'AudioLDM conditions latent diffusion with text embeddings from contrastive language-audio pretraining. The denoiser works in a compact latent audio space instead of directly generating every waveform sample.',
    invariant: 'The text condition guides the latent denoising path; the decoder is responsible for turning latents back into audible structure.',
  };

  yield {
    state: labelMatrix(
      'Audio tensors',
      [
        { id: 'wave', label: 'wave' },
        { id: 'mel', label: 'mel' },
        { id: 'latent', label: 'latent' },
        { id: 'embed', label: 'embed' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'job', label: 'job' },
      ],
      [
        ['wav', 'listen'],
        ['t/f', 'decode'],
        ['z grid', 'diff'],
        ['vec', 'cond'],
      ],
    ),
    highlight: { active: ['latent:job', 'embed:job'], compare: ['wave:shape', 'mel:shape'] },
    explanation: 'The implementation is a stack of representations. Waveforms are for playback, spectrogram-like features are for audio rendering, latents are for efficient diffusion, and embeddings carry text-audio alignment.',
  };

  yield {
    state: audioGraph('Denoised latent becomes spectrogram and waveform'),
    highlight: { active: ['noise', 'denoise', 'mel', 'wave', 'e-noise-denoise', 'e-denoise-mel', 'e-mel-wave'], compare: ['clapT'] },
    explanation: 'After iterative denoising, the latent decoder and vocoder-like rendering path produce audible sound. The model has to preserve event timing, texture, and prompt semantics through several representation changes.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'second', min: 0, max: 8 }, y: { label: 'energy', min: 0, max: 100 } },
      series: [
        { id: 'rain', label: 'rain', points: [{ x: 0, y: 40 }, { x: 1, y: 45 }, { x: 2, y: 47 }, { x: 3, y: 49 }, { x: 4, y: 48 }, { x: 5, y: 46 }, { x: 6, y: 44 }, { x: 7, y: 43 }] },
        { id: 'thunder', label: 'thunder', points: [{ x: 0, y: 8 }, { x: 1, y: 12 }, { x: 2, y: 18 }, { x: 3, y: 82 }, { x: 4, y: 35 }, { x: 5, y: 13 }, { x: 6, y: 11 }, { x: 7, y: 10 }] },
      ],
      markers: [
        { id: 'hit', x: 3, y: 82, label: 'event' },
      ],
    }),
    highlight: { active: ['rain', 'thunder', 'hit'] },
    explanation: 'Audio quality is temporal. A good generation does not only match a label such as rain; it places events, ambience, and dynamics at plausible times.',
  };
}

function* audioEdits() {
  yield {
    state: labelMatrix(
      'Edit masks',
      [
        { id: 'inpaint', label: 'paint' },
        { id: 'style', label: 'style' },
        { id: 'super', label: 'super' },
        { id: 'mix', label: 'mix' },
      ],
      [
        { id: 'mask', label: 'mask' },
        { id: 'condition', label: 'cond' },
      ],
      [
        ['span', 'gap'],
        ['global', 'texture'],
        ['band', 'restore'],
        ['stems', 'mix'],
      ],
    ),
    highlight: { active: ['inpaint:mask', 'style:condition', 'super:mask'], compare: ['mix:condition'] },
    explanation: 'Latent audio diffusion can support edits because the state is structured. Masks can target time spans, frequency bands, style vectors, or separated stems depending on the product.',
  };

  yield {
    state: audioGraph('Inpainting preserves context and regenerates a gap'),
    highlight: { active: ['latent', 'noise', 'denoise', 'mel'], found: ['prompt'], compare: ['wave'] },
    explanation: 'For inpainting, the known audio context stays fixed while the masked latent span is noised and regenerated. The prompt and surrounding sound both condition the missing segment.',
  };

  yield {
    state: labelMatrix(
      'Evaluation ledger',
      [
        { id: 'fd', label: 'FD' },
        { id: 'sem', label: 'sem' },
        { id: 'pref', label: 'human' },
        { id: 'safety', label: 'safety' },
      ],
      [
        { id: 'asks', label: 'asks' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['dist', 'proxy'],
        ['match', 'shallow'],
        ['prefs', 'cost'],
        ['policy', 'miss'],
      ],
    ),
    highlight: { active: ['fd:asks', 'sem:asks', 'pref:asks', 'safety:asks'], compare: ['fd:risk', 'sem:risk'] },
    explanation: 'Audio evaluation needs several ledgers. Distribution metrics, prompt matching, human preference, safety review, and latency all catch different failure modes.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'guidance', min: 0, max: 10 }, y: { label: 'relative score', min: 0, max: 100 } },
      series: [
        { id: 'align', label: 'align', points: [{ x: 1, y: 40 }, { x: 3, y: 62 }, { x: 5, y: 78 }, { x: 7, y: 85 }, { x: 9, y: 88 }] },
        { id: 'natural', label: 'natural', points: [{ x: 1, y: 86 }, { x: 3, y: 84 }, { x: 5, y: 78 }, { x: 7, y: 66 }, { x: 9, y: 48 }] },
      ],
      markers: [
        { id: 'trade', x: 5, y: 78, label: 'route' },
      ],
    }),
    highlight: { active: ['align', 'natural', 'trade'] },
    explanation: 'Guidance can improve prompt adherence while hurting naturalness. A production tool often routes preview, final render, and edit modes to different guidance and sampler settings.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'latent pipeline') yield* latentPipeline();
  else if (view === 'audio edits') yield* audioEdits();
  else throw new InputError('Pick an AudioLDM view.');
}

export const article = {
  references: [
    { title: 'AudioLDM: Text-to-Audio Generation with Latent Diffusion Models', url: 'https://proceedings.mlr.press/v202/liu23f.html' },
    { title: 'AudioLDM project page', url: 'https://audioldm.github.io/' },
    { title: 'AudioLDM paper PDF', url: 'https://proceedings.mlr.press/v202/liu23f/liu23f.pdf' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['AudioLDM is a text-to-audio system built on latent diffusion. Instead of denoising raw waveforms directly, it learns and samples continuous audio representations conditioned by language-audio embeddings.', 'This module extends Diffusion Models and Variational Autoencoders: the expensive object is audio, but the sampler operates in a compressed latent space and a decoder renders the final waveform.'] },
    { heading: 'Data structures', paragraphs: ['The pipeline stores prompt text, text embeddings, audio embeddings, latent tensors, noise timesteps, denoised latents, spectrogram-like representations, waveform samples, edit masks, and evaluation scores.', 'CLAP-style embeddings align text and audio. The latent diffusion model can use text embeddings during sampling while training on audio representations, which helps separate audio reconstruction from cross-modal conditioning.'] },
    { heading: 'How it works', paragraphs: ['A pretrained language-audio representation maps text and audio into a shared semantic space. The latent diffusion model learns to generate audio latents, and the decoder turns those latents into audible output.', 'The same latent structure supports more than simple generation. Inpainting, style transfer, and super-resolution can be represented as masks or constraints over latent audio states.'] },
    { heading: 'Complete case study', paragraphs: ['A sound-design tool receives the prompt "rain in a metal warehouse with distant thunder." The system creates a text embedding, samples latent audio, decodes a waveform, and records metrics for prompt match, distribution quality, human preference, safety, and render time.', 'An editor then masks a two-second region and asks for a louder thunder hit. The product reuses the surrounding latent context, regenerates only the masked span, and stores the edit mask with the generation seed.'] },
    { heading: 'Pitfalls', paragraphs: ['Audio failures can be subtle. A sample may match the prompt label while having bad timing, harsh artifacts, unnatural dynamics, or unsafe content. Evaluation needs listening tests and task-specific checks, not one scalar metric.', 'Another trap is over-guidance. Pushing prompt adherence too hard can reduce naturalness or diversity, especially for long ambience where the best result is often textured rather than literal.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: AudioLDM at https://proceedings.mlr.press/v202/liu23f.html, AudioLDM project page at https://audioldm.github.io/, and the paper PDF at https://proceedings.mlr.press/v202/liu23f/liu23f.pdf. Study Diffusion Models, Variational Autoencoders, Embeddings & Similarity, Convolution, and Normalizing Flows next.'] },
  ],
};
