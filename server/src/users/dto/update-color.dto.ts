import { IsNotEmpty, Matches } from 'class-validator';

export class UpdateColorDto {
  @IsNotEmpty()
  @Matches(/^#([0-9A-F]{3}){1,2}$/i, { 
    message: 'Color must be a valid hex color code' 
  })
  color: string;
}
