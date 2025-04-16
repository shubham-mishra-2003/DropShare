import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../hooks/ThemeProvider";
import path from "path";

// Define types
interface FileItem {
  name: string;
  fullPath: string;
  isDirectory: boolean;
}

interface SelectedFile {
  name: string;
  content: string;
}

interface FilesScreenProps {
  drive: string;
}

const FilesScreen: React.FC<FilesScreenProps> = ({ drive }) => {
  const { colorScheme } = useTheme();
  const [currentPath, setCurrentPath] = useState<string>(drive);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [pathStack, setPathStack] = useState<string[]>([drive]);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  // const getFiles = (dirPath: string) => {
  //   try {
  //     const items = fs.readdirSync(dirPath);
  //     const detailedItems: FileItem[] = items.map((item) => {
  //       const itemPath = path.join(dirPath, item);
  //       return {
  //         name: item,
  //         fullPath: itemPath,
  //         isDirectory: fs.statSync(itemPath).isDirectory(),
  //       };
  //     });
  //     setFiles(detailedItems);
  //     setError(null); // Clear previous errors
  //   } catch (err) {
  //     console.error("Error reading directory:", err);
  //     setError("Failed to load directory. Please check the path.");
  //     setFiles([]);
  //   }
  // };

  // useEffect(() => {
  //   if (fs.existsSync(currentPath)) {
  //     getFiles(currentPath);
  //   } else {
  //     setError("The specified path does not exist.");
  //   }
  // }, [currentPath]);

  const handleItemClick = (item: FileItem) => {
    try {
      if (item.isDirectory) {
        setCurrentPath(item.fullPath);
        setPathStack((prevStack) => [...prevStack, item.fullPath]);
      } else {
        if (fs.statSync(item.fullPath).isFile()) {
          const content = fs.readFileSync(item.fullPath, "utf-8");
          setSelectedFile({ name: item.name, content });
        } else {
          setError("Selected item is not a valid file.");
        }
      }
    } catch (err) {
      console.error("Error opening item:", err);
      setError("Failed to open the selected item.");
    }
  };

  const handleBack = () => {
    try {
      if (pathStack.length > 1) {
        const newStack = [...pathStack];
        newStack.pop();
        const newPath = newStack[newStack.length - 1];
        setPathStack(newStack);
        setCurrentPath(newPath);
        setSelectedFile(null);
      } else {
        navigate(-1);
      }
    } catch (err) {
      console.error("Error navigating back:", err);
      setError("Failed to navigate back.");
    }
  };

  const handleCloseFile = () => {
    setSelectedFile(null);
  };

  return (
    <div className="h-screen bg-blue-400 p-4 flex flex-col">
      {error && (
        <div className="bg-red-500 text-white p-2 rounded mb-4">{error}</div>
      )}

      {!selectedFile ? (
        <>
          <button
            onClick={handleBack}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Back
          </button>
          <h2 className="text-white text-xl font-bold mt-4 mb-2">
            Current Path: {currentPath}
          </h2>
          <div className="flex flex-wrap gap-4 mt-2">
            {files.map((item, index) => (
              <div
                key={index}
                onClick={() => handleItemClick(item)}
                className={`flex items-center justify-center cursor-pointer p-4 rounded shadow-md transition-transform transform hover:scale-105 ${
                  item.isDirectory
                    ? "bg-blue-700 text-white"
                    : "bg-white text-black"
                }`}
              >
                <span className="mr-2">{item.isDirectory ? "📂" : "📄"}</span>
                {item.name}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-lg max-h-[80vh] overflow-y-auto text-black">
          <button
            onClick={handleCloseFile}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
          >
            Close File
          </button>
          <h2 className="text-2xl font-bold my-4">{selectedFile.name}</h2>
          <pre className="bg-gray-100 p-4 rounded">{selectedFile.content}</pre>
        </div>
      )}
    </div>
  );
};

export default FilesScreen;
