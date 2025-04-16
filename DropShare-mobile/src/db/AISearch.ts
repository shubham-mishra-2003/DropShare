import RNFS from "react-native-fs";

interface OnnxRuntimeModule {
  InferenceSession: {
    create(
      modelPath: string,
      options?: { executionProviders?: string[] }
    ): Promise<any>;
    prototype: any;
  };
  Tensor: {
    new (type: string, data: Float32Array | number[], dims: number[]): any;
    prototype: any;
  };
}

interface Prediction {
  className: string;
  confidence: number;
}

const resizeImage = (
  uint8Array: Uint8Array,
  origWidth: number,
  origHeight: number,
  targetWidth: number,
  targetHeight: number
): Uint8Array => {
  const targetSize = targetWidth * targetHeight * 3;
  const resizedData = new Uint8Array(targetSize);
  const scaleX = origWidth / targetWidth;
  const scaleY = origHeight / targetHeight;

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const origX = Math.floor(x * scaleX);
      const origY = Math.floor(y * scaleY);
      const origIdx =
        (Math.min(origY, origHeight - 1) * origWidth +
          Math.min(origX, origWidth - 1)) *
        3;
      const targetIdx = (y * targetWidth + x) * 3;

      if (origIdx < uint8Array.length) {
        resizedData[targetIdx] = uint8Array[origIdx];
        resizedData[targetIdx + 1] = uint8Array[origIdx + 1];
        resizedData[targetIdx + 2] = uint8Array[origIdx + 2];
      } else {
        resizedData[targetIdx] = 0;
        resizedData[targetIdx + 1] = 0;
        resizedData[targetIdx + 2] = 0;
      }
    }
  }

  return resizedData;
};

export const classifyImage = async (filePath: string): Promise<string[]> => {
  try {
    const { modelLocalPath, labelsLocalPath } = await ensureModelFiles();
    const ortModule = (await import(
      "onnxruntime-react-native"
    )) as OnnxRuntimeModule;
    const { InferenceSession, Tensor } = ortModule;
    const session = await InferenceSession.create(modelLocalPath, {
      executionProviders: ["cpu"],
    });

    const { tensor } = await preprocessImage(filePath, Tensor);
    const feeds = { images: tensor };
    const outputMap = await session.run(feeds);

    const output = outputMap["output0"].data as Float32Array;
    const numBoxes = output.length / 85;
    const confidences = new Float32Array(numBoxes);
    const classIds = new Uint32Array(numBoxes);

    for (let i = 0; i < numBoxes; i++) {
      const offset = i * 85;
      const confidence = output[offset + 4];
      confidences[i] = confidence;
      const classScores = output.slice(offset + 5, offset + 85);
      classIds[i] = classScores.indexOf(Math.max(...classScores));
    }

    const labelsData = await RNFS.readFile(labelsLocalPath, "utf8");
    const cocoLabels = labelsData
      .split("\n")
      .map((l) => l.split(": ")[1] || l)
      .filter((l) => l);

    const predictionsData = Array.from(
      { length: numBoxes },
      (_, i) =>
        ({
          className: cocoLabels[classIds[i]] || "unknown",
          confidence: confidences[i],
        } as Prediction)
    )
      .filter((p) => p.confidence > 0.3)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    const formattedPredictions = predictionsData.map(
      (p) => `${p.className} (${(p.confidence * 100).toFixed(2)}%)`
    );
    return formattedPredictions;
  } catch (error) {
    console.error("❌ Classification error for", filePath, ":", error);
    return [];
  }
};

const ensureModelFiles = async () => {
  const modelLocalPath = `${RNFS.DocumentDirectoryPath}/yolov8n.onnx`;
  const labelsLocalPath = `${RNFS.DocumentDirectoryPath}/coco_classes.txt`;
  const modelAssetPath = "model/yolov8n.onnx";
  const labelsAssetPath = "model/coco_classes.txt";

  if (!(await RNFS.exists(modelLocalPath))) {
    await RNFS.copyFileAssets(modelAssetPath, modelLocalPath);
  }
  if (!(await RNFS.exists(labelsLocalPath))) {
    await RNFS.copyFileAssets(labelsAssetPath, labelsLocalPath);
  }

  return { modelLocalPath, labelsLocalPath };
};

const preprocessImage = async (
  filePath: string,
  Tensor: any
): Promise<{ tensor: any }> => {
  try {
    const imageData = await RNFS.readFile(filePath, "base64");

    const binaryString = atob(imageData);
    const uint8Array = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++)
      uint8Array[i] = binaryString.charCodeAt(i);

    let origWidth = Math.floor(Math.sqrt(uint8Array.length / 3));
    let origHeight = Math.floor(uint8Array.length / (3 * origWidth));
    if (origWidth * origHeight * 3 !== uint8Array.length) {
      while (origWidth > 0 && origHeight * origWidth * 3 > uint8Array.length)
        origWidth--;
      origHeight = Math.floor(uint8Array.length / (3 * origWidth));
    }

    const targetWidth = 640;
    const targetHeight = 640;
    const resizedData = resizeImage(
      uint8Array,
      origWidth,
      origHeight,
      targetWidth,
      targetHeight
    );

    const floatArray = new Float32Array(resizedData.length);
    for (let i = 0; i < resizedData.length; i++)
      floatArray[i] = resizedData[i] / 255.0;

    const tensor = new Tensor("float32", floatArray, [
      1,
      3,
      targetHeight,
      targetWidth,
    ]);
    return { tensor };
  } catch (error) {
    console.error("❌ Preprocessing error for", filePath, ":", error);
    throw error;
  }
};
