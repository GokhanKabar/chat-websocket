import React from "react";

const Avatar = ({
  user,
  size = "w-8 h-8",
  showStatus = false,
  className = "",
}) => {
  if (!user) return null;

  const isOnline = user?.isOnline !== undefined ? user.isOnline : true;
  const initial = (user?.username || "U")[0].toUpperCase();
  const bgColor = user?.color || "#E5E7EB";

  return (
    <div className={`relative ${className}`}>
      {user?.avatar ? (
        <img
          src={user.avatar}
          alt={`Avatar de ${user.username}`}
          className={`${size} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${size} rounded-full flex items-center justify-center text-white font-medium`}
          style={{ backgroundColor: bgColor }}
        >
          {initial}
        </div>
      )}

      {showStatus && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
            isOnline ? "bg-green-500" : "bg-gray-400"
          }`}
          title={isOnline ? "En ligne" : "Hors ligne"}
        />
      )}
    </div>
  );
};

export default Avatar;
