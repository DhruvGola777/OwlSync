import { PrismaClient } from '@prisma/client';
import { createNotification } from '../notifications/notifications.service.js';

const prisma = new PrismaClient();

const DEFAULT_BADGES = [
  {
    slug: 'early-adopter',
    name: 'Early Adopter',
    description: 'Joined OwlSync during the launch phase.',
    icon: '🚀',
    category: 'COMMUNITY'
  },
  {
    slug: 'master-collaborator',
    name: 'Master Collaborator',
    description: 'Collaborated in active live rooms with other developers.',
    icon: '🤝',
    category: 'COLLABORATION'
  },
  {
    slug: 'code-virtuoso',
    name: 'Code Virtuoso',
    description: 'Created multiple persistent codebases & projects.',
    icon: '💻',
    category: 'CODING'
  },
  {
    slug: 'night-owl',
    name: 'Night Owl',
    description: 'Burned the midnight oil coding on OwlSync.',
    icon: '🦉',
    category: 'DEDICATION'
  },
  {
    slug: 'speed-demon',
    name: 'Power Coder',
    description: 'High velocity developer with active file edits.',
    icon: '⚡',
    category: 'PRODUCTIVITY'
  }
];

/**
 * Seed default badges if not already existing in database
 */
export const seedBadgesIfEmpty = async () => {
  for (const b of DEFAULT_BADGES) {
    await prisma.badge.upsert({
      where: { slug: b.slug },
      update: {},
      create: b
    });
  }
};

/**
 * Get all platform badges
 */
export const getAllBadges = async () => {
  await seedBadgesIfEmpty();
  return prisma.badge.findMany({
    orderBy: { createdAt: 'asc' }
  });
};

/**
 * Get badges awarded to a specific user
 */
export const getUserBadges = async (username) => {
  await seedBadgesIfEmpty();

  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      badges: {
        include: { badge: true }
      }
    }
  });

  if (!user) return [];

  // If user has no badges yet, award 'early-adopter' automatically
  if (user.badges.length === 0) {
    const earlyBadge = await prisma.badge.findUnique({ where: { slug: 'early-adopter' } });
    if (earlyBadge) {
      await prisma.userBadge.upsert({
        where: { userId_badgeId: { userId: user.id, badgeId: earlyBadge.id } },
        update: {},
        create: { userId: user.id, badgeId: earlyBadge.id }
      });
      return [{ badge: earlyBadge, awardedAt: new Date() }];
    }
  }

  return user.badges;
};

/**
 * Award badge to user and notify them
 */
export const awardBadge = async (userId, badgeSlug) => {
  const badge = await prisma.badge.findUnique({ where: { slug: badgeSlug } });
  if (!badge) return null;

  const existing = await prisma.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId: badge.id } }
  });

  if (!existing) {
    const userBadge = await prisma.userBadge.create({
      data: { userId, badgeId: badge.id },
      include: { badge: true }
    });

    await createNotification(userId, {
      type: 'SYSTEM',
      title: 'New Badge Unlocked! 🏆',
      message: `You earned the "${badge.name}" badge: ${badge.description}`,
      link: '/settings'
    });

    return userBadge;
  }

  return existing;
};
