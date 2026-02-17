#!/usr/bin/env bash
# ============================================
# AUMO v2 — Database Seeder Script
# Seeds MongoDB with demo users, rides, and stats
# ============================================

set -euo pipefail

echo "🌱 AUMO v2 — Database Seeder"
echo "=============================="

# Configuration
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/aumo}"
BACKEND_URL="${BACKEND_URL:-http://localhost:5000}"

echo "📦 MongoDB URI: $MONGO_URI"
echo "🌐 Backend URL: $BACKEND_URL"
echo ""

# ── Option 1: Seed via backend API ──
echo "🔧 Attempting to seed via backend /api/admin/seed endpoint..."

HTTP_CODE=$(curl -s -o /tmp/aumo-seed-response.json -w "%{http_code}" \
  -X POST "$BACKEND_URL/api/admin/seed" \
  -H "Content-Type: application/json" \
  2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "✅ Seed data inserted via API!"
  cat /tmp/aumo-seed-response.json | python3 -m json.tool 2>/dev/null || cat /tmp/aumo-seed-response.json
  echo ""
  echo "🎉 Seeding complete!"
  exit 0
fi

echo "⚠️  API seeding failed (HTTP $HTTP_CODE). Trying direct MongoDB insertion..."

# ── Option 2: Seed via mongosh ──
if ! command -v mongosh &> /dev/null; then
  echo "❌ mongosh not found. Install MongoDB Shell or start the backend server first."
  echo ""
  echo "   Alternative: Start the backend with SEED_DB=true"
  echo "   $ cd backend && SEED_DB=true npm run dev"
  exit 1
fi

echo "📤 Inserting seed data via mongosh..."

mongosh "$MONGO_URI" --quiet <<'SEED_JS'

// Clear existing data
db.users.deleteMany({});
db.rides.deleteMany({});
db.sitestats.deleteMany({});
db.messages.deleteMany({});
db.notifications.deleteMany({});

print("🗑️  Cleared existing data");

// Insert demo users
const bcryptHash = "$2b$12$LJ3m4ys3Lk0TSwHjfY2fuuvRRqBnXxAv8e7FN9FN/s.X0kRq2vDaS"; // password: demo123

const users = [
  { name: "Admin User",  email: "admin@aumo.city",  password: bcryptHash, role: "admin",  greenScore: 92, totalRides: 45, totalCO2Saved: 12500, totalDistance: 890000, preferences: { maxDetour: 15, preferredRole: "both", vehicleType: "sedan", smokingAllowed: false, musicPreference: "soft", chatEnabled: true } },
  { name: "Priya Sharma", email: "priya@aumo.city",  password: bcryptHash, role: "user", greenScore: 78, totalRides: 23, totalCO2Saved: 6200, totalDistance: 450000 },
  { name: "Rahul Verma",  email: "rahul@aumo.city",  password: bcryptHash, role: "user", greenScore: 65, totalRides: 18, totalCO2Saved: 4800, totalDistance: 320000 },
  { name: "Ananya Desai", email: "ananya@aumo.city", password: bcryptHash, role: "user", greenScore: 85, totalRides: 31, totalCO2Saved: 8900, totalDistance: 620000 },
  { name: "Vikram Patel", email: "vikram@aumo.city", password: bcryptHash, role: "user", greenScore: 55, totalRides: 12, totalCO2Saved: 3100, totalDistance: 210000 },
];

users.forEach(u => {
  u.createdAt = new Date();
  u.updatedAt = new Date();
});

const insertedUsers = db.users.insertMany(users);
print("👥 Inserted " + Object.keys(insertedUsers.insertedIds).length + " users");

// Insert sample stats for the last 30 days
const statsArr = [];
for (let i = 30; i >= 0; i--) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  d.setHours(0, 0, 0, 0);
  statsArr.push({
    date: d,
    totalRides: Math.floor(Math.random() * 20) + 5,
    completedRides: Math.floor(Math.random() * 15) + 3,
    totalUsers: 5 + Math.floor(i * 0.2),
    newUsers: Math.floor(Math.random() * 3),
    totalCO2Saved: Math.floor(Math.random() * 2000) + 500,
    totalDistance: Math.floor(Math.random() * 50000) + 10000,
    avgGreenScore: 60 + Math.random() * 30,
    createdAt: new Date(),
  });
}
db.sitestats.insertMany(statsArr);
print("📊 Inserted " + statsArr.length + " daily stat records");

print("");
print("🎉 Seeding complete!");
print("   Demo login: admin@aumo.city / demo123");
print("   Users: priya / rahul / ananya / vikram @aumo.city / demo123");

SEED_JS

echo ""
echo "✅ Database seeded successfully!"
