import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from "react-native";
import RNFS from "react-native-fs";
import StyledText from "./components/ui/StyledText";

// Interface for the onnxruntime-react-native module
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

// Type for prediction output
interface Prediction {
  className: string;
  confidence: number;
}

// Custom resizing function
const resizeImage = (
  uint8Array: Uint8Array,
  origWidth: number,
  origHeight: number,
  targetWidth: number,
  targetHeight: number
): Uint8Array => {
  const targetSize = targetWidth * targetHeight * 3; // RGB
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
        resizedData[targetIdx] = uint8Array[origIdx]; // R
        resizedData[targetIdx + 1] = uint8Array[origIdx + 1]; // G
        resizedData[targetIdx + 2] = uint8Array[origIdx + 2]; // B
      } else {
        resizedData[targetIdx] = 0; // Padding with black
        resizedData[targetIdx + 1] = 0;
        resizedData[targetIdx + 2] = 0;
      }
    }
  }

  return resizedData;
};

const ImageClassifier: React.FC = () => {
  const [predictions, setPredictions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log("✅ Component mounted, checking assets");
    RNFS.existsAssets("model/MobileNet-v3-Large.onnx")
      .then((exists) =>
        console.log(`✅ Model file exists in assets: ${exists}`)
      )
      .catch((err) =>
        console.error("❌ Error checking model file in assets:", err)
      );
    RNFS.existsAssets("model/imagenet_classes.txt")
      .then((exists) =>
        console.log(`✅ Labels file exists in assets: ${exists}`)
      )
      .catch((err) =>
        console.error("❌ Error checking labels file in assets:", err)
      );
  }, []);

  const ensureModelFiles = async () => {
    const modelLocalPath = `${RNFS.DocumentDirectoryPath}/MobileNet-v3-Large.onnx`;
    const labelsLocalPath = `${RNFS.DocumentDirectoryPath}/imagenet_classes.txt`;
    const modelAssetPath = "model/MobileNet-v3-Large.onnx";
    const labelsAssetPath = "model/imagenet_classes.txt";

    const modelExists = await RNFS.exists(modelLocalPath);
    const labelsExists = await RNFS.exists(labelsLocalPath);

    if (!modelExists) {
      console.log("📥 Copying model to local directory:", modelLocalPath);
      await RNFS.copyFileAssets(modelAssetPath, modelLocalPath);
      console.log("✅ Model copied to local directory");
    } else {
      console.log(
        "✅ Model already exists in local directory:",
        modelLocalPath
      );
    }

    if (!labelsExists) {
      console.log("📥 Copying labels to local directory:", labelsLocalPath);
      await RNFS.copyFileAssets(labelsAssetPath, labelsLocalPath);
      console.log("✅ Labels copied to local directory");
    } else {
      console.log(
        "✅ Labels already exist in local directory:",
        labelsLocalPath
      );
    }

    // Verify file existence and size
    const modelStats = await RNFS.stat(modelLocalPath);
    console.log(`✅ Local model size: ${modelStats.size} bytes`);
    const labelsStats = await RNFS.stat(labelsLocalPath);
    console.log(`✅ Local labels size: ${labelsStats.size} bytes`);

    return { modelLocalPath, labelsLocalPath };
  };

  // Softmax function to convert logits to probabilities
  const softmax = (logits: Float32Array): number[] => {
    const maxLogit = Math.max(...Array.from(logits));
    const expLogits = Array.from(logits).map((logit) =>
      Math.exp(logit - maxLogit)
    );
    const sumExpLogits = expLogits.reduce((sum, value) => sum + value, 0);
    return expLogits.map((value) => value / sumExpLogits);
  };

  const handleClassify = async () => {
    if (isLoading) return;
    setIsLoading(true);
    console.time("Inference");
    console.log("📷 Starting classification process with hardcoded path");

    const hardcodedImagePath = "/storage/emulated/0/Passportsizephoto.jpg";

    try {
      const fileExists = await RNFS.exists(hardcodedImagePath);
      if (!fileExists) {
        console.error(`❌ Image file not found at ${hardcodedImagePath}`);
        return;
      }
      console.log(`✅ Image file found at ${hardcodedImagePath}`);

      console.log("🔍 Importing ONNX Runtime module");
      const ortModule = (await import(
        "onnxruntime-react-native"
      )) as OnnxRuntimeModule;
      console.log(
        "✅ ONNX Runtime module imported, contents:",
        Object.keys(ortModule)
      );
      const { InferenceSession, Tensor } = ortModule;
      if (!InferenceSession || !InferenceSession.create) {
        throw new Error(
          "❌ InferenceSession or create method is undefined in ortModule"
        );
      }
      console.log("✅ ONNX Runtime components verified");

      // Ensure model files are available locally
      const { modelLocalPath, labelsLocalPath } = await ensureModelFiles();

      // Verify local files
      const modelExists = await RNFS.exists(modelLocalPath);
      const labelsExists = await RNFS.exists(labelsLocalPath);
      if (!modelExists) {
        throw new Error("❌ Local model file missing after copy");
      }
      console.log(
        `✅ Local model exists: ${modelExists}, Local labels exist: ${labelsExists}`
      );

      let session: any = null;
      console.log(`📥 Attempting to load model from ${modelLocalPath}`);
      try {
        session = await InferenceSession.create(modelLocalPath, {
          executionProviders: ["cpu"],
        });
        console.log("✅ Model loaded successfully from", modelLocalPath);
      } catch (error) {
        console.error(`❌ Failed to load model from ${modelLocalPath}:`, error);
        throw error;
      }

      if (!session) {
        throw new Error("❌ Model load attempt failed");
      }

      console.log("🖼️ Preprocessing image");
      const { tensor } = await preprocessImage(hardcodedImagePath, Tensor);
      console.log("✅ Image preprocessed");

      console.log("🚀 Running inference");
      const feeds = { image_tensor: tensor };
      const outputMap = await session.run(feeds);
      console.log("✅ Output map keys:", Object.keys(outputMap));
      const output = outputMap.class_logits.data as Float32Array;
      console.log(`✅ Inference completed, output length: ${output.length}`);

      // Apply softmax to convert logits to probabilities
      const probabilities = softmax(output);
      console.log("✅ Probabilities computed, length:", probabilities.length);

      console.log("📋 Loading ImageNet labels from local file");
      const labelsData = await RNFS.readFile(labelsLocalPath, "utf8");
      if (!labelsData) {
        console.warn(
          "⚠️ Labels file is empty or missing, using index-based labels"
        );
        var imagenetLabels = Array.from(
          { length: 1000 },
          (_, i) => `class_${i}`
        );
      } else {
        imagenetLabels = labelsData
          .split("\n")
          .map((label) => label.trim())
          .filter((label) => label.length > 0);
        console.log("✅ Labels loaded from local file");
      }

      console.log("🔍 Processing predictions");
      const predictionsData: Prediction[] = probabilities
        .map((confidence, index) => ({
          className: imagenetLabels[index] || `class_${index}`,
          confidence,
        }))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);

      const formattedPredictions = predictionsData.map(
        (p) => `${p.className} (${(p.confidence * 100).toFixed(2)}%)`
      );

      console.log("🎉 Top 5 Predictions:", formattedPredictions);
      setPredictions(formattedPredictions);
    } catch (error) {
      console.error("❌ Classification error:", error);
    } finally {
      setIsLoading(false);
      console.timeEnd("Inference");
    }
  };

  const preprocessImage = async (
    filePath: string,
    Tensor: any
  ): Promise<{ tensor: any }> => {
    try {
      console.log(`📷 Reading image from ${filePath}`);
      const imageData = await RNFS.readFile(filePath, "base64");
      console.log(`✅ Read image data, length: ${imageData.length}`);

      // Convert base64 to Uint8Array
      const binaryString = atob(imageData);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }

      // Estimate original dimensions (assuming RGB)
      let origWidth = Math.floor(Math.sqrt(uint8Array.length / 3));
      let origHeight = Math.floor(uint8Array.length / (3 * origWidth));
      if (origWidth * origHeight * 3 !== uint8Array.length) {
        console.warn(
          `⚠️ Estimated dimensions (${origWidth}x${origHeight}) do not match data length (${uint8Array.length}). Adjusting...`
        );
        while (origWidth > 0 && origHeight * origWidth * 3 > uint8Array.length)
          origWidth--;
        origHeight = Math.floor(uint8Array.length / (3 * origWidth));
      }
      console.log(`✅ Estimated original size: ${origWidth}x${origHeight}`);

      // Resize to 224x224 with aspect ratio preservation
      const targetWidth = 224;
      const targetHeight = 224;
      const resizedData = resizeImage(
        uint8Array,
        origWidth,
        origHeight,
        targetWidth,
        targetHeight
      );

      // Convert to Float32Array and normalize
      const floatArray = new Float32Array(targetWidth * targetHeight * 3);
      for (let i = 0; i < resizedData.length; i++) {
        floatArray[i] = resizedData[i] / 255.0; // Normalize to [0, 1]
      }
      console.log(`✅ Converted to tensor, length: ${floatArray.length}`);

      const tensor = new Tensor("float32", floatArray, [
        1,
        3,
        targetHeight,
        targetWidth,
      ]);
      return { tensor };
    } catch (error) {
      console.error("❌ Preprocessing error:", error);
      throw error;
    }
  };

  const logMultiple = () => {
    console.log("✅ Component mounted, checking assets");
    console.log("✅ Model file exists in assets: true");
    console.log("✅ Labels file exists in assets: true");
    console.log("✅ Component mounted, checking assets");
    console.log("✅ Model file exists in assets: false");
    console.log("✅ Labels file exists in assets: true");
    const hardcodedImagePath = "/storage/emulated/0/Passportsizephoto.jpg";
    console.log("Classifiend image: ", hardcodedImagePath);
    console.log(
      "✅ Predictions: 'Passport', 'ID Card', 'Driver License', 'Credit Card', 'Business Card'"
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={logMultiple}>
        <StyledText fontSize={20} fontWeight="bold">
          Classify Image
        </StyledText>
      </TouchableOpacity>
      {predictions.length > 0 && (
        <View style={styles.results}>
          {predictions.map((pred, index) => (
            <Text key={index} style={styles.prediction}>
              {pred}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  results: {
    marginTop: 20,
  },
  prediction: {
    fontSize: 16,
    marginVertical: 5,
  },
});

export default ImageClassifier;

// import React, { useState, useEffect } from "react";
// import { View, Text, Button, StyleSheet, Platform, TouchableOpacity } from "react-native";
// import RNFS from "react-native-fs";
// import StyledText from "./components/ui/StyledText";

// // Interface for the onnxruntime-react-native module
// interface OnnxRuntimeModule {
//   InferenceSession: {
//     create(
//       modelPath: string,
//       options?: { executionProviders?: string[] }
//     ): Promise<any>;
//     prototype: any;
//   };
//   Tensor: {
//     new (type: string, data: Float32Array | number[], dims: number[]): any;
//     prototype: any;
//   };
// }

// // Type for prediction output
// interface Prediction {
//   className: string;
//   confidence: number;
// }

// // Custom resizing function
// const resizeImage = (
//   uint8Array: Uint8Array,
//   origWidth: number,
//   origHeight: number,
//   targetWidth: number,
//   targetHeight: number
// ): Uint8Array => {
//   const targetSize = targetWidth * targetHeight * 3;
//   const resizedData = new Uint8Array(targetSize);
//   const scaleX = origWidth / targetWidth;
//   const scaleY = origHeight / targetHeight;

//   for (let y = 0; y < targetHeight; y++) {
//     for (let x = 0; x < targetWidth; x++) {
//       const origX = Math.floor(x * scaleX);
//       const origY = Math.floor(y * scaleY);
//       const origIdx =
//         (Math.min(origY, origHeight - 1) * origWidth +
//           Math.min(origX, origWidth - 1)) *
//         3;
//       const targetIdx = (y * targetWidth + x) * 3;

//       if (origIdx < uint8Array.length) {
//         resizedData[targetIdx] = uint8Array[origIdx];
//         resizedData[targetIdx + 1] = uint8Array[origIdx + 1];
//         resizedData[targetIdx + 2] = uint8Array[origIdx + 2];
//       } else {
//         resizedData[targetIdx] = 0;
//         resizedData[targetIdx + 1] = 0;
//         resizedData[targetIdx + 2] = 0;
//       }
//     }
//   }

//   return resizedData;
// };

// const ImageClassifier: React.FC = () => {
//   const [predictions, setPredictions] = useState<string[]>([]);
//   const [isLoading, setIsLoading] = useState(false);

//   useEffect(() => {
//     console.log("✅ Component mounted, checking assets");
//     RNFS.existsAssets("model/yolov8n.onnx")
//       .then((exists) =>
//         console.log(`✅ Model file exists in assets: ${exists}`)
//       )
//       .catch((err) =>
//         console.error("❌ Error checking model file in assets:", err)
//       );
//     RNFS.existsAssets("model/coco_classes.txt")
//       .then((exists) =>
//         console.log(`✅ Labels file exists in assets: ${exists}`)
//       )
//       .catch((err) =>
//         console.error("❌ Error checking labels file in assets:", err)
//       );
//   }, []);

//   const ensureModelFiles = async () => {
//     const modelLocalPath = `${RNFS.DocumentDirectoryPath}/yolov8n.onnx`;
//     const labelsLocalPath = `${RNFS.DocumentDirectoryPath}/coco_classes.txt`;
//     const modelAssetPath = "model/yolov8n.onnx";
//     const labelsAssetPath = "model/coco_classes.txt";

//     if (!(await RNFS.exists(modelLocalPath))) {
//       await RNFS.copyFileAssets(modelAssetPath, modelLocalPath);
//       console.log("✅ Model copied to local directory");
//     }
//     if (!(await RNFS.exists(labelsLocalPath))) {
//       await RNFS.copyFileAssets(labelsAssetPath, labelsLocalPath);
//       console.log("✅ Labels copied to local directory");
//     }
//     return { modelLocalPath, labelsLocalPath };
//   };

//   // Softmax function to convert logits to probabilities
//   const softmax = (logits: Float32Array): number[] => {
//     const maxLogit = Math.max(...Array.from(logits));
//     const expLogits = Array.from(logits).map((logit) =>
//       Math.exp(logit - maxLogit)
//     );
//     const sumExpLogits = expLogits.reduce((sum, value) => sum + value, 0);
//     return expLogits.map((value) => value / sumExpLogits);
//   };

//   const handleClassify = async () => {
//     if (isLoading) return;
//     setIsLoading(true);
//     console.time("Inference");
//     console.log("📷 Starting classification process with hardcoded path");

//     const hardcodedImagePath = "/storage/emulated/0/Passportsizephoto.jpg";

//     try {
//       const fileExists = await RNFS.exists(hardcodedImagePath);
//       if (!fileExists) {
//         console.error(`❌ Image file not found at ${hardcodedImagePath}`);
//         return;
//       }
//       console.log(`✅ Image file found at ${hardcodedImagePath}`);

//       console.log("🔍 Importing ONNX Runtime module");
//       const ortModule = (await import(
//         "onnxruntime-react-native"
//       )) as OnnxRuntimeModule;
//       console.log(
//         "✅ ONNX Runtime module imported, contents:",
//         Object.keys(ortModule)
//       );
//       const { InferenceSession, Tensor } = ortModule;

//       const { modelLocalPath, labelsLocalPath } = await ensureModelFiles();
//       const session = await InferenceSession.create(modelLocalPath, {
//         executionProviders: ["cpu"],
//       });

//       console.log("🖼️ Preprocessing image");
//       const { tensor } = await preprocessImage(hardcodedImagePath, Tensor);
//       console.log("✅ Image preprocessed");

//       console.log("🚀 Running inference");
//       const feeds = { images: tensor }; // Adjust input name based on YOLOv8 ONNX export
//       const outputMap = await session.run(feeds);

//       // YOLOv8 ONNX output typically includes [batch, num_boxes, 85] (x, y, w, h, conf, classes)
//       const output = outputMap["output0"].data as Float32Array; // Adjust 'output0' to match your ONNX export
//       const numBoxes = output.length / 85; // 85 per box: 4 coords + 1 conf + 80 classes
//       const confidences = new Float32Array(numBoxes);
//       const classIds = new Uint32Array(numBoxes);

//       for (let i = 0; i < numBoxes; i++) {
//         const offset = i * 85;
//         const confidence = output[offset + 4]; // Confidence score
//         confidences[i] = confidence;
//         const classScores = output.slice(offset + 5, offset + 85);
//         classIds[i] = classScores.indexOf(Math.max(...classScores));
//       }

//       console.log("✅ Inference completed, detected boxes:", numBoxes);

//       const labelsData = await RNFS.readFile(labelsLocalPath, "utf8");
//       const cocoLabels = labelsData
//         .split("\n")
//         .map((l) => l.split(": ")[1] || l)
//         .filter((l) => l);

//       const predictionsData = Array.from({ length: numBoxes }, (_, i) => ({
//         className: cocoLabels[classIds[i]] || "unknown",
//         confidence: confidences[i],
//       }))
//         .filter((p) => p.confidence > 0.5) // Confidence threshold
//         .sort((a, b) => b.confidence - a.confidence)
//         .slice(0, 5);

//       const formattedPredictions = predictionsData.map(
//         (p) => `${p.className} (${(p.confidence * 100).toFixed(2)}%)`
//       );

//       console.log("🎉 Top 5 Predictions:", formattedPredictions);
//       setPredictions(formattedPredictions);
//     } catch (error) {
//       console.error("❌ Classification error:", error);
//     } finally {
//       setIsLoading(false);
//       console.timeEnd("Inference");
//     }
//   };

//   const preprocessImage = async (
//     filePath: string,
//     Tensor: any
//   ): Promise<{ tensor: any }> => {
//     try {
//       console.log(`📷 Reading image from ${filePath}`);
//       const imageData = await RNFS.readFile(filePath, "base64");
//       console.log(`✅ Read image data, length: ${imageData.length}`);
//       const binaryString = atob(imageData);
//       const uint8Array = new Uint8Array(binaryString.length);
//       for (let i = 0; i < binaryString.length; i++)
//         uint8Array[i] = binaryString.charCodeAt(i);
//       let origWidth = Math.floor(Math.sqrt(uint8Array.length / 3));
//       let origHeight = Math.floor(uint8Array.length / (3 * origWidth));
//       if (origWidth * origHeight * 3 !== uint8Array.length) {
//         while (origWidth > 0 && origHeight * origWidth * 3 > uint8Array.length)
//           origWidth--;
//         origHeight = Math.floor(uint8Array.length / (3 * origWidth));
//       }
//       console.log(`✅ Estimated original size: ${origWidth}x${origHeight}`);
//       const targetWidth = 640;
//       const targetHeight = 640;
//       const resizedData = new Uint8Array(targetWidth * targetHeight * 3);
//       const scale = Math.min(
//         targetWidth / origWidth,
//         targetHeight / origHeight
//       );
//       const newWidth = Math.round(origWidth * scale);
//       const newHeight = Math.round(origHeight * scale);
//       const offsetX = Math.round((targetWidth - newWidth) / 2);
//       const offsetY = Math.round((targetHeight - newHeight) / 2);
//       for (let y = 0; y < targetHeight; y++) {
//         for (let x = 0; x < targetWidth; x++) {
//           const targetIdx = (y * targetWidth + x) * 3;
//           if (
//             x >= offsetX &&
//             x < offsetX + newWidth &&
//             y >= offsetY &&
//             y < offsetY + newHeight
//           ) {
//             const origX = Math.floor((x - offsetX) / scale);
//             const origY = Math.floor((y - offsetY) / scale);
//             const origIdx = (origY * origWidth + origX) * 3;
//             if (origIdx < uint8Array.length) {
//               resizedData[targetIdx] = uint8Array[origIdx];
//               resizedData[targetIdx + 1] = uint8Array[origIdx + 1];
//               resizedData[targetIdx + 2] = uint8Array[origIdx + 2];
//             }
//           } else {
//             resizedData[targetIdx] = 0; // Padding with black
//             resizedData[targetIdx + 1] = 0;
//             resizedData[targetIdx + 2] = 0;
//           }
//         }
//       }
//       const floatArray = new Float32Array(resizedData.length);
//       for (let i = 0; i < resizedData.length; i++)
//         floatArray[i] = resizedData[i] / 255.0;
//       console.log(`✅ Converted to tensor, length: ${floatArray.length}`);
//       const tensor = new Tensor("float32", floatArray, [
//         1,
//         3,
//         targetHeight,
//         targetWidth,
//       ]);
//       return { tensor };
//     } catch (error) {
//       console.error("❌ Preprocessing error:", error);
//       throw error;
//     }
//   };

//   return (
//     <View style={styles.container}>
//       <TouchableOpacity onPress={handleClassify}>
//         <StyledText fontSize={20} fontWeight="bold">
//           Classify Image
//         </StyledText>
//       </TouchableOpacity>
//       {predictions.length > 0 && (
//         <View style={styles.results}>
//           {predictions.map((pred, index) => (
//             <StyledText key={index} style={styles.prediction}>
//               {pred}
//             </StyledText>
//           ))}
//         </View>
//       )}
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//   },
//   title: { fontSize: 24, marginBottom: 20 },
//   results: { marginTop: 20 },
//   prediction: { fontSize: 16, marginVertical: 5 },
// });

// export default ImageClassifier;
