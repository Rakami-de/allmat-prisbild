# Proffsbilder — experiment

An isolated test room: can an on-device model cut products out of shop photos well enough,
and fast enough, on a real iPhone? Nothing in the main app depends on this folder.

**To remove it:** delete this folder and the one `home.lab` link in `js/ui/views/home.js`.

- Runtime: [onnxruntime-web](https://github.com/microsoft/onnxruntime) 1.30.0 (MIT), WebAssembly, loaded from jsDelivr.
- Models, fetched from Hugging Face on first use and then kept in the browser's Cache Storage:
  - `BritishWerewolf/U-2-Netp` — U²-Net-P, 4.6 MB, Apache-2.0, 320 px input. Fast, soft edges.
  - `onnx-community/ormbg-ONNX` (int8) — IS-Net, 44 MB, Apache-2.0, 1024 px input. Slower, sharper.
- No server, no API key, no cost. Photos never leave the phone.
- Deliberately avoided: `@imgly/background-removal` (AGPL-3.0) and BRIA RMBG (non-commercial licence).
