import React from "react";
import { FiMessageSquare, FiInfo, FiUser } from "react-icons/fi";

const UserList = ({
  users = [],
  typingUsers = [],
  onPrivateChat,
  currentUser,
}) => {
  // Logs pour déboguer
  React.useEffect(() => {
    console.log("UserList - users:", users);
    console.log("UserList - typingUsers:", typingUsers);
  }, [users, typingUsers]);

  const handleUserClick = (otherUser) => {
    // Ne pas permettre de cliquer sur son propre nom
    if (currentUser && otherUser.id === currentUser.id) return;

    if (onPrivateChat) {
      onPrivateChat(otherUser);
    }
  };

  // Fonction pour afficher l'avatar ou un avatar par défaut
  const renderAvatar = (user) => {
    if (user?.avatar) {
      return (
        <img
          src={user.avatar}
          alt={`Avatar de ${user.username}`}
          className="w-6 h-6 rounded-full object-cover mr-2"
        />
      );
    }

    // Utiliser la couleur comme avatar par défaut
    return (
      <span
        className="w-6 h-6 rounded-full mr-2 flex items-center justify-center text-white text-xs font-medium"
        style={{ backgroundColor: user.color || "#CCCCCC" }}
      >
        {user.username[0].toUpperCase()}
      </span>
    );
  };

  // État pour afficher ou masquer le tooltip d'aide
  const [showTooltip, setShowTooltip] = React.useState(false);

  // Filtrer et trier les utilisateurs valides
  const validUsers = users.filter(Boolean).filter((user) => user && user.id);

  // Séparer l'utilisateur actuel des autres utilisateurs
  const currentUserFromList = currentUser
    ? validUsers.find((user) => user.id === currentUser.id)
    : null;

  const otherUsers = validUsers
    .filter((user) => !currentUser || user.id !== currentUser.id)
    .sort((a, b) => a.username.localeCompare(b.username)); // Tri alphabétique

  return (
    <div className="w-48 bg-gray-100 border-l border-gray-300 p-4 hidden md:block flex-shrink-0">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-bold text-gray-700">Utilisateurs</h2>
        <button
          className="text-gray-400 hover:text-gray-600"
          onClick={() => setShowTooltip(!showTooltip)}
        >
          <FiInfo size={16} />
        </button>
      </div>

      {showTooltip && (
        <div className="text-xs bg-blue-50 p-2 rounded mb-3 text-gray-600 border border-blue-200">
          Cliquez sur un utilisateur pour démarrer une conversation privée
        </div>
      )}

      <div className="overflow-y-auto h-[calc(100vh-200px)]">
        <ul>
          {/* Afficher d'abord l'utilisateur actuel s'il existe */}
          {currentUserFromList && (
            <li key={currentUserFromList.id} className="mb-2">
              <div className="p-1 bg-blue-50 rounded">
                <div className="flex items-center">
                  {renderAvatar(currentUserFromList)}
                  <span className="font-bold">
                    {currentUserFromList.username}{" "}
                    <span className="text-blue-600 text-xs">(moi)</span>
                  </span>
                  {typingUsers.includes(currentUserFromList.id) && (
                    <span className="ml-2 text-xs text-gray-500 italic">
                      écrit...
                    </span>
                  )}
                  <FiUser className="ml-auto text-blue-500" size={14} />
                </div>
              </div>
            </li>
          )}

          {/* Afficher ensuite les autres utilisateurs */}
          {otherUsers.map((user) => (
            <li key={user.id} className="mb-2">
              <div
                className="flex items-center cursor-pointer hover:bg-gray-200 p-1 rounded"
                onClick={() => handleUserClick(user)}
                title="Cliquez pour démarrer une discussion privée"
              >
                {renderAvatar(user)}
                <span>{user.username}</span>
                {typingUsers.includes(user.id) && (
                  <span className="ml-2 text-xs text-gray-500 italic">
                    écrit...
                  </span>
                )}

                <FiMessageSquare
                  className="ml-auto text-blue-500 hover:text-blue-700"
                  size={14}
                  title="Démarrer une conversation privée"
                />
              </div>
            </li>
          ))}

          {validUsers.length === 0 && (
            <li className="text-gray-500 text-sm">Aucun autre utilisateur</li>
          )}
        </ul>
      </div>

      {/* Style pour l'animation des points */}
      <style jsx="true">{`
        .typing-animation {
          display: inline-flex;
          align-items: center;
        }
        .dot {
          display: inline-block;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          margin: 0 1px;
          background-color: #666;
          animation: blink 1.4s infinite both;
        }
        .dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        .dot:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes blink {
          0% {
            opacity: 0.1;
          }
          20% {
            opacity: 1;
          }
          100% {
            opacity: 0.1;
          }
        }
      `}</style>
    </div>
  );
};

export default UserList;
