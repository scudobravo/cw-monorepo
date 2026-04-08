import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminMiddleware } from '../../middleware/admin.middleware';
import { CompetitorsController } from '../competitors/competitors.controller';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminMiddleware],
  exports: [AdminService],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AdminMiddleware)
      .forRoutes(AdminController, CompetitorsController);
  }
}
