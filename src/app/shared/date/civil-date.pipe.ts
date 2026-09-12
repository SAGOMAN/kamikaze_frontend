import { Pipe, PipeTransform } from '@angular/core';
import { formatCivilDate } from './format-timestamp';

@Pipe({
  name: 'civilDate',
})
export class CivilDatePipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined): string {
    return formatCivilDate(value);
  }
}
