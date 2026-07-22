import { Module } from '@nestjs/common';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { FileStorageService } from './storage/file-storage.service';

@Module({
  controllers: [FileController],
  providers: [FileService, FileStorageService],
  exports: [FileService],
})
export class FileModule {}
