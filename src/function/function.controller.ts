import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { FunctionService } from 'function/function.service';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import {
  ApiFunctionResponseDto,
  CreateApiFunctionDto,
  CreateCustomFunctionDto,
  ExecuteApiFunctionDto,
  ExecuteCustomFunctionDto,
  ExecuteCustomFunctionQueryParams,
  FunctionBasicDto,
  FunctionDetailsDto, FunctionPublicBasicDto, FunctionPublicDetailsDto,
  Permission,
  Role,
  UpdateApiFunctionDto,
  UpdateCustomFunctionDto,
} from '@poly/model';
import { AuthRequest } from 'common/types';
import { AuthService } from 'auth/auth.service';
import { VariableService } from 'variable/variable.service';
import { LimitService } from 'limit/limit.service';
import { FunctionCallsLimitGuard } from 'limit/function-calls-limit-guard';
import { Tenant } from '@prisma/client';
import { StatisticsService } from 'statistics/statistics.service';
import { FUNCTIONS_LIMIT_REACHED } from '@poly/common/messages';

@ApiSecurity('PolyApiKey')
@Controller('functions')
export class FunctionController {
  private logger: Logger = new Logger(FunctionController.name);

  constructor(
    private readonly service: FunctionService,
    private readonly authService: AuthService,
    private readonly variableService: VariableService,
    private readonly limitService: LimitService,
    private readonly statisticsService: StatisticsService,
  ) {
  }

  @UseGuards(PolyAuthGuard)
  @Get('/api')
  async getApiFunctions(@Req() req: AuthRequest): Promise<FunctionBasicDto[]> {
    const apiFunctions = await this.service.getApiFunctions(req.user.environment.id);
    return apiFunctions.map(apiFunction => this.service.apiFunctionToBasicDto(apiFunction));
  }

