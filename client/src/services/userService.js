/**
 * Service pour gérer les opérations liées à l'utilisateur
 */
const API_URL = "http://localhost:3000";

/**
 * Met à jour la couleur de l'utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @param {string} color - Code couleur au format hexadécimal (#RRGGBB)
 * @returns {Promise<Object>} - Utilisateur mis à jour
 */
export const updateUserColor = async (userId, color) => {
  try {
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error("Aucun token trouvé, veuillez vous reconnecter");
    }

    // Utilisation de PUT au lieu de PATCH pour la compatibilité CORS
    const response = await fetch(`${API_URL}/users/${userId}/color`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ color }),
    });

    if (!response.ok) {
      throw new Error(
        `Erreur lors de la mise à jour de la couleur (${response.status})`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la couleur:", error);
    throw error;
  }
};

/**
 * Met à jour l'avatar de l'utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @param {string} avatarDataUrl - Image en format Data URL (base64)
 * @returns {Promise<Object>} - Utilisateur mis à jour
 */
export const updateUserAvatar = async (userId, avatarDataUrl) => {
  try {
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error("Aucun token trouvé, veuillez vous reconnecter");
    }

    // Convertir Data URL en Blob pour l'envoi
    const response = await fetch(`${API_URL}/users/${userId}/avatar`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ avatar: avatarDataUrl }),
    });

    if (!response.ok) {
      throw new Error(
        `Erreur lors de la mise à jour de l'avatar (${response.status})`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'avatar:", error);
    throw error;
  }
};

export default {
  updateUserColor,
  updateUserAvatar,
};
