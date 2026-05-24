import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.model.js';
import Reviewer from '../models/Reviewer.model.js';

const SEED_PASSWORD = 'Seed123456';

const SEED_ACCOUNTS = {
  researcher: {
    firstName: 'Demo',
    lastName: 'Researcher',
    email: 'researcher@test.com',
    role: 'researcher',
  },
  reviewer: {
    firstName: 'Demo',
    lastName: 'Reviewer',
    email: 'reviewer@test.com',
    role: 'reviewer',
    reviewerProfile: {
      specialization: 'Clinical Research',
    },
  },
  admin: {
    firstName: 'Demo',
    lastName: 'Admin',
    email: 'admin@test.com',
    role: 'admin',
  },
};

async function seedResearcher() {
  const data = SEED_ACCOUNTS.researcher;
  const existing = await User.findOne({ email: data.email });

  if (existing) {
    console.log(`Researcher already exists: ${data.email}`);
    return existing;
  }

  const user = await User.create({
    ...data,
    password: SEED_PASSWORD,
    isEmailVerified: true,
    isActive: true,
  });

  console.log(`Created researcher: ${data.email}`);
  return user;
}

async function seedReviewer() {
  const data = SEED_ACCOUNTS.reviewer;
  let user = await User.findOne({ email: data.email });

  if (!user) {
    user = await User.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      role: data.role,
      password: SEED_PASSWORD,
      isEmailVerified: true,
      isActive: true,
    });
    console.log(`Created reviewer user: ${data.email}`);
  } else {
    console.log(`Reviewer user already exists: ${data.email}`);
  }

  const existingProfile = await Reviewer.findOne({ email: data.email });
  if (existingProfile) {
    if (!existingProfile.userId) {
      existingProfile.userId = user._id;
      await existingProfile.save();
      console.log(`Linked existing reviewer profile to user: ${data.email}`);
    } else {
      console.log(`Reviewer profile already exists: ${data.email}`);
    }
    return user;
  }

  await Reviewer.create({
    name: `${data.firstName} ${data.lastName}`,
    email: data.email,
    specialization: data.reviewerProfile.specialization,
    userId: user._id,
    isActive: true,
  });

  console.log(`Created reviewer profile for: ${data.email}`);
  return user;
}

async function seedAdmin() {
  const data = SEED_ACCOUNTS.admin;
  const existing = await User.findOne({ email: data.email });

  if (existing) {
    console.log(`Admin already exists: ${data.email}`);
    return existing;
  }

  const user = await User.create({
    ...data,
    password: SEED_PASSWORD,
    isEmailVerified: true,
    isActive: true,
  });

  console.log(`Created admin: ${data.email}`);
  return user;
}

const seeders = {
  researcher: seedResearcher,
  reviewer: seedReviewer,
  admin: seedAdmin,
};

function printCredentials() {
  console.log('\nSeed account credentials (password for all):', SEED_PASSWORD);
  console.log('  researcher@test.com  — researcher');
  console.log('  reviewer@test.com    — reviewer');
  console.log('  admin@test.com       — admin\n');
}

async function main() {
  const role = process.argv[2]?.toLowerCase();

  if (role && !seeders[role]) {
    console.error(`Unknown role "${role}". Use: researcher, reviewer, admin, or omit to seed all.`);
    process.exit(1);
  }

  await connectDB();

  try {
    if (role) {
      await seeders[role]();
    } else {
      await seedResearcher();
      await seedReviewer();
      await seedAdmin();
    }

    printCredentials();
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
