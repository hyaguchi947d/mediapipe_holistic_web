import {
    HolisticLandmarker,
    DrawingUtils,
    FaceLandmarker,
    PoseLandmarker,
    HandLandmarker,
    FilesetResolver
} from "@mediapipe/tasks-vision";

const video = document.getElementById("webcam");
const cameraSelect = document.getElementById("cameraSelect");
let currentStream = null;

// https://github.com/google-ai-edge/mediapipe-samples-web/blob/bbb8974ffd450650ad5a1e7c1656c9debb8e38bf/src/components/base-vision-task.ts#L37
const canvasElement = document.getElementById('output_canvas');
const ctx = canvasElement.getContext('2d');
const drawingUtils = new DrawingUtils(ctx);

// カメラ一覧を取得してセレクトボックスに反映
async function populateCameraList() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === "videoinput");

    cameraSelect.innerHTML = "";
    videoInputs.forEach((device, index) => {
        const option = document.createElement("option");
        option.value = device.deviceId;
        // 許可前はlabelが空文字になることがある
        option.text = device.label || `カメラ ${index + 1}`;
        cameraSelect.appendChild(option);
    });
}

// 指定deviceIdでカメラを起動
async function startCamera(deviceId) {
    // 既存のストリームがあれば停止（切り替え時にカメラが二重起動しないように）
    if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
    }

    const constraints = {
        video: deviceId
        ? { 
            deviceId: { exact: deviceId },
            width: 1280,
            height: 720
        }
        : { 
            width: 1280,
            height: 720
        }, // deviceId未指定なら既定のカメラ
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentStream = stream;

    // Webカメラ映像を取得してvideo要素に流す
    video.srcObject = stream;
    await video.play();
}

async function main() {
    // 先に一度getUserMediaで許可を取っておく（label取得のため）
    await startCamera(null);
    await populateCameraList();

    // セレクトボックス変更時にカメラを切り替え
    cameraSelect.addEventListener("change", (e) => {
        startCamera(e.target.value);
    });

    // WASMランタイムをロード
    // const vision = await FilesetResolver.forVisionTasks(
    //   "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    // );
    const vision = await FilesetResolver.forVisionTasks("./mediapipe/wasm");

    // HolisticLandmarkerを作成（VIDEOモード）
    const holisticLandmarker = await HolisticLandmarker.createFromOptions(vision, {
        baseOptions: {
        modelAssetPath:
        //   "https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task",
            "./models/holistic_landmarker.task",
        delegate: "GPU" // 対応環境がなければ "CPU" に
        },
        runningMode: "VIDEO"
    });

    // フレームごとに検出ループ
    let lastVideoTime = -1;
    function renderLoop() {
        if (video.currentTime !== lastVideoTime) {
            const result = holisticLandmarker.detectForVideo(video, performance.now());
            // console.log(result); // poseLandmarks / faceLandmarks / leftHandLandmarks / rightHandLandmarks

            // 描画は公式サンプルを参照
            // https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/tasks/holistic-landmarker.ts#L61
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

            // Face Landmarks
            if (result.faceLandmarks && result.faceLandmarks.length > 0) {
                for (const landmarks of result.faceLandmarks) {
                    drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
                        color: '#C0C0C070',
                        lineWidth: 1,
                    });
                    drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: '#FF3030' });
                    drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: '#FF3030' });
                    drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: '#30FF30' });
                    drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: '#30FF30' });
                    drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: '#E0E0E0' });
                    drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: '#E0E0E0' });
                }
            }

            // Pose Landmarks
            if (result.poseLandmarks && result.poseLandmarks.length > 0) {
                for (const landmarks of result.poseLandmarks) {
                    drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#FFFFFF' });
                    drawingUtils.drawLandmarks(landmarks, { color: '#FF0000', radius: 1 });
                }
            }

            // Hand Landmarks
            if (result.leftHandLandmarks && result.leftHandLandmarks.length > 0) {
                for (const landmarks of result.leftHandLandmarks) {
                    drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: '#CC0000', lineWidth: 5 });
                    drawingUtils.drawLandmarks(landmarks, { color: '#00FF00', lineWidth: 2 });
                }
            }

            if (result.rightHandLandmarks && result.rightHandLandmarks.length > 0) {
                for (const landmarks of result.rightHandLandmarks) {
                    drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: '#00CC00', lineWidth: 5 });
                    drawingUtils.drawLandmarks(landmarks, { color: '#FF0000', lineWidth: 2 });
                }
            }

            lastVideoTime = video.currentTime;
        }
        requestAnimationFrame(renderLoop);
    }
    renderLoop();
}
main();