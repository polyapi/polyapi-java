export const resetMocks = (...mocks: { [key: string]: jest.Mock | { [key: string]: jest.Mock } }[]) => {
  for (const mock of mocks) {
    Object.values(mock).forEach((value) => {
      if (typeof value === 'function') {
        value.mockReset();
      } else {
        resetMocks(value);
      }
    });
  }
};
