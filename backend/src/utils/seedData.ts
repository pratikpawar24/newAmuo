import bcrypt from 'bcrypt';
import { User } from '../models/User';
import { Ride } from '../models/Ride';
import { SiteStats } from '../models/SiteStats';
import { logger } from '../utils/logger';
import { v4 as uuid } from 'uuid';

const DEMO_USERS = [
  { name: 'Aarav Sharma', email: 'aarav@demo.com', password: 'Demo@1234', role: 'user' as const, greenScore: 82 },
  { name: 'Priya Patel', email: 'priya@demo.com', password: 'Demo@1234', role: 'user' as const, greenScore: 91 },
  { name: 'Rahul Verma', email: 'rahul@demo.com', password: 'Demo@1234', role: 'user' as const, greenScore: 67 },
  { name: 'Sneha Kumar', email: 'sneha@demo.com', password: 'Demo@1234', role: 'user' as const, greenScore: 75 },
  { name: 'Admin User', email: 'admin@aumo.io', password: 'Admin@1234', role: 'admin' as const, greenScore: 50 },
];

const PUNE_LOCATIONS = [
  { name: 'Shivajinagar', lat: 18.5308, lng: 73.8475 },
  { name: 'Hinjewadi IT Park', lat: 18.5912, lng: 73.7380 },
  { name: 'Koregaon Park', lat: 18.5362, lng: 73.8938 },
  { name: 'Kothrud', lat: 18.5074, lng: 73.8077 },
  { name: 'Viman Nagar', lat: 18.5679, lng: 73.9143 },
  { name: 'Deccan Gymkhana', lat: 18.5176, lng: 73.8414 },
  { name: 'Baner', lat: 18.5590, lng: 73.7868 },
  { name: 'Swargate', lat: 18.5018, lng: 73.8636 },
  { name: 'Wakad', lat: 18.5981, lng: 73.7630 },
  { name: 'Magarpatta City', lat: 18.5141, lng: 73.9267 },
];

export async function seedDatabase(): Promise<void> {
  logger.info('[SEED] Starting database seeding...');

  // Check if already seeded
  const existingUsers = await User.countDocuments();
  if (existingUsers > 0) {
    logger.info('[SEED] Database already has data. Skipping seed.');
    return;
  }

  // Create users
  const hashedPassword = await bcrypt.hash('Demo@1234', 12);
  const adminPassword = await bcrypt.hash('Admin@1234', 12);

  const userDocs = await User.insertMany(
    DEMO_USERS.map((u) => ({
      fullName: u.name,
      email: u.email,
      password: u.role === 'admin' ? adminPassword : hashedPassword,
      role: u.role,
      greenScore: u.greenScore,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name)}`,
      preferences: {
        smoking: false,
        music: true,
        pets: false,
        chatty: true,
        routePreference: 'balanced',
      },
      badges: u.greenScore >= 90 ? ['eco_warrior'] : u.greenScore >= 70 ? ['green_starter'] : [],
      stats: {
        totalRides: Math.floor(Math.random() * 30) + 5,
        totalCO2Saved: Math.round(Math.random() * 50 * 100) / 100,
        totalDistance: Math.round(Math.random() * 500 * 100) / 100,
        activeDays: Math.floor(Math.random() * 60) + 10,
      },
    }))
  );

  logger.info(`[SEED] Created ${userDocs.length} users`);

  // Create sample rides
  const regularUsers = userDocs.filter((u) => u.role === 'user');
  const rides = [];

  for (let i = 0; i < 15; i++) {
    const driver = regularUsers[i % regularUsers.length];
    const origin = PUNE_LOCATIONS[Math.floor(Math.random() * PUNE_LOCATIONS.length)];
    let dest = PUNE_LOCATIONS[Math.floor(Math.random() * PUNE_LOCATIONS.length)];
    while (dest.name === origin.name) {
      dest = MUMBAI_LOCATIONS[Math.floor(Math.random() * MUMBAI_LOCATIONS.length)];
    }

    const departureTime = new Date();
    departureTime.setHours(departureTime.getHours() + Math.floor(Math.random() * 48));

    const distanceKm = Math.round((Math.random() * 20 + 3) * 100) / 100;
    const fare = Math.round(distanceKm * 8 + 20);
    const status = i < 10 ? 'pending' : i < 13 ? 'in_progress' : 'completed';

    rides.push({
      driver: driver._id,
      origin: { address: origin.name, coordinates: [origin.lng, origin.lat] },
      destination: { address: dest.name, coordinates: [dest.lng, dest.lat] },
      departureTime,
      availableSeats: Math.floor(Math.random() * 3) + 1,
      fare,
      status,
      chatRoomId: uuid(),
      vehicleInfo: {
        model: ['Maruti Swift', 'Hyundai i20', 'Honda City', 'Tata Nexon'][Math.floor(Math.random() * 4)],
        color: ['White', 'Silver', 'Black', 'Blue'][Math.floor(Math.random() * 4)],
        plateNumber: `MH12-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${Math.floor(1000 + Math.random() * 9000)}`,
      },
      distanceKm,
      estimatedDuration: Math.round(distanceKm * 3 + 10),
      emissions: {
        total: Math.round(distanceKm * 120 * 100) / 100,
        perPassenger: Math.round(distanceKm * 60 * 100) / 100,
        saved: Math.round(distanceKm * 60 * 100) / 100,
        treeDaysEquivalent: Math.round((distanceKm * 60) / 22000 * 100) / 100,
      },
    });
  }

  await Ride.insertMany(rides);
  logger.info(`[SEED] Created ${rides.length} rides`);

  // Create sample site stats for the past 30 days
  const statsOps = [];
  for (let d = 30; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    date.setHours(0, 0, 0, 0);

    const peakHourDistribution = Array.from({ length: 24 }, (_, h) => {
      if (h >= 7 && h <= 10) return Math.floor(Math.random() * 20) + 15;
      if (h >= 17 && h <= 20) return Math.floor(Math.random() * 25) + 20;
      return Math.floor(Math.random() * 8) + 2;
    });

    statsOps.push({
      date,
      totalUsers: Math.floor(Math.random() * 5) + userDocs.length,
      totalRides: Math.floor(Math.random() * 10) + 3,
      completedRides: Math.floor(Math.random() * 8) + 1,
      totalCO2Saved: Math.round(Math.random() * 30 * 100) / 100,
      totalEmissions: Math.round(Math.random() * 80 * 100) / 100,
      totalDistance: Math.round(Math.random() * 200 * 100) / 100,
      averageRideDistance: Math.round((Math.random() * 15 + 3) * 100) / 100,
      activeDrivers: Math.floor(Math.random() * 4) + 1,
      activePassengers: Math.floor(Math.random() * 6) + 2,
      peakHourDistribution,
    });
  }

  await SiteStats.insertMany(statsOps);
  logger.info(`[SEED] Created ${statsOps.length} daily stats records`);

  logger.info('[SEED] Database seeding completed successfully!');
}
