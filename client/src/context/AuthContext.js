import React, { createContext, useContext, useState, useEffect } from "react";
import {
  getToken,
  getUserData,
  isAuthenticated,
  onAuthChange,
} from "../services/authService";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialiser l'utilisateur depuis le localStorage
    const token = getToken();
    const userData = getUserData();

    if (token && userData) {
      setUser(userData);
    }

    setLoading(false);

    // Écouter les changements d'authentification
    const unsubscribe = onAuthChange((isAuth) => {
      if (isAuth) {
        const currentUserData = getUserData();
        setUser(currentUserData);
      } else {
        setUser(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("userData");
    setUser(null);
  };

  const value = {
    user,
    loading,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
