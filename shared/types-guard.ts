/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
export const isString = (value: any): value is string => typeof value === 'string';

export const isArray = (value: any): value is any[] => Array.isArray(value);

export const isEmptyArray = (value: any): boolean => isArray(value) && !value.length;
