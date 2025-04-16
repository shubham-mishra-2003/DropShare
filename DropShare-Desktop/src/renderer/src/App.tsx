import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./screens/Home";
import Settings from "./screens/Settings";
import NotFound from "./screens/NotFound";
import CustomFrame from "./components/CustomFrame";
import HostScreen from "./screens/HostScreen";
import ClientScreen from "./screens/ClientScreen";
import FilesScreen from "./screens/FilesScreen";

function App(): JSX.Element {
  return (
    <Router>
      <div className="main">
        <CustomFrame />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/hostscreen" element={<HostScreen />} />
          <Route path="/clientscreen" element={<ClientScreen />} />
          <Route path="/filescreen" element={<FilesScreen />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
