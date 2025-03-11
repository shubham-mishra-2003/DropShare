import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./screens/Home";
import Settings from "./screens/Settings";
import Sharing from "./screens/Sharing";
import NotFound from "./screens/NotFound";
import CustomFrame from "./components/CustomFrame";

function App(): JSX.Element {
  return (
    <Router>
      <div className="main">
        <CustomFrame />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/sharing" element={<Sharing />} />
          {/* <Route path="/files/:drive/*" element={<FileExplorer />} /> */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
