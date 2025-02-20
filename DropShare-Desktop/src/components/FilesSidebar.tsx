import { useEffect, useState } from "react";
import Toast from "./Toast";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../hooks/ThemeProvider";
import { Colors } from "../constants/Colors";
import Icon from "./Icon";
import { icons } from "../assets";

const FilesSidebar = () => {
  const { drive } = useParams<{ drive: string }>();
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dropDown, setDropDown] = useState(false);
  const navigate = useNavigate();
  const { colorScheme } = useTheme();

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

  return (
    <div className="flex flex-col gap-1 w-full h-full overflow-y-auto px-1 py-2">
      {loading ? (
        <Loading />
      ) : files && files.length > 0 ? (
        files.map((file, index) => (
          <div
            onClick={() => { }}
            className="flex flex-col h-auto group w-full items-center p-2 border-2 cursor-pointer rounded-lg gap-3"
            style={{
              background: Colors[colorScheme].transparent,
              borderColor: Colors[colorScheme].border,
              borderWidth: 2,
            }}
            key={index}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <Icon
                  src={icons.folderClosed}
                  filter={1}
                  height={20}
                  width={20}
                />
                <div className="font-bold text-[16px] truncate">{file}</div>
              </div>
              <div
                onClick={() => setDropDown((prev) => !prev)}
                className={`flex z-50 opacity-0 cursor-pointer items-center justify-center group-hover:opacity-100 rounded-lg p-1 ${colorScheme == "dark" ? "hover:bg-slate-600" : "hover:bg-blue-300"}`}
              >
                <Icon
                  src={dropDown ? icons.dropdownOpen : icons.dropdownClosed}
                  filter={1}
                  height={20}
                  width={20}
                />
              </div>
            </div>
            {dropDown && (
              <div>
                Dropdown showing folder or inside the folder clicked
              </div>
            )}
          </div>
        ))
      ) : (
        <div>No files found.</div>
      )}
    </div>
  );
};

export default FilesSidebar;

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
