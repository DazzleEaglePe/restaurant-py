import { Module } from '@nestjs/common';

import { ZonasController } from './zonas.controller';
import { ZonasService } from './zonas.service';

@Module({
  controllers: [ZonasController],
  providers: [ZonasService],
})
export class ZonasModule {}
