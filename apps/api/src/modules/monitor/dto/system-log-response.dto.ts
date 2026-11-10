import { ApiProperty } from '@nestjs/swagger';
import { SystemLogEntryDto } from './system-log.dto';

export class SystemLogsResultDto {
  @ApiProperty({ type: [SystemLogEntryDto], description: '日志条目列表' })
  list: SystemLogEntryDto[];

  @ApiProperty({ description: '符合条件的日志条数', example: 42 })
  total: number;
}
