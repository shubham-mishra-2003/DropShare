import DrivesCard from "../components/DrivesCard";
import Header from "../components/Header";
import Toast from "../components/Toast";
import { useTheme } from "../hooks/ThemeProvider";

const Home = () => {
  const { colorScheme } = useTheme();

  return (
    <div className="flex flex-col size-full">
      <Header icon={false} title="Drives and Files" />
      <div className="flex p-2 size-full flex-col overflow-y-auto">
        <DrivesCard />
        <button
          onClick={() =>
            Toast({
              type: "success",
              message: "error",
              colorScheme: colorScheme,
            })
          }
        >
          Toast
        </button>
      </div>
    </div>
  );
};

export default Home;
