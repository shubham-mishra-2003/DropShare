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
      <div className="flex p-2 size-full flex-col overflow-y-auto">
        <DrivesCard />
        <div
          style={{
            flex: 1,
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          {categories.map((item) => (
            <button
              key={item.name}
              style={{
                height: 100,
                width: 100,
                borderRadius: 15,
                backgroundColor: Colors[colorScheme].itemBackground,
                justifyContent: "space-between",
                padding: 10,
                alignItems: "center",
                flexDirection: "column",
              }}
              onClick={() => navigate("fileslist")}
            >
              <h1 style={{ fontSize: 12 }}>{item.name}</h1>
              <Icon src={item.icon} height={20} width={20} filter={1} />
              <h1 style={{ fontSize: 12 }}>{0}</h1>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
