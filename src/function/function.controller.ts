import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
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
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { FunctionService } from 'function/function.service';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import {
  ApiFunctionDetailsDto,
  ApiFunctionResponseDto,
  ArgumentsMetadata,
  CreateApiFunctionDto,
  CreateClientCustomFunctionDto,
  CreateServerCustomFunctionDto,
  CreateServerCustomFunctionResponseDto,
  ExecuteApiFunctionDto,
  ExecuteCustomFunctionDto,
  ExecuteCustomFunctionQueryParams,
  FunctionBasicDto,
  FunctionDetailsDto,
  FunctionPublicBasicDto,
  FunctionPublicDetailsDto,
  Permission,
  Role,
  TrainingFunctionDto,
  UpdateApiFunctionDto,
  UpdateClientCustomFunctionDto,
  UpdateServerCustomFunctionDto,
  UpdateSourceFunctionDto,
  Visibility,
} from '@poly/model';
import { AuthRequest } from 'common/types';
import { AuthService } from 'auth/auth.service';
import { VariableService } from 'variable/variable.service';
import { LimitService } from 'limit/limit.service';
import { FunctionCallsLimitGuard } from 'limit/function-calls-limit-guard';
import { CustomFunction, Environment, Tenant } from '@prisma/client';
import { StatisticsService } from 'statistics/statistics.service';
import { FUNCTIONS_LIMIT_REACHED } from '@poly/common/messages';
import { CommonService } from 'common/common.service';
import { API_TAG_INTERNAL } from 'common/constants';
import { Request, Response } from 'express';
import { EnvironmentService } from 'environment/environment.service';
import { PerfLog } from 'statistics/perf-log.decorator';
import { PerfLogType } from 'statistics/perf-log-type';
import { PerfLogInterceptor } from 'statistics/perf-log-interceptor';
import { PerfLogInfoProvider } from 'statistics/perf-log-info-provider';
import { ConfigService } from 'config/config.service';

@ApiSecurity('PolyApiKey')
@Controller('functions')
@UseInterceptors(PerfLogInterceptor)
export class FunctionController {
  private logger: Logger = new Logger(FunctionController.name);

