import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Roles } from './decorators/roles.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import type { AuthenticatedRequest } from './types/authenticated-request.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งาน');
    }

    return this.authService.me(user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ISSUER')
  @Get('issuer/staff')
  listStaffMembers(@Req() request: AuthenticatedRequest) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งาน');
    }

    return this.authService.listStaffMembers(user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ISSUER')
  @Post('issuer/staff')
  createStaffMember(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateStaffDto,
  ) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งาน');
    }

    return this.authService.createStaffMember({
      adminUserId: user.sub,
      dto,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ISSUER')
  @Patch('issuer/staff/:id')
  updateStaffMember(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งาน');
    }

    return this.authService.updateStaffMember({
      adminUserId: user.sub,
      staffId: id,
      dto,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/profile')
  updateMyProfile(
    @Req() request: AuthenticatedRequest,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งาน');
    }

    return this.authService.updateMyProfile({
      userId: user.sub,
      dto: updateProfileDto,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  changeMyPassword(
    @Req() request: AuthenticatedRequest,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งาน');
    }

    return this.authService.changeMyPassword({
      userId: user.sub,
      dto: changePasswordDto,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/wallet')
  updateMyWalletAddress(
    @Req() request: AuthenticatedRequest,
    @Body() updateWalletDto: UpdateWalletDto,
  ) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งาน');
    }

    return this.authService.updateMyWalletAddress({
      userId: user.sub,
      walletAddress: updateWalletDto.walletAddress,
    });
  }
}
