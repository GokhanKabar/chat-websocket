import { io } from "socket.io-client";

class SocketService {
  constructor() {
    this.socket = null;
    this.handlers = {};
    this.currentUserId = null;
    this.isConnecting = false;
    this.messagesSent = new Set();
  }

  connect(token) {
    // Prevent multiple connection attempts
    if (this.isConnecting) {
      return;
    }

    if (this.socket) {
      this.disconnect();
    }

    if (!token) {
      console.error(
        "[SOCKET] Tentative de connexion au WebSocket sans token JWT!"
      );
      return;
    }

    this.isConnecting = true;

    // Le token JWT ne doit pas contenir "Bearer" pour socket.io
    // Le serveur s'attend à recevoir juste le token brut
    const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;

    // Récupérer l'ID utilisateur sauvegardé
    const savedUserId = localStorage.getItem("currentUserId");
    const savedUsername = localStorage.getItem("currentUsername");

    // Décoder le token JWT pour obtenir l'ID utilisateur
    try {
      const payload = JSON.parse(atob(cleanToken.split(".")[1]));
      this.currentUserId = payload.sub;

      // Vérifier si l'ID de l'utilisateur sauvegardé correspond à celui du token
      if (savedUserId && Number(savedUserId) !== this.currentUserId) {
        console.warn(
          `[SOCKET] Attention: L'ID utilisateur sauvegardé (${savedUserId}) ne correspond pas à celui du token (${this.currentUserId})`
        );
      }
    } catch (e) {
      console.error("[SOCKET] Erreur lors du décodage du token:", e);
    }

    this.messagesSent.clear();

    this.socket = io("http://localhost:3000", {
      auth: {
        token: cleanToken,
        userId: savedUserId,
        username: savedUsername,
      },
      autoConnect: true,
      reconnection: true,
      forceNew: true,
    });

    this.socket.on("connect", () => {
      this.isConnecting = false;
    });

    this.socket.on("disconnect", (reason) => {
      this.isConnecting = false;
    });

    this.socket.on("error", (error) => {
      console.error("Erreur WebSocket:", error);
      this.isConnecting = false;
    });

    this.socket.on("connect_error", (error) => {
      console.error("Erreur de connexion WebSocket:", error);
      this.isConnecting = false;
    });
  }

  disconnect() {
    if (!this.socket) {
      this.isConnecting = false;
      this.currentUserId = null;
      this.messagesSent.clear();
      this.handlers = {};
      return;
    }

    try {
      const builtInEvents = ["connect", "disconnect", "error", "connect_error"];

      builtInEvents.forEach((event) => {
        try {
          if (this.socket.hasListeners && this.socket.hasListeners(event)) {
            this.socket.removeAllListeners(event);
          }
        } catch (err) {
          console.error(
            `Erreur lors de la suppression du listener pour ${event}:`,
            err
          );
        }
      });

      if (this.handlers) {
        Object.keys(this.handlers).forEach((event) => {
          try {
            if (this.socket.hasListeners && this.socket.hasListeners(event)) {
              this.socket.off(event, this.handlers[event]);
            }
          } catch (err) {
            console.error(
              `Erreur lors de la suppression du handler pour ${event}:`,
              err
            );
          }
        });
      }

      try {
        this.socket.removeAllListeners();
      } catch (err) {
        console.error(
          "Erreur lors de la suppression de tous les listeners:",
          err
        );
      }

      try {
        this.socket.disconnect();
      } catch (err) {
        console.error("Erreur lors de la déconnexion:", err);
      }
    } catch (error) {
      console.error("Erreur générale lors de la déconnexion:", error);
    } finally {
      this.socket = null;
      this.currentUserId = null;
      this.isConnecting = false;
      this.messagesSent.clear();
      this.handlers = {};
    }
  }

  joinRoom(roomId) {
    if (this.socket) {
      this.socket.emit("joinRoom", { roomId });
    }
  }

  leaveRoom(roomId) {
    if (this.socket) {
      this.socket.emit("leaveRoom", { roomId });
    }
  }

  sendMessage(roomId, content) {
    if (this.socket) {
      const messageId = `${roomId}_${Date.now()}_${this.currentUserId}`;

      if (this.messagesSent.has(messageId)) {
        return;
      }

      this.messagesSent.add(messageId);

      this.socket.emit("sendMessage", {
        roomId: roomId,
        content: content,
        messageId: messageId,
      });

      setTimeout(() => {
        this.messagesSent.delete(messageId);
      }, 5000);
    }
  }

  createRoom(roomId, roomName, isPrivate = false) {
    if (this.socket) {
      this.socket.emit("createRoom", { roomId, roomName, isPrivate });
    }
  }

  typing(roomId, isTyping) {
    if (this.socket) {
      this.socket.emit("typing", { roomId, isTyping });
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.handlers[event] = callback;
      this.socket.on(event, callback);
    }
  }

  off(event) {
    if (this.socket && this.handlers[event]) {
      this.socket.off(event, this.handlers[event]);
      delete this.handlers[event];
    }
  }

  getSocket() {
    return this.socket;
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }
}

// Instance singleton
const socketService = new SocketService();

export default socketService;
