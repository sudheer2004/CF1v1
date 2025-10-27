const { PrismaClient } = require('@prisma/client');

// Global variable to store the singleton instance
const globalForPrisma = global;

// Reuse existing instance or create new one
const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'production' 
    ? ['error'] 
    : ['error', 'warn'],
  // Add connection pooling configuration
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Store instance globally in development to prevent hot-reload issues
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('📴 Shutting down gracefully (SIGINT)...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('📴 Shutting down gracefully (SIGTERM)...');
  await prisma.$disconnect();
  process.exit(0);
});

// Handle unexpected errors
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;