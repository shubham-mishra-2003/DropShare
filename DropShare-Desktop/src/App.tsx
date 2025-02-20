import Home from "./screens/Home";
import Sharing from "./screens/Sharing";
import Settings from "./screens/Settings";
import NotFound from "./screens/NotFound";
import CustomFrame from "./components/CustomFrame";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import FileExplorer from "./components/FilesView";

function App(): JSX.Element {
  return (
    <Router>
      <CustomFrame />
      <div className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/sharing" element={<Sharing />} />
          <Route path="/files/:drive" element={<FileExplorer />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

// const Layout = () => {
//   const { page } = usePage();
//   return page == "home" ? (
//     <Home />
//   ) : page == "settings" ? (
//     <Settings />
//   ) : page == "sharing" ? (
//     <Sharing />
//   ) : (
//     <NotFound />
//   );
// };
