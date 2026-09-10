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

// camera parameters
const cameraWidth = 1280;
const cameraHeight = 720;
const fovElement = document.getElementById("fov");
const cameraRotationDegrees = 0;

function createCameraParams() {
    // focal_lengthはfovをもとに計算する
    let fov_rad = fovElement.value * Math.PI / 180.0;
    let frame_diag = Math.sqrt(cameraWidth * cameraWidth + cameraHeight * cameraHeight);
    let focal_length = frame_diag * 0.5 / Math.tan(fov_rad * 0.5);
    let params = {
        "focal_length": focal_length,
        "frame_width": cameraWidth,
        "frame_height": cameraHeight,
        "rotation_degrees": cameraRotationDegrees,
    };
    return params;
}

let cameraParams = createCameraParams();
fovElement.addEventListener("input", (event) => {
    cameraParams = createCameraParams();
})

// gravity
const gxElement = document.getElementById("gx");
const gyElement = document.getElementById("gy");
const gzElement = document.getElementById("gz");

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
            width: cameraWidth,
            height: cameraHeight
        }
        : { 
            width: cameraWidth,
            height: cameraHeight
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
            // delegate: "CPU"  // TODO: GPUだとoutputFaceBlendshapesを設定するとエラー
        },
        // outputFaceBlendshapes: true,
        runningMode: "VIDEO"
    });

    // フレームごとに検出ループ
    let lastVideoTime = -1;
    function renderLoop() {
        if (video.currentTime !== lastVideoTime) {
            let timestamp = performance.now();
            let timestamp_ns = timestamp * 1e6;
            const result = holisticLandmarker.detectForVideo(video, timestamp);
            // console.log(result); // poseLandmarks / faceLandmarks / leftHandLandmarks / rightHandLandmarks

            // json変換
            let json_msg = {
                "camera_params": cameraParams,
                "gravity": [
                    gxElement.value,
                    gyElement.value,
                    gzElement.value,
                ],
                "gravity_stamp": timestamp_ns
            };

            if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
                // TODO: 現状GPUでは動かない 
                console.log(result.faceBlendshapes[0].categories);
            }

            if (result.faceLandmarks && result.faceLandmarks.length > 0) {
                json_msg["face_landmarks"] = [];
                const landmarks = result.faceLandmarks[0];
                for (const landmark of landmarks) {
                    let pt = {
                        "x": landmark.x,
                        "y": landmark.y,
                        "z": landmark.z,
                    };
                    json_msg["face_landmarks"].push(pt);
                }
                json_msg["face_landmarks_stamp"] = timestamp_ns;
            }

            if (result.poseLandmarks && result.poseLandmarks.length > 0) {
                json_msg["pose_landmarks"] = [];
                const landmarks = result.poseLandmarks[0];
                for (const landmark of landmarks) {
                    let pt = {
                        "x": landmark.x,
                        "y": landmark.y,
                        "z": landmark.z,
                    };
                    json_msg["pose_landmarks"].push(pt);
                }
                json_msg["pose_landmarks_stamp"] = timestamp_ns;
            }

            if (result.poseWorldLandmarks && result.poseWorldLandmarks.length > 0) {
                json_msg["pose_world_landmarks"] = [];
                const landmarks = result.poseWorldLandmarks[0];
                for (const landmark of landmarks) {
                    let pt = {
                        "x": landmark.x,
                        "y": landmark.y,
                        "z": landmark.z,
                        "visibility": landmark.visibility,
                    };
                    json_msg["pose_world_landmarks"].push(pt);
                }
                json_msg["pose_world_landmarks_stamp"] = timestamp_ns;
            }

            if (result.leftHandWorldLandmarks && result.leftHandWorldLandmarks.length > 0) {
                json_msg["left_hand_world_landmarks"] = [];
                const landmarks = result.leftHandWorldLandmarks[0];
                for (const landmark of landmarks) {
                    let pt = {
                        "x": landmark.x,
                        "y": landmark.y,
                        "z": landmark.z,
                    };
                    json_msg["left_hand_world_landmarks"].push(pt);
                }
                json_msg["left_hand_world_landmarks_stamp"] = timestamp_ns;
            }

            if (result.rightHandWorldLandmarks && result.rightHandWorldLandmarks.length > 0) {
                json_msg["right_hand_world_landmarks"] = [];
                const landmarks = result.rightHandWorldLandmarks[0];
                for (const landmark of landmarks) {
                    let pt = {
                        "x": landmark.x,
                        "y": landmark.y,
                        "z": landmark.z,
                    };
                    json_msg["right_hand_world_landmarks"].push(pt);
                }
                json_msg["right_hand_world_landmarks_stamp"] = timestamp_ns;
            }

            console.log(json_msg);

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

            // fps
            let processTime = performance.now() - timestamp;
            let processFPS = 1.0 / (processTime * 1e-3);
            console.log(`${processFPS} FPS`);

            lastVideoTime = video.currentTime;
        }
        requestAnimationFrame(renderLoop);
    }
    renderLoop();
}
main();