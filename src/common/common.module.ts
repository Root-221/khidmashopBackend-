import { Global, Module } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { CloudinaryService } from './services/cloudinary.service';
import { RefreshTokenService } from './services/refresh-token.service';

@Global()
@Module({
  providers: [PrismaService, CloudinaryService, RefreshTokenService],
  exports: [PrismaService, CloudinaryService, RefreshTokenService],
})
export class CommonModule {}
