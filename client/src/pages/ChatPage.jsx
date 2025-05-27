import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import RoomList from "../components/RoomList";
import MessageList from "../components/MessageList";
import MessageInput from "../components/MessageInput";
import UserList from "../components/UserList";
import Notification from "../components/Notification";
import ProfileModal from "../components/ProfileModal";
import socketService from "../services/socketService";
import { updateUserColor, updateUserAvatar } from "../services/userService";
import { v4 as uuidv4 } from "uuid";
import { FiSettings } from "react-icons/fi";

const ChatPage = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState("general");
  const [messages, setMessages] = useState([]);
  const [roomUsers, setRoomUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [notification, setNotification] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const typingTimeoutsRef = useRef({});
  const isMountedRef = useRef(true); // Track if component is mounted
  const messageIdRef = useRef(new Set()); // Pour suivre les messages déjà affichés

  useEffect(() => {
    // Mark as mounted
    isMountedRef.current = true;

    // Récupérer le token JWT du localStorage
    const token = localStorage.getItem("token");
    console.log(
      "Token récupéré:",
      token ? `${token.substring(0, 20)}...` : "aucun token"
    );

    if (!token) {
      // When navigating away immediately, mark as unmounted first
      isMountedRef.current = false;
      // Use setTimeout to ensure this happens after the current execution context
      setTimeout(() => {
        navigate("/login");
      }, 0);
      return;
    }

    // Forcer la déconnexion d'abord pour éviter les problèmes de connexion multiple
    socketService.disconnect();

    // Réinitialiser l'ensemble des messages déjà affichés
    messageIdRef.current.clear();

    // Store all listeners to be able to remove them properly on cleanup
    const eventHandlers = [
      { event: "userConnected", handler: handleUserConnected },
      { event: "userJoined", handler: handleUserJoined },
      { event: "userDisconnected", handler: handleUserDisconnected },
      { event: "newMessage", handler: handleNewMessage },
      { event: "roomHistory", handler: handleRoomHistory },
      { event: "userJoinedRoom", handler: handleUserJoinedRoom },
      { event: "userLeftRoom", handler: handleUserLeftRoom },
      { event: "typing", handler: handleTyping },
      { event: "userColorChanged", handler: handleUserColorChanged },
      { event: "roomCreated", handler: handleRoomCreated },
      { event: "roomList", handler: handleRoomList },
      { event: "roomUserList", handler: handleRoomUserList },
      { event: "userAvatarChanged", handler: handleUserAvatarChanged },
    ];

    // Initialiser la connexion WebSocket avec un délai pour s'assurer que la déconnexion est terminée
    const connectTimeout = setTimeout(() => {
      if (!isMountedRef.current) return; // Skip if component unmounted

      console.log("[DEBUG] Initialisation de la connexion WebSocket");
      socketService.connect(token);

      // Écouter les événements
      console.log("[DEBUG] Ajout des écouteurs d'événements");
      eventHandlers.forEach(({ event, handler }) => {
        socketService.on(event, handler);
      });

      // Écouteur pour les erreurs de connexion
      socketService.on("error", (error) => {
        if (!isMountedRef.current) return; // Prevent state updates after unmount
        console.error("Erreur WebSocket reçue:", error);
        showNotification("error", `Erreur: ${error.message}`);
      });

      // Rejoindre la salle général par défaut
      console.log("[DEBUG] Rejoindre la salle général");
      socketService.joinRoom("general");
    }, 300);

    // Nettoyage à la déconnexion
    return () => {
      console.log(
        "[DEBUG] Nettoyage du composant ChatPage - déconnexion du socket"
      );
      // Annuler le timeout si la déconnexion arrive avant
      clearTimeout(connectTimeout);
      // Mark as unmounted to prevent state updates after the component is gone
      isMountedRef.current = false;
      // Cancel any pending timeouts
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};
      // Vider l'ensemble des messages
      messageIdRef.current.clear();

      // Remove all event listeners properly
      eventHandlers.forEach(({ event }) => {
        socketService.off(event);
      });
      socketService.off("error");

      // Disconnect socket
      socketService.disconnect();
    };
  }, [navigate]);

  // Gestionnaire des événements WebSocket
  const handleUserConnected = (data) => {
    if (!isMountedRef.current) return; // Prevent state update after unmount

    console.log("handleUserConnected:", data);
    console.log("Socket ID:", socketService.socket.id);
    console.log(
      "CurrentUserId from socketService:",
      socketService.currentUserId
    );

    // Si data.user existe, utilisez-le
    if (data.user) {
      console.log("Définition de l'utilisateur actuel depuis data.user");
      setCurrentUser(data.user);
      console.log("Utilisateur actuel défini:", data.user);

      // Stocker l'ID de l'utilisateur dans localStorage pour les reconnexions
      if (data.isCurrentUser) {
        localStorage.setItem("currentUserId", data.user.id);
        localStorage.setItem("currentUsername", data.user.username);
        console.log("ID utilisateur actuel sauvegardé:", data.user.id);
      }
    } else {
      // Sinon, utilisez data directement (format legacy)
      console.log(
        "Définition de l'utilisateur actuel depuis data (format legacy)"
      );
      setCurrentUser(data);
      console.log("Utilisateur actuel défini (format legacy):", data);

      // Format legacy - stocker ID si disponible
      if (data.id) {
        localStorage.setItem("currentUserId", data.id);
        localStorage.setItem("currentUsername", data.username || "Utilisateur");
        console.log("ID utilisateur actuel sauvegardé (legacy):", data.id);
      }
    }
    showNotification("info", "Connecté au serveur");
  };

  const handleUserDisconnected = (data) => {
    if (!isMountedRef.current) return; // Prevent state update after unmount
    setRoomUsers((prev) => prev.filter((user) => user.id !== data.userId));
  };

  const handleNewMessage = (data) => {
    if (!isMountedRef.current) return; // Prevent state update after unmount

    console.log("[DEBUG] Nouveau message reçu:", data);

    // Vérifier si le message a déjà été traité
    const messageId = data.id || (data.message && data.message.id);
    if (messageId && messageIdRef.current.has(messageId)) {
      console.log(`[DEBUG] Message déjà affiché, ignoré (ID: ${messageId})`);
      return;
    }

    // Le serveur peut envoyer soit un message directement, soit un objet {message}
    const messageToAdd = data.message || data;

    // Ajouter l'ID du message à notre ensemble pour éviter les doublons
    if (messageId) {
      messageIdRef.current.add(messageId);
      // Limiter la taille du Set pour éviter les fuites de mémoire
      if (messageIdRef.current.size > 200) {
        // Garder seulement les 100 derniers IDs
        messageIdRef.current = new Set(
          Array.from(messageIdRef.current).slice(-100)
        );
      }
    }

    // Ajouter des informations de débogage
    console.log("[DEBUG] Message ajouté:", messageToAdd);
    console.log("[DEBUG] Utilisateur actuel:", currentUser);

    setMessages((prev) => [...prev, messageToAdd]);
  };

  const handleRoomHistory = (data) => {
    if (!isMountedRef.current) return; // Prevent state update after unmount

    console.log("Historique de la salle reçu:", data);
    // Le serveur peut renvoyer directement les messages ou un objet {messages, users}
    const historyMessages = data.messages || data;
    const roomParticipants = data.users || [];
    setMessages(historyMessages);
    setRoomUsers(roomParticipants);
  };

  const handleUserJoinedRoom = (data) => {
    if (!isMountedRef.current) return; // Prevent state update after unmount

    console.log("User joined room event:", data);

    // Vérification que data et data.user existent
    if (!data || !data.user) {
      console.warn("Données d'utilisateur rejoint invalides:", data);
      return;
    }

    // Extraire l'utilisateur ou utiliser des valeurs par défaut
    const user = {
      id: data.user.id || data.userId,
      username: data.user.username || "Utilisateur inconnu",
      color: data.user.color || "#CCCCCC",
    };

    // Vérifier que l'ID existe
    if (!user.id) {
      console.warn("Utilisateur sans ID ignoré");
      return;
    }

    setRoomUsers((prev) => {
      if (!prev.find((u) => u.id === user.id)) {
        return [...prev, user];
      }
      return prev;
    });

    showNotification("info", `${user.username} a rejoint la salle`);
  };

  const handleUserLeftRoom = (data) => {
    if (!isMountedRef.current) return; // Prevent state update after unmount

    console.log("User left room event:", data);

    // Vérification des données
    if (!data) {
      console.warn("Données d'utilisateur quitté invalides");
      return;
    }

    // L'ID de l'utilisateur peut être soit data.userId soit data.user?.id
    const userId = data.userId || data.user?.id;

    if (!userId) {
      console.warn("Impossible d'identifier l'utilisateur qui a quitté:", data);
      return;
    }

    setRoomUsers((prev) => prev.filter((user) => user.id !== userId));

    // Récupérer le nom d'utilisateur s'il est disponible
    const username = data.username || data.user?.username || "Un utilisateur";
    showNotification("info", `${username} a quitté la salle`);
  };

  const handleTyping = (data) => {
    if (!isMountedRef.current) return; // Prevent state update after unmount

    console.log("Typing event:", data);

    // Vérification des données
    if (!data || typeof data.isTyping !== "boolean") {
      console.warn("Données de frappe invalides:", data);
      return;
    }

    // L'ID de l'utilisateur peut être dans différents formats
    const userId = data.userId || data.user?.id;

    if (!userId) {
      console.warn("Impossible d'identifier l'utilisateur qui frappe:", data);
      return;
    }

    // Annuler tout timeout existant pour cet utilisateur
    if (typingTimeoutsRef.current[userId]) {
      clearTimeout(typingTimeoutsRef.current[userId]);
    }

    if (data.isTyping) {
      setTypingUsers((prev) => {
        if (!prev.includes(userId)) {
          return [...prev, userId];
        }
        return prev;
      });

      // Définir un nouveau timeout pour cet utilisateur
      typingTimeoutsRef.current[userId] = setTimeout(() => {
        if (!isMountedRef.current) return; // Prevent state update in timeout after unmount
        setTypingUsers((prev) => prev.filter((id) => id !== userId));
        delete typingTimeoutsRef.current[userId];
      }, 3000); // Le statut expire après 3 secondes d'inactivité
    } else {
      setTypingUsers((prev) => prev.filter((id) => id !== userId));
      delete typingTimeoutsRef.current[userId];
    }
  };

  // Gestionnaire pour les nouveaux utilisateurs qui rejoignent
  const handleUserJoined = (data) => {
    if (!isMountedRef.current) return; // Prevent state update after unmount

    console.log("Nouvel utilisateur connecté:", data);

    if (data.user) {
      // Ajouter l'utilisateur à la liste des utilisateurs de la salle si pas déjà présent
      setRoomUsers((prev) => {
        if (!prev.find((u) => u.id === data.user.id)) {
          return [...prev, data.user];
        }
        return prev;
      });

      showNotification("info", `${data.user.username} s'est connecté`);
    }
  };

  // Actions utilisateur
  const handleRoomSelect = (roomId) => {
    if (currentRoom !== roomId) {
      socketService.leaveRoom(currentRoom);
      socketService.joinRoom(roomId);
      setCurrentRoom(roomId);
      setMessages([]);
    }
  };

  const handleCreateRoom = (roomName) => {
    const roomId = uuidv4(); // Générer un ID unique
    // Envoyer la création du salon au serveur pour diffusion à tous les clients
    socketService.createRoom(roomId, roomName);
    // Ajouter localement le salon et y accéder
    setRooms((prev) => [...prev, { id: roomId, name: roomName }]);
    handleRoomSelect(roomId);
  };

  const handleSendMessage = (content) => {
    console.log(
      `[DEBUG] Envoi de message dans la salle ${currentRoom}: "${content}"`
    );
    socketService.sendMessage(currentRoom, content);
  };

  const handleTypingStatus = (isTyping) => {
    socketService.typing(currentRoom, isTyping);
  };

  const handleLogout = () => {
    console.log("Déconnexion de l'utilisateur:", currentUser?.username);

    // Mark component as unmounted immediately to prevent any further state updates
    isMountedRef.current = false;

    // Remove socket event listeners first to prevent any callbacks during logout
    const events = [
      "userConnected",
      "userJoined",
      "userDisconnected",
      "newMessage",
      "roomHistory",
      "userJoinedRoom",
      "userLeftRoom",
      "typing",
      "userColorChanged",
      "roomCreated",
      "roomList",
      "roomUserList",
      "error",
      "userAvatarChanged",
    ];

    events.forEach((event) => {
      socketService.off(event);
    });

    // Disconnect socket
    socketService.disconnect();

    // Clear local storage after socket disconnection
    localStorage.removeItem("token");
    localStorage.removeItem("currentUserId");
    localStorage.removeItem("currentUsername");

    // Use a slight delay before navigation to ensure all async operations complete
    setTimeout(() => {
      navigate("/login", { state: { justLoggedOut: true } });
    }, 50);
  };

  const showNotification = (type, message) => {
    if (!isMountedRef.current) return; // Prevent notification after unmount

    setNotification({ type, message });

    // Effacer la notification après 3 secondes
    setTimeout(() => {
      if (!isMountedRef.current) return; // Prevent state update in timeout after unmount
      setNotification(null);
    }, 3000);
  };

  // Nettoyer les timeouts à la déconnexion
  useEffect(() => {
    return () => {
      // Annuler tous les timeouts à la déconnexion
      Object.values(typingTimeoutsRef.current).forEach((timeout) => {
        clearTimeout(timeout);
      });
      typingTimeoutsRef.current = {};

      // Mark as unmounted
      isMountedRef.current = false;
    };
  }, []); // Empty dependency array is correct here as we only want this to run on mount/unmount

  // Gestionnaire pour les mises à jour de couleur des utilisateurs
  const handleUserColorChanged = (data) => {
    if (!isMountedRef.current) return; // Prevent state update after unmount

    console.log("[COLOR] Mise à jour de couleur reçue:", data);

    // Mettre à jour la couleur de l'utilisateur dans la liste des utilisateurs
    setRoomUsers((prev) => {
      const updatedUsers = prev.map((user) =>
        user.id === data.userId ? { ...user, color: data.color } : user
      );

      // Log le avant/après pour diagnostiquer
      const userBefore = prev.find((u) => u.id === data.userId);
      const userAfter = updatedUsers.find((u) => u.id === data.userId);

      if (userBefore && userAfter) {
        console.log(`[COLOR] Mise à jour utilisateur ${userAfter.username}:`, {
          ancienneCouleur: userBefore.color,
          nouvelleCouleur: userAfter.color,
        });
      } else if (!userBefore) {
        console.log(
          `[COLOR] Utilisateur ID=${data.userId} non trouvé dans la liste actuelle des utilisateurs`
        );
      }

      return updatedUsers;
    });

    // Si c'est l'utilisateur actuellement connecté, mettre à jour son état
    if (currentUser && currentUser.id === data.userId) {
      console.log(`[COLOR] Mise à jour de ma propre couleur: ${data.color}`);

      // Mettre à jour l'état local
      setCurrentUser((prev) => ({
        ...prev,
        color: data.color,
      }));

      // Sauvegarder la nouvelle couleur dans le localStorage pour persistance
      try {
        // Essayer d'abord userData
        const userDataString = localStorage.getItem("userData");
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          userData.color = data.color;
          localStorage.setItem("userData", JSON.stringify(userData));
          console.log(
            `[COLOR] Couleur mise à jour dans userData: ${data.color}`
          );
        }

        // Mise à jour directe si userData n'existe pas
        localStorage.setItem("userColor", data.color);
        console.log(`[COLOR] Couleur mise à jour directement: ${data.color}`);
      } catch (error) {
        console.error(
          "[COLOR] Erreur lors de la mise à jour du localStorage:",
          error
        );
      }
    }

    // Force UI refresh pour la pastille de couleur dans le header
    // Cette fois, on utilise l'ID unique au lieu de la classe
    setTimeout(() => {
      const headerColorDot = document.getElementById("header-color-dot");
      if (headerColorDot) {
        const headerUserId = headerColorDot.getAttribute("data-user-id");
        if (headerUserId && parseInt(headerUserId) === data.userId) {
          console.log(
            `[COLOR] Force mise à jour de la pastille de couleur dans le header: ${data.color}`
          );
          headerColorDot.style.backgroundColor = data.color;
        }
      }

      // Aussi mettre à jour currentUser si les données sont incompatibles
      if (currentUser && currentUser.id !== data.userId) {
        const headerUsername = document.getElementById("header-username");
        if (headerUsername && headerUsername.textContent === data.username) {
          console.log(
            `[COLOR] Détection d'incohérence - mise à jour forcée de currentUser`
          );
          setCurrentUser((prev) => ({
            ...prev,
            color: data.color,
          }));
        }
      }
    }, 50);

    // Mettre à jour la couleur dans les messages existants
    setMessages((prev) => {
      const updatedMessages = prev.map((msg) => {
        if (msg.userId === data.userId || msg.user?.id === data.userId) {
          // Créer une copie du message avec la couleur mise à jour
          const updatedMsg = { ...msg };

          if (updatedMsg.user) {
            updatedMsg.user = { ...updatedMsg.user, color: data.color };
          } else {
            updatedMsg.userColor = data.color;
          }

          return updatedMsg;
        }
        return msg;
      });

      const changedCount = updatedMessages.filter(
        (msg, idx) =>
          msg !== prev[idx] &&
          (msg.userId === data.userId || msg.user?.id === data.userId)
      ).length;

      console.log(
        `[COLOR] ${changedCount} messages mis à jour avec la nouvelle couleur`
      );

      return updatedMessages;
    });
  };

  // Gestionnaire pour les nouveaux salons créés par d'autres utilisateurs
  const handleRoomCreated = (data) => {
    if (!isMountedRef.current) return; // Prevent state update after unmount

    console.log("Nouveau salon créé:", data);
    // Ne pas ajouter le salon s'il existe déjà
    setRooms((prev) => {
      if (!prev.some((room) => room.id === data.roomId)) {
        return [...prev, { id: data.roomId, name: data.roomName }];
      }
      return prev;
    });
    showNotification("info", `Nouveau salon créé: ${data.roomName}`);
  };

  // Gestionnaire pour la liste initiale des salons
  const handleRoomList = (data) => {
    if (!isMountedRef.current) return; // Prevent state update after unmount

    console.log("Liste des salons reçue:", data);
    if (data.rooms && Array.isArray(data.rooms)) {
      // Filtrer le salon "general" et enlever les doublons par ID
      const uniqueRooms = data.rooms
        .filter((room) => room.id !== "general")
        .map((room) => {
          // S'assurer que les salons dont l'ID commence par "private_" sont marqués comme privés
          if (room.id.startsWith("private_") && !room.isPrivate) {
            return {
              ...room,
              isPrivate: true,
            };
          }
          return room;
        })
        .reduce((acc, room) => {
          // Ne pas ajouter de salons déjà existants avec le même ID
          if (!acc.some((r) => r.id === room.id)) {
            acc.push(room);
          }
          return acc;
        }, []);

      setRooms(uniqueRooms);
    }
  };

  // Gestionnaire pour les mises à jour de la liste des utilisateurs d'une salle
  const handleRoomUserList = (data) => {
    if (!isMountedRef.current) return; // Prevent state update after unmount

    console.log("[USERS] Liste d'utilisateurs mise à jour reçue:", data);

    // Vérifier si c'est pour la salle actuelle
    if (data.roomId === currentRoom && data.users) {
      // Comparaison avant/après pour détecter les changements
      setRoomUsers((prev) => {
        // Comparer les utilisateurs pour voir ce qui a changé
        const addedUsers = data.users.filter(
          (newUser) => !prev.some((oldUser) => oldUser.id === newUser.id)
        );

        const removedUsers = prev.filter(
          (oldUser) => !data.users.some((newUser) => newUser.id === oldUser.id)
        );

        const changedUsers = data.users.filter((newUser) => {
          const oldUser = prev.find((u) => u.id === newUser.id);
          return (
            oldUser &&
            (oldUser.color !== newUser.color ||
              oldUser.username !== newUser.username)
          );
        });

        // Logs de débogage
        if (addedUsers.length > 0) {
          console.log(
            `[USERS] ${addedUsers.length} utilisateurs ajoutés:`,
            addedUsers
          );
        }
        if (removedUsers.length > 0) {
          console.log(
            `[USERS] ${removedUsers.length} utilisateurs retirés:`,
            removedUsers
          );
        }
        if (changedUsers.length > 0) {
          console.log(
            `[USERS] ${changedUsers.length} utilisateurs modifiés:`,
            changedUsers.map((newUser) => {
              const oldUser = prev.find((u) => u.id === newUser.id);
              return {
                id: newUser.id,
                username: newUser.username,
                ancienneCouleur: oldUser?.color,
                nouvelleCouleur: newUser.color,
              };
            })
          );
        }

        console.log(
          `[USERS] Liste des utilisateurs mise à jour pour ${currentRoom}: ${data.users.length} utilisateurs`
        );

        return data.users;
      });
    } else {
      console.log(
        `[USERS] Liste ignorée car salle différente (actuelle: ${currentRoom}, reçue: ${data.roomId})`
      );
    }
  };

  // Fonction pour ouvrir la modale de profil
  const openProfileModal = () => {
    if (!isMountedRef.current) return; // Prevent state update after unmount
    setIsProfileModalOpen(true);
  };

  // Fonction pour fermer la modale de profil
  const closeProfileModal = () => {
    if (!isMountedRef.current) return; // Prevent state update after unmount
    setIsProfileModalOpen(false);
  };

  // Fonction pour sauvegarder la nouvelle couleur
  const handleSaveColor = async (newColor) => {
    if (!isMountedRef.current) return; // Prevent state update after unmount

    try {
      if (!currentUser || !currentUser.id) {
        showNotification("error", "Utilisateur non identifié");
        return;
      }

      // Afficher une notification de chargement
      showNotification("info", "Mise à jour de votre couleur...");

      // Appel API pour mettre à jour la couleur
      const updatedUser = await updateUserColor(currentUser.id, newColor);

      // Note: Les mises à jour visuelles seront faites via l'événement WebSocket
      // pour garantir la cohérence entre tous les clients

      // Notification de succès plus claire
      showNotification("success", "Votre couleur a été mise à jour");
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la couleur:", error);
      showNotification("error", "Erreur lors de la mise à jour de la couleur");
    }
  };

  // Fonction pour sauvegarder le nouvel avatar
  const handleSaveAvatar = async (avatarDataUrl) => {
    if (!isMountedRef.current) return; // Prevent state update after unmount

    try {
      if (!currentUser || !currentUser.id) {
        showNotification("error", "Utilisateur non identifié");
        return;
      }

      // Afficher une notification de chargement
      showNotification("info", "Mise à jour de votre avatar...");

      // Appel API pour mettre à jour l'avatar
      const updatedUser = await updateUserAvatar(currentUser.id, avatarDataUrl);

      // Mettre à jour l'utilisateur localement
      setCurrentUser((prev) => ({
        ...prev,
        avatar: updatedUser.avatar,
      }));

      // Mettre à jour l'utilisateur dans la liste des utilisateurs de la salle
      setRoomUsers((prev) =>
        prev.map((user) =>
          user.id === currentUser.id
            ? { ...user, avatar: updatedUser.avatar }
            : user
        )
      );

      // Notification de succès
      showNotification("success", "Votre avatar a été mis à jour");

      // Envoyer l'information au serveur pour diffusion à tous les clients
      socketService.socket.emit("userAvatarChanged", {
        userId: currentUser.id,
        avatar: updatedUser.avatar,
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'avatar:", error);
      showNotification("error", "Erreur lors de la mise à jour de l'avatar");
    }
  };

  // Gestionnaire pour les mises à jour d'avatar des utilisateurs
  const handleUserAvatarChanged = (data) => {
    if (!isMountedRef.current) return; // Prevent state update after unmount

    console.log("[AVATAR] Mise à jour d'avatar reçue:", data);

    // Mettre à jour l'avatar de l'utilisateur dans la liste des utilisateurs
    setRoomUsers((prev) => {
      return prev.map((user) =>
        user.id === data.userId ? { ...user, avatar: data.avatar } : user
      );
    });

    // Si c'est l'utilisateur actuellement connecté, mettre à jour son état
    if (currentUser && currentUser.id === data.userId) {
      setCurrentUser((prev) => ({
        ...prev,
        avatar: data.avatar,
      }));
    }

    // Mettre à jour l'avatar dans les messages existants
    setMessages((prev) => {
      return prev.map((msg) => {
        if (msg.userId === data.userId || msg.user?.id === data.userId) {
          // Créer une copie du message avec l'avatar mis à jour
          const updatedMsg = { ...msg };

          if (updatedMsg.user) {
            updatedMsg.user = { ...updatedMsg.user, avatar: data.avatar };
          } else {
            updatedMsg.userAvatar = data.avatar;
          }

          return updatedMsg;
        }
        return msg;
      });
    });
  };

  // Ajout de l'écouteur d'événement pour les changements d'avatar
  useEffect(() => {
    socketService.on("userAvatarChanged", handleUserAvatarChanged);

    return () => {
      socketService.off("userAvatarChanged");
    };
  }, []);

  // Fonction pour créer un salon privé avec un autre utilisateur
  const handlePrivateChat = (otherUser) => {
    if (!isMountedRef.current) return; // Prevent state update after unmount

    if (!currentUser) {
      showNotification(
        "error",
        "Vous devez être connecté pour démarrer une conversation privée"
      );
      return;
    }

    // Générer un ID unique pour ce chat privé entre les deux utilisateurs
    // On trie les IDs pour avoir toujours le même salon quel que soit l'ordre des utilisateurs
    const userIds = [currentUser.id, otherUser.id].sort((a, b) => a - b);
    const privateRoomId = `private_${userIds[0]}_${userIds[1]}`;

    // Nom convivial du salon
    const roomName = `Chat avec ${otherUser.username}`;

    // Vérifier si la salle existe déjà dans notre liste de salons
    const existingRoom = rooms.find((room) => room.id === privateRoomId);

    if (!existingRoom) {
      // Créer la salle si elle n'existe pas
      socketService.createRoom(privateRoomId, roomName, true); // true = salon privé

      // Ajouter directement à la liste locale pour réactivité immédiate
      setRooms((prev) => [
        ...prev,
        { id: privateRoomId, name: roomName, isPrivate: true },
      ]);
    }

    // Changer vers cette salle
    handleRoomSelect(privateRoomId);

    showNotification("info", `Conversation privée avec ${otherUser.username}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Chat App</h1>
          <div className="flex items-center space-x-2">
            {currentUser && (
              <div className="flex items-center mr-2">
                <div className="flex items-center mr-2">
                  {currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt="Avatar"
                      className="w-8 h-8 rounded-full mr-1 object-cover"
                    />
                  ) : (
                    <span
                      id="header-color-dot"
                      className="w-3 h-3 rounded-full mr-1 header-color-dot"
                      style={{ backgroundColor: currentUser.color || "#000" }}
                      data-user-id={currentUser.id}
                    ></span>
                  )}
                  <span
                    id="header-username"
                    className="text-gray-700 header-username"
                    data-user-id={currentUser.id}
                  >
                    {currentUser.username}
                  </span>
                </div>
                <button
                  onClick={openProfileModal}
                  className="ml-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  title="Paramètres de profil"
                >
                  <FiSettings size={16} />
                </button>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-grow overflow-hidden">
        <RoomList
          rooms={rooms}
          currentRoom={currentRoom}
          onRoomSelect={handleRoomSelect}
          onCreateRoom={handleCreateRoom}
          currentUser={currentUser}
        />

        <div className="flex-grow flex flex-col overflow-hidden">
          <MessageList messages={messages} currentUser={currentUser} />
          <MessageInput
            onSendMessage={handleSendMessage}
            onTyping={handleTypingStatus}
            typingUsers={typingUsers}
            roomUsers={roomUsers}
          />
        </div>

        <UserList
          users={roomUsers}
          typingUsers={typingUsers}
          onPrivateChat={handlePrivateChat}
          currentUser={currentUser}
        />
      </main>

      {/* Modale de profil */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={closeProfileModal}
        currentUser={currentUser}
        onSaveColor={handleSaveColor}
        onSaveAvatar={handleSaveAvatar}
      />

      <Notification
        notification={notification}
        onClose={() => setNotification(null)}
      />
    </div>
  );
};

export default ChatPage;
