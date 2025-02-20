import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Toast from "./Toast";
import { useTheme } from "../hooks/ThemeProvider";
import { Colors } from "../constants/Colors";
import Icon from "./Icon";
import { icons } from "../assets";

const FilesList = () => {
  const { drive } = useParams<{ drive: string }>();
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!drive) {
      Toast({ type: "error", message: "No drive selected in URL!" });
      return;
    }
    window.electron
      .getFiles(decodeURIComponent(drive))
      .then((data: string[] | undefined) => {
        if (Array.isArray(data)) {
          setFiles(data);
        } else {
          Toast({
            type: "error",
            message: `Invalid response from getFiles: ${data}`,
          });
          setFiles([]);
        }
        setLoading(false);
      })
      .catch((error) => {
        Toast({ type: "error", message: `Error fetching files: ${error}` });
        setFiles([]);
        setLoading(false);
      });
  }, [drive]);

  const { colorScheme } = useTheme();

  return (
    <div className="grid grid-cols-6 flex-1 gap-2 overflow-y-auto flex-col size-full overflow-x-hidden px-2 py-3">
      {loading ? (
        <Loading />
      ) : files && files.length > 0 ? (
        files.map((file, index) => (
          <div
            onClick={() => navigate(file)}
            className="flex flex-col h-auto w-full justify-center items-centr cursor-pointer rounded-lg"
            key={index}
          >
            <div
              style={{ background: Colors[colorScheme].transparent }}
              className="flex w-30 h-30 p-4 border-2 border-slate-500 cursor-pointer rounded-lg"
            >
              <Icon
                src={icons.folderClosed}
                height={30}
                width={30}
                filter={1}
              />
            </div>
            <div className="font-bold text-xl truncate">{file}</div>
          </div>
        ))
      ) : (
        <div>No files found.</div>
      )}
    </div>
  );
};

export default FilesList;

const Loading = () => {
  const { colorScheme } = useTheme();
  return (
    <div className="flex justify-center flex-col items-center w-full gap-2">
      {Array.from({ length: 20 }).map((_, index) => (
        <div
          key={index}
          style={{
            backgroundColor: Colors[colorScheme].transparent,
          }}
          className="flex p-2 text-2xl font-bold w-full rounded-lg animate-pulse"
        >
          Getting files...
        </div>
      ))}
    </div>
  );
};
