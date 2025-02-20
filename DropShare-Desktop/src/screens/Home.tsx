import Toast from "../components/Toast";
import DriveCard from "../components/DriveCard";
import Header from "../components/Header";
import { useTheme } from "../hooks/ThemeProvider";

const Home = () => {
  const { colorScheme } = useTheme();

  return (
    <div className="flex flex-col size-full">
      <Header icon={false} title="Drives and Files" />
      <div className="flex p-2 size-full flex-col overflow-y-auto">
        <DriveCard />
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
