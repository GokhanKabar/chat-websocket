import React, { useState } from "react";

const ColorPickerModal = ({ isOpen, onClose, currentColor, onSave }) => {
  const [selectedColor, setSelectedColor] = useState(currentColor || "#1D4ED8");

  // Liste prédéfinie de couleurs
  const predefinedColors = [
    "#1D4ED8", // Bleu (par défaut)
    "#2563EB", // Bleu clair
    "#7C3AED", // Violet
    "#DB2777", // Rose
    "#DC2626", // Rouge
    "#EA580C", // Orange
    "#65A30D", // Vert
    "#0D9488", // Turquoise
    "#0369A1", // Bleu foncé
    "#4B5563", // Gris
    "#000000", // Noir
  ];

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(selectedColor);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-[90%]">
        <h2 className="text-xl font-bold mb-4">Choisir une couleur</h2>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Couleur actuelle
          </label>
          <div className="flex items-center">
            <div
              className="w-6 h-6 rounded-full mr-2"
              style={{ backgroundColor: selectedColor }}
            ></div>
            <span className="text-gray-600">{selectedColor}</span>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Couleurs prédéfinies
          </label>
          <div className="flex flex-wrap gap-2">
            {predefinedColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setSelectedColor(color)}
                className={`w-8 h-8 rounded-full shadow hover:shadow-md focus:outline-none transform hover:scale-110 transition-transform ${
                  selectedColor === color
                    ? "ring-2 ring-offset-2 ring-blue-500"
                    : ""
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Couleur ${color}`}
              />
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Choisir une couleur personnalisée
          </label>
          <input
            type="color"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            className="h-10 w-full cursor-pointer rounded border-0"
          />
        </div>

        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColorPickerModal;
