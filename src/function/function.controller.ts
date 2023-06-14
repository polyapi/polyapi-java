import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post, Query,
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
  ExecuteApiFunctionDto, ExecuteApiFunctionQueryParams,
  ExecuteCustomFunctionDto, ExecuteCustomFunctionQueryParams,
  FunctionBasicDto,
  FunctionDetailsDto,
  Permission,
  Role,
  UpdateApiFunctionDto,
  UpdateCustomFunctionDto,
} from '@poly/common';
import { AuthRequest } from 'common/types';
import { AuthService } from 'auth/auth.service';

@ApiSecurity('PolyApiKey')
@Controller('functions')
export class FunctionController {
  private logger: Logger = new Logger(FunctionController.name);

  constructor(private readonly service: FunctionService, private readonly authService: AuthService) {
  }

  @UseGuards(PolyAuthGuard)
  @Get('/api')
  async getApiFunctions(@Req() req: AuthRequest): Promise<FunctionBasicDto[]> {
    const apiFunctions = await this.service.getApiFunctions(req.user.environment.id);
    return apiFunctions.map((apiFunction) => this.service.apiFunctionToBasicDto(apiFunction));
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
    } = data;
    const environmentId = req.user.environment.id;

    await this.authService.checkPermissions(req.user, Permission.Teach);

    this.logger.debug(`Creating API function in environment ${environmentId}...`);
    this.logger.debug(
      `name: ${name}, context: ${context}, description: ${description}, payload: ${payload}, response: ${response}, statusCode: ${statusCode}`,
    );

    return this.service.apiFunctionToBasicDto(
      await this.service.createOrUpdateApiFunction(
        id,
        environmentId,
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
        templateAuth,
      ),
    );
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
      payload = null,
      visibility = null,
    } = data;
    const apiFunction = await this.service.findApiFunction(id);
    if (!apiFunction) {
      throw new NotFoundException('Function not found');
    }
    await this.authService.checkEnvironmentEntityAccess(apiFunction, req.user);

    return this.service.apiFunctionToDetailsDto(
      await this.service.updateApiFunction(apiFunction, name, context, description, argumentsMetadata, response, payload, visibility),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Post('/api/:id/execute')
  async executeApiFunction(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() data: ExecuteApiFunctionDto,
    @Query() { clientId }: ExecuteApiFunctionQueryParams,
  ): Promise<ApiFunctionResponseDto | null> {
    const apiFunction = await this.service.findApiFunction(id);
    if (!apiFunction) {
      throw new NotFoundException(`Function with id ${id} not found.`);
    }

    await this.authService.checkEnvironmentEntityAccess(apiFunction, req.user, true, Permission.Use);

    return await this.service.executeApiFunction(apiFunction, data, clientId);
  }

  @UseGuards(PolyAuthGuard)
  @Delete('/api/:id')
  async deleteApiFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<any> {
    const apiFunction = await this.service.findApiFunction(id);
    if (!apiFunction) {
      throw new NotFoundException('Function not found');
    }

    await this.authService.checkEnvironmentEntityAccess(apiFunction, req.user);
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
        await this.service.createCustomFunction(req.user.environment, context, name, description, code, false, req.user.key),
      );
    } catch (e) {
      throw new BadRequestException(e.message);
    }
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

    try {
      return this.service.customFunctionToDetailsDto(
        await this.service.createCustomFunction(req.user.environment, context, name, description, code, true, req.user.key),
      );
    } catch (e) {
      throw new BadRequestException(e.message);
    }
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

  @UseGuards(PolyAuthGuard)
  @Post('/server/:id/execute')
  async executeServerFunction(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() data: ExecuteCustomFunctionDto,
    @Query() { clientId }: ExecuteCustomFunctionQueryParams,
  ): Promise<any> {
    const customFunction = await this.service.findServerFunction(id);
    if (!customFunction) {
      throw new NotFoundException(`Function with id ${id} not found.`);
    }
    if (!customFunction.serverSide) {
      throw new BadRequestException(`Function with id ${id} is not server function.`);
    }

    await this.authService.checkEnvironmentEntityAccess(customFunction, req.user, true, Permission.Use);

    return await this.service.executeServerFunction(customFunction, req.user.environment, data, clientId);
  }

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Post('/server/all/update')
  async updateAllServerFunctions(@Req() req: AuthRequest) {
    this.service.updateAllServerFunctions(req.user.environment, req.user.key)
      .then(() => {
        this.logger.debug('All functions are being updated in background.');
      });
    return 'Functions are being updated in background. Please check logs for more details.';
  }
}
