import React, { useEffect, useRef } from "react";
import Icon from "./Icon";
import { useTheme } from "../hooks/ThemeProvider";
import { icons } from "../assets";
import { Colors } from "../constants/Colors";

const modes = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

const ThemeSwitch = () => {
  const { theme, setTheme, colorScheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className={`w-fit cursor-pointer p-1 flex items-center justify-center rounded-[8px] ${
          colorScheme == "dark" ? "hover:bg-blue-500" : "hover:bg-blue-300"
        }`}
        onClick={() => setOpen(!open)}
      >
        <Icon
          src={
            theme == "system"
              ? icons.system
              : theme == "dark"
                ? icons.moon
                : icons.sun
          }
          height={25}
          width={30}
          filter={1}
        />
      </div>
      {open && (
        <div
          className="w-32 gap-1 flex flex-col p-1 rounded-xl absolute top-10 right-0"
          style={{
            background: "transparent",
            backgroundColor: Colors[colorScheme].background,
          }}
        >
          {modes.map((mode) => (
            <div
              className={`flex font-bold gap-6 py-1 px-2 justify-between cursor-pointer rounded-[10px] items-center ${
                colorScheme == "dark"
                  ? "hover:bg-[#308ffc]"
                  : "hover:bg-[#88c0ff]"
              } ${
                theme == mode.value
                  ? colorScheme == "dark"
                    ? "bg-[#308ffc]"
                    : "bg-[#88c0ff]"
                  : ""
              }`}
              key={mode.value}
              onClick={() => {
                setTheme(mode.value);
                setOpen(false);
              }}
            >
              {mode.label}
              {theme === mode.value && (
                <Icon height={20} width={20} src={icons.check} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeSwitch;
