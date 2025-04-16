import { useState } from "react";

const useCurrentPath = (path: string) => {
  const [currentPath, setCurrentPath] = useState(path);

  return { currentPath, setCurrentPath };
};

export default useCurrentPath;
