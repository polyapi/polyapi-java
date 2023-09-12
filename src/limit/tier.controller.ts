import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { CreateTierDto, Role, TierDto, UpdateTierDto } from '@poly/model';
import { LimitService } from 'limit/limit.service';
import { API_TAG_INTERNAL } from 'common/constants';

@ApiSecurity('PolyApiKey')
@Controller('tiers')
export class TierController {
  private logger: Logger = new Logger(TierController.name);

  constructor(
    private readonly service: LimitService,
  ) {
  }

  @ApiOperation({ tags: [API_TAG_INTERNAL] })
  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Get()
  async getTiers(): Promise<TierDto[]> {
    const limitTiers = await this.service.getLimitTiers();
    return limitTiers.map(limitTier => this.service.toTierDto(limitTier));
  }

  @ApiOperation({ tags: [API_TAG_INTERNAL] })
  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Post()
  async createTier(@Body() data: CreateTierDto): Promise<TierDto> {
    const {
      name,
      maxFunctions,
      functionCallsPerDay,
      chatQuestionsPerDay,
      variableCallsPerDay,
      serverFunctionLimitCpu,
      serverFunctionLimitMemory,
      serverFunctionLimitTime,
    } = data;

    this.logger.log('Creating limit tier...');
    this.logger.log(
      `name: ${name}, maxFunctions: ${maxFunctions}, functionCallsPerDay: ${functionCallsPerDay}, chatQuestionsPerDay: ${chatQuestionsPerDay}`,
    );

    return this.service.toTierDto(
      await this.service.createLimitTier(
        name,
        maxFunctions,
        chatQuestionsPerDay,
        functionCallsPerDay,
        variableCallsPerDay,
        serverFunctionLimitCpu,
        serverFunctionLimitMemory,
        serverFunctionLimitTime,
      ),
    );
  }

  @ApiOperation({ tags: [API_TAG_INTERNAL] })
  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Get('/:id')
  async getTier(@Param('id') id: string): Promise<TierDto> {
    return this.service.toTierDto(
      await this.findLimitTier(id),
    );
  }

  @ApiOperation({ tags: [API_TAG_INTERNAL] })
  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Patch('/:id')
  async updateTier(@Param('id') id: string, @Body() data: UpdateTierDto): Promise<TierDto> {
    const {
      name,
      maxFunctions,
      functionCallsPerDay,
      chatQuestionsPerDay,
      variableCallsPerDay,
      serverFunctionLimitCpu,
      serverFunctionLimitMemory,
      serverFunctionLimitTime,
    } = data;
    const tier = await this.findLimitTier(id);

    this.logger.log(`Updating limit tier ${id}...`);
    this.logger.log(
      `name: ${name}, maxFunctions: ${maxFunctions}, functionCallsPerDay: ${functionCallsPerDay}, chatQuestions: ${chatQuestionsPerDay}`,
    );

    return this.service.toTierDto(
      await this.service.updateLimitTier(
        tier,
        name,
        maxFunctions,
        chatQuestionsPerDay,
        functionCallsPerDay,
        variableCallsPerDay,
        serverFunctionLimitCpu,
        serverFunctionLimitMemory,
        serverFunctionLimitTime,
      ),
    );
  }

  @ApiOperation({ tags: [API_TAG_INTERNAL] })
  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Delete('/:id')
  async deleteTier(@Param('id') id: string): Promise<void> {
    const tier = await this.findLimitTier(id);

    this.logger.log(`Deleting limit tier ${id}...`);

    await this.service.deleteLimitTier(tier);
  }

  private async findLimitTier(id: string) {
    const limitTier = await this.service.findById(id);
    if (!limitTier) {
      throw new NotFoundException(`Limit tier with ID ${id} not found.`);
    }
    return limitTier;
  }
}
