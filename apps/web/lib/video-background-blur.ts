import "client-only";

// Real-time background blur for the video recorder (app/networks/[id]/
// record-media.tsx) - there's no browser API for this (a few browsers
// expose something similar, but it's tied to OS-level camera drivers, not
// something a website can turn on). This runs MediaPipe's Selfie
// Segmenter client-side (WASM+model, dynamically imported so pages that
// never touch blur never pay for it) to get a per-pixel "how much is this
// a person" confidence mask each frame, then composites: a blurred copy
// of the full frame first, the sharp person cut out of that same frame
// drawn on top using the mask as an alpha channel. The output canvas is
// what both the live preview and MediaRecorder actually see - this
// replaces the raw camera stream, it doesn't sit alongside it.
const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
const BLUR_PX = 12;
const OUTPUT_FPS = 30;

type Segmenter = import("@mediapipe/tasks-vision").ImageSegmenter;

// One WASM+model load shared across recordings in the same tab (loading
// it fresh per-recording would add several seconds of visible delay every
// time someone toggles blur on).
let segmenterPromise: Promise<Segmenter> | null = null;
function getSegmenter(): Promise<Segmenter> {
  if (!segmenterPromise) {
    segmenterPromise = import("@mediapipe/tasks-vision").then(({ FilesetResolver, ImageSegmenter }) =>
      FilesetResolver.forVisionTasks(WASM_BASE_URL).then((fileset) =>
        ImageSegmenter.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        }),
      ),
    );
  }
  return segmenterPromise;
}

export type BlurredStream = {
  stream: MediaStream;
  stop: () => void;
};

// rawStream must already have its video track live (getUserMedia already
// resolved) - this reads frames from it via a detached, muted <video> and
// writes the blurred composite to an internal, never-attached-to-the-DOM
// canvas every animation frame (no React ref needed - created directly
// here, so there's no risk of running before some element has mounted).
// Audio isn't reprocessed, just passed through onto the returned stream.
export async function createBlurredVideoStream(rawStream: MediaStream): Promise<BlurredStream> {
  const segmenter = await getSegmenter();

  const sourceVideo = document.createElement("video");
  sourceVideo.srcObject = rawStream;
  sourceVideo.muted = true;
  sourceVideo.playsInline = true;
  await sourceVideo.play();

  const width = sourceVideo.videoWidth || 640;
  const height = sourceVideo.videoHeight || 480;
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputCtx = outputCanvas.getContext("2d")!;

  // Two scratch canvases: one holds the mask as an alpha channel (so it
  // can be drawn as a compositing source), the other holds the sharp
  // frame after being cut down to just the person via that mask.
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext("2d")!;

  const personCanvas = document.createElement("canvas");
  personCanvas.width = width;
  personCanvas.height = height;
  const personCtx = personCanvas.getContext("2d")!;

  let rafId = 0;
  let stopped = false;

  function renderFrame() {
    if (stopped) return;
    segmenter.segmentForVideo(sourceVideo, performance.now(), (result) => {
      const confidence = result.confidenceMasks?.[0];
      if (confidence) {
        const maskValues = confidence.getAsFloat32Array();
        const maskImage = maskCtx.createImageData(width, height);
        for (let i = 0; i < maskValues.length; i++) {
          maskImage.data[i * 4 + 3] = Math.round(maskValues[i] * 255);
        }
        maskCtx.putImageData(maskImage, 0, 0);
        confidence.close();
      }
      result.categoryMask?.close();

      personCtx.clearRect(0, 0, width, height);
      personCtx.drawImage(sourceVideo, 0, 0, width, height);
      personCtx.globalCompositeOperation = "destination-in";
      personCtx.drawImage(maskCanvas, 0, 0);
      personCtx.globalCompositeOperation = "source-over";

      outputCtx.filter = `blur(${BLUR_PX}px)`;
      outputCtx.drawImage(sourceVideo, 0, 0, width, height);
      outputCtx.filter = "none";
      outputCtx.drawImage(personCanvas, 0, 0);
    });
    rafId = requestAnimationFrame(renderFrame);
  }
  renderFrame();

  const canvasStream = outputCanvas.captureStream(OUTPUT_FPS);
  const combined = new MediaStream([...canvasStream.getVideoTracks(), ...rawStream.getAudioTracks()]);

  return {
    stream: combined,
    stop: () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      sourceVideo.pause();
      sourceVideo.srcObject = null;
      canvasStream.getTracks().forEach((track) => track.stop());
    },
  };
}
