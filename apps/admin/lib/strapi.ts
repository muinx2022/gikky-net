import axios from 'axios';
import { getCookie } from 'cookies-next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:1337';

export const strapiApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

strapiApi.interceptors.request.use((config) => {
  const token = getCookie('token');
  const alreadyHasAuthHeader =
    typeof config.headers?.Authorization === 'string' &&
    config.headers.Authorization.length > 0;

  if (token && !alreadyHasAuthHeader) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
