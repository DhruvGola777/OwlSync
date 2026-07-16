import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('Users in DB:', users.length);
  if (users.length > 0) console.log(users);
  
  const accounts = await prisma.oAuthAccount.findMany();
  console.log('OAuth Accounts in DB:', accounts.length);
  if (accounts.length > 0) console.log(accounts);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
