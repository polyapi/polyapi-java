export const INSTANCE_URL_MAP = {
  develop: 'develop-k8s.polyapi.io',
  na1: 'na1.polyapi.io',
  local: 'localhost:8000',
};

export const ASSISTANCE_TRAINING_SCRIPT_VERSION_HEADER = 'x-poly-training-assistant-version';
export const TRAINING_SCRIPT_VERSION_HEADER = 'x-poly-training-script-version';

export const getInstanceUrl = (instance = 'local') => {
  if (typeof INSTANCE_URL_MAP[instance] === 'undefined') {
    return instance;
  }

  let protocol = instance === 'local' ? 'http://' : 'https://';
  let instanceUrl = INSTANCE_URL_MAP[instance];

  if (typeof INSTANCE_URL_MAP[instance] === 'undefined') {
    protocol = 'http://';
    instanceUrl = INSTANCE_URL_MAP.local;
  }

  return `${protocol}${instanceUrl}`;
};

export const isPlainObjectPredicate = (value: unknown): value is object => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const getStartOfDay = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

export const getEndOfDay = () => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};

export const getOneDayLaterDate = () => {
  const date = new Date();

  date.setHours(date.getHours() + 24);

  return date;
};

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getNanosecondsFromDate = (date: Date): string => `${date.getTime() * 1000000}`;

export const getNanosecondsDateISOString = (nanoSecondTimestamp: string): string => {
  const milliseconds = parseInt(nanoSecondTimestamp.slice(0, -6), 10);
  const date = new Date(milliseconds);
  const isoString = date.toISOString();
  const nanoseconds = nanoSecondTimestamp.slice(-6);
  return `${isoString.slice(0, -1)}${nanoseconds}Z`;
};

export const getDateMinusXHours = (date: Date, hours: number): Date => {
  date.setHours(date.getHours() - hours);
  return date;
};
