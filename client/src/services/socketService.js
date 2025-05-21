import { io } from "socket.io-client";

class SocketService {
  constructor() {
    this.socket = null;
    this.handlers = {};
    this.currentUserId = null;
    this.isConnecting = false;
    this.messagesSent = new Set(); // Pour tracer les messages envoyés
  }

  // Initialiser la connexion WebSocket avec le token JWT
  connect(token) {
    // Prevent multiple connection attempts
    if (this.isConnecting) {
      console.log("[SOCKET] Connection already in progress, skipping");
      return;
    }

    if (this.socket) {
      console.log(
        "[SOCKET] Socket déjà connecté, déconnexion avant reconnexion"
      );
      this.disconnect();
    }

    if (!token) {
      console.error(
        "[SOCKET] Tentative de connexion au WebSocket sans token JWT!"
      );
      return;
    }

    this.isConnecting = true;
    console.log("[SOCKET] Début du processus de connexion");

    // Le token JWT ne doit pas contenir "Bearer" pour socket.io
    // Le serveur s'attend à recevoir juste le token brut
    const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;

    // Récupérer l'ID utilisateur sauvegardé
    const savedUserId = localStorage.getItem("currentUserId");
    const savedUsername = localStorage.getItem("currentUsername");
    console.log(
      `[SOCKET] Données utilisateur dans localStorage - ID: ${savedUserId}, Username: ${savedUsername}`
    );

    // Décoder le token JWT pour obtenir l'ID utilisateur
    try {
      const payload = JSON.parse(atob(cleanToken.split(".")[1]));
      this.currentUserId = payload.sub;
      console.log(
        `[SOCKET] Token décodé - UserID: ${this.currentUserId}, Email: ${payload.email}`
      );

      // Vérifier si l'ID de l'utilisateur sauvegardé correspond à celui du token
      if (savedUserId && Number(savedUserId) !== this.currentUserId) {
        console.warn(
          `[SOCKET] Attention: L'ID utilisateur sauvegardé (${savedUserId}) ne correspond pas à celui du token (${this.currentUserId})`
        );
      }
    } catch (e) {
      console.error("[SOCKET] Erreur lors du décodage du token:", e);
    }

    console.log(
      "[SOCKET] Connexion au WebSocket avec token (tronqué):",
      cleanToken.substring(0, 15) + "..."
    );

    // Nettoyage des anciens messages envoyés
    this.messagesSent.clear();

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
        `[SOCKET] Socket connecté - ID: ${this.socket.id}, UserID: ${this.currentUserId}`
      );
      console.log(
        "[SOCKET] LocalStorage token:",
        localStorage.getItem("token")?.substring(0, 15) + "..."
      );
      this.isConnecting = false;
    });

    this.socket.on("disconnect", (reason) => {
      console.log(
        `[SOCKET] Déconnecté du serveur WebSocket: ${reason}, UserID: ${this.currentUserId}`
      );
      this.isConnecting = false;
    });

    this.socket.on("error", (error) => {
      console.error(
        `[SOCKET] Erreur WebSocket (UserID: ${this.currentUserId}):`,
        error
      );
      this.isConnecting = false;
    });

    this.socket.on("connect_error", (error) => {
      console.error(
        `[SOCKET] Erreur de connexion WebSocket (UserID: ${this.currentUserId}):`,
        error
      );
      this.isConnecting = false;
    });

    // Pour le débogage
    this.socket.onAny((event, ...args) => {
      console.log(
        `[SOCKET] Événement reçu (UserID: ${this.currentUserId}): ${event}`,
        args
      );
    });
  }

  // Se déconnecter
  disconnect() {
    console.log("[SOCKET] Déconnexion du socket...");

    // If not connected or already disconnecting, no need to continue
    if (!this.socket) {
      console.log("[SOCKET] Aucun socket à déconnecter");
      this.isConnecting = false;
      this.currentUserId = null;
      this.messagesSent.clear();
      this.handlers = {};
      return;
    }

    try {
      // First remove all listeners for socket.io built-in events
      const builtInEvents = ["connect", "disconnect", "error", "connect_error"];

      builtInEvents.forEach((event) => {
        try {
          if (this.socket.hasListeners && this.socket.hasListeners(event)) {
            console.log(
              `[SOCKET] Suppression des listeners intégrés pour: ${event}`
            );
            this.socket.removeAllListeners(event);
          }
        } catch (err) {
          console.error(
            `[SOCKET] Erreur lors de la suppression du listener pour ${event}:`,
            err
          );
        }
      });

      // Then remove our custom handlers
      if (this.handlers) {
        Object.keys(this.handlers).forEach((event) => {
          try {
            console.log(
              `[SOCKET] Suppression du listener pour l'événement: ${event}`
            );
            if (this.socket.hasListeners && this.socket.hasListeners(event)) {
              this.socket.off(event, this.handlers[event]);
            }
          } catch (err) {
            console.error(
              `[SOCKET] Erreur lors de la suppression du handler pour ${event}:`,
              err
            );
          }
        });
      }

      // Final safety - remove any other listeners with removeAllListeners
      try {
        console.log("[SOCKET] Suppression de tous les listeners restants");
        this.socket.removeAllListeners();
      } catch (err) {
        console.error(
          "[SOCKET] Erreur lors de la suppression de tous les listeners:",
          err
        );
      }

      // Disconnect socket in try-catch to handle any errors
      try {
        this.socket.disconnect();
      } catch (err) {
        console.error("[SOCKET] Erreur lors de la déconnexion du socket:", err);
      }
    } catch (error) {
      console.error("[SOCKET] Erreur lors du nettoyage des listeners:", error);
    } finally {
      // Réinitialiser la liste des handlers et variables d'état
      this.handlers = {};
      this.socket = null;
      this.isConnecting = false;
      this.currentUserId = null;
      this.messagesSent.clear();
      console.log("[SOCKET] Socket déconnecté et réinitialisé");
    }
  }

  // Rejoindre une salle
  joinRoom(roomId) {
    if (this.socket) {
      console.log(`[SOCKET] Rejoindre la salle: ${roomId}`);
      this.socket.emit("joinRoom", { roomId });
    }
  }

  // Quitter une salle
  leaveRoom(roomId) {
    if (this.socket) {
      console.log(`[SOCKET] Quitter la salle: ${roomId}`);
      this.socket.emit("leaveRoom", { roomId });
    }
  }

  // Envoyer un message
  sendMessage(roomId, content) {
    if (this.socket) {
      // Créer un identifiant unique pour ce message basé sur contenu+horodatage
      const messageId = `${
        this.currentUserId
      }-${Date.now()}-${content.substring(0, 10)}`;

      console.log(
        `[SOCKET] Envoi de message dans la salle ${roomId}: "${content}" (ID: ${messageId})`
      );

      // Vérifier si ce message a déjà été envoyé récemment (déduplication)
      if (this.messagesSent.has(messageId)) {
        console.log(`[SOCKET] Message déjà envoyé, ignoré: ${messageId}`);
        return;
      }

      // Ajouter à l'ensemble des messages envoyés
      this.messagesSent.add(messageId);

      // Limiter la taille du Set
      if (this.messagesSent.size > 50) {
        this.messagesSent = new Set(Array.from(this.messagesSent).slice(-20));
      }

      this.socket.emit("sendMessage", { roomId, content });
    }
  }

  // Créer un nouveau salon
  createRoom(roomId, roomName, isPrivate = false) {
    if (this.socket) {
      console.log(
        `[SOCKET] Création d'un salon: ${roomName} (${roomId}), privé: ${isPrivate}`
      );
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
      // Supprimer l'écouteur existant pour cet événement s'il existe
      if (this.handlers[event]) {
        console.log(
          `[SOCKET] Remplacement du listener existant pour: ${event}`
        );
        this.socket.off(event, this.handlers[event]);
      }

      console.log(`[SOCKET] Ajout d'un listener pour: ${event}`);
      this.socket.on(event, callback);
      // Stocker le handler pour pouvoir le retirer plus tard
      this.handlers[event] = callback;
    }
  }

  // Retirer un écouteur d'événement
  off(event) {
    if (this.socket && this.handlers[event]) {
      console.log(`[SOCKET] Suppression du listener pour: ${event}`);
      this.socket.off(event, this.handlers[event]);
      delete this.handlers[event];
    }
  }
}

// Singleton pour partager la même instance dans toute l'application
const socketService = new SocketService();
export default socketService;
