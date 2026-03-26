import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { URL_CONSTANTS } from './url.constant';

export interface UrlRecord {
  shortUrl: string;
  longUrl: string;
  creationTime: string;
  expirationTime: string | null;
}

@Injectable()
export class UrlRepository {
  private readonly expirationDays = URL_CONSTANTS.EXPIRATION_DAYS;

  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient) {}

  async findByShortCode(shortCode: string): Promise<UrlRecord | null> {
    const { data, error } = await this.supabase
      .from('urls')
      .select('shortUrl, longUrl, creationTime, expirationTime')
      .eq('shortUrl', shortCode)
      .single();

    if (error || !data) return null;
    return data as UrlRecord;
  }

  async findByLongUrl(longUrl: string): Promise<UrlRecord | null> {
    const { data } = await this.supabase
      .from('urls')
      .select('shortUrl, longUrl, creationTime, expirationTime')
      .eq('longUrl', longUrl)
      .limit(1)
      .single();

    return data ? (data as UrlRecord) : null;
  }

  async isShortCodeTaken(shortCode: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('urls')
      .select('shortUrl')
      .eq('shortUrl', shortCode)
      .single();

    return !!data;
  }

  async create(shortCode: string, longUrl: string): Promise<UrlRecord> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.expirationDays * 24 * 60 * 60 * 1000);

    const { data, error } = await this.supabase
      .from('urls')
      .insert({
        shortUrl: shortCode,
        longUrl,
        creationTime: now.toISOString(),
        expirationTime: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new ConflictException('Failed to create short URL: ' + error.message);
    }

    return data as UrlRecord;
  }
}
