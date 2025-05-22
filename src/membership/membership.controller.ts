import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, UseInterceptors, UploadedFile, UnauthorizedException } from '@nestjs/common';

import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../auth/decorators/public.decorators';
import { MembershipService } from './membership.service';
import { CreateMembershipDto, UpdateMembershipDto } from './DTO/membership.dto';
import { MembershipStatus } from 'src/entities/membership/membership.entity';
import { Create } from 'sharp';

@ApiTags('membership')
@Controller('membership')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class MermbershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get()

  @ApiOperation({ summary: 'Get all memberships' })
  @ApiResponse({ status: 200, description: 'Return all memberships.' })
  findAll() {
    return this.membershipService.findAll();
  }

  @Get(':id')

  @ApiOperation({ summary: 'Get a membership by id' })
  @ApiResponse({ status: 200, description: 'Return the membership.' })
  @ApiResponse({ status: 404, description: 'Membership not found.' })
  findOne(@Param('id') id: string) {
    return this.membershipService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a membership' })
  @ApiResponse({ status: 200, description: 'Membership updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })

  async update(
    @Param('id') id: string,
    @Body() updateMembership: UpdateMembershipDto,
  ) {
    try {
        if (!id) {
            throw new UnauthorizedException('Membership ID is required');
      }
        console.log('Updating membership with ID:', id);
        const updateData = {
          ...updateMembership,
          updatedAt: new Date(),
        };
        
      return this.membershipService.update(id, updateData);
    } catch (error) {
      console.error('Error updating membership:', error);
      throw error;
    }
  }

@Get('tribe/:tribeId')
  @ApiOperation({ summary: 'Get all memberships by tribe ' })
  @ApiResponse({ status: 200, description: 'Return all memberships by tribe ' })
  getAllMembershipsByTribe(
    @Param('tribeId') tribeId: string,
    @Param('status') status: MembershipStatus
  ) {
    return this.membershipService.getAllMembershipsByTribeAndStatus(tribeId, status);
  }


  @Get('tribe/:tribeId/status/:status')
  @ApiOperation({ summary: 'Get all memberships by tribe and status' })
  @ApiResponse({ status: 200, description: 'Return memberships by tribe and status.' })
  getAllMembershipsByTribeAndStatus(
    @Param('tribeId') tribeId: string,
    @Param('status') status: MembershipStatus
  ) {
    return this.membershipService.getAllMembershipsByTribeAndStatus(tribeId, status);
  }

  @Get('user/:userId/requests')
  @ApiOperation({ summary: 'Get all membership requests by user' })
  @ApiResponse({ status: 200, description: 'Return all membership requests by user.' })
  getAllMembershipRequestsByUserId(@Param('userId') userId: string) {
    return this.membershipService.getAllMembershipRequestsByUserId(userId);
  }

  @Patch('exit/:userId/:tribeId')
  @ApiOperation({ summary: 'Exit from tribe' })
  @ApiResponse({ status: 200, description: 'User exited from tribe.' })
  exitFromTribe(
    @Param('userId') userId: string,
    @Param('tribeId') tribeId: string
  ) {
    return this.membershipService.exitFromTribe(userId, tribeId);
  }

  @Post('')
  @ApiOperation({ summary: 'Create a new membership' })
  @ApiResponse({ status: 201, description: 'Membership created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 404, description: 'Tribe not found' })
  @ApiResponse({ status: 409, description: 'Membership already exists' })
  async create(
    @Body() createMembershipDto: CreateMembershipDto,
    @Req() req: any
  ) {
    try {
      return this.membershipService.create(createMembershipDto);
    } catch (error) {
      console.error('Error creating membership:', error);
      throw error;
    }
  }

}