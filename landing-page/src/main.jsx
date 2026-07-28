import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { initializeAnalytics } from "./services/analyticsService.js";
import "./styles/global.css";

initializeAnalytics();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
