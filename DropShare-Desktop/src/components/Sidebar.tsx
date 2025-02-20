import { SidebarContent } from "../constants/index";
import Icon from "./Icon";
import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import { useEffect, useRef, useState } from "react";
import { icons } from "../assets";
import { useNavigate } from "react-router-dom";

const Sidebar = () => {
  const [show, setShow] = useState(false);

  const { colorScheme } = useTheme();

  const sidebarRef = useRef<HTMLDivElement>(null);

  const [currentPath, setCurrentPath] = useState(location.pathname);

  useEffect(() => {
    setCurrentPath(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setShow(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const navigate = useNavigate();

  return (
    <>
      <Icon
        onClick={() => setShow((prev) => !prev)}
        src={icons.menu}
        filter={1}
        height={18}
        width={20}
      />
      <div
        ref={sidebarRef}
        style={{ background: Colors[colorScheme].background }}
        className={`flex flex-col gap-2 fixed top-[45px] bottom-0 left-0 justify-between items-center p-2 w-60 transition-transform duration-300 z-50 ${show ? "translate-x-0" : "translate-x-[-100%]"}`}
      >
        <div className="flex flex-col w-full items-center gap-2">
          {SidebarContent.slice(0, 4).map((item, index) => (
            <div
              className="flex cursor-pointer w-full p-3 gap-3 items-center rounded-xl"
              style={{
                background:
                  currentPath == `/${item.page}`
                    ? Colors[colorScheme].tint
                    : Colors[colorScheme].itemBackground,
              }}
              onClick={() => {
                navigate(`/${item.page}`);
                setShow(false);
              }}
              key={index}
            >
              <Icon filter={1} height={20} width={20} src={item.icon} />
              <h1 className="text-[18px] font-semibold">{item.title}</h1>
            </div>
          ))}
        </div>
        <div className="flex justify-around items-center w-full gap-2 px-2">
          {SidebarContent.slice(4, 5).map((item, index) => (
            <h1
              key={index}
              className={`text-md cursor-pointer font-semibold ${colorScheme == "dark" ? "text-slate-300" : "text-slate-600"}`}
            >
              {item.title}
            </h1>
          ))}
          <span
            className={`h-2 w-2 rounded-full ${colorScheme == "dark" ? "bg-slate-300" : "bg-slate-600"}`}
          />
          {SidebarContent.slice(5, 6).map((item, index) => (
            <h1
              key={index}
              className={`text-md cursor-pointer font-semibold ${colorScheme == "dark" ? "text-slate-300" : "text-slate-600"}`}
            >
              {item.title}
            </h1>
          ))}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
