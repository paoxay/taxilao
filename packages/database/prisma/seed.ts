import { PrismaClient, Role } from "@prisma/client";
import { drivers, tourPackages } from "@taxilao/shared";

const prisma = new PrismaClient();

async function main() {
  const cityRecords = new Map<string, string>();

  for (const cityName of ["Vientiane", "Luang Prabang", "Vang Vieng", "Pakse"]) {
    const city = await prisma.city.upsert({
      where: { name: cityName },
      update: {},
      create: { name: cityName }
    });
    cityRecords.set(cityName, city.id);
  }

  await prisma.user.upsert({
    where: { email: "admin@taxilao.com" },
    update: { role: Role.SUPER_ADMIN },
    create: {
      email: "admin@taxilao.com",
      name: "TAXILAO Admin",
      role: Role.SUPER_ADMIN
    }
  });

  for (const sample of drivers) {
    const user = await prisma.user.upsert({
      where: { email: `${sample.id}@taxilao.com` },
      update: {},
      create: {
        email: `${sample.id}@taxilao.com`,
        name: sample.name,
        role: Role.DRIVER,
        avatarUrl: sample.portraitUrl
      }
    });

    const profile = await prisma.driverProfile.upsert({
      where: { userId: user.id },
      update: {
        cityId: cityRecords.get(sample.city)!,
        bio: sample.bio,
        languages: sample.languages,
        rating: sample.rating,
        reviewCount: sample.reviewCount,
        startingPriceLak: sample.startingPriceLak,
        verified: sample.verified,
        premium: sample.premium,
        routes: sample.routes
      },
      create: {
        userId: user.id,
        cityId: cityRecords.get(sample.city)!,
        bio: sample.bio,
        languages: sample.languages,
        rating: sample.rating,
        reviewCount: sample.reviewCount,
        startingPriceLak: sample.startingPriceLak,
        verified: sample.verified,
        premium: sample.premium,
        routes: sample.routes
      }
    });

    await prisma.vehicle.upsert({
      where: {
        driverProfileId_type: {
          driverProfileId: profile.id,
          type: sample.vehicleType
        }
      },
      update: {
        make: sample.vehicleType.split(" ")[0] ?? "Premium",
        model: sample.vehicleType,
        seats: sample.vehicleType.includes("Alphard") || sample.vehicleType.includes("Staria") ? 7 : 5,
        imageUrl: sample.vehicleUrl
      },
      create: {
        driverProfileId: profile.id,
        type: sample.vehicleType,
        make: sample.vehicleType.split(" ")[0] ?? "Premium",
        model: sample.vehicleType,
        seats: sample.vehicleType.includes("Alphard") || sample.vehicleType.includes("Staria") ? 7 : 5,
        imageUrl: sample.vehicleUrl
      }
    });
  }

  for (const tour of tourPackages) {
    await prisma.tourPackage.upsert({
      where: { id: tour.id },
      update: {
        cityId: cityRecords.get(tour.city)!,
        title: tour.title,
        duration: tour.duration,
        priceLak: tour.priceLak,
        description: tour.description,
        imageUrl: tour.imageUrl
      },
      create: {
        id: tour.id,
        cityId: cityRecords.get(tour.city)!,
        title: tour.title,
        duration: tour.duration,
        priceLak: tour.priceLak,
        description: tour.description,
        imageUrl: tour.imageUrl
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
