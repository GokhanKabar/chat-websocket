import { io } from "socket.io-client";

class SocketService {
  constructor() {
    this.socket = null;
    this.handlers = {};
    this.currentUserId = null;
    this.isConnecting = false;
  }

  // Initialiser la connexion WebSocket avec le token JWT
  connect(token) {
    // Prevent multiple connection attempts
    if (this.isConnecting) {
      console.log("Connection already in progress, skipping");
      return;
    }

    if (this.socket) {
      console.log("Socket déjà connecté, déconnexion avant reconnexion");
      this.disconnect();
    }

    if (!token) {
      console.error("Tentative de connexion au WebSocket sans token JWT!");
      return;
    }

    this.isConnecting = true;

    // Le token JWT ne doit pas contenir "Bearer" pour socket.io
    // Le serveur s'attend à recevoir juste le token brut
    const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;

    // Récupérer l'ID utilisateur sauvegardé
    const savedUserId = localStorage.getItem("currentUserId");
    const savedUsername = localStorage.getItem("currentUsername");
    console.log(
      `Données utilisateur dans localStorage - ID: ${savedUserId}, Username: ${savedUsername}`
    );

    // Décoder le token JWT pour obtenir l'ID utilisateur
    try {
      const payload = JSON.parse(atob(cleanToken.split(".")[1]));
      this.currentUserId = payload.sub;
      console.log(
        `Token décodé - UserID: ${this.currentUserId}, Email: ${payload.email}`
      );

      // Vérifier si l'ID de l'utilisateur sauvegardé correspond à celui du token
      if (savedUserId && Number(savedUserId) !== this.currentUserId) {
        console.warn(
          `Attention: L'ID utilisateur sauvegardé (${savedUserId}) ne correspond pas à celui du token (${this.currentUserId})`
        );
      }
    } catch (e) {
      console.error("Erreur lors du décodage du token:", e);
    }

    console.log(
      "Connexion au WebSocket avec token (tronqué):",
      cleanToken.substring(0, 15) + "..."
    );

    this.socket = io("http://localhost:3000", {
      auth: {
        token: cleanToken, // Envoyer le token sans le préfixe "Bearer"
        userId: savedUserId, // Inclure l'ID utilisateur sauvegardé
        username: savedUsername, // Inclure le nom d'utilisateur sauvegardé
      },
      autoConnect: true,
      reconnection: true,
      forceNew: true, // Force une nouvelle connexion à chaque fois
    });

    // Événements de base
    this.socket.on("connect", () => {
      console.log(
        `Socket connecté - ID: ${this.socket.id}, UserID: ${this.currentUserId}`
      );
      console.log(
        "LocalStorage token:",
        localStorage.getItem("token")?.substring(0, 15) + "..."
      );
      this.isConnecting = false;
    });

    this.socket.on("disconnect", (reason) => {
      console.log(
        `Déconnecté du serveur WebSocket: ${reason}, UserID: ${this.currentUserId}`
      );
      this.isConnecting = false;
    });

    this.socket.on("error", (error) => {
      console.error(`Erreur WebSocket (UserID: ${this.currentUserId}):`, error);
      this.isConnecting = false;
    });

    this.socket.on("connect_error", (error) => {
      console.error(
        `Erreur de connexion WebSocket (UserID: ${this.currentUserId}):`,
        error
      );
      this.isConnecting = false;
    });

    // Pour le débogage
    this.socket.onAny((event, ...args) => {
      console.log(
        `Événement reçu (UserID: ${this.currentUserId}): ${event}`,
        args
      );
    });
  }

  // Se déconnecter
  disconnect() {
    if (this.socket) {
      console.log("Déconnexion du socket...");

      // Nettoyer tous les handlers avant la déconnexion
      try {
        // First remove all listeners for socket.io built-in events
        const builtInEvents = [
          "connect",
          "disconnect",
          "error",
          "connect_error",
        ];
        builtInEvents.forEach((event) => {
          if (this.socket.hasListeners(event)) {
            console.log(`Suppression des listeners intégrés pour: ${event}`);
            this.socket.removeAllListeners(event);
          }
        });

        // Then remove our custom handlers
        Object.keys(this.handlers).forEach((event) => {
          console.log(`Suppression du listener pour l'événement: ${event}`);
          if (this.socket.hasListeners(event)) {
            this.socket.off(event, this.handlers[event]);
          }
        });

        // Remove any other listeners with removeAllListeners
        this.socket.removeAllListeners();

        // Réinitialiser la liste des handlers
        this.handlers = {};
        console.log("Tous les listeners ont été nettoyés");
      } catch (error) {
        console.error("Erreur lors du nettoyage des listeners:", error);
      }

      // Déconnecter le socket
      this.socket.disconnect();
      this.socket = null;
      this.isConnecting = false;
      this.currentUserId = null;
      console.log("Socket déconnecté et réinitialisé");
    }
  }

  // Rejoindre une salle
  joinRoom(roomId) {
    if (this.socket) {
      this.socket.emit("joinRoom", { roomId });
    }
  }

  // Quitter une salle
  leaveRoom(roomId) {
    if (this.socket) {
      this.socket.emit("leaveRoom", { roomId });
    }
  }

  // Envoyer un message
  sendMessage(roomId, content) {
    if (this.socket) {
      this.socket.emit("sendMessage", { roomId, content });
    }
  }

  // Créer un nouveau salon
  createRoom(roomId, roomName, isPrivate = false) {
    if (this.socket) {
      this.socket.emit("createRoom", { roomId, roomName, isPrivate });
    }
  }

  // Indiquer que l'utilisateur est en train d'écrire
  typing(roomId, isTyping) {
    if (this.socket) {
      this.socket.emit("typing", { roomId, isTyping });
    }
  }

  // Ajouter un écouteur d'événement
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
      // Stocker le handler pour pouvoir le retirer plus tard
      this.handlers[event] = callback;
    }
  }

  // Retirer un écouteur d'événement
  off(event) {
    if (this.socket && this.handlers[event]) {
      this.socket.off(event, this.handlers[event]);
      delete this.handlers[event];
    }
  }
}

// Singleton pour partager la même instance dans toute l'application
const socketService = new SocketService();
export default socketService;
