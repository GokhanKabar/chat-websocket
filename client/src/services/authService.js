import axios from "axios";
import { EventEmitter } from "events";

const API_URL = "http://localhost:3000";

// Simple event emitter pour les changements d'authentification
class AuthEventEmitter {
  constructor() {
    this.listeners = [];
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(
        (listener) => listener !== callback
      );
    };
  }

  emit(isAuthenticated) {
    console.log("AuthEventEmitter - Émission événement auth:", isAuthenticated);
    this.listeners.forEach((callback) => {
      try {
        callback(isAuthenticated);
      } catch (error) {
        console.error("Erreur dans listener auth:", error);
      }
    });
  }
}

const authEmitter = new AuthEventEmitter();
export const authEventEmitter = authEmitter;

export const register = async (userData) => {
  const response = await axios.post(`${API_URL}/auth/register`, userData);
  if (response.data.token) {
    localStorage.setItem("token", response.data.token);
    authEmitter.emit(true);
  }
  return response.data;
};

export const login = (username, token, userData) => {
  localStorage.setItem("token", token);
  localStorage.setItem("username", username);
  localStorage.setItem("userData", JSON.stringify(userData));
  authEmitter.emit(true);
};

export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  localStorage.removeItem("userData");
  authEmitter.emit(false);
};

export const getCurrentUser = () => {
  return localStorage.getItem("token");
};

export const isAuthenticated = () => {
  const isAuth = !!localStorage.getItem("token");
  authEmitter.emit(isAuth);
  return isAuth;
};

export const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Export de l'event emitter pour écouter les changements
export const onAuthChange = (callback) => {
  return authEmitter.subscribe(callback);
};

export const getToken = () => localStorage.getItem("token");
export const getUsername = () => localStorage.getItem("username");
export const getUserData = () => {
  const userData = localStorage.getItem("userData");
  return userData ? JSON.parse(userData) : null;
};

export default {
  register,
  login,
  logout,
  getCurrentUser,
  isAuthenticated,
  getAuthHeader,
  onAuthChange,
  getToken,
  getUsername,
  getUserData,
};
