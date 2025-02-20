import React, { useEffect, useRef } from "react";
import { Check, Moon, Sun, SunMoon } from "lucide-react";

import { useTheme } from "../hooks/ThemeProvider";
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
        className={`w-fit cursor-pointer p-1 rounded-[8px] ${
          colorScheme == "dark" ? "hover:bg-blue-500" : "hover:bg-blue-300"
        }`}
        style={{
          color: Colors[colorScheme].text,
        }}
        onClick={() => setOpen(!open)}
      >
        {theme == "system" ? (
          <SunMoon size={30} />
        ) : theme == "dark" ? (
          <Moon size={30} />
        ) : (
          <Sun size={30} />
        )}
      </div>
      {open && (
        <div
          className="w-fit gap-1 flex flex-col p-1 rounded-xl absolute top-10 right-0"
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
              style={{
                color: Colors[colorScheme].text,
              }}
              key={mode.value}
              onClick={() => {
                setTheme(mode.value);
                setOpen(false);
              }}
            >
              {mode.label}
              <Check
                size={20}
                className={theme === mode.value ? "opacity-100" : "opacity-0"}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeSwitch;
