import { getMonthDifference } from '../date-helper';

describe('getMonthDifference()', () => {
  it('compare diffence in months by date 1', async () => {
    const dateDifference = getMonthDifference(new Date('2022-01-15'), new Date('2022-03-16'));
    expect(dateDifference).toEqual(2);
  });

  it('compare diffence in months by date 2', async () => {
    const dateDifference = getMonthDifference(new Date('2022-01-15'), new Date('2022-06-16'));
    expect(dateDifference).toEqual(5);
  });

  it('compare diffence in months by date 3', async () => {
    const dateDifference = getMonthDifference(new Date('2022-01-15'), new Date('2023-03-16'));
    expect(dateDifference).toEqual(14);
  });
});
