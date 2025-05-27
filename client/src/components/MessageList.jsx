import React, { useRef, useEffect } from "react";
import Avatar from "./Avatar";

const MessageList = ({ messages, currentUser }) => {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Fonction pour faire défiler vers le bas à chaque nouveau message
  const scrollToBottom = () => {
    // Utiliser le conteneur avec hauteur fixe pour le scroll
    if (messagesContainerRef.current) {
      const { scrollHeight, clientHeight } = messagesContainerRef.current;
      messagesContainerRef.current.scrollTop = scrollHeight - clientHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Pour le débogage
  useEffect(() => {
    if (messages && messages.length > 0) {
      console.log("Format du premier message:", messages[0]);
    }
    console.log("Current user:", currentUser);
  }, [messages, currentUser]);

  // Fonction pour afficher l'avatar avec le composant Avatar
  const renderAvatar = (user) => {
    return <Avatar user={user} size="w-8 h-8" showStatus={false} />;
  };

  // Si pas de messages
  if (!messages || messages.length === 0) {
    return (
      <div
        ref={messagesContainerRef}
        className="h-[calc(100vh-200px)] p-4 overflow-y-auto bg-white"
      >
        <div className="flex items-center justify-center h-full text-gray-500">
          Aucun message dans ce salon pour l'instant.
        </div>
      </div>
    );
  }

  return (
    <div
      ref={messagesContainerRef}
      className="h-[calc(100vh-200px)] p-4 overflow-y-auto bg-white"
    >
      <div className="space-y-4">
        {messages.map((message) => {
          // Vérification de la structure du message pour gérer différentes formats
          // Le serveur peut renvoyer soit un userId direct, soit un objet user complet
          const messageUserId = message.userId || message.user?.id;
          const messageUsername =
            message.username || message.user?.username || "Utilisateur inconnu";
          const messageUserColor =
            message.userColor || message.user?.color || "#E5E7EB";
          const messageUserAvatar = message.userAvatar || message.user?.avatar;

          // Créer un objet utilisateur pour l'avatar
          const messageUser = {
            id: messageUserId,
            username: messageUsername,
            color: messageUserColor,
            avatar: messageUserAvatar,
          };

          // Déterminer si le message est de l'utilisateur actuel
          const isCurrentUser = currentUser && messageUserId === currentUser.id;

          return (
            <div
              key={message.id}
              className={`flex ${
                isCurrentUser ? "justify-end" : "justify-start"
              } w-full items-start space-x-2`}
            >
              {!isCurrentUser && (
                <div className="flex-shrink-0">{renderAvatar(messageUser)}</div>
              )}

              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  isCurrentUser
                    ? "text-white rounded-tr-none" // Suppression de bg-blue-600
                    : "bg-gray-200 text-gray-800 rounded-tl-none"
                } shadow-md`}
                style={{
                  backgroundColor: messageUserColor, // Utilisation de la couleur personnalisée pour tous les messages
                  maxWidth: "75%",
                }}
              >
                {!isCurrentUser && (
                  <div className="font-bold mb-1">{messageUsername}</div>
                )}
                <p className="break-words">{message.content}</p>
                <div
                  className={`text-xs mt-1 ${
                    isCurrentUser ? "text-blue-200" : "text-gray-500"
                  } text-right`}
                >
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>

              {isCurrentUser && (
                <div className="flex-shrink-0">{renderAvatar(currentUser)}</div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessageList;
