import "./assets/main.css";

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./hooks/ThemeProvider";
import { Toaster } from "react-hot-toast";
import { DirectoryProvider } from "./hooks/DirectoryContext";
import { NetworkProvider } from "./hooks/NetworkProvider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <NetworkProvider>
      <ThemeProvider>
        <DirectoryProvider>
          <App />
          <Toaster position="bottom-right" />
        </DirectoryProvider>
      </ThemeProvider>
    </NetworkProvider>
  </React.StrictMode>,
);
