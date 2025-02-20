import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import { icons, images } from "../assets";
import Sidebar from "./Sidebar";
import Icon from "./Icon";
import ThemeSwitch from "./ThemeSwitch";

const CustomFrame = () => {
  const handleMinimize = (): void =>
    window.electron.ipcRenderer.send("manualMinimize");
  const handleMaximize = (): void =>
    window.electron.ipcRenderer.send("manualMaximize");
  const handleClose = (): void =>
    window.electron.ipcRenderer.send("manualClose");

  const { colorScheme } = useTheme();

  return (
    <div
      className={`flex justify-between h-[55px] w-full`}
      style={{
        background: Colors[colorScheme].background,
      }}
    >
      <div className="flex items-center p-2 gap-2 w-full">
        <Sidebar />
        <div id="drag" className="flex items-center gap-2">
          <img
            src={images.logo}
            height={40}
            width={40}
            className="w-[40px] h-[40px]"
          />
          <h1 className="text-3xl font-bold">DropShare</h1>
        </div>
      </div>
      <div className="flex gap-1 h-full">
        <ThemeSwitch />
        <button
          className={`border-none cursor-pointer active:scale-90 h-9 rounded-[5px] w-10 items-center flex justify-center ${colorScheme == "dark" ? "hover:bg-slate-700" : "hover:bg-blue-200"}`}
          onClick={handleMinimize}
        >
          <Icon height={20} width={20} src={icons.minus} filter={1} />
        </button>
        <button
          className={`border-none cursor-pointer active:scale-90 rounded-[5px] w-10 items-center flex justify-center h-9 ${colorScheme == "dark" ? "hover:bg-slate-700" : "hover:bg-blue-200"}`}
          onClick={handleMaximize}
        >
          <Icon height={20} width={20} src={icons.maximize} filter={1} />
        </button>
        <button
          className={`border-none cursor-pointer active:scale-90 rounded-[5px] w-10 items-center flex justify-center hover:bg-red-500 h-9`}
          onClick={handleClose}
        >
          <Icon filter={1} height={20} width={20} src={icons.close} />
        </button>
      </div>
    </div>
  );
};

export default CustomFrame;
