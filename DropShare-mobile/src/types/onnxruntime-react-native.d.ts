declare module "onnxruntime-react-native" {
  export class InferenceSession {
    static create(
      modelPath: string,
      options?: { executionProviders?: string[] }
    ): Promise<InferenceSession>;
    run(feeds: { [key: string]: Tensor }): Promise<{ [key: string]: Tensor }>;
  }
  export class Tensor {
    constructor(type: string, data: Float32Array | number[], dims: number[]);
    get data(): Float32Array;
  }
  const ort: {
    InferenceSession: typeof InferenceSession;
    Tensor: typeof Tensor;
  };
  export default ort;
}