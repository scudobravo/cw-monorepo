import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { join } from 'path';
import { existsSync } from 'fs';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useWebSocketAdapter(new WsAdapter(app));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({ origin: '*' });

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'admin/(.*)', method: RequestMethod.ALL },
      { path: 'health', method: RequestMethod.GET },
      { path: '', method: RequestMethod.GET },
    ],
  });

  const adminDist = join(__dirname, '..', 'admin-dist');
  if (existsSync(adminDist)) {
    const http = app.getHttpAdapter().getInstance();
    http.use('/admin', express.static(adminDist, { index: 'index.html' }));
    http.use('/admin', (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.originalUrl.startsWith('/admin/api')) {
        return next();
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }
      res.sendFile(join(adminDist, 'index.html'));
    });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}

bootstrap();
