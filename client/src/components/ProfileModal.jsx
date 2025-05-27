import React, { useState, useRef } from "react";

const ProfileModal = ({
  isOpen,
  onClose,
  currentUser,
  onSaveColor,
  onSaveAvatar,
}) => {
  const [selectedColor, setSelectedColor] = useState(
    currentUser?.color || "#1D4ED8"
  );
  const [avatarPreview, setAvatarPreview] = useState(
    currentUser?.avatar || null
  );
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

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

  const handleSaveColor = () => {
    onSaveColor(selectedColor);
  };

  // Fonction pour compresser une image
  const compressImage = (
    file,
    maxWidth = 200,
    maxHeight = 200,
    quality = 0.8
  ) => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        // Calculer les nouvelles dimensions en gardant les proportions
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        // Redimensionner le canvas
        canvas.width = width;
        canvas.height = height;

        // Dessiner l'image redimensionnée
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir en Data URL avec compression
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Vérification du type de fichier
    if (!file.type.match("image.*")) {
      alert("Veuillez sélectionner une image");
      return;
    }

    // Vérification de la taille du fichier (max 10MB avant compression)
    if (file.size > 10 * 1024 * 1024) {
      alert("L'image ne doit pas dépasser 10MB");
      return;
    }

    try {
      // Compresser l'image
      const compressedDataUrl = await compressImage(file);

      // Vérifier la taille après compression
      const sizeInBytes = Math.round((compressedDataUrl.length * 3) / 4);
      console.log(
        `Taille de l'image compressée: ${(sizeInBytes / 1024).toFixed(2)} KB`
      );

      if (sizeInBytes > 80 * 1024) {
        // 80KB pour laisser de la marge
        // Si encore trop volumineux, compresser davantage
        const furtherCompressed = await compressImage(file, 150, 150, 0.6);
        setAvatarPreview(furtherCompressed);
        console.log("Image compressée davantage");
      } else {
        setAvatarPreview(compressedDataUrl);
      }
    } catch (error) {
      console.error("Erreur lors de la compression:", error);
      alert("Erreur lors du traitement de l'image");
    }
  };

  const handleUploadAvatar = async () => {
    if (!avatarPreview || avatarPreview === currentUser?.avatar) return;

    try {
      setIsUploading(true);
      await onSaveAvatar(avatarPreview);
      setIsUploading(false);
    } catch (error) {
      console.error("Erreur lors de l'upload de l'avatar:", error);
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-[90%]">
        <h2 className="text-xl font-bold mb-4">Personnaliser votre profil</h2>

        {/* Section Avatar */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Photo de profil
          </label>
          <div className="flex flex-col items-center space-y-3">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                    <span>No Image</span>
                  </div>
                )}
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={triggerFileInput}
              className="px-3 py-1 bg-gray-200 rounded-md text-sm hover:bg-gray-300 transition"
            >
              Changer l'image
            </button>
            <p className="text-xs text-gray-500 text-center">
              L'image sera automatiquement redimensionnée et compressée
            </p>
          </div>
        </div>

        {/* Section Couleur */}
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
            onClick={() => {
              handleSaveColor();
              handleUploadAvatar();
              onClose();
            }}
            disabled={isUploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isUploading ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
