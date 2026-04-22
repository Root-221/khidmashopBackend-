import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getLogger } from '@/common/utils/logger';
import { createHash } from 'crypto';

const logger = getLogger('CloudinaryService');
type CloudinaryUploadResponse = { secure_url?: string; error?: { message: string } };
type UploadFileInput = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
};

@Injectable()
export class CloudinaryService {
  private readonly cloudName: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly apiSecret: string | undefined;
  private readonly baseUrl: string;
  private readonly folder: string | undefined;
  private readonly skipUpload: boolean;

  constructor(private configService: ConfigService) {
    this.cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    this.apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    this.apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    this.folder = this.configService.get<string>('CLOUDINARY_FOLDER');
    
    const skip = this.configService.get<string>('SKIP_CLOUDINARY_UPLOAD');
    this.skipUpload = skip === 'true' || skip === '1';

    this.baseUrl = this.cloudName
      ? `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`
      : '';

    if (!this.skipUpload) {
      if (!this.cloudName || !this.apiKey || !this.apiSecret) {
        logger.warn('Cloudinary configuration is MISSING. Please check your .env file.');
      } else {
        logger.log(`Cloudinary initialized: ${this.cloudName} (endpoint: ${this.baseUrl})`);
      }
    } else {
      logger.log('Cloudinary upload is disabled via SKIP_CLOUDINARY_UPLOAD');
    }
  }

  private ensureConfigured() {
    if (this.skipUpload) {
      return;
    }

    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new InternalServerErrorException(
        'Cloudinary is not configured correctly. Check CLOUDINARY_CLOUD_NAME, API_KEY, and API_SECRET.',
      );
    }
  }

  private getSignature(timestamp: number) {
    const params: Record<string, string> = {
      timestamp: timestamp.toString(),
    };

    if (this.folder) {
      params.folder = this.folder;
    }

    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    return createHash('sha1')
      .update(`${sortedParams}${this.apiSecret}`)
      .digest('hex');
  }

  private async performUpload(form: FormData) {
    logger.log(`Uploading to Cloudinary: ${this.baseUrl}`);
    
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        body: form,
      });

      const payload: CloudinaryUploadResponse = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.secure_url) {
        logger.error('Cloudinary API Error:', payload?.error?.message || 'Unknown error');
        throw new InternalServerErrorException(
          `Cloudinary upload failed: ${payload?.error?.message || response.statusText}`,
        );
      }

      logger.log('Cloudinary upload success:', payload.secure_url);
      return payload.secure_url as string;
    } catch (error: any) {
      logger.error('Network error during Cloudinary upload:', error.message);
      throw error;
    }
  }

  async upload(dataUrl: string) {
    if (this.skipUpload) {
      logger.warn('SKIP_CLOUDINARY_UPLOAD is active, using raw data URL.');
      return dataUrl;
    }

    if (!dataUrl?.startsWith('data:')) {
      logger.log('Image is already a URL or invalid data URL, returning as is.');
      return dataUrl;
    }

    this.ensureConfigured();

    const timestamp = Math.floor(Date.now() / 1000);
    const form = new FormData();
    form.append('file', dataUrl);
    form.append('api_key', this.apiKey!);
    form.append('timestamp', timestamp.toString());
    form.append('signature', this.getSignature(timestamp));
    if (this.folder) {
      form.append('folder', this.folder);
    }

    try {
      return await this.performUpload(form);
    } catch (error) {
      logger.warn('Falling back to local data URL due to upload failure.');
      return dataUrl;
    }
  }

  async uploadFile(file: UploadFileInput) {
    if (this.skipUpload) {
      return this.toDataUrl(file);
    }

    this.ensureConfigured();

    const timestamp = Math.floor(Date.now() / 1000);
    const form = new FormData();
    
    // Using a simple object for Fetch if native Blob is not fully compatible in this Node version
    // but Node 18+ FormData.append supports Buffer/Blob
    const blob = new Blob([file.buffer], {
      type: file.mimetype || 'application/octet-stream',
    });

    form.append('file', blob, file.originalname || 'upload');
    form.append('api_key', this.apiKey!);
    form.append('timestamp', timestamp.toString());
    form.append('signature', this.getSignature(timestamp));
    if (this.folder) {
      form.append('folder', this.folder);
    }

    try {
      return await this.performUpload(form);
    } catch (error) {
      logger.warn('Falling back to local data URL due to file upload failure.');
      return this.toDataUrl(file);
    }
  }

  async uploadMany(images: string[]) {
    if (!images || images.length === 0) return [];
    return Promise.all(images.map(img => this.upload(img)));
  }

  async uploadManyFiles(files: UploadFileInput[]) {
    if (!files || files.length === 0) return [];
    return Promise.all(files.map(file => this.uploadFile(file)));
  }

  private toDataUrl(file: UploadFileInput) {
    const mime = file.mimetype || 'application/octet-stream';
    return `data:${mime};base64,${file.buffer.toString('base64')}`;
  }
}

