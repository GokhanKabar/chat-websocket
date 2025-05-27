import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { isAuthenticated } from "../services/authService";

const ProtectedRoute = () => {
  // Vérification simple et directe - pas de state pour éviter les boucles
  const auth = isAuthenticated();
  
  console.log("=== ProtectedRoute rendu ===", { 
    auth, 
    hasToken: !!localStorage.getItem("token"),
    url: window.location.href 
  });

  // Rediriger vers la page de connexion si l'utilisateur n'est pas authentifié
  // L'option 'replace' est importante pour éviter d'empiler des redirections dans l'historique
  return auth ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
