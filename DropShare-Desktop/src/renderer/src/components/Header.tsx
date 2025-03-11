import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import { useLocation, useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { icons } from "../assets";
import ThemeSwitch from "./ThemeSwitch";
import FileSearch from "./FileSearch";

interface headerProps {
    icon: boolean;
    title: string;
}

const Header = ({ title, icon }: headerProps) => {
    const { colorScheme } = useTheme();
    const navigate = useNavigate();
    const path = useLocation();

    return (
        <div
            className="flex w-full p-2 px-4 items-center justify-between gap-3"
            style={{ background: Colors[colorScheme].background }}
        >
            <div className="flex gap-3 items-center justify-center">
                {icon && (
                    <div
                        onClick={() => navigate(-1)}
                        className={`flex cursor-pointer h-[40px] w-[110px] group items-center p-[2px] rounded-xl gap-1 ${colorScheme == "dark" ? "bg-slate-600" : "bg-blue-200"}`}
                    >
                        <div
                            style={{ background: Colors[colorScheme].tint }}
                            className="flex justify-center group-hover:w-full duration-300 items-center rounded-xl h-full w-[35px] z-20"
                        >
                            <Icon src={icons.back} filter={1} height={15} width={15} />
                        </div>
                        <p className="font-bold group-hover:hidden">Go Back</p>
                    </div>
                )}
                <h1 className="text-2xl font-bold">{title}</h1>
            </div>
            {path.pathname != "/settings" && <FileSearch />}
            {path.pathname == "/settings" && (
                <div className="flex items-center">
                    <ThemeSwitch />
                </div>
            )}
        </div>
    );
};

export default Header;
