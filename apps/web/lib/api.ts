export function getStrapiURL(path = "") {
  return `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:1337"}${path}`;
}

export async function fetchAPI(
  path: string,
  urlParamsObject = {},
  options = {}
) {
  try {
    // Merge default and user options
    const mergedOptions = {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    };

    // Build request URL
    const queryString = new URLSearchParams(urlParamsObject).toString();
    const requestUrl = `${getStrapiURL(
      `/api${path}${queryString ? `?${queryString}` : ""}`
    )}`;

    // Trigger API call
    const response = await fetch(requestUrl, mergedOptions);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    throw new Error(`Please check if your Strapi server is running and you have set the correct API_URL environment variable.`);
  }
}

// Helper to build Strapi query string with deep nesting support
function buildQueryString(params: any, prefix = ''): string {
  const parts: string[] = [];

  Object.entries(params).forEach(([key, value]) => {
    const fullKey = prefix ? `${prefix}[${key}]` : key;

    if (value === null || value === undefined) {
      return;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      // Recursively handle nested objects
      const nested = buildQueryString(value, fullKey);
      if (nested) parts.push(nested);
    } else if (Array.isArray(value)) {
      // Handle arrays
      value.forEach((item) => {
        if (typeof item === 'object') {
          const nested = buildQueryString(item, fullKey);
          if (nested) parts.push(nested);
        } else {
          parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  });

  return parts.join('&');
}

// Create axios-like API instance
export const api = {
  get: async (url: string, config?: { params?: any; headers?: Record<string, string> }) => {
    const queryString = config?.params ? "?" + buildQueryString(config.params) : "";
    const fullUrl = getStrapiURL(`${url}${queryString}`);

    const response = await fetch(fullUrl, {
      headers: {
        "Content-Type": "application/json",
        ...config?.headers,
      },
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const error: any = new Error(`HTTP ${response.status}: ${data?.error?.message || response.statusText}`);
      error.response = { data };
      throw error;
    }

    return { data };
  },

  post: async (url: string, body: any, config?: { headers?: Record<string, string> }) => {
    const response = await fetch(getStrapiURL(url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...config?.headers,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const error: any = new Error(`HTTP ${response.status}: ${data?.error?.message || response.statusText}`);
      error.response = { data };
      throw error;
    }

    return { data };
  },

  put: async (url: string, body: any, config?: { headers?: Record<string, string> }) => {
    const response = await fetch(getStrapiURL(url), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...config?.headers,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const error: any = new Error(`HTTP ${response.status}: ${data?.error?.message || response.statusText}`);
      error.response = { data };
      throw error;
    }

    return { data };
  },

  delete: async (url: string, config?: { headers?: Record<string, string> }) => {
    const response = await fetch(getStrapiURL(url), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...config?.headers,
      },
    });

    // Check if response has content before parsing JSON
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const error: any = new Error(`HTTP ${response.status}: ${data?.error?.message || response.statusText}`);
      error.response = { data };
      throw error;
    }

    return { data };
  },
};
