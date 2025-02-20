import "../global.css";

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./hooks/ThemeProvider";
import { PageProvider } from "./hooks/PageContext";
import { Toaster } from "react-hot-toast";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PageProvider>
      <ThemeProvider>
        <App />
        <Toaster position="bottom-right" reverseOrder={true} />
      </ThemeProvider>
    </PageProvider>
  </React.StrictMode>,
);
