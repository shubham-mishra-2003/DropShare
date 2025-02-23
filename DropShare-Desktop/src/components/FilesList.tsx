import { useTheme } from "../hooks/ThemeProvider";
import { Colors } from "../constants/Colors";
import Icon from "./Icon";
import { icons } from "../assets";

const FilesList = ({
  nodes,
  loading,
}: {
  nodes: FileNode[];
  loading: boolean;
}) => {
  const { colorScheme } = useTheme();
  return (
    <div className="grid grid-cols-6 flex-1 gap-2 overflow-y-auto flex-col size-full overflow-x-hidden px-2 py-3">
      {loading ? (
        <Loading />
      ) : (
        nodes.map((folder, index) => (
          <div
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
            <div className="font-bold text-xl truncate">{folder.name}</div>
          </div>
        ))
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
