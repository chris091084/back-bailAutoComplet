import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OneDriveAuthService } from './onedrive-auth.service';
import { OneDriveConnexion } from './onedrive-connexion.entity';
import { OneDriveController } from './onedrive.controller';
import { OneDriveService } from './onedrive.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OneDriveConnexion]),
    JwtModule.register({}),
  ],
  controllers: [OneDriveController],
  providers: [OneDriveAuthService, OneDriveService],
  exports: [OneDriveService, OneDriveAuthService],
})
export class OneDriveModule {}
