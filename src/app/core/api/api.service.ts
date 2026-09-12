import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type ApiQueryValue = string | number | boolean | null | undefined | Array<string | number>;
export type ApiQueryParams = Record<string, ApiQueryValue>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  get<T>(path: string, query?: ApiQueryParams) {
    return this.http.get<T>(`${this.base}${path}`, { params: this.toParams(query) });
  }

  getBlob(path: string, query?: ApiQueryParams) {
    return this.http.get(`${this.base}${path}`, {
      params: this.toParams(query),
      responseType: 'blob',
      observe: 'response',
    });
  }

  post<T>(path: string, body: unknown) {
    return this.http.post<T>(`${this.base}${path}`, body);
  }

  put<T>(path: string, body: unknown) {
    return this.http.put<T>(`${this.base}${path}`, body);
  }

  delete<T>(path: string) {
    return this.http.delete<T>(`${this.base}${path}`);
  }

  private toParams(query?: ApiQueryParams): HttpParams {
    let params = new HttpParams();
    if (!query) {
      return params;
    }

    Object.entries(query).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => {
          params = params.append(`${key}[]`, String(item));
        });
        return;
      }
      params = params.set(key, String(value));
    });

    return params;
  }
}
