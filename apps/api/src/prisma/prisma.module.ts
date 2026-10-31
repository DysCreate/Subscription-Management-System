import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Single PrismaClient instance shared by every domain module. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
