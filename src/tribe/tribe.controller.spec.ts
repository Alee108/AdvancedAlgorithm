import { Test, TestingModule } from '@nestjs/testing';
import { TribeController } from './tribe.controller';

describe('TribeController', () => {
  let controller: TribeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TribeController],
    }).compile();

    controller = module.get<TribeController>(TribeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
