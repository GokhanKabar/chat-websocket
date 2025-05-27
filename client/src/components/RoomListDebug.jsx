import React, { useState, useEffect } from "react";
import { FiMessageSquare, FiUsers, FiLock } from "react-icons/fi";

const RoomListDebug = ({
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
    // Pour les salons privés, extraire les IDs utilisateur depuis l'ID du salon
    if (room.id.startsWith("private_")) {
      const participantPart = room.id.replace("private_", "");
      const participantIds = participantPart.split("_").map(Number);

      // Déterminer quel ID n'est pas celui de l'utilisateur actuel
      if (currentUser && participantIds.includes(currentUser.id)) {
        const otherUserId = participantIds.find((id) => id !== currentUser.id);

        // Si le nom du salon est au format "Chat entre X et Y", extraire le nom de l'autre utilisateur
        if (room.name && room.name.startsWith("Chat entre ")) {
          // Extraire les noms des participants
          const nameMatch = room.name.match(/Chat entre (.+) et (.+)/);
          if (nameMatch) {
            const [, name1, name2] = nameMatch;

            // Déterminer quel nom n'est pas celui de l'utilisateur actuel
            const otherUserName =
              name1 === currentUser.username ? name2 : name1;
            const generatedName = `Chat avec ${otherUserName}`;

            return generatedName;
          }
        }

        // Si le nom est déjà au format "Chat avec X", vérifier que X n'est pas l'utilisateur actuel
        if (room.name && room.name.startsWith("Chat avec ")) {
          const otherUserName = room.name.replace("Chat avec ", "");

          // Si le nom dans "Chat avec" est celui de l'utilisateur actuel, c'est incorrect
          if (otherUserName === currentUser.username) {
            const generatedName = `Chat privé #${otherUserId}`;

            return generatedName;
          } else {
            return room.name;
          }
        }

        // Sinon, retourner un format générique avec l'ID
        const generatedName = `Chat privé #${otherUserId}`;
        return generatedName;
      }

      // Utiliser le nom par défaut
      const defaultName = room.name || "Chat privé";
      return defaultName;
    }

    // Séparer les salons publics et privés
    const publicRooms = rooms.filter((room) => !room.isPrivate);
    const privateRooms = rooms.filter((room) => room.isPrivate);

    return (
      <div className="bg-gray-800 text-white w-64 flex flex-col flex-shrink-0">
        {/* Debug Info Panel */}
        <div className="bg-red-900 p-2 text-xs">
          <div>
            <strong>DEBUG MODE</strong>
          </div>
          <div>
            User: {currentUser?.username} (ID: {currentUser?.id})
          </div>
          <div>Total rooms: {rooms.length}</div>
          <div>Public: {publicRooms.length}</div>
          <div>Private: {privateRooms.length}</div>
        </div>

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
                privateRooms.map((room) => {
                  const formattedName = formatPrivateRoomName(room);
                  console.log("[ROOMLIST_DEBUG] Affichage du salon privé:", {
                    id: room.id,
                    originalName: room.name,
                    formattedName: formattedName,
                  });

                  return (
                    <li
                      key={room.id}
                      onClick={() => onRoomSelect(room.id)}
                      className={`p-2 mb-1 rounded cursor-pointer hover:bg-gray-700 flex items-center ${
                        currentRoom === room.id ? "bg-purple-900" : ""
                      }`}
                    >
                      <FiLock className="mr-2 text-yellow-300" />
                      <span>{formattedName}</span>
                      <span className="ml-auto text-xs bg-yellow-400 text-black px-1.5 rounded-full">
                        Privé
                      </span>
                      <div className="text-xs text-gray-500 ml-2">
                        (ID: {room.id})
                      </div>
                    </li>
                  );
                })
              ) : (
                <li className="p-2 text-sm text-gray-400 italic">
                  Aucune conversation privée (DEBUG: {privateRooms.length}{" "}
                  salons privés)
                </li>
              )}
            </ul>
          </div>

          {/* Section Debug détaillée */}
          <div className="mt-4 p-2 bg-gray-900 text-xs">
            <div className="text-yellow-300 font-bold mb-2">DEBUG INFO:</div>
            <div>Tous les salons reçus:</div>
            {rooms.map((room, index) => (
              <div key={room.id} className="ml-2">
                {index + 1}. {room.id} - {room.name} (privé:{" "}
                {room.isPrivate ? "OUI" : "NON"})
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };
};

export default RoomListDebug;
