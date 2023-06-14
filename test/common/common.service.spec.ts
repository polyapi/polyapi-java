import { CommonService } from '../../src/common/common.service';

describe('CommonService', () => {
  let commonService: CommonService;

  beforeEach(() => {
    commonService = new CommonService();
  });

  describe('trimDownObject', () => {
    it('should return an array with first item on root level', async () => {
      const obj = ['Tom', 'Jerry', 'Garfield'];

      expect(commonService.trimDownObject(obj)).toEqual(['Tom']);
    });

    it('should return an array with first item on first level', async () => {
      const obj = {
        location: 'London',
        cats: ['Tom', 'Jerry', 'Garfield'],
      };

      expect(commonService.trimDownObject(obj)).toEqual({
        location: 'London',
        cats: ['Tom'],
      });
    });

    it('should return an array with two first items when maxItems is 2', async () => {
      const obj = {
        location: 'London',
        cats: ['Tom', 'Jerry', 'Garfield'],
      };

      expect(commonService.trimDownObject(obj, 2)).toEqual({
        location: 'London',
        cats: ['Tom', 'Jerry'],
      });
    });

    it('should return multiple arrays with first item on first level', async () => {
      const obj = {
        location: 'London',
        cats: ['Tom', 'Jerry', 'Garfield'],
        dogs: ['Spike', 'Pluto', 'Scooby Doo'],
      };

      expect(commonService.trimDownObject(obj)).toEqual({
        location: 'London',
        cats: ['Tom'],
        dogs: ['Spike'],
      });
    });

    it('should return arrays with first item on second level', async () => {
      const obj = {
        location: 'London',
        animals: {
          cats: ['Tom', 'Jerry', 'Garfield'],
          dogs: ['Spike', 'Pluto', 'Scooby Doo'],
        },
      };

      expect(commonService.trimDownObject(obj)).toEqual({
        location: 'London',
        animals: {
          cats: ['Tom'],
          dogs: ['Spike'],
        },
      });
    });

    it('should return arrays with first item inside another arrays', async () => {
      const obj = {
        location: 'London',
        cats: [
          {
            name: 'Tom',
            achievements: ['killed Jerry', 'killed Garfield'],
          },
          {
            name: 'Jerry',
            achievements: ['killed Tom', 'killed Garfield'],
          },
        ],
      };

      expect(commonService.trimDownObject(obj)).toEqual({
        location: 'London',
        cats: [
          {
            name: 'Tom',
            achievements: ['killed Jerry'],
          },
        ],
      });
    });
  });
});
