const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function cleanPublicRooms() {
  console.log('\n===== NETTOYAGE DES SALONS PUBLICS =====');

  // 1. Récupérer tous les salons
  const allRooms = await prisma.room.findMany();
  console.log(`\nTotal des salons trouvés: ${allRooms.length}`);

  // 2. Séparer les salons en catégories
  const generalRoom = allRooms.find((room) => room.id === 'general');
  const privateRooms = allRooms.filter((room) => room.isPrivate === true);
  const otherPublicRooms = allRooms.filter(
    (room) => room.id !== 'general' && room.isPrivate !== true,
  );

  console.log(`\nSalons par catégorie:`);
  console.log(
    `- Salon général: ${generalRoom ? '1 (' + generalRoom.name + ')' : 'Non trouvé'}`,
  );
  console.log(`- Salons privés: ${privateRooms.length}`);
  console.log(`- Autres salons publics: ${otherPublicRooms.length}`);

  // 3. Afficher la liste des salons publics à supprimer
  if (otherPublicRooms.length === 0) {
    console.log('\nAucun salon public supplémentaire à nettoyer.');
    return;
  }

  console.log('\nSalons publics à nettoyer:');
  otherPublicRooms.forEach((room, index) => {
    console.log(`${index + 1}. ${room.id} (${room.name})`);
  });

  // 4. Demander confirmation
  await new Promise((resolve) => {
    rl.question(
      '\nVoulez-vous supprimer tous ces salons publics ? (oui/non): ',
      async (answer) => {
        if (
          answer.toLowerCase() === 'oui' ||
          answer.toLowerCase() === 'o' ||
          answer.toLowerCase() === 'y' ||
          answer.toLowerCase() === 'yes'
        ) {
          console.log('\nSuppression en cours...');

          // 5. Supprimer d'abord les messages dans ces salons
          for (const room of otherPublicRooms) {
            const messageCount = await prisma.message.count({
              where: { roomId: room.id },
            });

            if (messageCount > 0) {
              await prisma.message.deleteMany({
                where: { roomId: room.id },
              });
              console.log(
                `✓ ${messageCount} messages supprimés du salon ${room.name} (${room.id})`,
              );
            }

            // Supprimer les associations userRoom
            await prisma.userRoom.deleteMany({
              where: { roomId: room.id },
            });

            // Supprimer le salon
            await prisma.room.delete({
              where: { id: room.id },
            });

            console.log(`✓ Salon supprimé: ${room.name} (${room.id})`);
          }

          console.log('\nNettoyage terminé avec succès!');
        } else {
          console.log('\nOpération annulée.');
        }
        resolve();
      },
    );
  });

  // 6. Vérifier que le salon général existe et le créer si nécessaire
  if (!generalRoom) {
    console.log(
      "\nLe salon général n'existe pas. Création du salon général...",
    );
    await prisma.room.create({
      data: {
        id: 'general',
        name: 'Général',
        isPrivate: false,
      },
    });
    console.log('✓ Salon général créé');
  } else if (generalRoom.name !== 'Général') {
    // Si le salon général existe mais avec un nom différent, le renommer
    console.log('\nRenommage du salon général...');
    await prisma.room.update({
      where: { id: 'general' },
      data: { name: 'Général' },
    });
    console.log('✓ Salon général renommé en "Général"');
  }

  // 7. Afficher la liste finale des salons
  const remainingRooms = await prisma.room.findMany();
  console.log(`\nSalons restants après nettoyage: ${remainingRooms.length}`);
  remainingRooms.forEach((room) => {
    const type =
      room.id === 'general'
        ? 'Général'
        : room.isPrivate
          ? 'Privé  '
          : 'Public ';
    console.log(`- [${type}] ${room.id} (${room.name})`);
  });
}

cleanPublicRooms()
  .catch((e) => {
    console.error('\nErreur pendant le nettoyage:', e);
    process.exit(1);
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
