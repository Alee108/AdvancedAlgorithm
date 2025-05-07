import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Request,
    UseGuards
  } from '@nestjs/common';
  import { AuthGuard } from './auth.guard';
  import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { Public } from './decorators/public.decorators';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { LoginDTO } from 'src/DTO/login-dto';
import { User } from 'src/entities/users/users.entity';
import { SignupDTO } from 'src/DTO/signup-dto';
  
  @ApiTags('auth')
  @Controller('auth')
  export class AuthController {
    constructor(private readonly authService: AuthService) {}
  
    @Post('signup')
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User successfully registered.' })
    @ApiResponse({ status: 400, description: 'Bad request.' })
    @ApiResponse({ status: 409, description: 'Email or username already exists.' })
    signUp(@Body() signupDto: SignupDTO) {
      return this.authService.signUp(signupDto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login user' })
    @ApiResponse({ status: 200, description: 'User successfully logged in.' })
    @ApiResponse({ status: 401, description: 'Invalid credentials.' })
    signIn(@Body() loginDto: LoginDTO) {
      return this.authService.signIn(loginDto.email, loginDto.password);
    }
  }
