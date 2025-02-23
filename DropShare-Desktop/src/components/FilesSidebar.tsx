import { useTheme } from "../hooks/ThemeProvider";
import { Colors } from "../constants/Colors";
import Icon from "./Icon";
import { icons } from "../assets";
import { useState } from "react";

const FilesSidebar = ({
  nodes,
  loading,
}: {
  nodes: FileNode[];
  loading: boolean;
}) => {
  const [dropdown, setDropDown] = useState<{
    id: string | null;
    open: boolean;
  }>({
    id: null,
    open: false,
  });

  const toggleDropdown = (id: string) => {
    setDropDown((prev) => ({
      id: prev.id === id && prev.open ? null : id,
      open: prev.id !== id || prev.open,
    }));
  };

  const { colorScheme } = useTheme();

  return (
    <div className="flex flex-col gap-1 w-full h-full overflow-y-auto px-1 py-2 overflow-x-hidden">
      {loading ? (
        <Loading />
      ) : (
        nodes
          .filter((file) => file.type == "directory")
          .map((folder, index) => (
            <div
              onClick={() => toggleDropdown(folder.path)}
              style={{ background: Colors[colorScheme].transparent }}
              key={index}
              title={folder.path}
              className="flex w-full justify-center rounded-lg p-2 px-3 max-h-fit min-h-14 flex-col"
            >
              <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-3 font-bold text-lg">
                  <Icon
                    src={
                      dropdown.id === folder.path && dropdown.open
                        ? icons.folderOpen
                        : icons.folderClosed
                    }
                    filter={1}
                    height={30}
                    width={30}
                  />
                  {folder.name}
                </div>
                <div
                  className="p-1 items-center justify-center flex"
                  onClick={() => toggleDropdown(folder.path)}
                >
                  <Icon
                    src={
                      folder.path == dropdown.id
                        ? icons.dropdownOpen
                        : icons.dropdownClosed
                    }
                  />
                </div>
              </div>
              <div className="pl-6 flex flex-col justify-center gap-1">
                {dropdown.id === folder.path &&
                  dropdown.open &&
                  Array.isArray(folder.children) &&
                  folder.children.length > 0 &&
                  folder.children
                    .filter((folder) => folder.type == "directory")
                    .map((child) => (
                      <div className="flex items-center gap-3">
                        <Icon src={icons.folderClosed} height={20} width={20} />
                        {child.name}</div>
                    ))}
              </div>
            </div>
          ))
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
          style={{ backgroundColor: Colors[colorScheme].transparent }}
          className="flex p-2 text-2xl font-bold w-full rounded-lg animate-pulse"
        >
          Getting files...
        </div>
      ))}
    </div>
  );
};
