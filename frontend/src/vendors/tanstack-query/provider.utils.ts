import { isPlainObject } from 'lodash-es';
import { QueryKey } from '@tanstack/react-query';

type QueryStringObject = Record<string, number | string | (number | string)[]>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const assertIsQueryStringObject = (obj: any): obj is QueryStringObject => {
  return Object.values(obj).every(
    (value) => typeof value === 'number' || typeof value === 'string' || Array.isArray(value),
  );
};

const transformStandardParams = (queryStringObject: QueryStringObject) =>
  Object.entries(queryStringObject).reduce<string[][]>((array, [key, value]) => {
    if (Array.isArray(value)) {
      return [...array, ...value.map((item) => [key, item.toString()])];
    }
    return [...array, [key, value.toString()]];
  }, []);

export const stringifyQueryKey = (queryKey: QueryKey): string => {
  return `${queryKey.reduce((path, currentItem) => {
    if (Array.isArray(currentItem)) {
      return `${path}/${currentItem.join('/')}`;
    }
    if (isPlainObject(currentItem) && assertIsQueryStringObject(currentItem)) {
      const standardParams = transformStandardParams(currentItem);
      const queryStringPair = new URLSearchParams(standardParams);
      return `${path}?${queryStringPair.toString()}`;
    }

    return `${path}/${currentItem}`;
  })}`;
};