  constructor(
    private readonly service: FunctionService,
    private readonly authService: AuthService,
    private readonly variableService: VariableService,
    private readonly limitService: LimitService,
    private readonly statisticsService: StatisticsService,
    private readonly commonService: CommonService,
    private readonly environmentService: EnvironmentService,
    private readonly perfLogInfoProvider: PerfLogInfoProvider,
    private readonly configService: ConfigService,
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
  async createApiFunction(@Req() req: AuthRequest, @Body() data: CreateApiFunctionDto): Promise<TrainingFunctionDto> {
    const {
      url,
      body,
      requestName = '',
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
      enableRedirect = false,
      scriptVersion,
    } = data;

    if (scriptVersion && scriptVersion !== this.configService.postmanScriptVersion) {
      throw new BadRequestException(`
        The Poly training code has been upgraded.
        Your training script needs to be updated.
        Please contact support@polyapi.io if you need any assistance!
      `);
    }

    const environmentId = req.user.environment.id;

    await this.authService.checkPermissions(req.user, Permission.ManageApiFunctions);

    this.logger.debug(`Creating or updating API function in environment ${environmentId}...`);
    this.logger.debug(
      `name: ${name}, context: ${context}, description: ${description}, payload: ${payload}, response: ${response}, statusCode: ${statusCode}`,
    );

    return this.service.apiFunctionToTrainingDto(
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
        enableRedirect,
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
  async getApiFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<ApiFunctionDetailsDto> {
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
      source,
      enableRedirect,
      returnType,
      returnTypeSchema,
      templateBody,
    } = data;

    const apiFunction = await this.service.findApiFunction(id);
    if (!apiFunction) {
      throw new NotFoundException('Function not found');
    }

    if (payload !== undefined && response === undefined) {
      throw new BadRequestException('`payload` cannot be updated without `response`');
    }

    if (returnType === 'object' && !returnTypeSchema) {
      throw new BadRequestException('returnTypeSchema is required if returnType is object');
    }
    if (returnTypeSchema && (returnType && returnType !== 'object')) {
      throw new BadRequestException('returnTypeSchema is only allowed if returnType is object');
    }
    if (response && returnType) {
      throw new BadRequestException('response and returnType cannot be set at the same time');
    }
    if (response && returnTypeSchema) {
      throw new BadRequestException('response and returnTypeSchema cannot be set at the same time');
    }

    this.checkSourceUpdateAuth(source);

    this.commonService.checkVisibilityAllowed(req.user.tenant, visibility);

    await this.authService.checkEnvironmentEntityAccess(apiFunction, req.user, false, Permission.ManageApiFunctions);

    const decodedTemplateBody = templateBody ? Buffer.from(templateBody, 'base64').toString() : templateBody;

    return this.service.apiFunctionToDetailsDto(
      await this.service.updateApiFunction(
        apiFunction,
        name,
        context,
        description,
        argumentsMetadata,
        response,
        payload,
        visibility,
        source,
        enableRedirect,
        returnType,
        returnTypeSchema,
        decodedTemplateBody,
      ),
    );
  }

  @PerfLog(PerfLogType.ApiFunctionExecution)
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

    await this.authService.checkEnvironmentEntityAccess(apiFunction, req.user, true, Permission.Execute);
    data = await this.variableService.unwrapVariables(req.user, data);

    await this.statisticsService.trackFunctionCall(req.user, apiFunction.id, 'api');

    this.perfLogInfoProvider.data = {
      id: apiFunction.id,
      url: apiFunction.url,
    };

    return await this.service.executeApiFunction(apiFunction, data, req.user.user?.id, req.user.application?.id);
  }

  @UseGuards(PolyAuthGuard)
  @Delete('/api/:id')
  async deleteApiFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<any> {
    const apiFunction = await this.service.findApiFunction(id);
    if (!apiFunction) {
      throw new NotFoundException('Function not found');
    }

    await this.authService.checkEnvironmentEntityAccess(apiFunction, req.user, false, Permission.ManageApiFunctions);
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
  async createClientFunction(@Req() req: AuthRequest, @Body() data: CreateClientCustomFunctionDto): Promise<FunctionDetailsDto> {
    const { context = '', name, description = '', code, typeSchemas = {} } = data;

    await this.authService.checkPermissions(req.user, Permission.CustomDev);

    try {
      return this.service.customFunctionToDetailsDto(
        await this.service.createOrUpdateClientFunction(
          req.user.environment,
          context,
          name,
          description,
          code,
          typeSchemas,
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
  async updateClientFunction(@Req() req: AuthRequest, @Param('id') id: string, @Body() data: UpdateClientCustomFunctionDto): Promise<FunctionDetailsDto> {
    const {
      context = null,
      description = null,
      visibility = null,
    } = data;
    const clientFunction = await this.service.findClientFunction(id);
    if (!clientFunction) {
      throw new NotFoundException('Function not found');
    }

    this.commonService.checkVisibilityAllowed(req.user.tenant, visibility);

    await this.authService.checkEnvironmentEntityAccess(clientFunction, req.user, false, Permission.CustomDev);

    return this.service.customFunctionToDetailsDto(
      await this.service.updateClientFunction(clientFunction, null, context, description, visibility),
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

  @ApiOperation({ tags: [API_TAG_INTERNAL] })
  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Post('/server/prebuilt-base-image')
  @Header('Content-Type', 'text/plain')
  async createOrUpdatePrebuiltBaseImage(@Req() req: AuthRequest) {
    return this.service.createOrUpdatePrebuiltBaseImage(req.user);
  }

  @UseGuards(PolyAuthGuard)
  @Post('/server')
  async createServerFunction(@Req() req: AuthRequest, @Body() data: CreateServerCustomFunctionDto): Promise<CreateServerCustomFunctionResponseDto> {
    const { environment } = req.user;
    const { context = '', name, description = '', code, typeSchemas = {}, logsEnabled = environment.logsDefault } = data;

    await this.authService.checkPermissions(req.user, Permission.CustomDev);

    await this.checkFunctionsLimit(req.user.tenant, 'creating custom server function');

    try {
      const customFunction = await this.service.createOrUpdateServerFunction(
        environment,
        context,
        name,
        description,
        code,
        typeSchemas,
        req.user.key,
        logsEnabled,
        () => this.checkFunctionsLimit(req.user.tenant, 'creating custom server function'),
      );
      return this.service.customServerFunctionResponseDto(customFunction);
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
  async updateServerFunction(@Req() req: AuthRequest, @Param('id') id: string, @Body() data: UpdateServerCustomFunctionDto): Promise<FunctionDetailsDto> {
    const {
      name = null,
      context = null,
      description = null,
      visibility = null,
      enabled,
      arguments: argumentsMetadata,
      sleep,
      sleepAfter,
      logsEnabled,
    } = data;
    const serverFunction = await this.service.findServerFunction(id, true);
    if (!serverFunction) {
      throw new NotFoundException('Function not found');
    }

    this.commonService.checkVisibilityAllowed(req.user.tenant, visibility);

    if (enabled !== undefined) {
      if (req.user.user?.role !== Role.SuperAdmin) {
        throw new BadRequestException('You do not have permission to enable/disable functions.');
      }
    }
    if (sleep !== undefined || sleepAfter !== undefined) {
      if (req.user.user?.role !== Role.SuperAdmin) {
        throw new BadRequestException('You do not have permission to change sleep data.');
      }
    }
    if (argumentsMetadata !== undefined) {
      this.checkServerFunctionUpdateArguments(argumentsMetadata);
    }
    await this.authService.checkEnvironmentEntityAccess(serverFunction, req.user, false, Permission.CustomDev);

    return this.service.customFunctionToDetailsDto(
      await this.service.updateServerFunction(serverFunction, name, context, description, visibility, argumentsMetadata, enabled, sleep, sleepAfter, logsEnabled),
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

  @UseGuards(PolyAuthGuard)
  @Get('/server/:id/logs')
  async getServerFunctionLogs(@Req() req: AuthRequest, @Param('id') id: string, @Query('keyword') keyword): Promise<any> {
    const serverFunction = await this.service.findServerFunction(id);
    if (!serverFunction) {
      throw new NotFoundException(`Function with ID ${id} not found.`);
    }

    if (req.user.environment.id !== serverFunction.environmentId) {
      throw new ForbiddenException(`You do not have access to the logs of the function with ID ${id}.`);
    }

    if (!serverFunction.logsEnabled) {
      throw new BadRequestException(`The function with ID ${id} does not have logging enabled. You can enable the logs by updating the function through the API (PATCH) or re-deploying the function through the Poly CLI.`);
    }

    await this.authService.checkEnvironmentEntityAccess(serverFunction, req.user);

    return await this.service.getServerFunctionLogs(id, keyword, serverFunction.logsEnabled);
  }

  @PerfLog(PerfLogType.ServerFunctionExecution)
  @UseGuards(PolyAuthGuard, FunctionCallsLimitGuard)
  @Post('/server/:id/execute')
  async executeServerFunction(
    @Req() req: AuthRequest,
    @Res() res: Response,
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
    if (!customFunction.enabled) {
      throw new BadRequestException(`Function with id ${id} has been disabled by System Administrator and cannot be used.`);
    }

    await this.authService.checkEnvironmentEntityAccess(customFunction, req.user, true, Permission.Execute);

    console.log('Data before unwrap', JSON.stringify(data));
    data = await this.variableService.unwrapVariables(req.user, data);
    console.log('Data after unwrap', data);

    await this.statisticsService.trackFunctionCall(req.user, customFunction.id, 'server');

    const executionEnvironment = await this.resolveExecutionEnvironment(customFunction, req);

    this.perfLogInfoProvider.data = {
      id: customFunction.id,
    };

    const { body, statusCode = 200 } = await this.service.executeServerFunction(customFunction, executionEnvironment, data, headers, clientId) || {};
    return res.status(statusCode).send(body);
  }

  @ApiOperation({ tags: [API_TAG_INTERNAL] })
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

  private checkServerFunctionUpdateArguments(argumentsMetadata: ArgumentsMetadata) {
    for (const key in argumentsMetadata) {
      const argument = argumentsMetadata[key];
      for (const argumentProperty in argument) {
        if (argumentProperty !== 'description') {
          throw new BadRequestException(`Only description can be updated for argument ${key}`);
        }
      }
    }
  }

  private checkSourceUpdateAuth(source?: UpdateSourceFunctionDto): void {
    if (!source) {
      return;
    }

    if (source?.auth?.type === 'apikey') {
      const inKey = source.auth.apikey.find((entry) => entry.key === 'in');
      const keyName = source.auth.apikey.find((entry) => entry.key === 'key');
      const keyValue = source.auth.apikey.find((entry) => entry.key === 'value');

      if (!inKey) {
        throw new BadRequestException('You must provide a key "in" in your apiKey auth type.');
      }

      if (!keyName) {
        throw new BadRequestException('You must provide a key "key" in your apiKey auth type.');
      }

      if (!keyValue) {
        throw new BadRequestException('You must provide a key "value" in your apiKey auth type.');
      }

      if (!['header', 'query'].includes(inKey.value)) {
        throw new BadRequestException('"in" key value should be "query" | "header".');
      }
    }
  }

  private async resolveExecutionEnvironment(customFunction: CustomFunction & {environment: Environment}, req: Request) {
    let executionEnvironment: Environment | null = null;

    if (customFunction.visibility !== Visibility.Environment) {
      executionEnvironment = await this.environmentService.findByHost(req.hostname);
    }

    if (!executionEnvironment) {
      executionEnvironment = customFunction.environment;
    }

    return executionEnvironment;
  }
}
