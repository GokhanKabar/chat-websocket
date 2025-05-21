import React, { useState, useEffect } from "react";

const MessageInput = ({
  onSendMessage,
  onTyping,
  typingUsers = [],
  roomUsers = [],
}) => {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [dots, setDots] = useState("");

  // Animation des points de suspension
  useEffect(() => {
    if (typingUsers.length > 0) {
      const interval = setInterval(() => {
        setDots((prev) => {
          if (prev.length >= 3) return "";
          return prev + ".";
        });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [typingUsers.length]);

  const handleChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    // Gestion du statut "en train d'écrire"
    if (!isTyping && value.length > 0) {
      setIsTyping(true);
      onTyping(true);
    } else if (isTyping && value.length === 0) {
      setIsTyping(false);
      onTyping(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage("");
      onTyping(false);
      setIsTyping(false);
    }
  };

  // Déterminer quels utilisateurs sont en train d'écrire
  const typingUsernames = roomUsers
    .filter((user) => typingUsers.includes(user.id))
    .map((user) => user.username);

  // Générer le texte de notification
  const getTypingText = () => {
    if (typingUsernames.length === 0) return "";
    if (typingUsernames.length === 1)
      return `${typingUsernames[0]} est en train d'écrire`;
    if (typingUsernames.length === 2)
      return `${typingUsernames[0]} et ${typingUsernames[1]} sont en train d'écrire`;
    return "Plusieurs personnes sont en train d'écrire";
  };

  return (
    <div className="border-t border-gray-300 bg-white flex-shrink-0">
      {/* Bulle de notification pour les utilisateurs qui écrivent */}
      {typingUsernames.length > 0 && (
        <div className="px-4 py-1">
          <div className="inline-block bg-gray-100 text-sm text-gray-600 px-3 py-1 rounded-lg shadow-sm">
            {getTypingText()}
            {dots}
          </div>
        </div>
      )}

      <div className="p-3">
        <form onSubmit={handleSubmit} className="flex">
          <input
            type="text"
            value={message}
            onChange={handleChange}
            placeholder="Écrivez votre message..."
            className="flex-grow p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!message.trim()}
            className={`px-4 py-2 rounded-r-md focus:outline-none ${
              message.trim()
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            Envoyer
          </button>
        </form>
      </div>
    </div>
  );
};

export default MessageInput;
