const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPrivateRooms() {
  console.log('Recherche des salons privés à corriger...');

  // 1. Récupérer tous les salons
  const allRooms = await prisma.room.findMany();
  console.log(`Total des salons trouvés: ${allRooms.length}`);

  // 2. Identifier les salons dont l'ID commence par "private_" mais qui ne sont pas marqués comme privés
  const roomsToFix = allRooms.filter(
    (room) => room.id.startsWith('private_') && room.isPrivate === false,
  );

  console.log(`Salons privés à corriger: ${roomsToFix.length}`);
  console.log(
    'Salons à corriger:',
    roomsToFix.map((r) => `${r.id} (${r.name})`).join(', '),
  );

  // 3. Mettre à jour ces salons pour les marquer comme privés
  if (roomsToFix.length > 0) {
    console.log('Correction des salons privés...');

    for (const room of roomsToFix) {
      await prisma.room.update({
        where: { id: room.id },
        data: { isPrivate: true },
      });
      console.log(`✓ Salon corrigé: ${room.id} (${room.name})`);
    }

    console.log('Correction terminée!');
  } else {
    console.log('Aucun salon privé à corriger.');
  }

  // 4. Afficher tous les salons privés actuellement dans la base de données
  const privateRooms = await prisma.room.findMany({
    where: { isPrivate: true },
  });

  console.log(
    `\nSalons privés dans la base de données: ${privateRooms.length}`,
  );
  privateRooms.forEach((room) => {
    console.log(`- ${room.id} (${room.name})`);
  });
}

fixPrivateRooms()
  .catch((e) => {
    console.error('Erreur pendant la correction:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
