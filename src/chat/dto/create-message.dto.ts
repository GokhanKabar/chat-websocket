import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  content: string;

  @IsNotEmpty()
  @IsString()
  roomId: string;
}
