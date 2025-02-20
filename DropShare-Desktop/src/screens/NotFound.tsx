import { useTheme } from "../hooks/ThemeProvider";
import { images } from "../assets";
import Icon from "../components/Icon";
import Header from "../components/Header";
import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const { colorScheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="flex size-full flex-col">
      <Header title="Page not found" icon />
      <div className="flex justify-center items-center size-full">
        <div
          className={`rounded-md h-[60%] w-80 gap-3 sm:w-[40%] relative border-2 flex justify-center items-center p-2 flex-col ${colorScheme == "dark" ? "bg-slate-800/20 border-gray-400" : "bg-slate-200/20 border-gray-500"}`}
        >
          <h1 className="text-8xl text-center font-bold">404</h1>
          <h1 className="text-5xl text-center font-semibold">Page not found</h1>
          <div className="p-0 absolute bottom-0 left-0">
            <Icon src={images.notFound} filter={0} height={100} width={100} />
          </div>
          <button
            onClick={() => {
              navigate("/");
            }}
            className="text-xl font-bold border p-2 rounded-xl cursor-pointer"
          >
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
