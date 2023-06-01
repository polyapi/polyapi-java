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
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { FunctionService } from 'function/function.service';
import { PolyKeyGuard } from 'auth/poly-key-auth-guard.service';
import {
  ApiFunctionResponseDto,
  CreateCustomFunctionDto,
  ExecuteApiFunctionDto,
  ExecuteCustomFunctionDto,
  FunctionBasicDto,
  FunctionDetailsDto,
  Permission,
  Role,
  UpdateApiFunctionDto,
  UpdateCustomFunctionDto,
} from '@poly/common';
import { AuthRequest } from 'common/types';
import { AuthService } from 'auth/auth.service';

@ApiSecurity('X-PolyApiKey')
@Controller('functions')
export class FunctionController {
  private logger: Logger = new Logger(FunctionController.name);

  constructor(private readonly service: FunctionService, private readonly authService: AuthService) {
  }

  @UseGuards(PolyKeyGuard)
  @Get('/api')
  async getApiFunctions(@Req() req: AuthRequest): Promise<FunctionBasicDto[]> {
    const apiFunctions = await this.service.getApiFunctions(req.user.environment.id);
    return apiFunctions.map((apiFunction) => this.service.apiFunctionToBasicDto(apiFunction));
  }

  @UseGuards(PolyKeyGuard)
  @Get('/api/:id')
  async getApiFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<FunctionDetailsDto> {
    const apiFunction = await this.service.findApiFunction(id);
    if (!apiFunction) {
      throw new NotFoundException(`Function with ID ${id} not found.`);
    }

    await this.authService.checkEnvironmentEntityAccess(apiFunction, req.user);

    return this.service.apiFunctionToDetailsDto(apiFunction);
  }

  @UseGuards(PolyKeyGuard)
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

  // @UseGuards(PolyKeyGuard)
  @Post('/api/:id/execute')
  async executeApiFunction(@Req() req, @Param('id') id: string, @Body() data: ExecuteApiFunctionDto): Promise<ApiFunctionResponseDto | null> {
    const apiFunction = await this.service.findApiFunction(id);
    if (!apiFunction) {
      throw new NotFoundException(`Function with id ${id} not found.`);
    }

    // TODO: temporarily disabled for GPT plugin purposes
    // await this.authService.checkEnvironmentEntityAccess(apiFunction, req.user, Permission.Use);

    return await this.service.executeApiFunction(apiFunction, data.args, data.clientID);
  }

  @UseGuards(PolyKeyGuard)
  @Delete('/api/:id')
  async deleteApiFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<any> {
    const apiFunction = await this.service.findApiFunction(id);
    if (!apiFunction) {
      throw new NotFoundException('Function not found');
    }

    await this.authService.checkEnvironmentEntityAccess(apiFunction, req.user);
    await this.service.deleteApiFunction(id);
  }

  @UseGuards(PolyKeyGuard)
  @Get('/client')
  async getClientFunctions(@Req() req: AuthRequest): Promise<FunctionBasicDto[]> {
    const functions = await this.service.getClientFunctions(req.user.environment.id);
    return functions
      .map((clientFunction) => this.service.customFunctionToBasicDto(clientFunction));
  }

