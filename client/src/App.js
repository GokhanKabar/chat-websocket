import React, { useMemo } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChatPage from "./pages/ChatPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { isAuthenticated } from "./services/authService";
import "./App.css";

function App() {
  // Vérifier l'authentification une seule fois par rendu
  const auth = useMemo(() => isAuthenticated(), []);

  return (
    <Router>
      <Routes>
        {/* Route pour la page d'accueil */}
        <Route
          path="/"
          element={auth ? <Navigate to="/chat" replace /> : <HomePage />}
        />

        {/* Routes publiques */}
        <Route
          path="/login"
          element={auth ? <Navigate to="/chat" replace /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={auth ? <Navigate to="/chat" replace /> : <RegisterPage />}
        />

        {/* Routes protégées */}
        <Route element={<ProtectedRoute />}>
          <Route path="/chat" element={<ChatPage />} />
        </Route>

        {/* Redirection pour les routes non définies */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
