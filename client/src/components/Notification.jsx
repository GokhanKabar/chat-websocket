import React from "react";

const Notification = ({ notification, onClose }) => {
  if (!notification) return null;

  const { type, message } = notification;

  const bgColor =
    {
      success: "bg-green-500",
      error: "bg-red-500",
      warning: "bg-yellow-500",
      info: "bg-blue-500",
    }[type] || "bg-blue-500";

  return (
    <div
      className={`fixed top-4 right-4 px-4 py-3 rounded-md shadow-md ${bgColor} text-white max-w-xs`}
    >
      <div className="flex justify-between items-center">
        <span>{message}</span>
        <button
          onClick={onClose}
          className="ml-4 text-white hover:text-gray-200 focus:outline-none"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default Notification;
