import RNFS from "react-native-fs";

// Define an interface for the onnxruntime-react-native module
interface OnnxRuntimeModule {
  InferenceSession: {
    create(
      modelPath: string,
      options?: { executionProviders?: string[] }
    ): Promise<any>; // Use any temporarily
    prototype: any;
  };
  Tensor: {
    new (type: string, data: Float32Array | number[], dims: number[]): any;
    prototype: any;
  };
}

async function testOnnxRuntime() {
  console.time("Inference");

  try {
    // Dynamically import the module and cast to the interface
    const ortModule = (await import(
      "onnxruntime-react-native"
    )) as OnnxRuntimeModule;
    const { InferenceSession, Tensor } = ortModule;
    console.log("✅ ONNX Runtime module loaded");

    // Load the ONNX model
    const modelPath =
      "file:///android/app/src/main/assets/mobilenetv3_large_100_Opset16.onnx";
    const session = await InferenceSession.create(modelPath, {
      executionProviders: ["cpu"],
    });
    console.log("✅ ONNX Runtime model loaded");

    // Create a dummy tensor
    const dummyData = new Float32Array(224 * 224 * 3).fill(0.5);
    const tensor = new Tensor("float32", dummyData, [1, 3, 224, 224]);
    console.log("✅ Dummy tensor created");

    // Run inference
    const feeds = { input: tensor };
    const outputMap = await session.run(feeds);
    const output = outputMap.output.data as Float32Array;
    console.log("✅ Inference completed", output.length);

    // Process output with ImageNet labels
    const labelsData = await RNFS.readFileAssets(
      "imagenet_classes.txt",
      "utf8"
    );
    if (!labelsData) {
      console.error("❌ Failed to load imagenet_classes.txt");
      return;
    }
    console.log("✅ Labels loaded");
    const imagenetLabels = labelsData
      .split("\n")
      .map((label) => label.trim())
      .filter((label) => label.length > 0);
    const predictions = Array.from(output)
      .map((confidence, index) => ({
        className: imagenetLabels[index] || `class_${index}`,
        confidence,
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
      .map((p) => `${p.className} (${(p.confidence * 100).toFixed(2)}%)`);

    console.log("Top 5 Predictions (dummy):", predictions);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    console.timeEnd("Inference");
  }
}

testOnnxRuntime().catch(console.error);
