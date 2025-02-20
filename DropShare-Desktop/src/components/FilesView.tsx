import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Header from "./Header";
import { PanelResizeHandle, Panel, PanelGroup } from "react-resizable-panels";
import Icon from "./Icon";
import { icons } from "../assets";
import FilesSidebar from "./FilesSidebar";
import FilesList from "./FilesList";

const FileExplorer = () => {
  const { drive } = useParams<{ drive: string }>();
  const [sidebarWidth, setSidebarWidth] = useState(30);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedWidth = parseInt(
        localStorage.getItem("sidebarWidth") || "30",
        10,
      );
      setSidebarWidth(savedWidth);
    }
  }, []);

  const handleResize = (newWidth: number) => {
    setSidebarWidth(newWidth);
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebarWidth", newWidth.toString());
    }
  };

  return (
    <div className="flex size-full flex-col">
      <Header icon title={`Files in ${drive}:`} />
      <PanelGroup  className="flex h-full w-full" direction="horizontal">
        <Panel
          defaultSize={sidebarWidth}
          minSize={15}
          maxSize={25}
          className="flex w-full h-full"
        >
          <FilesSidebar />
        </Panel>
        <PanelResizeHandle
          onResize={() => handleResize}
          className="flex relative justify-center items-center cursor-ew-resize"
        >
          <div className="absolute bg-blue-200 w-1 top-0 bottom-0 rounded-xl"></div>
          <Icon
            filter={0}
            height={30}
            width={20}
            src={icons.grab}
            className="bg-blue-300 rounded z-50"
          />
        </PanelResizeHandle>
        <Panel className="flex size-full">
          <FilesList />
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default FileExplorer;
