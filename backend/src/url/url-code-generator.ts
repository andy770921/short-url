import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

@Injectable()
export class UrlCodeGenerator {
  md5ToBase62(input: string): string {
    const hex = createHash('md5').update(input).digest('hex');
    let num = BigInt('0x' + hex);
    let result = '';

    while (num > 0n) {
      const remainder = Number(num % 62n);
      result = BASE62_CHARS[remainder] + result;
      num = num / 62n;
    }

    return result || '0';
  }

  getCandidate(base62: string, offset: number, codeLength: number): string {
    if (offset <= base62.length - codeLength) {
      return base62.substring(offset, offset + codeLength);
    }
    return base62.substring(0, codeLength - 2) + this.randomSuffix(2);
  }

  randomSuffix(length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += BASE62_CHARS[Math.floor(Math.random() * 62)];
    }
    return result;
  }
}
