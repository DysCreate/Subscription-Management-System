import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_PREFIX } from '@subloop/shared';
import { Public } from './common/decorators/public.decorator';

@ApiTags('health')
@Controller()
export class AppController {
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe' })
  health() {
    return {
      status: 'ok',
      service: 'subloop-api',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'API index' })
  index() {
    return {
      name: 'SubLoop API',
      version: '0.1.0',
      prefix: `/${API_PREFIX}`,
      docs: '/api/docs',
      health: `/${API_PREFIX}/health`,
    };
  }
}
