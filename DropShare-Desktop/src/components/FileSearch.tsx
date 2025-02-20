import React from "react";
import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import Icon from "./Icon";
import { icons } from "../assets";

const FileSearch = () => {
  const { colorScheme } = useTheme();
  return (
    <label
      style={{ background: Colors[colorScheme].transparent }}
      className="flex group-[input]:shadow-xl items-center justify-center p-2 h-[45px] rounded-xl gap-2"
    >
      <Icon filter={1} src={icons.search} />
      <input
        className={`bg-transparent outline-none focus:group-[input] border-none font-bold text-[20px] ${colorScheme == "dark" ? "placeholder:text-slate-400" : "placeholder:text-slate-600"}`}
        type="text"
        placeholder="Search Files"
      />
    </label>
  );
};

export default FileSearch;
