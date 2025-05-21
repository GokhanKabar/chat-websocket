import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import RoomList from "../components/RoomList";
import MessageList from "../components/MessageList";
import MessageInput from "../components/MessageInput";
import UserList from "../components/UserList";
import Notification from "../components/Notification";
import ColorPickerModal from "../components/ColorPickerModal";
import socketService from "../services/socketService";
import { updateUserColor } from "../services/userService";
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
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const typingTimeoutsRef = useRef({});

  useEffect(() => {
    // Récupérer le token JWT du localStorage
    const token = localStorage.getItem("token");
    console.log(
      "Token récupéré:",
      token ? `${token.substring(0, 20)}...` : "aucun token"
    );

    if (!token) {
      navigate("/login");
      return;
    }

    // Forcer la déconnexion d'abord pour éviter les problèmes de connexion multiple
    socketService.disconnect();

    // Initialiser la connexion WebSocket avec un délai pour s'assurer que la déconnexion est terminée
    setTimeout(() => {
      socketService.connect(token);

      // Écouter les événements
      socketService.on("userConnected", handleUserConnected);
      socketService.on("userJoined", handleUserJoined);
      socketService.on("userDisconnected", handleUserDisconnected);
      socketService.on("newMessage", handleNewMessage);
      socketService.on("roomHistory", handleRoomHistory);
      socketService.on("userJoinedRoom", handleUserJoinedRoom);
      socketService.on("userLeftRoom", handleUserLeftRoom);
      socketService.on("typing", handleTyping);
      socketService.on("userColorChanged", handleUserColorChanged);
      socketService.on("roomCreated", handleRoomCreated);
      socketService.on("roomList", handleRoomList);
      socketService.on("roomUserList", handleRoomUserList);

      // Écouteur pour les erreurs de connexion
      socketService.on("error", (error) => {
        console.error("Erreur WebSocket reçue:", error);
        showNotification("error", `Erreur: ${error.message}`);
      });

      // Rejoindre la salle général par défaut
      socketService.joinRoom("general");
    }, 300);

    // Nettoyage à la déconnexion
    return () => {
      console.log("Nettoyage du composant ChatPage - déconnexion du socket");
      socketService.disconnect();
    };
  }, [navigate]);

  // Gestionnaire des événements WebSocket
  const handleUserConnected = (data) => {
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
    setRoomUsers((prev) => prev.filter((user) => user.id !== data.userId));
  };

  const handleNewMessage = (data) => {
    console.log("Nouveau message reçu:", data);
    // Le serveur peut envoyer soit un message directement, soit un objet {message}
    const messageToAdd = data.message || data;

    // Ajouter des informations de débogage
    console.log("Message ajouté:", messageToAdd);
    console.log("Utilisateur actuel:", currentUser);

    setMessages((prev) => [...prev, messageToAdd]);
  };

  const handleRoomHistory = (data) => {
    console.log("Historique de la salle reçu:", data);
    // Le serveur peut renvoyer directement les messages ou un objet {messages, users}
    const historyMessages = data.messages || data;
    const roomParticipants = data.users || [];
    setMessages(historyMessages);
    setRoomUsers(roomParticipants);
  };

  const handleUserJoinedRoom = (data) => {
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
    socketService.sendMessage(currentRoom, content);
  };

  const handleTypingStatus = (isTyping) => {
    socketService.typing(currentRoom, isTyping);
  };

  const handleLogout = () => {
    console.log("Déconnexion de l'utilisateur:", currentUser?.username);

    // Déconnexion du WebSocket
    socketService.disconnect();

    // Suppression du token d'authentification
    localStorage.removeItem("token");

    // Afficher une notification avant la redirection
    showNotification("info", "Vous avez été déconnecté");

    // Utiliser useNavigate avec state pour indiquer qu'on vient de se déconnecter
    navigate("/login", { state: { justLoggedOut: true } });
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });

    // Effacer la notification après 3 secondes
    setTimeout(() => {
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
    };
  }, []);

  // Fonction pour ouvrir la modale de sélection de couleur
  const openColorPicker = () => {
    setIsColorPickerOpen(true);
  };

  // Fonction pour fermer la modale de sélection de couleur
  const closeColorPicker = () => {
    setIsColorPickerOpen(false);
  };

  // Fonction pour sauvegarder la nouvelle couleur
  const handleSaveColor = async (newColor) => {
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

  // Gestionnaire pour les mises à jour de couleur des utilisateurs
  const handleUserColorChanged = (data) => {
    console.log("Mise à jour de couleur reçue:", data);

    // Mettre à jour la couleur de l'utilisateur dans la liste des utilisateurs
    setRoomUsers((prev) =>
      prev.map((user) =>
        user.id === data.userId ? { ...user, color: data.color } : user
      )
    );

    // Si c'est l'utilisateur actuel, mettre également à jour son état
    if (currentUser && currentUser.id === data.userId) {
      setCurrentUser((prev) => ({
        ...prev,
        color: data.color,
      }));

      // Sauvegarder la nouvelle couleur dans le localStorage pour persistance
      try {
        const userDataString = localStorage.getItem("userData");
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          userData.color = data.color;
          localStorage.setItem("userData", JSON.stringify(userData));
        }
      } catch (error) {
        console.error("Erreur lors de la mise à jour du localStorage:", error);
      }
    }

    // Mettre à jour la couleur dans les messages existants
    setMessages((prev) =>
      prev.map((msg) => {
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
      })
    );
  };

  // Gestionnaire pour les nouveaux salons créés par d'autres utilisateurs
  const handleRoomCreated = (data) => {
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
    console.log("Liste d'utilisateurs mise à jour reçue:", data);

    // Vérifier si c'est pour la salle actuelle
    if (data.roomId === currentRoom && data.users) {
      // Mettre à jour la liste des utilisateurs de la salle
      setRoomUsers(data.users);
      console.log(
        `Liste des utilisateurs mise à jour pour ${currentRoom}: ${data.users.length} utilisateurs`
      );
    }
  };

  // Fonction pour créer un salon privé avec un autre utilisateur
  const handlePrivateChat = (otherUser) => {
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
                <span
                  className="w-3 h-3 rounded-full mr-1"
                  style={{ backgroundColor: currentUser.color || "#000" }}
                ></span>
                <span className="text-gray-700">{currentUser.username}</span>
                <button
                  onClick={openColorPicker}
                  className="ml-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  title="Paramètres de couleur"
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

      {/* Modale de sélection de couleur */}
      <ColorPickerModal
        isOpen={isColorPickerOpen}
        onClose={closeColorPicker}
        currentColor={currentUser?.color || "#1D4ED8"}
        onSave={handleSaveColor}
      />

      <Notification
        notification={notification}
        onClose={() => setNotification(null)}
      />
    </div>
  );
};

export default ChatPage;
