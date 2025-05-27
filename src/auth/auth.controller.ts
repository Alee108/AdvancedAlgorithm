import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Request,
    UseGuards,
    UseInterceptors,
    UploadedFile
  } from '@nestjs/common';
  import { AuthGuard } from './auth.guard';
  import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { Public } from './decorators/public.decorators';
import { ApiOperation, ApiTags, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { LoginDTO } from './dto/login.dto';
import { User } from 'src/entities/users/users.entity';
import { SignupDTO } from './dto/signup.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
  
  @ApiTags('auth')
  @Controller('auth')
  export class AuthController {
    constructor(private readonly authService: AuthService) {}
  
    @Post('signup')
    @Public()
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User successfully registered.' })
    @ApiResponse({ status: 400, description: 'Bad request.' })
    @ApiResponse({ status: 409, description: 'Email already exists.' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(
      FileInterceptor('profilePhoto', {
        storage: diskStorage({
          destination: './uploads/profiles',
          filename: (req, file, callback) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            callback(null, `${uniqueSuffix}${extname(file.originalname)}`);
          },
        }),
        fileFilter: (req, file, callback) => {
          if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp|PNG|JPG|JPG)$/)) {
            return callback(new Error('Only image files are allowed!'), false);
          }
          callback(null, true);
        },
      }),
    )
    async signup(
      @Body() signupDto: SignupDTO,
      @UploadedFile() file: Express.Multer.File
    ) {
      try {
        return this.authService.signup({
          ...signupDto,
          profilePhoto: file
        });
      } catch (error) {
        console.error('Error during signup:', error);
        throw error;
      }
    }

    @Post('login')
    @Public()
    @ApiOperation({ summary: 'Login user' })
    @ApiResponse({ status: 200, description: 'User successfully logged in.' })
    @ApiResponse({ status: 401, description: 'Invalid credentials.' })
    async login(@Body() loginDto: LoginDTO) {
      return this.authService.login(loginDto);
    }
  }
