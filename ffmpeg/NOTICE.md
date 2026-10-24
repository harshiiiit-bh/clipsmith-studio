# FFmpeg.wasm worker notice

The worker implementation in this folder is adapted from [`ffmpegwasm/ffmpeg.wasm`](https://github.com/ffmpegwasm/ffmpeg.wasm), version 0.12.15, under the MIT License.

Copyright (c) 2019 Jerome Wu. The full MIT permission and warranty text is available in the upstream repository's `LICENSE` file.

These small ESM files are hosted from the ClipSmith site origin because browsers do not allow the FFmpeg wrapper to start its main worker directly from a cross-origin CDN URL. The FFmpeg engine/WebAssembly files are still fetched lazily from jsDelivr when conversion is requested.