  @UseGuards(PolyAuthGuard)
  @Post('/api')
  async createApiFunction(@Req() req: AuthRequest, @Body() data: CreateApiFunctionDto): Promise<FunctionBasicDto> {
    const {
      url,
      body,
      requestName,
      name = null,
      context = null,
      description = null,
      payload = null,
      response,
      variables = {},
      statusCode,
      templateHeaders,
      method,
      templateAuth,
      templateUrl,
      templateBody,
      id = null,
      introspectionResponse = null,
    } = data;
    const environmentId = req.user.environment.id;

    await this.authService.checkPermissions(req.user, Permission.Teach);

    this.logger.debug(`Creating or updating API function in environment ${environmentId}...`);
    this.logger.debug(
      `name: ${name}, context: ${context}, description: ${description}, payload: ${payload}, response: ${response}, statusCode: ${statusCode}`,
    );

    return this.service.apiFunctionToBasicDto(
      await this.service.createOrUpdateApiFunction(
        id,
        req.user.environment,
        url,
        body,
        requestName,
        name,
        context,
        description,
        payload,
        response,
        variables,
        statusCode,
        templateHeaders,
        method,
        templateUrl,
        templateBody,
        introspectionResponse,
        templateAuth,
        () => this.checkFunctionsLimit(req.user.tenant, 'training function'),
      ),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Get('/api/public')
  async getPublicApiFunctions(@Req() req: AuthRequest): Promise<FunctionPublicBasicDto[]> {
    const { tenant, environment, user } = req.user;
    const apiFunctions = await this.service.getPublicApiFunctions(tenant, environment, user?.role === Role.Admin);

    return apiFunctions
      .map(apiFunction => this.service.apiFunctionToPublicBasicDto(apiFunction));
  }

  @UseGuards(PolyAuthGuard)
  @Get('/api/public/:id')
  async getPublicApiFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<FunctionPublicDetailsDto> {
    const { tenant, environment } = req.user;
    const apiFunction = await this.service.findPublicApiFunction(tenant, environment, id);
    if (apiFunction === null) {
      throw new NotFoundException(`Public API function with ID ${id} not found.`);
    }

    return this.service.apiFunctionToPublicDetailsDto(apiFunction);
  }

  @UseGuards(PolyAuthGuard)
  @Get('/api/:id')
  async getApiFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<FunctionDetailsDto> {
    const apiFunction = await this.service.findApiFunction(id);
    if (!apiFunction) {
      throw new NotFoundException(`Function with ID ${id} not found.`);
    }

    await this.authService.checkEnvironmentEntityAccess(apiFunction, req.user);

    return this.service.apiFunctionToDetailsDto(apiFunction);
  }

  @UseGuards(PolyAuthGuard)
  @Patch('/api/:id')
  async updateApiFunction(@Req() req: AuthRequest, @Param('id') id: string, @Body() data: UpdateApiFunctionDto): Promise<any> {
    const {
      name = null,
      context = null,
      description = null,
      arguments: argumentsMetadata = null,
      response,
      payload,
      visibility = null,
    } = data;
    const apiFunction = await this.service.findApiFunction(id);
    if (!apiFunction) {
      throw new NotFoundException('Function not found');
    }

    if (payload !== undefined && response === undefined) {
      throw new BadRequestException('`payload` cannot be updated without `response`');
    }

    await this.authService.checkEnvironmentEntityAccess(apiFunction, req.user, false, Permission.Teach);

    return this.service.apiFunctionToDetailsDto(
      await this.service.updateApiFunction(apiFunction, name, context, description, argumentsMetadata, response, payload, visibility),
    );
  }

  @UseGuards(PolyAuthGuard, FunctionCallsLimitGuard)
  @Post('/api/:id/execute')
  async executeApiFunction(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() data: ExecuteApiFunctionDto,
  ): Promise<ApiFunctionResponseDto | null> {
    const apiFunction = await this.service.findApiFunction(id, true);
    if (!apiFunction) {
      throw new NotFoundException(`Function with id ${id} not found.`);
    }

    await this.authService.checkEnvironmentEntityAccess(apiFunction, req.user, true, Permission.Use);
    data = await this.variableService.unwrapVariables(req.user, data);

    await this.statisticsService.trackFunctionCall(req.user, apiFunction.id, 'api');

    return await this.service.executeApiFunction(apiFunction, data, req.user.user?.id, req.user.application?.id);
  }

  @UseGuards(PolyAuthGuard)
  @Delete('/api/:id')
  async deleteApiFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<any> {
    const apiFunction = await this.service.findApiFunction(id);
    if (!apiFunction) {
      throw new NotFoundException('Function not found');
    }

    await this.authService.checkEnvironmentEntityAccess(apiFunction, req.user, false, Permission.Teach);
    await this.service.deleteApiFunction(id);
  }

  @UseGuards(PolyAuthGuard)
  @Get('/client')
  async getClientFunctions(@Req() req: AuthRequest): Promise<FunctionBasicDto[]> {
    const functions = await this.service.getClientFunctions(req.user.environment.id);
    return functions
      .map((clientFunction) => this.service.customFunctionToBasicDto(clientFunction));
  }

  @UseGuards(PolyAuthGuard)
  @Post('/client')
  async createClientFunction(@Req() req: AuthRequest, @Body() data: CreateCustomFunctionDto): Promise<FunctionDetailsDto> {
    const { context = '', name, description = '', code } = data;

    await this.authService.checkPermissions(req.user, Permission.CustomDev);

    try {
      return this.service.customFunctionToDetailsDto(
        await this.service.createOrUpdateCustomFunction(
          req.user.environment,
          context,
          name,
          description,
          code,
          false,
          req.user.key,
          () => this.checkFunctionsLimit(req.user.tenant, 'creating custom client function'),
        ),
      );
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(PolyAuthGuard)
  @Get('/client/public')
  async getPublicClientFunctions(@Req() req: AuthRequest): Promise<FunctionPublicBasicDto[]> {
    const { tenant, environment, user } = req.user;
    const functions = await this.service.getPublicClientFunctions(tenant, environment, user?.role === Role.Admin);
    return functions
      .map((clientFunction) => this.service.customFunctionToPublicBasicDto(clientFunction));
  }

  @UseGuards(PolyAuthGuard)
  @Get('/client/public/:id')
  async getPublicClientFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<FunctionPublicDetailsDto> {
    const { tenant, environment } = req.user;
    const clientFunction = await this.service.findPublicClientFunction(tenant, environment, id);
    if (clientFunction === null) {
      throw new NotFoundException(`Public client function with ID ${id} not found.`);
    }

    return this.service.customFunctionToPublicDetailsDto(clientFunction);
  }

  @UseGuards(PolyAuthGuard)
  @Get('/client/:id')
  async getClientFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<FunctionDetailsDto> {
    const clientFunction = await this.service.findClientFunction(id);
    if (!clientFunction) {
      throw new NotFoundException(`Function with ID ${id} not found.`);
    }

    await this.authService.checkEnvironmentEntityAccess(clientFunction, req.user);

    return this.service.customFunctionToDetailsDto(clientFunction);
  }

  @UseGuards(PolyAuthGuard)
  @Patch('/client/:id')
  async updateClientFunction(@Req() req: AuthRequest, @Param('id') id: string, @Body() data: UpdateCustomFunctionDto): Promise<FunctionDetailsDto> {
    const {
      context = null,
      description = null,
      visibility = null,
    } = data;
    const clientFunction = await this.service.findClientFunction(id);
    if (!clientFunction) {
      throw new NotFoundException('Function not found');
    }

    await this.authService.checkEnvironmentEntityAccess(clientFunction, req.user, false, Permission.CustomDev);

    return this.service.customFunctionToDetailsDto(
      await this.service.updateCustomFunction(clientFunction, null, context, description, visibility),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Delete('/client/:id')
  async deleteClientFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<any> {
    const clientFunction = await this.service.findClientFunction(id);
    if (!clientFunction) {
      throw new NotFoundException('Function not found');
    }

    await this.authService.checkEnvironmentEntityAccess(clientFunction, req.user, false, Permission.CustomDev);

    await this.service.deleteCustomFunction(id, req.user.environment);
  }

  @UseGuards(PolyAuthGuard)
  @Get('/server')
  async getServerFunctions(@Req() req: AuthRequest): Promise<FunctionBasicDto[]> {
    const customFunctions = await this.service.getServerFunctions(req.user.environment.id);
    return customFunctions
      .map((serverFunction) => this.service.customFunctionToBasicDto(serverFunction));
  }

  @UseGuards(PolyAuthGuard)
  @Post('/server')
  async createServerFunction(@Req() req: AuthRequest, @Body() data: CreateCustomFunctionDto): Promise<FunctionDetailsDto> {
    const { context = '', name, description = '', code } = data;

    await this.authService.checkPermissions(req.user, Permission.CustomDev);

    await this.checkFunctionsLimit(req.user.tenant, 'creating custom server function');

    try {
      const customFunction = await this.service.createOrUpdateCustomFunction(
        req.user.environment,
        context,
        name,
        description,
        code,
        true,
        req.user.key,
        () => this.checkFunctionsLimit(req.user.tenant, 'creating custom server function'),
      );
      return this.service.customFunctionToDetailsDto(customFunction);
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(PolyAuthGuard)
  @Get('/server/public')
  async getPublicServerFunctions(@Req() req: AuthRequest): Promise<FunctionPublicBasicDto[]> {
    const { tenant, environment, user } = req.user;
    const functions = await this.service.getPublicServerFunctions(tenant, environment, user?.role === Role.Admin);
    return functions
      .map((serverFunction) => this.service.customFunctionToPublicBasicDto(serverFunction));
  }

  @UseGuards(PolyAuthGuard)
  @Get('/server/public/:id')
  async getPublicServerFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<FunctionPublicDetailsDto> {
    const { tenant, environment } = req.user;
    const serverFunction = await this.service.findPublicServerFunction(tenant, environment, id);
    if (serverFunction === null) {
      throw new NotFoundException(`Public server function with ID ${id} not found.`);
    }

    return this.service.customFunctionToPublicDetailsDto(serverFunction);
  }

  @UseGuards(PolyAuthGuard)
  @Get('/server/:id')
  async getServerFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<FunctionDetailsDto> {
    const serverFunction = await this.service.findServerFunction(id);
    if (!serverFunction) {
      throw new NotFoundException(`Function with ID ${id} not found.`);
    }

    await this.authService.checkEnvironmentEntityAccess(serverFunction, req.user);

    return this.service.customFunctionToDetailsDto(serverFunction);
  }

  @UseGuards(PolyAuthGuard)
  @Patch('/server/:id')
  async updateServerFunction(@Req() req: AuthRequest, @Param('id') id: string, @Body() data: UpdateCustomFunctionDto): Promise<FunctionDetailsDto> {
    const {
      name = null,
      context = null,
      description = null,
      visibility = null,
    } = data;
    const serverFunction = await this.service.findServerFunction(id);
    if (!serverFunction) {
      throw new NotFoundException('Function not found');
    }

    await this.authService.checkEnvironmentEntityAccess(serverFunction, req.user, false, Permission.CustomDev);

    return this.service.customFunctionToDetailsDto(
      await this.service.updateCustomFunction(serverFunction, name, context, description, visibility),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Delete('/server/:id')
  async deleteServerFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<any> {
    const serverFunction = await this.service.findServerFunction(id);
    if (!serverFunction) {
      throw new NotFoundException('Function not found');
    }

    await this.authService.checkEnvironmentEntityAccess(serverFunction, req.user, false, Permission.CustomDev);

    await this.service.deleteCustomFunction(id, req.user.environment);
  }

  @UseGuards(PolyAuthGuard, FunctionCallsLimitGuard)
  @Post('/server/:id/execute')
  async executeServerFunction(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() data: ExecuteCustomFunctionDto,
    @Headers() headers: Record<string, any>,
    @Query() { clientId }: ExecuteCustomFunctionQueryParams,
  ): Promise<any> {
    this.logger.debug(`Headers: ${JSON.stringify(headers)}`);

    const customFunction = await this.service.findServerFunction(id, true);
    if (!customFunction) {
      throw new NotFoundException(`Function with id ${id} not found.`);
    }
    if (!customFunction.serverSide) {
      throw new BadRequestException(`Function with id ${id} is not server function.`);
    }

    await this.authService.checkEnvironmentEntityAccess(customFunction, req.user, true, Permission.Use);
    data = await this.variableService.unwrapVariables(req.user, data);

    await this.statisticsService.trackFunctionCall(req.user, customFunction.id, 'server');

    return await this.service.executeServerFunction(customFunction, data, headers, clientId);
  }

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Post('/server/all/update')
  async updateAllServerFunctions() {
    this.service.updateAllServerFunctions()
      .then(() => {
        this.logger.debug('All functions are being updated in background...');
      });
    return 'Functions are being updated in background. Please check logs for more details.';
  }

  private async checkFunctionsLimit(tenant: Tenant, debugMessage: string) {
    if (!await this.limitService.checkTenantFunctionsLimit(tenant)) {
      this.logger.debug(`Tenant ${tenant.id} reached its limit of functions while ${debugMessage}.`);
      throw new HttpException(FUNCTIONS_LIMIT_REACHED, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
