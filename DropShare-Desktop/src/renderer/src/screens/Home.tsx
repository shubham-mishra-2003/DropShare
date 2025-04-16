import { icons } from "../assets";
import DrivesCard from "../components/DrivesCard";
import Header from "../components/Header";
import Icon from "../components/Icon";
import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import { useNavigate } from "react-router-dom";

interface Category {
  name: string;
  icon: any;
  color: string;
}

const categories: Category[] = [
  { name: "Photos", icon: icons.photo, color: "#4A90E2" },
  { name: "Videos", icon: icons.video, color: "#8B5CF6" },
  { name: "Audio", icon: icons.audio, color: "#E67E22" },
  { name: "Documents", icon: icons.document, color: "#3498DB" },
];

const Home = () => {
  const { colorScheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col size-full">
      <Header icon={false} title="Drives and Files" />
      <div className="flex p-2 gap-10 size-full items-center flex-col overflow-y-auto w-full">
        <DrivesCard />
        <div className="grid sm-p-5 p-2 w-[70%] gap-7 grid-cols-[repeat(auto-fit,minmax(130px,1fr))]">
          {categories.map((item) => (
            <div
              key={item.name}
              className={`flex duration-300 hover:border-2 hover:shadow-lg gap-3 cursor-pointer flex-col rounded-xl justify-between items-center p-4 ${colorScheme == "dark" ? "border-[#308ffc] shadow-[#308ffc]" : "border-blue-400 shadow-blue-400"}`}
              style={{
                backgroundColor: Colors[colorScheme].transparent,
              }}
              onClick={() => navigate("fileslist")}
            >
              <h1 className="text-2xl font-bold text-center">{item.name}</h1>
              <Icon src={item.icon} height={30} width={35} filter={1} />
              <h1 className="text-2xl font-bold text-center">{0}</h1>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
