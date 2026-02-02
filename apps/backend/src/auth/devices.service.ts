import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.device.findMany({
      include: {
        user: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
          },
        },
        syncStates: true,
      },
      orderBy: { registeredAt: 'desc' },
    });
  }

  async findById(id: string) {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
          },
        },
        syncStates: true,
      },
    });

    if (!device) {
      throw new NotFoundException('Appareil non trouvé');
    }

    return device;
  }

  async revoke(id: string) {
    // Revoke device access
    await this.prisma.device.update({
      where: { id },
      data: { isActive: false },
    });

    // Delete all refresh tokens for this device
    await this.prisma.refreshToken.deleteMany({
      where: { deviceId: id },
    });

    return { message: 'Appareil révoqué' };
  }

  async reactivate(id: string) {
    return this.prisma.device.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async updateLastSync(deviceId: string) {
    return this.prisma.device.update({
      where: { id: deviceId },
      data: { lastSyncAt: new Date() },
    });
  }
}
