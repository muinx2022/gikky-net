export function getStrapiURL(path = "") {
  return `${
    process.env.API_URL || "http://127.0.0.1:1337"
  }${path}`;
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
