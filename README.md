# Mediapipe HolisticLandmarker Web版

- Author: Hiroaki Yaguchi, 947d-tech
- License: Apache-2.0 (mediapipeに準拠)

claudeとのペアプログラミングによって作成しています。
描画部分は公式サンプルコードを参考にしています。
https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/tasks/holistic-landmarker.ts

## 使用方法

nodejsを先にインストールしてください。

webカメラをPCに接続してください。

### 事前準備

以下のコマンドで準備を行ってください。
初回の一度のみでOKです。

```
npm install
npm download:model
npm copy:mediapipe
```

### サーバー起動

```
npm start
```

### ブラウザから読み込み

http://localhost:3000

にアクセスしてください。
