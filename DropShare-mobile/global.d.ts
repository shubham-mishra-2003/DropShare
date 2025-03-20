declare module "*.png" {
  const value: any;
  export default value;
}

declare module "onnxruntime-react-native" {
  import * as ort from "onnxruntime-common";
  export = ort;
}

declare module "react-native-crypto" {
  import crypto from "crypto";
  export = crypto;
}
