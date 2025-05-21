import React, { useState } from "react";
import { FiMessageSquare, FiUsers, FiLock } from "react-icons/fi";

const RoomList = ({
  rooms,
  currentRoom,
  onRoomSelect,
  onCreateRoom,
  currentUser,
}) => {
  const [newRoomName, setNewRoomName] = useState("");

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (newRoomName.trim()) {
      onCreateRoom(newRoomName.trim());
      setNewRoomName("");
    }
  };

  // Fonction pour formater le nom d'un salon privé
  const formatPrivateRoomName = (room) => {
    // Si le nom est déjà personnalisé, l'utiliser tel quel
    if (room.name && !room.name.startsWith("Chat avec ")) {
      return room.name;
    }

    // Essayer d'extraire les IDs utilisateur depuis l'ID du salon
    if (room.id.startsWith("private_")) {
      const participantPart = room.id.replace("private_", "");
      const participantIds = participantPart.split("_").map(Number);

      // Déterminer quel ID n'est pas celui de l'utilisateur actuel
      if (currentUser && participantIds.includes(currentUser.id)) {
        const otherUserId = participantIds.find((id) => id !== currentUser.id);

        // Si le nom du salon contient déjà un nom d'utilisateur, l'utiliser
        if (room.name && room.name.includes("Chat avec ")) {
          return room.name;
        }

        // Sinon, retourner un format générique
        return `Chat privé #${otherUserId}`;
      }
    }

    // Utiliser le nom par défaut
    return room.name || "Chat privé";
  };

  // Séparer les salons publics et privés
  const publicRooms = rooms.filter((room) => !room.isPrivate);
  const privateRooms = rooms.filter((room) => room.isPrivate);

  return (
    <div className="bg-gray-800 text-white w-64 flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold mb-2">Salons</h2>
        <form onSubmit={handleCreateRoom} className="flex">
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="Nouveau salon..."
            className="flex-grow p-2 text-sm bg-gray-700 rounded-l focus:outline-none"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-3 py-2 text-sm rounded-r hover:bg-blue-700 focus:outline-none"
          >
            +
          </button>
        </form>
      </div>

      <div className="overflow-y-auto h-[calc(100vh-200px)]">
        {/* Section Salons Publics */}
        <div className="mb-4">
          <div className="bg-gray-700 py-2 px-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider">
              Salon principal
            </h3>
          </div>
          <ul className="mt-2 px-2">
            {/* Salon général fixe */}
            <li
              onClick={() => onRoomSelect("general")}
              className={`p-2 mb-1 rounded cursor-pointer hover:bg-gray-700 flex items-center ${
                currentRoom === "general" ? "bg-blue-800" : ""
              }`}
            >
              <FiUsers className="mr-2 text-blue-400" />
              <span># Général</span>
            </li>
          </ul>
        </div>

        {/* Salons publics */}
        {publicRooms.length > 0 && (
          <div className="mb-4">
            <div className="bg-gray-700 py-2 px-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider">
                Salons publics
              </h3>
            </div>
            <ul className="mt-2 px-2">
              {publicRooms.map((room) => (
                <li
                  key={room.id}
                  onClick={() => onRoomSelect(room.id)}
                  className={`p-2 mb-1 rounded cursor-pointer hover:bg-gray-700 flex items-center ${
                    currentRoom === room.id ? "bg-blue-800" : ""
                  }`}
                >
                  <FiMessageSquare className="mr-2 text-green-400" />
                  <span>
                    #{" "}
                    {room.name && room.name !== room.id
                      ? room.name
                      : "Salon sans nom"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Ligne de séparation */}
        <div className="mx-4 border-t border-gray-600 my-3"></div>

        {/* Salons privés */}
        <div>
          <div className="bg-gray-700 py-2 px-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-yellow-300">
              Messages privés
            </h3>
          </div>
          <ul className="mt-2 px-2">
            {privateRooms.length > 0 ? (
              privateRooms.map((room) => (
                <li
                  key={room.id}
                  onClick={() => onRoomSelect(room.id)}
                  className={`p-2 mb-1 rounded cursor-pointer hover:bg-gray-700 flex items-center ${
                    currentRoom === room.id ? "bg-purple-900" : ""
                  }`}
                >
                  <FiLock className="mr-2 text-yellow-300" />
                  <span>{formatPrivateRoomName(room)}</span>
                  <span className="ml-auto text-xs bg-yellow-400 text-black px-1.5 rounded-full">
                    Privé
                  </span>
                </li>
              ))
            ) : (
              <li className="p-2 text-sm text-gray-400 italic">
                Aucune conversation privée
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RoomList;
