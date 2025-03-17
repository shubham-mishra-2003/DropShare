import * as mobilenet from "@tensorflow-models/mobilenet";
import * as tf from "@tensorflow/tfjs";
import RNFS from "react-native-fs";
import { Image } from "react-native";

// Load TensorFlow model
let model: mobilenet.MobileNet | null = null;

export const loadModel = async () => {
    if (!model) {
        model = await mobilenet.load();
        console.log("✅ AI Model loaded successfully");
    }
};

// AI-based image classification
export const classifyImage = async (filePath: string) => {
    try {
        await loadModel();
        const image = await Image.resolveAssetSource({ uri: `file://${filePath}` });
        const predictions = await model!.classify(image);
        return predictions.map((p) => p.className).join(", ");
    } catch (error) {
        console.error("❌ Image classification error:", error);
        return null;
    }
};

// Extract text from .txt and .md files
export const extractTextFromFile = async (filePath: string) => {
    try {
        const content = await RNFS.readFile(filePath, "utf8");
        return content.slice(0, 500);
    } catch (error) {
        console.error("❌ Text extraction error:", error);
        return null;
    }
};
