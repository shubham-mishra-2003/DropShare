import React, { createContext, useContext, useState } from "react";

interface DirectoryContextProps {
  selectedPath: string;
  setSelectedPath: (path: string) => void;
}

const DirectoryContext = createContext<DirectoryContextProps | undefined>(
  undefined,
);

export const DirectoryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [selectedPath, setSelectedPath] = useState<string>("");

  return (
    <DirectoryContext.Provider value={{ selectedPath, setSelectedPath }}>
      {children}
    </DirectoryContext.Provider>
  );
};

export const useDirectory = () => {
  const context = useContext(DirectoryContext);
  if (!context) {
    throw new Error("useDirectory must be used within a DirectoryProvider");
  }
  return context;
};
