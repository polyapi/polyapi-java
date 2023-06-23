import { isPlainObject } from 'lodash';

export function isPlainObjectPredicate(value: unknown): value is object {
    return isPlainObject(value);
}