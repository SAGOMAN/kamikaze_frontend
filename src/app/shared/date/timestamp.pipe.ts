import { Pipe, PipeTransform } from '@angular/core';
import { formatTimestamp } from './format-timestamp';

@Pipe({
  name: 'timestamp',
})
export class TimestampPipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined): string {
    return formatTimestamp(value);
  }
}