  @UseGuards(PolyKeyGuard)
  @Post('/client')
  async createClientFunction(@Req() req: AuthRequest, @Body() data: CreateCustomFunctionDto): Promise<FunctionDetailsDto> {
    const { context = '', name, code } = data;

    await this.authService.checkPermissions(req.user, Permission.CustomDev);

    try {
      return this.service.customFunctionToDetailsDto(
        await this.service.createCustomFunction(req.user.environment, context, name, code, false, req.user.key)
      );
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(PolyKeyGuard)
  @Get('/client/:id')
  async getClientFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<FunctionDetailsDto> {
    const clientFunction = await this.service.findClientFunction(id);
    if (!clientFunction) {
      throw new NotFoundException(`Function with ID ${id} not found.`);
    }

    await this.authService.checkEnvironmentEntityAccess(clientFunction, req.user);

    return this.service.customFunctionToDetailsDto(clientFunction);
  }

  @UseGuards(PolyKeyGuard)
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

    await this.authService.checkEnvironmentEntityAccess(clientFunction, req.user, Permission.CustomDev);

    return this.service.customFunctionToDetailsDto(
      await this.service.updateCustomFunction(clientFunction, null, context, description, visibility),
    );
  }

  @UseGuards(PolyKeyGuard)
  @Delete('/client/:id')
  async deleteClientFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<any> {
    const clientFunction = await this.service.findClientFunction(id);
    if (!clientFunction) {
      throw new NotFoundException('Function not found');
    }

    await this.authService.checkEnvironmentEntityAccess(clientFunction, req.user, Permission.CustomDev);

    await this.service.deleteCustomFunction(id);
  }

  @UseGuards(PolyKeyGuard)
  @Get('/server')
  async getServerFunctions(@Req() req: AuthRequest): Promise<FunctionBasicDto[]> {
    const customFunctions = await this.service.getCustomFunctions(req.user.environment.id);
    return customFunctions
      .filter((customFunction) => customFunction.serverSide)
      .map((serverFunction) => this.service.customFunctionToBasicDto(serverFunction));
  }

  @UseGuards(PolyKeyGuard)
  @Post('/server')
  async createServerFunction(@Req() req: AuthRequest, @Body() data: CreateCustomFunctionDto): Promise<FunctionDetailsDto> {
    const { context = '', name, code } = data;

    await this.authService.checkPermissions(req.user, Permission.CustomDev);

    try {
      return this.service.customFunctionToDetailsDto(
        await this.service.createCustomFunction(req.user.environment, context, name, code, true, req.user.key)
      );
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(PolyKeyGuard)
  @Get('/server/:id')
  async getServerFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<FunctionDetailsDto> {
    const serverFunction = await this.service.findServerFunction(id);
    if (!serverFunction) {
      throw new NotFoundException(`Function with ID ${id} not found.`);
    }

    await this.authService.checkEnvironmentEntityAccess(serverFunction, req.user);

    return this.service.customFunctionToDetailsDto(serverFunction);
  }

  @UseGuards(PolyKeyGuard)
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

    await this.authService.checkEnvironmentEntityAccess(serverFunction, req.user, Permission.CustomDev);

    return this.service.customFunctionToDetailsDto(
      await this.service.updateCustomFunction(serverFunction, name, context, description, visibility),
    );
  }

  @UseGuards(PolyKeyGuard)
  @Delete('/server/:id')
  async deleteServerFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<any> {
    const serverFunction = await this.service.findServerFunction(id);
    if (!serverFunction) {
      throw new NotFoundException('Function not found');
    }

    await this.authService.checkEnvironmentEntityAccess(serverFunction, req.user, Permission.CustomDev);

    await this.service.deleteCustomFunction(id);
  }

  // @UseGuards(PolyKeyGuard)
  @Post('/server/:id/execute')
  async executeServerFunction(@Req() req: AuthRequest, @Param('id') id: string, @Body() data: ExecuteCustomFunctionDto): Promise<any> {
    const customFunction = await this.service.findServerFunction(id);
    if (!customFunction) {
      throw new NotFoundException(`Function with id ${id} not found.`);
    }
    if (!customFunction.serverSide) {
      throw new BadRequestException(`Function with id ${id} is not server function.`);
    }

    // TODO: temporarily disabled for GPT plugin purposes
    // await this.authService.checkEnvironmentEntityAccess(customFunction, req.user, Permission.Use);

    return await this.service.executeServerFunction(customFunction, data.args, data.clientID);
  }

  @UseGuards(new PolyKeyGuard([Role.SuperAdmin]))
  @Post('/server/all/update')
  async updateAllServerFunctions(@Req() req: AuthRequest) {
    void this.service.updateAllServerFunctions(req.user.environment, req.user.key);
    return 'Functions are being updated in background. Please check logs for more details.';
  }
}
