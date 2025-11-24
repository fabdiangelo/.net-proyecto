import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AuthProvider from "./services/AuthService.jsx";
import App from "./App.jsx";
import './index.css';
import './App.css';

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter basename="/frontend">
        <App />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
