import React, { useState, useEffect } from "react";
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
import { isAuthenticated, onAuthChange } from "./services/authService";
import "./App.css";

function App() {
  // Utiliser un état React pour éviter les boucles de re-rendu
  const [auth, setAuth] = useState(() => isAuthenticated());

  // Écouter les changements d'authentification via notre event emitter
  useEffect(() => {
    console.log("=== App.js useEffect - écoute des changements auth ===");

    // S'abonner aux changements d'authentification
    const unsubscribe = onAuthChange((newAuth) => {
      console.log("App.js - Changement auth reçu:", newAuth);
      if (newAuth !== auth) {
        setAuth(newAuth);
      }
    });

    // Écouter les changements du localStorage (pour les autres onglets)
    const handleStorageChange = (e) => {
      if (e.key === "token") {
        console.log(
          "Changement de token détecté dans localStorage (autre onglet)"
        );
        const newAuth = isAuthenticated();
        console.log("Nouveau statut auth:", newAuth);
        setAuth(newAuth);
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      unsubscribe();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []); // Dépendances vides pour ne s'exécuter qu'au montage

  // Debug logging pour détecter les instances multiples
  console.log("=== App.js rendu ===", {
    timestamp: new Date().toISOString(),
    auth: auth,
    url: window.location.href,
    hasToken: !!localStorage.getItem("token"),
  });

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
