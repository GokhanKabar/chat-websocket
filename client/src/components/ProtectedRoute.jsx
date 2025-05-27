import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { isAuthenticated } from "../services/authService";

const ProtectedRoute = () => {
  // Vérifier l'authentification à chaque rendu pour détecter les changements
  const auth = isAuthenticated();

  // Rediriger vers la page de connexion si l'utilisateur n'est pas authentifié
  // L'option 'replace' est importante pour éviter d'empiler des redirections dans l'historique
  return auth ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
