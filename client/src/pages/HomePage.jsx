import React from "react";
import { Link } from "react-router-dom";

const HomePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-200 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Bienvenue sur Chat App
          </h1>
          <p className="text-gray-500 mb-6">
            Une application de messagerie en temps réel
          </p>
        </div>

        <div className="space-y-4">
          <Link
            to="/register"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Créer un compte
          </Link>

          <Link
            to="/login"
            className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Se connecter
          </Link>
        </div>

        <div className="pt-4 text-center">
          <p className="text-sm text-gray-500">
            Une application de chat en temps réel avec NestJS et React
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
