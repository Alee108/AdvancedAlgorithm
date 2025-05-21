import { Test, TestingModule } from '@nestjs/testing';
import { NestController } from './nest.controller';

describe('NestController', () => {
  let controller: NestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NestController],
    }).compile();

    controller = module.get<NestController>(NestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
