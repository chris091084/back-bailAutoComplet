import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBase64,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class MailAttachmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename!: string;

  /** Contenu binaire encodé en base64, sans préfixe `data:`. */
  @IsBase64()
  contentBase64!: string;
}

export class SendMailDto {
  @IsEmail()
  to!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  text!: string;

  /**
   * Version mise en forme du corps du mail, éditée dans Quill côté front.
   * `text` reste le repli pour les clients mail qui ne rendent pas le HTML.
   */
  @IsOptional()
  @IsString()
  html?: string;

  // Douze : une année de quittances mensuelles, qui partent dans un seul mail.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => MailAttachmentDto)
  attachments?: MailAttachmentDto[];
}
