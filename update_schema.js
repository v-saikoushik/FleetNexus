const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// Add new Enums
const enumsToAdd = `
enum RateBasis {
  PER_TON
  PER_TRIP
  PER_KM
  FLAT
  OTHER
}

enum ExpenseType {
  TOLL
  DRIVER_ALLOWANCE
  MAINTENANCE
  LOADING
  UNLOADING
  COMMISSION
  OTHER
}
`;

// Insert after existing enums
schema = schema.replace('// ─────────────────────────────────────────────────────────────────────────────\n// Organization', enumsToAdd + '\n// ─────────────────────────────────────────────────────────────────────────────\n// Organization');

// Add new Relations to Organization
const orgRelations = `  // Relations
  users           User[]
  vehicles        Vehicle[]
  locations       Location[]
  routes          Route[]
  commodities     Commodity[]
  freightRates    FreightRate[]
  fuelTransactions FuelTransaction[]
  expenses        Expense[]`;

schema = schema.replace(/  \/\/ Relations\r?\n  users    User\[\]\r?\n  vehicles Vehicle\[\]/, orgRelations);

// Add new Relations to Vehicle
const vehicleRelations = `  organization Organization @relation(fields: [organizationId], references: [id])
  fuelTransactions FuelTransaction[]
  expenses         Expense[]`;

schema = schema.replace('  organization Organization @relation(fields: [organizationId], references: [id])', vehicleRelations);

// Add new Models at the end
const modelsToAdd = `
// ─────────────────────────────────────────────────────────────────────────────
// Business Memory & Intelligence Foundation
// ─────────────────────────────────────────────────────────────────────────────

model Location {
  id             String       @id @default(uuid())
  organizationId String
  name           String
  address        String?
  city           String?
  state          String?
  latitude       Decimal?     @db.Decimal(10, 8)
  longitude      Decimal?     @db.Decimal(11, 8)
  notes          String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  routesOrigin   Route[]      @relation("RouteOrigin")
  routesDest     Route[]      @relation("RouteDestination")

  @@index([organizationId])
  @@map("locations")
}

model Route {
  id                    String        @id @default(uuid())
  organizationId        String
  originLocationId      String
  destinationLocationId String
  estimatedDistance     Decimal?      @db.Decimal(10, 2)
  typicalDurationHours  Decimal?      @db.Decimal(8, 2)
  preferredRoute        String?
  tollEstimate          Decimal?      @db.Decimal(10, 2)
  notes                 String?
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  organization          Organization  @relation(fields: [organizationId], references: [id])
  originLocation        Location      @relation("RouteOrigin", fields: [originLocationId], references: [id])
  destinationLocation   Location      @relation("RouteDestination", fields: [destinationLocationId], references: [id])
  freightRates          FreightRate[]
  expenses              Expense[]

  @@index([organizationId])
  @@index([originLocationId, destinationLocationId])
  @@map("routes")
}

model Commodity {
  id             String        @id @default(uuid())
  organizationId String
  name           String
  category       String?
  notes          String?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  organization   Organization  @relation(fields: [organizationId], references: [id])
  freightRates   FreightRate[]

  @@index([organizationId])
  @@map("commodities")
}

model FreightRate {
  id             String       @id @default(uuid())
  organizationId String
  routeId        String
  commodityId    String?
  vehicleType    VehicleType?
  freightAmount  Decimal      @db.Decimal(12, 2)
  rateBasis      RateBasis    @default(PER_TON)
  effectiveDate  DateTime     @default(now())
  notes          String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  route          Route        @relation(fields: [routeId], references: [id])
  commodity      Commodity?   @relation(fields: [commodityId], references: [id])

  @@index([organizationId])
  @@index([routeId])
  @@map("freight_rates")
}

model FuelTransaction {
  id              String       @id @default(uuid())
  organizationId  String
  vehicleId       String
  date            DateTime     @default(now())
  litres          Decimal      @db.Decimal(10, 2)
  totalAmount     Decimal      @db.Decimal(12, 2)
  pricePerLitre   Decimal?     @db.Decimal(8, 2)
  fuelStation     String?
  odometerReading Int?
  receiptRef      String?
  notes           String?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  organization    Organization @relation(fields: [organizationId], references: [id])
  vehicle         Vehicle      @relation(fields: [vehicleId], references: [id])

  @@index([organizationId])
  @@index([vehicleId])
  @@index([date])
  @@map("fuel_transactions")
}

model Expense {
  id             String      @id @default(uuid())
  organizationId String
  vehicleId      String?
  routeId        String?
  type           ExpenseType
  amount         Decimal     @db.Decimal(12, 2)
  date           DateTime    @default(now())
  notes          String?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  vehicle        Vehicle?     @relation(fields: [vehicleId], references: [id])
  route          Route?       @relation(fields: [routeId], references: [id])

  @@index([organizationId])
  @@index([vehicleId])
  @@index([routeId])
  @@index([date])
  @@map("expenses")
}
`;

fs.writeFileSync(schemaPath, schema + modelsToAdd);
console.log('Schema updated successfully');
