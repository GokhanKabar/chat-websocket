import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import socketService from "../services/socketService";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useRef(true);

  // Set mounted flag on initial render
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Déconnecter toute session WebSocket existante
  useEffect(() => {
    console.log("LoginPage - Déconnexion de toute session WebSocket existante");
    
    // Vérifier si l'on vient de se déconnecter
    if (location.state?.justLoggedOut) {
      // Nettoyer le localStorage pour éviter les problèmes de session
      console.log("Déconnexion récente détectée, nettoyage du localStorage");
      localStorage.removeItem("token");
      
      // Nettoyer l'état de navigation pour éviter les boucles
      window.history.replaceState({}, document.title);
    }
    
    // Déconnecter le socket de manière asynchrone
    const timer = setTimeout(() => {
      socketService.disconnect();
    }, 0);
    
    return () => clearTimeout(timer);
  }, [location.state]);

  // Vérifier si l'utilisateur vient de s'inscrire
  useEffect(() => {
    if (!isMountedRef.current) return;

    if (location.state?.message) {
      setSuccessMessage(location.state.message);

      // Pré-remplir l'email si disponible
      if (location.state.email) {
        setFormData((prev) => ({ ...prev, email: location.state.email }));
      }
    }

    // Essayer de récupérer le dernier email utilisé pour l'inscription
    const lastEmail = sessionStorage.getItem("lastRegisteredEmail");
    if (lastEmail && !formData.email) {
      setFormData((prev) => ({ ...prev, email: lastEmail }));
      // Nettoyer après utilisation
      sessionStorage.removeItem("lastRegisteredEmail");
    }
  }, [location, formData.email]);

  const handleChange = (e) => {
    if (!isMountedRef.current) return;

    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isMountedRef.current) return;

    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    console.log("Tentative de connexion avec:", formData.email);

    try {
      const apiUrl = "http://localhost:3000/auth/login";
      console.log("Envoi requête à:", apiUrl);

      // Appel à l'API pour se connecter
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!isMountedRef.current) return;

      console.log("Statut de la réponse:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch((e) => ({
          message: `Erreur ${response.status}: ${response.statusText}`,
        }));
        console.error("Erreur de réponse:", errorData);
        throw new Error(
          errorData.message ||
            `Erreur lors de la connexion (${response.status})`
        );
      }

      const data = await response.json();
      console.log("Connexion réussie:", data);

      // Vérification et enregistrement du token dans le localStorage
      if (data.access_token) {
        localStorage.setItem("token", data.access_token);
        console.log(
          "Token accès enregistré:",
          data.access_token.substring(0, 20) + "..."
        );
      } else if (data.token) {
        localStorage.setItem("token", data.token);
        console.log("Token enregistré:", data.token.substring(0, 20) + "...");
      } else {
        console.error("Pas de token dans la réponse:", data);
        throw new Error("Pas de token dans la réponse du serveur");
      }

      // Redirection vers le chat
      navigate("/chat");
    } catch (err) {
      if (!isMountedRef.current) return;

      console.error("Erreur complète:", err);
      setError(err.message);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Connexion à votre compte
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4">
              <div className="text-red-700">{error}</div>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-4">
              <div className="text-green-700">{successMessage}</div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Mot de passe
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  isLoading ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {isLoading ? "Connexion en cours..." : "Se connecter"}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Pas encore de compte ?
                </span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                to="/register"
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Créer un compte
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
